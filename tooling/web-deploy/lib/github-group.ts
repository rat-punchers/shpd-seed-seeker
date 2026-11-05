// The GitHub step: a token that can write the `web-v2` environment's
// secrets, and the environment itself.
import {
  CLASSIC_TOKEN_URL,
  createEnvironment,
  ENVIRONMENT,
  FINE_GRAINED_TOKEN_URL,
  inferToken,
  OWNER,
  probeEnvironment,
  probeRepo,
  REPO,
} from './github'
import { askSecret, confirm } from './prompt'
import { openUrl } from './shell'
import { withSpinner } from './spinner'
import { type Brief, bold, green, printBrief, red, yellow } from './style'

export const GITHUB_BRIEF: Brief = {
  usedFor: `Writing the deploy secrets into the ${ENVIRONMENT} environment of ${OWNER}/${REPO}. It is used on this machine only and is not stored.`,
  needs: [
    {
      name: 'Classic PAT `repo` scope, or fine-grained Environments: write on this repository',
      why: 'reads and writes the environment secrets',
    },
    {
      name: 'Administration: write (only if the environment does not exist yet)',
      why: `creates the ${ENVIRONMENT} environment; Environments access alone cannot`,
    },
  ],
  inferHint:
    'The gh login often lacks the repo scope, or for fine-grained tokens, Environments access to this repository.',
}

export interface GithubAccess {
  token: string
  /** Secret names already in the environment, when it could be read. */
  existing: string[]
  ready: boolean
}

async function offerUrls(): Promise<void> {
  const links = [
    { label: '🎫 Classic PAT', hint: 'scope repo', url: CLASSIC_TOKEN_URL },
    {
      label: '🔑 Fine-grained',
      hint: `this repository, Environments: write (and Administration: write to create ${ENVIRONMENT})`,
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

/** Finds a token that reaches the environment, creating it when allowed. */
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
      let environment = await withSpinner(
        `Checking the ${ENVIRONMENT} environment`,
        () => probeEnvironment(token)
      )
      if (environment.access === 'missing') {
        console.log(
          `   ${yellow(`The ${ENVIRONMENT} environment does not exist, or this token cannot see it.`)}`
        )
        if (
          await confirm(
            `Create ${ENVIRONMENT} now? (needs Administration: write)`
          )
        ) {
          const created = await withSpinner(`Creating ${ENVIRONMENT}`, () =>
            createEnvironment(token)
          )
          if (created.ok) {
            environment = await probeEnvironment(token)
          } else {
            console.log(
              `   ${red(`GitHub answered ${created.status}.`)} A repository admin must create it.`
            )
          }
        }
      }
      if (environment.access === 'ok') {
        console.log(`   ${green('✓')} Environment ${ENVIRONMENT} is writable`)
        return { token, existing: environment.secrets, ready: true }
      }
      if (environment.access === 'forbidden') {
        console.log(
          `   ${red('The token cannot read the environment secrets (needs Environments: write).')}`
        )
      }
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
