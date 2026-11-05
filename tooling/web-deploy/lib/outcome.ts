// What happened to each value, for the closing summary.
import { bold, dim, green, red, yellow } from './style'

export type Outcome =
  /** Verified, then stored. */
  | 'stored'
  /** Stored although verification failed or could not run. */
  | 'unverified'
  /** Already set in the store; left as it was. */
  | 'kept'
  /** No value was entered. */
  | 'skipped'
  /** Writing to the store failed. */
  | 'failed'

export interface Result {
  name: string
  outcome: Outcome
  note?: string
}

const LABELS: Record<Outcome, string> = {
  stored: green('✅ stored'),
  unverified: yellow('⚠️  stored, unverified'),
  kept: dim('↺  kept'),
  skipped: dim('⏭️  skipped'),
  failed: red('❌ not stored'),
}

export function printSummary(results: Result[]): void {
  console.log(`\n${bold('Summary')}`)
  for (const result of results) {
    const note = result.note ? dim(` (${result.note})`) : ''
    console.log(`   ${LABELS[result.outcome]}  ${bold(result.name)}${note}`)
  }
}
