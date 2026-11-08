// GitHub: the token that stores the secrets, the repository's Actions
// secrets, and storing secrets through `gh` over stdin.
import { envWithout, run } from './shell'

export const OWNER = 'rat-punchers'
export const REPO = 'shpd-seed-seeker'
const API = 'https://api.github.com'

export const CLASSIC_TOKEN_URL = `https://github.com/settings/tokens/new?description=${encodeURIComponent(
  `${REPO} deploy secrets`
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

export type SecretsAccess =
  /** The token can read the repository's Actions secrets. */
  | 'ok'
  /** The token sees the repository but lacks Secrets access. */
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
 * Reads `GET …/actions/secrets`. Once the repository is visible, a 403 or
 * 404 there means the token lacks Secrets access, not success.
 */
export function classifySecrets(status: number): SecretsAccess {
  if (status === 200) return 'ok'
  if (status === 403 || status === 404) return 'forbidden'
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

/** Access to the repository's Actions secrets, and the names already set. */
export async function probeSecrets(
  token: string,
  fetcher: typeof fetch = fetch
): Promise<{ access: SecretsAccess; secrets: string[] }> {
  const answer = await status(
    fetcher,
    `${API}/repos/${OWNER}/${REPO}/actions/secrets?per_page=100`,
    { headers: headers(token) }
  )
  const access = classifySecrets(answer.status)
  const list =
    (answer.body as { secrets?: { name: string }[] } | null)?.secrets ?? []
  return {
    access,
    secrets: access === 'ok' ? list.map((secret) => secret.name) : [],
  }
}

/** Stores one repository Actions secret with `gh secret set`, value on stdin. */
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
      '--app',
      'actions',
      '--repo',
      `${OWNER}/${REPO}`,
    ],
    { stdin: value, env: { ...envWithout(['GITHUB_TOKEN']), GH_TOKEN: token } }
  )
  return { ok: result.code === 0, message: result.stderr.trim() }
}
