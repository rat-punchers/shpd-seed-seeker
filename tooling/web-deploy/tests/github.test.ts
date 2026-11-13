import { describe, expect, it } from 'bun:test'
import {
  CLASSIC_TOKEN_URL,
  classifyRepo,
  classifySecrets,
  probeRepo,
  probeSecrets,
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
  'GET /repos/rat-punchers/shpd-seed-seeker/actions/secrets?per_page=100'

describe('classification', () => {
  it('reads the repository probe', () => {
    expect(classifyRepo(200)).toBe('ok')
    expect(classifyRepo(401)).toBe('invalid')
    expect(classifyRepo(404)).toBe('no-repo')
    expect(classifyRepo(500)).toBe('error')
  })

  it('reads a 403 or 404 on the repository secrets as no access, not success', () => {
    expect(classifySecrets(404)).toBe('forbidden')
    expect(classifySecrets(403)).toBe('forbidden')
    expect(classifySecrets(401)).toBe('invalid')
    expect(classifySecrets(200)).toBe('ok')
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

  it('lists the secrets already in the repository', async () => {
    const { fetcher } = mockFetch({
      [SECRETS]: {
        status: 200,
        body: { total_count: 1, secrets: [{ name: 'CLOUDFLARE_API_TOKEN' }] },
      },
    })
    expect(await probeSecrets('t', fetcher)).toEqual({
      access: 'ok',
      secrets: ['CLOUDFLARE_API_TOKEN'],
    })
  })

  it('reports unreadable secrets with no names', async () => {
    const { fetcher } = mockFetch({})
    expect(await probeSecrets('t', fetcher)).toEqual({
      access: 'forbidden',
      secrets: [],
    })
  })
})

it('the classic token URL asks for the repo scope', () => {
  expect(new URL(CLASSIC_TOKEN_URL).searchParams.get('scopes')).toBe('repo')
})
