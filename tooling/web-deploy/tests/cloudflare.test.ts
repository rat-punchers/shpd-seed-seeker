import { describe, expect, it } from 'bun:test'
import {
  allPassed,
  classifyCloudflare,
  PERMISSIONS,
  parseWhoami,
  tokenTemplateUrl,
  verifyToken,
} from '../lib/cloudflare'

type Route = { status: number; body: unknown }

/** A fetch that answers by path and records each request. */
function mockFetch(routes: Record<string, Route>) {
  const calls: { url: string; auth: string | null }[] = []
  const fetcher = (async (
    input: string | URL | Request,
    init?: RequestInit
  ) => {
    const url = String(input)
    calls.push({ url, auth: new Headers(init?.headers).get('Authorization') })
    const path = url.replace('https://api.cloudflare.com/client/v4', '')
    const route = routes[path] ?? {
      status: 404,
      body: { success: false, errors: [] },
    }
    return new Response(JSON.stringify(route.body), { status: route.status })
  }) as typeof fetch
  return { fetcher, calls }
}

const ok = (result: unknown): Route => ({
  status: 200,
  body: { success: true, errors: [], result },
})
const ZONE_ROUTES = {
  '/accounts/acc/workers/scripts': ok([]),
  '/zones?name=nerdcoder.xyz': ok([{ id: 'zone1', name: 'nerdcoder.xyz' }]),
  '/zones/zone1/dns_records?per_page=1': ok([]),
  '/zones/zone1/workers/routes': ok([]),
}

describe('token template URLs', () => {
  it('pre-fill the deploy permissions for an account-owned token', () => {
    const url = new URL(tokenTemplateUrl('account'))
    expect(`${url.origin}${url.pathname}`).toBe('https://dash.cloudflare.com/')
    expect(url.searchParams.get('to')).toBe('/:account/api-tokens')
    expect(
      JSON.parse(url.searchParams.get('permissionGroupKeys') ?? '')
    ).toEqual([
      { key: 'workers_scripts', type: 'edit' },
      { key: 'zone', type: 'read' },
      { key: 'dns', type: 'edit' },
      { key: 'workers_routes', type: 'edit' },
    ])
    expect(url.searchParams.get('name')).toBe('shpd-seed-seeker-v2 deploy')
    expect(url.searchParams.has('accountId')).toBe(false)
  })

  it('scope a user-owned token to every account and zone', () => {
    const url = new URL(tokenTemplateUrl('user'))
    expect(url.pathname).toBe('/profile/api-tokens')
    expect(url.searchParams.get('accountId')).toBe('*')
    expect(url.searchParams.get('zoneId')).toBe('all')
    expect(
      JSON.parse(url.searchParams.get('permissionGroupKeys') ?? '')
    ).toEqual(PERMISSIONS)
  })

  it('encode the permission JSON as one parameter', () => {
    const url = tokenTemplateUrl(
      'account',
      [{ key: 'dns', type: 'edit' }],
      'A&B'
    )
    expect(url).toContain(
      'permissionGroupKeys=%5B%7B%22key%22%3A%22dns%22%2C%22type%22%3A%22edit%22%7D%5D'
    )
    expect(url).toEndWith('&name=A%26B')
  })
})

describe('probe classification', () => {
  it('accepts a successful envelope', () => {
    expect(classifyCloudflare(200, { success: true, errors: [] }).status).toBe(
      'ok'
    )
  })

  it('reads 6003 and 6111 as a malformed header, not an unknown token', () => {
    const body = {
      success: false,
      errors: [{ code: 6003, message: 'Invalid request headers' }],
    }
    expect(classifyCloudflare(400, body).status).toBe('malformed')
    const other = {
      success: false,
      errors: [
        { code: 6111, message: 'Invalid format for Authorization header' },
      ],
    }
    expect(classifyCloudflare(400, other).status).toBe('malformed')
  })

  it('reads 1000 as an invalid token', () => {
    const body = {
      success: false,
      errors: [{ code: 1000, message: 'Invalid API Token' }],
    }
    expect(classifyCloudflare(401, body)).toEqual({
      status: 'invalid',
      message: '1000 Invalid API Token',
    })
  })

  it('reads other 401 and 403 answers as a missing permission', () => {
    const body = {
      success: false,
      errors: [{ code: 10000, message: 'Authentication error' }],
    }
    expect(classifyCloudflare(403, body).status).toBe('forbidden')
    expect(classifyCloudflare(401, null).status).toBe('forbidden')
  })

  it('reports other failures as errors', () => {
    expect(classifyCloudflare(500, null)).toEqual({
      status: 'error',
      message: 'HTTP 500',
    })
  })
})

describe('verifyToken', () => {
  it('passes a token that reaches every endpoint, sending it as a bearer token', async () => {
    const { fetcher, calls } = mockFetch(ZONE_ROUTES)
    const checks = await verifyToken('tok', 'acc', fetcher)
    expect(checks.map((check) => check.probe.status)).toEqual([
      'ok',
      'ok',
      'ok',
      'ok',
    ])
    expect(allPassed(checks)).toBe(true)
    expect(calls.every((call) => call.auth === 'Bearer tok')).toBe(true)
  })

  it('stops after the first probe for a malformed token', async () => {
    const { fetcher, calls } = mockFetch({
      '/accounts/acc/workers/scripts': {
        status: 400,
        body: {
          success: false,
          errors: [{ code: 6003, message: 'Invalid request headers' }],
        },
      },
    })
    const checks = await verifyToken('bad token', 'acc', fetcher)
    expect(checks).toHaveLength(1)
    expect(checks[0]?.probe.status).toBe('malformed')
    expect(calls).toHaveLength(1)
    expect(allPassed(checks)).toBe(false)
  })

  it('fails when the token cannot see the zone', async () => {
    const { fetcher } = mockFetch({
      ...ZONE_ROUTES,
      '/zones?name=nerdcoder.xyz': ok([]),
    })
    const checks = await verifyToken('tok', 'acc', fetcher)
    expect(checks.map((check) => check.probe.status)).toEqual([
      'ok',
      'forbidden',
    ])
  })

  it('fails a token without zone route access', async () => {
    const { fetcher } = mockFetch({
      ...ZONE_ROUTES,
      '/zones/zone1/workers/routes': {
        status: 403,
        body: {
          success: false,
          errors: [{ code: 10000, message: 'Authentication error' }],
        },
      },
    })
    const checks = await verifyToken('tok', 'acc', fetcher)
    expect(checks.at(-1)?.probe.status).toBe('forbidden')
    expect(allPassed(checks)).toBe(false)
  })

  it('reports a network failure as an error', async () => {
    const fetcher = (async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    const checks = await verifyToken('tok', 'acc', fetcher)
    expect(checks[0]?.probe).toEqual({ status: 'error', message: 'offline' })
  })
})

describe('parseWhoami', () => {
  it('reads accounts after any banner text', () => {
    const out =
      'Getting User settings...\n{"loggedIn":true,"accounts":[{"id":"a1","name":"Main"}]}'
    expect(parseWhoami(out)).toEqual([{ id: 'a1', name: 'Main' }])
  })

  it('answers no accounts for unreadable output', () => {
    expect(parseWhoami('You are not authenticated.')).toEqual([])
  })
})
