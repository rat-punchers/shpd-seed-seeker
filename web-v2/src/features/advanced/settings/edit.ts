import { $query } from '../../../app/store/query'
import type { ChallengeName, QueryState } from '../../../engine/types'
import { toggleFarmingFloor } from '../../../shared/game/floor-requirements'

/** Writes `patch` over the saved query. */
export function patchQuery(patch: Partial<QueryState>): void {
  $query.set({ ...$query.get(), ...patch })
}

/** Turns one challenge on or off, keeping the others in their order. */
export function toggleChallenge(name: ChallengeName): void {
  const { challenges } = $query.get()
  patchQuery({
    challenges: challenges.includes(name)
      ? challenges.filter((value) => value !== name)
      : [...challenges, name],
  })
}

/** Adds or removes a Ring of Wealth farming floor (dark, with a garden). */
export function toggleFarming(depth: number): void {
  $query.set(toggleFarmingFloor($query.get(), depth))
}

/** Drops the requirement on one floor. */
export function removeFloorRequirement(depth: number): void {
  const floors = $query.get().floorRequirements ?? []
  patchQuery({
    floorRequirements: floors.filter((floor) => floor.depth !== depth),
  })
}
