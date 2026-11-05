#!/usr/bin/env bun
// Guided setup of the web-v2 deploy credentials: finds what the local `gh`
// and `wrangler` logins know, verifies each value against the API that will
// consume it, and stores it in the GitHub `web-v2` environment.
//
// Run from the repository root: `bun run deploy:setup`.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { accountGroup, tokenGroup } from './lib/cloudflare-group'
import { ENVIRONMENT, OWNER, REPO, storeSecret } from './lib/github'
import { githubGroup } from './lib/github-group'
import { printSummary, type Result } from './lib/outcome'
import { releaseStdin } from './lib/prompt'
import { run } from './lib/shell'
import { withSpinner } from './lib/spinner'
import { bold, dim, heading, red, yellow } from './lib/style'

const WRANGLER = fileURLToPath(
  new URL('../../web-v2/node_modules/.bin/wrangler', import.meta.url)
)

async function preflight(): Promise<{ wrangler?: string[] }> {
  const gh = await withSpinner('Checking for gh', () =>
    run(['gh', '--version'])
  )
  if (gh.code !== 0) {
    console.log(
      `   ${red('gh is required to store the secrets: https://cli.github.com')}`
    )
    process.exit(1)
  }
  if (!existsSync(WRANGLER)) {
    console.log(
      `   ${yellow('wrangler is not installed (run bun install); the account id will be asked for.')}`
    )
    return {}
  }
  const wrangler = await withSpinner('Checking for wrangler', () =>
    run([WRANGLER, '--version'])
  )
  return wrangler.code === 0 ? { wrangler: [WRANGLER] } : {}
}

async function store(
  token: string,
  name: string,
  value: string,
  verified: boolean
): Promise<Result> {
  const saved = await withSpinner(`Storing ${name}`, () =>
    storeSecret(token, name, value)
  )
  if (!saved.ok) return { name, outcome: 'failed', note: saved.message }
  return { name, outcome: verified ? 'stored' : 'unverified' }
}

async function main(): Promise<void> {
  console.log(
    bold(
      `🔐 web-v2 deploy credentials → ${OWNER}/${REPO}, environment ${ENVIRONMENT}`
    )
  )
  console.log(
    dim('   Values are verified before they are stored. Press Ctrl-C to stop.')
  )

  heading(1, '🧰 Preflight')
  const { wrangler } = await preflight()

  heading(2, '🐙 GitHub access (required)')
  const github = await githubGroup()

  heading(3, '☁️  Cloudflare account (required)')
  const account = await accountGroup(
    wrangler,
    github.existing.includes('CLOUDFLARE_ACCOUNT_ID')
  )

  heading(4, '🔑 Cloudflare API token (required)')
  const token = await tokenGroup(
    account.accountId,
    github.existing.includes('CLOUDFLARE_API_TOKEN')
  )

  heading(5, '💾 Store')
  const results: Result[] = []
  const canStore = github.ready
  if (!canStore)
    console.log(
      `   ${red(`The ${ENVIRONMENT} environment is not writable; nothing is stored.`)}`
    )

  if (account.keep)
    results.push({ name: 'CLOUDFLARE_ACCOUNT_ID', outcome: 'kept' })
  else if (!account.accountId)
    results.push({ name: 'CLOUDFLARE_ACCOUNT_ID', outcome: 'skipped' })
  else if (!canStore)
    results.push({ name: 'CLOUDFLARE_ACCOUNT_ID', outcome: 'failed' })
  else {
    // The id is verified together with the token: the probes are scoped to it.
    const verified = token.kind === 'store' && token.verified
    results.push(
      await store(
        github.token,
        'CLOUDFLARE_ACCOUNT_ID',
        account.accountId,
        verified
      )
    )
  }

  if (token.kind === 'keep')
    results.push({ name: 'CLOUDFLARE_API_TOKEN', outcome: 'kept' })
  else if (token.kind === 'skip')
    results.push({ name: 'CLOUDFLARE_API_TOKEN', outcome: 'skipped' })
  else if (!canStore)
    results.push({ name: 'CLOUDFLARE_API_TOKEN', outcome: 'failed' })
  else
    results.push(
      await store(
        github.token,
        'CLOUDFLARE_API_TOKEN',
        token.token,
        token.verified
      )
    )

  printSummary(results)
}

try {
  await main()
} catch (error) {
  console.log(
    `\n${red(error instanceof Error ? error.message : String(error))}`
  )
  releaseStdin()
  process.exit(1)
}
releaseStdin()
