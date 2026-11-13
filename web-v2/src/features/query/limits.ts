import type { QueryState, TierFilter, UpgradeFilter } from '../../engine/types'

// The query bounds below are local copies of the engine's own constants
// (`crates/seedfinder-core/src/engine_info.rs`). They stay local so the app
// never has to wait on the wasm module to render; `engine-constants.test.ts`
// asserts each of them against the engine's `engine_info` document instead.

/** Deepest floor a search may cover. */
export const MAX_DEPTH = 24

/** First-deck transmutations after all four catalyst offers have been consumed. */
export const TRINKET_TRANSMUTATION_MAX = 13

/** The last floor the Blacksmith's quest can sit on: a run whose floor limit
 * reaches it always meets him, so "require Blacksmith" only matters below it. */
export const BLACKSMITH_LAST_FLOOR = 14

/**
 * Boss floors that generate no searchable items. The core treats a floor
 * limit of 5/10/15 exactly like 4/9/14, so these are useless as bounds and
 * floor-limit selectors skip them. Floor 20 stays: the Imp shop makes the
 * City boss floor carry searchable stock.
 */
export const EMPTY_BOSS_FLOORS: readonly number[] = [5, 10, 15]

/** Floors offered by floor-limit selectors: 1 through `MAX_DEPTH` minus the empty boss floors. */
export const FLOOR_LIMIT_OPTIONS: readonly number[] = Array.from(
  { length: MAX_DEPTH },
  (_, index) => index + 1
).filter((floor) => !EMPTY_BOSS_FLOORS.includes(floor))

/** Snaps an empty boss-floor limit to the equivalent floor below it (5→4, 10→9, 15→14). */
export const normalizeFloorLimit = (value: number): number =>
  EMPTY_BOSS_FLOORS.includes(value) ? value - 1 : value

/**
 * The selector index of `value` within `options`; off-list values snap to
 * the nearest option below (or the first option). This is the snapping rule
 * every floor-limit slider uses.
 */
export const nearestOptionIndex = (
  options: readonly number[],
  value: number
): number => {
  const exact = options.indexOf(value)
  if (exact >= 0) return exact
  return options.reduce(
    (best, option, index) => (option <= value ? index : best),
    0
  )
}

export const defaultTier = (): TierFilter => ({ mode: 'any', value: 3 })
export const defaultUpgrade = (): UpgradeFilter => ({ mode: 'any', value: 1 })

export const defaultQueryState = (): QueryState => ({
  autoApplyTrinket: true,
  requirements: [],
  maxDepth: MAX_DEPTH,
  requireBlacksmith: false,
  excludeBlacksmithRewards: false,
  challenges: [],
})
