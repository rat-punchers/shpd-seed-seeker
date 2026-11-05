import { describe, expect, it } from 'bun:test'
import {
  CLASSIC_TOKEN_URL,
  classifyEnvironment,
  classifyRepo,
  createEnvironment,
  probeEnvironment,
  probeRepo,
} from '../lib/github'

function mockFetch(
  answers: Record<string, { status: number; body?: unknown }>
) {
  const calls: { url: string; method: string; auth: string | null }[] = []
  const fetcher = (async (
    input: string | URL | Request,
    init?: RequestInit
  ) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    calls.push({
      url,
      method,
      auth: new Headers(init?.headers).get('Authorization'),
    })
    const answer = answers[
      `${method} ${url.replace('https://api.github.com', '')}`
    ] ?? {
      status: 404,
    }
    return new Response(
      JSON.stringify(answer.body ?? { message: 'Not Found' }),
      {
        status: answer.status,
      }
    )
  }) as typeof fetch
  return { fetcher, calls }
}

const SECRETS =
  'GET /repos/rat-punchers/shpd-seed-seeker/environments/web-v2/secrets'

describe('classification', () => {
  it('reads the repository probe', () => {
    expect(classifyRepo(200)).toBe('ok')
    expect(classifyRepo(401)).toBe('invalid')
    expect(classifyRepo(404)).toBe('no-repo')
    expect(classifyRepo(500)).toBe('error')
  })

  it('reads a 404 on the environment secrets as a missing environment, not success', () => {
    expect(classifyEnvironment(404)).toBe('missing')
    expect(classifyEnvironment(403)).toBe('forbidden')
    expect(classifyEnvironment(200)).toBe('ok')
  })
})

describe('probes', () => {
  it('checks the repository with the token', async () => {
    const { fetcher, calls } = mockFetch({
      'GET /repos/rat-punchers/shpd-seed-seeker': { status: 200, body: {} },
    })
    expect(await probeRepo('ghp_x', fetcher)).toBe('ok')
    expect(calls[0]?.auth).toBe('Bearer ghp_x')
  })

  it('lists the secrets already in the environment', async () => {
    const { fetcher } = mockFetch({
      [SECRETS]: {
        status: 200,
        body: { total_count: 1, secrets: [{ name: 'CLOUDFLARE_API_TOKEN' }] },
      },
    })
    expect(await probeEnvironment('t', fetcher)).toEqual({
      access: 'ok',
      secrets: ['CLOUDFLARE_API_TOKEN'],
    })
  })

  it('reports a missing environment with no secrets', async () => {
    const { fetcher } = mockFetch({})
    expect(await probeEnvironment('t', fetcher)).toEqual({
      access: 'missing',
      secrets: [],
    })
  })

  it('creates the environment with PUT', async () => {
    const { fetcher, calls } = mockFetch({
      'PUT /repos/rat-punchers/shpd-seed-seeker/environments/web-v2': {
        status: 200,
        body: {},
      },
    })
    expect(await createEnvironment('t', fetcher)).toEqual({
      ok: true,
      status: 200,
    })
    expect(calls[0]?.method).toBe('PUT')
  })

  it('reports a refused environment creation', async () => {
    const { fetcher } = mockFetch({
      'PUT /repos/rat-punchers/shpd-seed-seeker/environments/web-v2': {
        status: 403,
      },
    })
    expect(await createEnvironment('t', fetcher)).toEqual({
      ok: false,
      status: 403,
    })
  })
})

it('the classic token URL asks for the repo scope', () => {
  expect(new URL(CLASSIC_TOKEN_URL).searchParams.get('scopes')).toBe('repo')
})
