/**
 * Walking Find's results from Analyze: J (next) and K (previous) on a
 * keyboard, horizontal swipes on touch. Only a tab showing a search result
 * navigates; it is replaced in place by the neighbouring result.
 */
import { $mode } from '../../app/store/mode'
import { searchStore } from '../search/store'
import { $activeSeedId, findSession, replaceActiveSeed } from './sessions'

export interface ResultPosition {
  /** 0-based index of the seed in the results. */
  index: number
  total: number
}

/** Where `seed` sits in the results, or undefined when it is not one. */
export function resultPosition(
  seeds: readonly string[],
  seed: string | undefined
): ResultPosition | undefined {
  if (!seed) return undefined
  const index = seeds.indexOf(seed)
  return index >= 0 ? { index, total: seeds.length } : undefined
}

/**
 * The seed `delta` steps from `seed`, clamped to the ends; undefined when
 * `seed` is not a result or the step would not move.
 */
export function stepResult(
  seeds: readonly string[],
  seed: string | undefined,
  delta: number
): string | undefined {
  const position = resultPosition(seeds, seed)
  if (!position) return undefined
  const target = Math.min(Math.max(position.index + delta, 0), seeds.length - 1)
  return target === position.index ? undefined : seeds[target]
}

/** The active tab's seed code: the report's canonical code once it has one. */
export function activeSeedCode(): string | undefined {
  const session = findSession($activeSeedId.get())
  return session?.report?.seed.code ?? session?.seed
}

export function resultSeeds(): string[] {
  return searchStore.state.matches.map((match) => match.code)
}

/** Opens the result `delta` steps away in the active tab; false when none. */
export function stepActiveResult(delta: number): boolean {
  const next = stepResult(resultSeeds(), activeSeedCode(), delta)
  if (!next) return false
  const match = searchStore.state.matches.find((entry) => entry.code === next)
  const query = searchStore.state.query
  const trinket =
    match?.selectedTrinket === null ? 'none' : match?.selectedTrinket
  void replaceActiveSeed({
    seed: next,
    ...(query ? { query } : {}),
    ...(query?.challenges?.length ? { challenges: query.challenges } : {}),
    ...(trinket ? { trinket } : {}),
  })
  return true
}

/** A swipe's step: left is the next result, right the previous, else 0. */
export function swipeDelta(
  start: { x: number; y: number },
  end: { x: number; y: number }
): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (Math.abs(dx) < 60 || Math.abs(dx) < 1.5 * Math.abs(dy)) return 0
  return dx < 0 ? 1 : -1
}

function keyDelta(event: KeyboardEvent): number {
  const key = event.key.toLowerCase()
  if (key === 'j' || event.code === 'KeyJ') return 1
  if (key === 'k' || event.code === 'KeyK') return -1
  return 0
}

function typingOrModal(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null
  if (
    target &&
    (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
      target.isContentEditable)
  )
    return true
  return document.querySelector('dialog[open], [role="dialog"]') !== null
}

/** The active tab is still loading, so a held key waits for it. */
function busy(): boolean {
  const status = findSession($activeSeedId.get())?.status
  return status === 'loading' || status === 'pending'
}

const HOLD_DELAY_MS = 300
const HOLD_INTERVAL_MS = 70

/**
 * Installs J/K. Holding a key keeps stepping on its own clock, one step per
 * finished report, instead of the OS repeat rate. Returns the cleanup.
 */
export function initResultKeys(): () => void {
  let holdDelta = 0
  let frame: number | undefined
  let dueAt = 0

  const stopHold = () => {
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
    holdDelta = 0
  }
  const step = (now: number) => {
    frame = requestAnimationFrame(step)
    if (now < dueAt || busy()) return
    if (!stepActiveResult(holdDelta)) return stopHold()
    dueAt = now + HOLD_INTERVAL_MS
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return
    const delta = keyDelta(event)
    if (delta === 0 || $mode.get() !== 'analyze' || typingOrModal(event)) return
    if (!stepActiveResult(delta)) return
    event.preventDefault()
    stopHold()
    holdDelta = delta
    dueAt = performance.now() + HOLD_DELAY_MS
    frame = requestAnimationFrame(step)
  }
  const onKeyUp = (event: KeyboardEvent) => {
    if (keyDelta(event) !== 0) stopHold()
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  // A key released while the page is unfocused never reports a keyup.
  window.addEventListener('blur', stopHold)
  return () => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', stopHold)
    stopHold()
  }
}
