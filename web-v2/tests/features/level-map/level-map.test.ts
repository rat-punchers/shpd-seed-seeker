import { beforeAll, describe, expect, it } from 'bun:test'
import {
  level_map,
  level_map_asset,
} from '../../../src/engine/pkg/seedfinder.js'
import {
  hasLevelMap,
  mapRequestJson,
} from '../../../src/features/level-map/client'
import {
  hasInspection,
  inspectPoint,
  itemBounds,
  kindName,
} from '../../../src/features/level-map/item-inspection'
import { particleState } from '../../../src/features/level-map/rendering/particles'
import { glowAmount } from '../../../src/features/level-map/rendering/render'
import type {
  LevelMapDocument,
  LevelMapRequest,
} from '../../../src/features/level-map/types'
import { loadEngine } from '../../engine/engine'
import { REAL_FIXTURES, realReport } from '../analyze/fixtures'

beforeAll(loadEngine)

const map = (seed: string, depth: number, branch = 0) =>
  JSON.parse(
    level_map(mapRequestJson({ seed, depth, branch, challenges: [] }))
  ) as LevelMapDocument

describe('map requests', () => {
  it('canonicalize challenges and keep trinket, floor and branch apart', () => {
    const request: LevelMapRequest = {
      seed: 'AAA-AAA-AAA',
      depth: 13,
      challenges: ['faith_is_my_armor', 'on_diet'],
    }
    const key = mapRequestJson(request)
    expect(
      mapRequestJson({
        ...request,
        challenges: ['on_diet', 'faith_is_my_armor', 'on_diet'],
      })
    ).toBe(key)
    expect(JSON.parse(key).trinket).toBe('none')
    expect(mapRequestJson({ ...request, selectedTrinket: null })).toBe(key)
    expect(
      mapRequestJson({ ...request, selectedTrinket: 'mossy_clump' })
    ).not.toBe(key)
    expect(mapRequestJson({ ...request, branch: 1 })).not.toBe(key)
    expect(mapRequestJson({ ...request, depth: 14 })).not.toBe(key)
  })

  it('cover main floors, boss arenas 5 and 15, and quest branches', () => {
    expect([1, 5, 13, 15, 19, 24].every((depth) => hasLevelMap(depth))).toBe(
      true
    )
    expect([0, 10, 20, 25, 26].some((depth) => hasLevelMap(depth))).toBe(false)
    expect(hasLevelMap(13, 1)).toBe(true)
    expect(hasLevelMap(9, 1)).toBe(false)
  })
})

describe('report branches', () => {
  for (const file of REAL_FIXTURES) {
    it(`match the maps of ${file}`, async () => {
      const report = await realReport(file)
      const floors = report.floors.filter((floor) => floor.branches.length)
      expect(floors.length).toBeGreaterThan(0)
      for (const floor of floors) {
        const parent = map(report.seed.code, floor.depth)
        expect(
          parent.branches.map(({ branch, kind }) => ({ branch, kind }))
        ).toEqual(floor.branches.map(({ branch, kind }) => ({ branch, kind })))
        for (const branch of floor.branches) {
          expect(hasLevelMap(floor.depth, branch.branch)).toBe(true)
          const level = map(report.seed.code, floor.depth, branch.branch)
          expect(level.kind).toBe(branch.kind)
          expect(level.terrain).toHaveLength(level.width * level.height)
        }
      }
    })
  }
})

describe('tile inspection', () => {
  const floor = () => map('AAA-AAA-AAA', 4)

  it('finds the item whose raised sprite covers a point', () => {
    const level = floor()
    const tip = level.itemTooltips?.find((entry) => !entry.hidden)
    if (!tip) throw new Error('no visible item on floor 4')
    const [left, top, width, height] = itemBounds(
      tip,
      level.width,
      level.scene.tileSize
    )
    const inside = inspectPoint(level, left + width / 2, top + height / 2)
    expect(inside?.tip).toBe(tip)
    expect(inside?.cell).toBe(tip.cell)
    expect(hasInspection(inside)).toBe(true)
    expect(inspectPoint(level, -1, 0)).toBeNull()
  })

  it('lists mobs on their cell and finds hidden items too', () => {
    const level = floor()
    const tile = level.scene.tileSize
    const mob = level.contents?.mobs[0]
    if (!mob) throw new Error('no mob on floor 4')
    const x = (mob.cell % level.width) * tile + tile / 2
    const y = Math.floor(mob.cell / level.width) * tile + tile / 2
    expect(inspectPoint(level, x, y)?.mobs).toContain(mob)
    expect(kindName(mob.kind)).toBe('Slime')
    expect(kindName('PoisonDartTrap')).toBe('Poison dart trap')

    // Floor 2 has a secret room with items in it.
    const secretFloor = map('AAA-AAA-AAA', 2)
    const hidden = secretFloor.itemTooltips?.find((entry) => entry.hidden)
    if (!hidden) throw new Error('no hidden item on floor 2')
    const [left, top] = itemBounds(hidden, secretFloor.width, tile)
    expect(inspectPoint(secretFloor, left + 1, top + 1)?.tip?.cell).toBe(
      hidden.cell
    )
  })

  it('names each mob with its in-game examine text and portrait film', () => {
    const level = floor()
    const slime = level.mobDetails?.Slime
    if (!slime) throw new Error('no slime details on floor 4')
    expect(slime.name).toBe('Slime')
    expect(slime.description).toStartWith('Slimes are')
    expect(level.assets.map((asset) => asset.id)).toContain(slime.asset)
    expect(slime.frames.length).toBeGreaterThan(0)
  })

  it('describes plants with their in-game examine text and tile', () => {
    const level = [1, 2, 3, 4, 5, 6, 7, 8, 9]
      .map((depth) => map('AAA-AAA-AAA', depth))
      .find((entry) => (entry.contents?.plants.length ?? 0) > 0)
    const plant = level?.contents?.plants[0]
    if (!level || !plant) throw new Error('no plant on floors 1 to 9')
    const detail = level.plantDetails?.[plant.kind]
    expect(detail?.description.length).toBeGreaterThan(0)
    expect(detail?.asset).toBe('terrain_features.png')
    const tile = level.scene.tileSize
    const x = (plant.cell % level.width) * tile + tile / 2
    const y = Math.floor(plant.cell / level.width) * tile + tile / 2
    expect(inspectPoint(level, x, y)?.plants).toContain(plant)
  })

  it('shows a mimic once, as its secret tooltip, and leaves summoning traps out', () => {
    const level = JSON.parse(
      level_map(
        mapRequestJson({
          seed: 'AAA-AAA-AAA',
          depth: 6,
          challenges: [],
          selectedTrinket: 'mimic_tooth',
        })
      )
    ) as LevelMapDocument
    const tile = level.scene.tileSize
    const tip = level.itemTooltips?.find(
      (entry) => entry.label === 'Ebony Mimic'
    )
    if (!tip) throw new Error('no Ebony mimic on floor 6')
    expect(tip.hidden).toBe(true)
    const [left, top, width, height] = itemBounds(tip, level.width, tile)
    const inside = inspectPoint(level, left + width / 2, top + height / 2)
    expect(inside?.tip).toBe(tip)
    expect(inside?.carrier?.kind).toBe('EbonyMimic')
    expect(inside?.mobs).toEqual([])
    expect(level.mobDetails?.EbonyMimic?.frames).toHaveLength(5)

    const summoning = map('DDD-DDD-DDD', 13)
    const trap = summoning.contents?.traps.find(
      (entry) => entry.kind === 'Summoning'
    )
    if (!trap) throw new Error('no summoning trap on floor 13')
    const x = (trap.cell % summoning.width) * tile + tile / 2
    const y = Math.floor(trap.cell / summoning.width) * tile + tile / 2
    expect(inspectPoint(summoning, x, y)?.traps).toEqual([])
  })
})

describe('rendering contract', () => {
  it('pulses glows to the game’s 60% peak', () => {
    expect(glowAmount(1000, 0)).toBe(0)
    expect(glowAmount(1000, 500)).toBe(0.3)
    expect(glowAmount(1000, 1000)).toBe(0.6)
    expect(glowAmount(1000, 2000)).toBe(0)
    expect(glowAmount(500, 500)).toBe(0.6)
  })

  it('loads a PNG for every asset the scene draws', () => {
    const level = map('AAA-AAA-AAA', 1)
    const ids = new Set(level.assets.map((asset) => asset.id))
    for (const id of ids) {
      expect([...level_map_asset(id).slice(0, 4)]).toEqual([137, 80, 78, 71])
    }
    for (const sprite of level.scene.sprites)
      for (const frame of sprite.frames)
        for (const command of frame)
          if (command.kind === 'blit') expect(ids.has(command.asset)).toBe(true)
  })

  it('keeps chasm wind on chasm cells and loops it', () => {
    const level = map('AAA-AAA-AAA', 22)
    const wind = (level.scene.emitters ?? []).filter((e) => e.clipToChasm)
    expect(wind.length).toBeGreaterThan(0)
    for (const emitter of wind) {
      expect(level.terrain[emitter.cell]).toBe(0)
      expect(emitter.loopMs).toBe(2500)
    }
    const breeze = wind.find((emitter) => emitter.velocity[0] !== 0)
    const particle = breeze?.particles[0]
    if (!breeze || !particle) throw new Error('no moving wind')
    const time = particle.birthMs + particle.lifespanMs / 2
    expect(particleState(breeze, particle, time + 2500)).toEqual(
      particleState(breeze, particle, time)
    )
  })

  it('starts Vault rays on their seeded turn', () => {
    const vault = JSON.parse(
      level_map(JSON.stringify({ seed: 'FOI-QDX-EMJ', depth: 18, branch: 1 }))
    ) as LevelMapDocument
    const first = vault.scene.emitters?.find(
      (e) =>
        e.cell === 391 &&
        e.image.kind === 'blit' &&
        e.image.asset === 'effects.png'
    )
    const particle = first?.particles[0]
    if (!first || !particle) throw new Error('no ray at cell 391')
    expect(first.startMs).toBe(1000)
    expect(particleState(first, particle, 999)).toBeNull()
    expect(particleState(first, particle, 1100)?.scale).toBe(1)
    expect(particleState(first, particle, 8100)).toEqual(
      particleState(first, particle, 1100)
    )
  })
})
