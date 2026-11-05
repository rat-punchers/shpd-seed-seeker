// GitHub: the token that stores the secrets, the `web-v2` environment, and
// storing secrets through `gh` over stdin.
import { envWithout, run } from './shell'

export const OWNER = 'rat-punchers'
export const REPO = 'shpd-seed-seeker'
export const ENVIRONMENT = 'web-v2'
const API = 'https://api.github.com'

export const CLASSIC_TOKEN_URL = `https://github.com/settings/tokens/new?description=${encodeURIComponent(
  `${REPO} ${ENVIRONMENT} secrets`
)}&scopes=repo`
export const FINE_GRAINED_TOKEN_URL =
  'https://github.com/settings/personal-access-tokens/new'

/** A token from the environment or the `gh` login, with where it came from. */
export async function inferToken(
  env: Record<string, string | undefined> = process.env
): Promise<{ token: string; source: string } | undefined> {
  for (const name of ['GITHUB_TOKEN', 'GH_TOKEN']) {
    const token = env[name]?.trim()
    if (token) return { token, source: `$${name}` }
  }
  const result = await run(['gh', 'auth', 'token'])
  const token = result.stdout.trim()
  return result.code === 0 && token
    ? { token, source: 'gh auth token' }
    : undefined
}

export type RepoAccess = 'ok' | 'invalid' | 'no-repo' | 'error'

export type EnvironmentAccess =
  /** The environment exists and the token can read its secrets. */
  | 'ok'
  /** No such environment, or the token cannot see it: it must be created. */
  | 'missing'
  /** The environment exists but the token lacks Environments access. */
  | 'forbidden'
  | 'invalid'
  | 'error'

export function classifyRepo(status: number): RepoAccess {
  if (status === 200) return 'ok'
  if (status === 401) return 'invalid'
  if (status === 403 || status === 404) return 'no-repo'
  return 'error'
}

/**
 * Reads `GET …/environments/{name}/secrets`. A 404 means the environment
 * does not exist (or is hidden from the token), not success.
 */
export function classifyEnvironment(status: number): EnvironmentAccess {
  if (status === 200) return 'ok'
  if (status === 404) return 'missing'
  if (status === 403) return 'forbidden'
  if (status === 401) return 'invalid'
  return 'error'
}

function headers(token: string): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

async function status(fetcher: typeof fetch, url: string, init: RequestInit) {
  try {
    const response = await fetcher(url, init)
    return {
      status: response.status,
      body: await response.json().catch(() => null),
    }
  } catch {
    return { status: 0, body: null }
  }
}

export async function probeRepo(token: string, fetcher: typeof fetch = fetch) {
  const answer = await status(fetcher, `${API}/repos/${OWNER}/${REPO}`, {
    headers: headers(token),
  })
  return classifyRepo(answer.status)
}

/** The environment's access, and the names of the secrets it already holds. */
export async function probeEnvironment(
  token: string,
  fetcher: typeof fetch = fetch
): Promise<{ access: EnvironmentAccess; secrets: string[] }> {
  const answer = await status(
    fetcher,
    `${API}/repos/${OWNER}/${REPO}/environments/${ENVIRONMENT}/secrets`,
    { headers: headers(token) }
  )
  const access = classifyEnvironment(answer.status)
  const list =
    (answer.body as { secrets?: { name: string }[] } | null)?.secrets ?? []
  return {
    access,
    secrets: access === 'ok' ? list.map((secret) => secret.name) : [],
  }
}

/** Creates the environment. Needs repository Administration: write. */
export async function createEnvironment(
  token: string,
  fetcher: typeof fetch = fetch
): Promise<{ ok: boolean; status: number }> {
  const answer = await status(
    fetcher,
    `${API}/repos/${OWNER}/${REPO}/environments/${ENVIRONMENT}`,
    {
      method: 'PUT',
      headers: { ...headers(token), 'Content-Type': 'application/json' },
      body: '{}',
    }
  )
  return {
    ok: answer.status === 200 || answer.status === 201,
    status: answer.status,
  }
}

/** Stores one environment secret with `gh secret set`, the value on stdin. */
export async function storeSecret(
  token: string,
  name: string,
  value: string
): Promise<{ ok: boolean; message: string }> {
  const result = await run(
    [
      'gh',
      'secret',
      'set',
      name,
      '--env',
      ENVIRONMENT,
      '--repo',
      `${OWNER}/${REPO}`,
    ],
    { stdin: value, env: { ...envWithout(['GITHUB_TOKEN']), GH_TOKEN: token } }
  )
  return { ok: result.code === 0, message: result.stderr.trim() }
}
