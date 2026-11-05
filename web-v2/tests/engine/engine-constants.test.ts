import { beforeAll, expect, it } from 'bun:test'
import { SHPD_VERSION } from '../../src/engine/constants'
import type { EngineInfo } from '../../src/engine/types'
import { getEngineInfo } from '../../src/engine/wasm'
import {
  BLACKSMITH_LAST_FLOOR,
  EMPTY_BOSS_FLOORS,
  MAX_DEPTH,
  TRINKET_TRANSMUTATION_MAX,
} from '../../src/features/query/query'
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
