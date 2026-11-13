// The Cloudflare step: the account id (public) and the deploy API token
// (secret), each verified before it is stored.
import {
  allPassed,
  type Check,
  tokenTemplateUrl,
  verifyToken,
  WORKER,
  type WranglerAccount,
  wranglerAccounts,
  ZONE,
} from './cloudflare'
import { ask, askSecret, confirm } from './prompt'
import { openUrl } from './shell'
import { withSpinner } from './spinner'
import { type Brief, bold, dim, green, printBrief, red } from './style'

export const ACCOUNT_BRIEF: Brief = {
  usedFor: `CLOUDFLARE_ACCOUNT_ID: the account wrangler deploys the ${WORKER} Worker to.`,
  needs: [
    {
      name: `The account that owns the ${ZONE} zone`,
      why: 'the custom domain lives there',
    },
  ],
}

export const TOKEN_BRIEF: Brief = {
  usedFor: `CLOUDFLARE_API_TOKEN: wrangler deploy of ${WORKER} on seedseeker.${ZONE} from CI.`,
  needs: [
    {
      name: 'Account · Workers Scripts: Edit',
      why: 'uploads the Worker and its assets, attaches the custom domain',
    },
    {
      name: `Zone · Zone: Read (${ZONE})`,
      why: 'wrangler finds the zone of the custom domain',
    },
    {
      name: `Zone · DNS: Edit (${ZONE})`,
      why: 'Cloudflare writes the hostname record',
    },
    {
      name: `Zone · Workers Routes: Edit (${ZONE})`,
      why: 'the custom domain is a Worker route',
    },
  ],
  inferHint:
    'A wrangler OAuth login is not an API token and is never offered here. An existing $CLOUDFLARE_API_TOKEN may be scoped for another deploy.',
}

/** Picks the account id: kept, inferred from wrangler, or typed. */
export async function accountGroup(
  wrangler: string[] | undefined,
  alreadySet: boolean
): Promise<{ accountId: string; keep: boolean }> {
  printBrief(ACCOUNT_BRIEF)
  const accounts: WranglerAccount[] = wrangler
    ? await withSpinner('Reading the wrangler login', () =>
        wranglerAccounts(wrangler)
      )
    : []
  const inferred = await chooseAccount(accounts)
  if (
    alreadySet &&
    !(await confirm('CLOUDFLARE_ACCOUNT_ID is already set. Re-enter it?'))
  ) {
    // GitHub never reveals a stored secret; the token check still needs the id.
    const accountId =
      inferred ?? (await ask('Account id to verify the token against:'))
    return { accountId, keep: true }
  }
  if (inferred) return { accountId: inferred, keep: false }
  return { accountId: await ask('Cloudflare account id:'), keep: false }
}

async function chooseAccount(
  accounts: WranglerAccount[]
): Promise<string | undefined> {
  if (accounts.length === 0) return undefined
  if (accounts.length === 1) {
    const [account] = accounts as [WranglerAccount]
    return (await confirm(
      `Use the account ${bold(account.name)} (${account.id})?`,
      true
    ))
      ? account.id
      : undefined
  }
  accounts.forEach((account, index) => {
    console.log(`   ${index + 1}. ${account.name} ${dim(account.id)}`)
  })
  const answer = Number(await ask('Account number (Enter to type an id):'))
  return accounts[answer - 1]?.id
}

function printChecks(checks: Check[]): void {
  for (const check of checks) {
    const mark = check.probe.status === 'ok' ? green('✓') : red('✗')
    const detail =
      check.probe.status === 'ok'
        ? ''
        : ` ${dim(`${check.probe.status}: ${check.probe.message}`)}`
    console.log(`     ${mark} ${check.name}${detail}`)
  }
}

async function enterToken(): Promise<string> {
  const links = [
    {
      label: '🏢 Account-owned',
      hint: 'preferred for CI; needs account admin',
      url: tokenTemplateUrl('account'),
    },
    {
      label: '👤 User-owned',
      hint: 'fallback; tied to your user',
      url: tokenTemplateUrl('user'),
    },
  ]
  for (const link of links)
    console.log(`   ${link.label} (${link.hint}):\n     ${link.url}`)
  console.log(`   ${dim(`Limit the zone permissions to ${ZONE}.`)}`)
  for (const link of links) {
    if (await confirm(`Open ${link.label} in the browser?`))
      await openUrl(link.url)
  }
  return askSecret('Cloudflare API token:')
}

export type TokenChoice =
  | { kind: 'keep' }
  | { kind: 'skip' }
  | { kind: 'store'; token: string; verified: boolean }

/** Gets a deploy token and checks it against the API the deploy uses. */
export async function tokenGroup(
  accountId: string,
  alreadySet: boolean,
  local: { path: string; token?: string }
): Promise<TokenChoice> {
  printBrief(TOKEN_BRIEF)
  if (alreadySet) {
    const reenter = local.token
      ? await confirm('CLOUDFLARE_API_TOKEN is already set. Re-enter it?')
      : await confirm(
          `CLOUDFLARE_API_TOKEN is set on GitHub but not in ${local.path}. Re-enter it to deploy manually?`,
          true
        )
    if (!reenter) return { kind: 'keep' }
  }
  const candidates = [
    {
      source: '$CLOUDFLARE_API_TOKEN',
      token: process.env.CLOUDFLARE_API_TOKEN?.trim(),
    },
    { source: local.path, token: local.token?.trim() },
  ]
  let token: string | undefined
  for (const candidate of candidates) {
    if (
      candidate.token &&
      (await confirm(`Use the token in ${bold(candidate.source)}?`))
    ) {
      token = candidate.token
      break
    }
  }
  token ??= await enterToken()
  for (;;) {
    if (!token) return { kind: 'skip' }
    if (!accountId) return { kind: 'store', token, verified: false }
    const current = token
    const checks = await withSpinner('Verifying the token', () =>
      verifyToken(current, accountId)
    )
    printChecks(checks)
    if (allPassed(checks)) return { kind: 'store', token, verified: true }
    if (!(await confirm('Try another token?', true))) {
      return { kind: 'store', token, verified: false }
    }
    token = await enterToken()
  }
}
