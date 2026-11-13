import { beforeAll, expect, it } from 'bun:test'
import { SHPD_VERSION } from '../../src/engine/constants'
import type { EngineInfo } from '../../src/engine/types'
import { getEngineInfo } from '../../src/engine/wasm'
import {
  EXTRA_UPGRADE_TIER,
  MAX_UPGRADE_BY_KIND,
  MAX_UPGRADE_DEFAULT,
} from '../../src/features/find/simple-items'
import {
  MAP_BRANCH_DEPTHS,
  MAP_DEPTHS,
} from '../../src/features/level-map/client'
import { TILE_PX } from '../../src/features/level-map/map-view'
import {
  BLACKSMITH_LAST_FLOOR,
  EMPTY_BOSS_FLOORS,
  MAX_DEPTH,
  TRINKET_TRANSMUTATION_MAX,
} from '../../src/features/query/query'
import {
  SEARCH_START_STRIDE,
  TOTAL_SEEDS,
} from '../../src/features/search/traversal'
import { challenges, LEVEL_GEN_CHALLENGES } from '../../src/shared/game/catalog'
import { loadEngine } from './engine'

/** Local copies of engine facts must match the `engine_info` document. */
let info: EngineInfo

beforeAll(async () => {
  await loadEngine()
  info = await getEngineInfo()
})

it('the shell game version is the engine version', () => {
  expect(SHPD_VERSION).toBe(info.shpdVersion)
})

it('query bounds', () => {
  expect(MAX_DEPTH).toBe(info.limits.maxDepth)
  expect(TRINKET_TRANSMUTATION_MAX).toBe(info.limits.trinketTransmutationsMax)
})

it('Simple upgrade limits', () => {
  expect<Record<string, number>>(MAX_UPGRADE_BY_KIND).toEqual(
    info.limits.maxUpgradeByKind
  )
  expect(EXTRA_UPGRADE_TIER).toBe(info.limits.extraUpgradeTier)
  expect(MAX_UPGRADE_DEFAULT).toBe(info.limits.maxUpgradeDefault)
})

it('seed space and search stride', () => {
  expect(TOTAL_SEEDS).toBe(info.totalSeeds)
  expect(SEARCH_START_STRIDE).toBe(info.searchStartStride)
})

it('empty boss floors and the Blacksmith window', () => {
  expect([...EMPTY_BOSS_FLOORS]).toEqual(info.emptyBossFloors)
  expect(BLACKSMITH_LAST_FLOOR).toBe(info.questWindows.blacksmith[1])
})

it('challenge list, mask order, and generation relevance', () => {
  expect(challenges.map((challenge) => challenge.value)).toEqual(
    info.challenges.map((challenge) => challenge.name)
  )
  info.challenges.forEach((challenge, index) => {
    expect(challenge.mask).toBe(1 << index)
  })
  expect([...LEVEL_GEN_CHALLENGES].sort()).toEqual(
    info.challenges
      .filter((challenge) => challenge.changesLevelGeneration)
      .map((challenge) => challenge.name)
      .sort()
  )
})

it('level map coverage and tile size', () => {
  expect([...MAP_DEPTHS]).toEqual(info.levelMaps.supportedDepths)
  expect([...MAP_BRANCH_DEPTHS]).toEqual(info.levelMaps.branchDepths)
  expect(TILE_PX).toBe(info.levelMaps.tileSize)
})
