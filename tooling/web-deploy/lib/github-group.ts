// The GitHub step: a token that can write the repository's Actions secrets.
import {
  CLASSIC_TOKEN_URL,
  FINE_GRAINED_TOKEN_URL,
  inferToken,
  OWNER,
  probeRepo,
  probeSecrets,
  REPO,
} from './github'
import { askSecret, confirm } from './prompt'
import { openUrl } from './shell'
import { withSpinner } from './spinner'
import { type Brief, bold, green, printBrief, red } from './style'

export const GITHUB_BRIEF: Brief = {
  usedFor: `Writing the deploy secrets into the Actions secrets of ${OWNER}/${REPO}. It is used on this machine only and is not stored.`,
  needs: [
    {
      name: 'Classic PAT `repo` scope, or fine-grained Secrets: write on this repository',
      why: 'reads and writes the repository secrets',
    },
  ],
  inferHint:
    'The gh login often lacks the repo scope, or for fine-grained tokens, Secrets access to this repository.',
}

export interface GithubAccess {
  token: string
  /** Secret names already in the repository, when they could be read. */
  existing: string[]
  ready: boolean
}

async function offerUrls(): Promise<void> {
  const links = [
    { label: '🎫 Classic PAT', hint: 'scope repo', url: CLASSIC_TOKEN_URL },
    {
      label: '🔑 Fine-grained',
      hint: 'this repository, Secrets: write',
      url: FINE_GRAINED_TOKEN_URL,
    },
  ]
  for (const link of links)
    console.log(`   ${link.label} (${link.hint}): ${link.url}`)
  for (const link of links) {
    if (await confirm(`Open ${link.label} in the browser?`))
      await openUrl(link.url)
  }
}

async function enterToken(): Promise<string> {
  await offerUrls()
  return askSecret('GitHub token:')
}

/** Finds a token that can read and write the repository's secrets. */
export async function githubGroup(): Promise<GithubAccess> {
  printBrief(GITHUB_BRIEF)
  const inferred = await withSpinner('Looking for a local GitHub token', () =>
    inferToken()
  )
  let token =
    inferred &&
    (await confirm(`Use the token from ${bold(inferred.source)}?`, true))
      ? inferred.token
      : await enterToken()

  for (;;) {
    const repo = await withSpinner(`Checking access to ${OWNER}/${REPO}`, () =>
      probeRepo(token)
    )
    if (repo === 'ok') {
      const secrets = await withSpinner('Checking the repository secrets', () =>
        probeSecrets(token)
      )
      if (secrets.access === 'ok') {
        console.log(`   ${green('✓')} Repository secrets are writable`)
        return { token, existing: secrets.secrets, ready: true }
      }
      console.log(
        `   ${red(
          secrets.access === 'forbidden'
            ? 'The token cannot read the repository secrets (needs Secrets: write).'
            : 'GitHub could not list the repository secrets.'
        )}`
      )
    } else {
      const reason =
        repo === 'invalid'
          ? 'GitHub rejected the token.'
          : repo === 'no-repo'
            ? `The token cannot see ${OWNER}/${REPO}.`
            : 'GitHub could not be reached.'
      console.log(`   ${red(reason)}`)
    }
    if (!(await confirm('Try another GitHub token?', true))) {
      return { token, existing: [], ready: false }
    }
    token = await enterToken()
  }
}
