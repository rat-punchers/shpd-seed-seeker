// Cloudflare: the deploy token's template URLs, the account id from
// wrangler, and capability probes against the endpoints the deploy uses.
import { envWithout, run } from './shell'

export const API = 'https://api.cloudflare.com/client/v4'
export const ZONE = 'nerdcoder.xyz'
export const WORKER = 'shpd-seed-seeker-v2'
export const TOKEN_NAME = 'shpd-seed-seeker-v2 deploy'

/** A permission group as the dashboard's template URL names it. */
export interface PermissionKey {
  key: string
  type: 'read' | 'edit'
}

/**
 * What `wrangler deploy` of an asset-only Worker on a custom domain needs.
 * Attaching the domain is Workers Scripts Write (Cloudflare's "Attach Worker
 * Domain" API); wrangler also looks the zone up by name, and Cloudflare
 * writes the hostname's DNS record and Worker route in that zone.
 */
export const PERMISSIONS: PermissionKey[] = [
  { key: 'workers_scripts', type: 'edit' },
  { key: 'zone', type: 'read' },
  { key: 'dns', type: 'edit' },
  { key: 'workers_routes', type: 'edit' },
]

export type TokenOwner = 'account' | 'user'

/** The dashboard URL that pre-fills a token with `permissions`. */
export function tokenTemplateUrl(
  owner: TokenOwner,
  permissions: PermissionKey[] = PERMISSIONS,
  name = TOKEN_NAME
): string {
  const keys = encodeURIComponent(JSON.stringify(permissions))
  const label = encodeURIComponent(name)
  if (owner === 'account') {
    return `https://dash.cloudflare.com/?to=/:account/api-tokens&permissionGroupKeys=${keys}&name=${label}`
  }
  return `https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=${keys}&accountId=*&zoneId=all&name=${label}`
}

export interface WranglerAccount {
  id: string
  name: string
}

/**
 * Accounts of the local wrangler login. `CLOUDFLARE_API_TOKEN` is stripped
 * so wrangler reports its own login rather than the token in the env.
 */
export async function wranglerAccounts(
  wrangler: string[]
): Promise<WranglerAccount[]> {
  const result = await run([...wrangler, 'whoami', '--json'], {
    env: envWithout(['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']),
  })
  if (result.code !== 0) return []
  return parseWhoami(result.stdout)
}

export function parseWhoami(stdout: string): WranglerAccount[] {
  try {
    const start = stdout.indexOf('{')
    const data = JSON.parse(stdout.slice(start)) as {
      accounts?: { id?: string; name?: string }[]
    }
    return (data.accounts ?? [])
      .filter((account): account is WranglerAccount => !!account.id)
      .map(({ id, name }) => ({ id, name: name ?? id }))
  } catch {
    return []
  }
}

export type ProbeStatus =
  | 'ok'
  | 'malformed'
  | 'invalid'
  | 'forbidden'
  | 'missing'
  | 'error'

export interface Probe {
  status: ProbeStatus
  message: string
}

interface Envelope {
  success?: boolean
  errors?: { code: number; message: string }[]
  result?: unknown
}

/**
 * Classifies one Cloudflare API answer. `6003`/`6111` mean the header is not
 * a token at all (a bad paste); `1000` means a well-formed token Cloudflare
 * does not know; 401/403 otherwise mean it lacks the permission.
 */
export function classifyCloudflare(
  status: number,
  body: Envelope | null
): Probe {
  const errors = body?.errors ?? []
  const codes = errors.map((error) => error.code)
  const message = errors
    .map((error) => `${error.code} ${error.message}`)
    .join('; ')
  if (status >= 200 && status < 300 && body?.success !== false) {
    return { status: 'ok', message: '' }
  }
  if (codes.includes(6003) || codes.includes(6111)) {
    return {
      status: 'malformed',
      message: message || 'Invalid Authorization header',
    }
  }
  if (codes.includes(1000))
    return { status: 'invalid', message: message || 'Invalid API Token' }
  if (status === 401 || status === 403) {
    return { status: 'forbidden', message: message || `HTTP ${status}` }
  }
  if (status === 404)
    return { status: 'missing', message: message || 'Not found' }
  return { status: 'error', message: message || `HTTP ${status}` }
}

async function probe(
  fetcher: typeof fetch,
  token: string,
  path: string
): Promise<{ probe: Probe; result: unknown }> {
  try {
    const response = await fetcher(`${API}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = (await response.json().catch(() => null)) as Envelope | null
    return {
      probe: classifyCloudflare(response.status, body),
      result: body?.result,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { probe: { status: 'error', message }, result: undefined }
  }
}

export interface Check {
  name: string
  probe: Probe
}

/**
 * Probes what the deploy does with the token: list the account's Workers,
 * find the zone by name, and read its DNS records and Worker routes. Stops
 * at the zone when the token cannot see it.
 */
export async function verifyToken(
  token: string,
  accountId: string,
  fetcher: typeof fetch = fetch
): Promise<Check[]> {
  const checks: Check[] = []
  const scripts = await probe(
    fetcher,
    token,
    `/accounts/${accountId}/workers/scripts`
  )
  checks.push({ name: 'Workers Scripts (account)', probe: scripts.probe })
  if (
    scripts.probe.status === 'malformed' ||
    scripts.probe.status === 'invalid'
  ) {
    return checks
  }
  const zones = await probe(
    fetcher,
    token,
    `/zones?name=${encodeURIComponent(ZONE)}`
  )
  const zone = Array.isArray(zones.result)
    ? (zones.result[0] as { id?: string })
    : undefined
  if (zones.probe.status === 'ok' && !zone?.id) {
    checks.push({
      name: `Zone Read (${ZONE})`,
      probe: {
        status: 'forbidden',
        message: `The token cannot see the zone ${ZONE}`,
      },
    })
    return checks
  }
  checks.push({ name: `Zone Read (${ZONE})`, probe: zones.probe })
  if (!zone?.id) return checks
  const dns = await probe(
    fetcher,
    token,
    `/zones/${zone.id}/dns_records?per_page=1`
  )
  checks.push({ name: `DNS (${ZONE})`, probe: dns.probe })
  const routes = await probe(fetcher, token, `/zones/${zone.id}/workers/routes`)
  checks.push({ name: `Workers Routes (${ZONE})`, probe: routes.probe })
  return checks
}

export const allPassed = (checks: Check[]): boolean =>
  checks.length > 0 && checks.every((check) => check.probe.status === 'ok')
