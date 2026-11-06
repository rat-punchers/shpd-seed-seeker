// The sidebar's seed field. The engine's `format_seed_code` groups the
// text; these helpers keep the caret where the user typed.
import { initEngine } from '../../engine/wasm'
import { AppStore } from '../../shared/store/persistent'

const SEED_CODE = /^[A-Z]{3}-[A-Z]{3}-[A-Z]{3}$/
const DAILY_DATE = /^\d{4}-\d{2}-\d{2}$/

/** True once the engine module is loaded, so formatting can run. */
export const $seedFormatterReady = new AppStore(false)

/** Loads the engine for the seed formatter; safe to call more than once. */
export function loadSeedFormatter(): Promise<void> {
  return initEngine().then(() => $seedFormatterReady.set(true))
}

/** A whole seed code (`ABC-DEF-GHI`) or daily date (`YYYY-MM-DD`). */
export function isCompleteSeedInput(value: string): boolean {
  return SEED_CODE.test(value) || DAILY_DATE.test(value)
}

/** Letters start a seed code and digits a daily date, as the formatter decides. */
function kindOf(raw: string): 'code' | 'daily' | undefined {
  const first = raw.match(/[A-Za-z0-9]/)?.[0]
  if (!first) return undefined
  return /[A-Za-z]/.test(first) ? 'code' : 'daily'
}

/** Characters that survive formatting, before the caret. */
export function significantCountBefore(raw: string, cursor: number): number {
  const before = raw.slice(0, Math.max(0, cursor))
  const kind = kindOf(raw)
  if (kind === 'code') return before.replace(/[^A-Za-z]/g, '').length
  if (kind === 'daily') return before.replace(/\D/g, '').length
  return 0
}

/** The caret offset in `formatted` just after its `count`-th significant character. */
export function caretAfterSignificant(
  formatted: string,
  count: number
): number {
  if (count <= 0) return 0
  let seen = 0
  for (let index = 0; index < formatted.length; index++) {
    if (formatted[index] === '-') continue
    seen += 1
    if (seen === count) return index + 1
  }
  return formatted.length
}
