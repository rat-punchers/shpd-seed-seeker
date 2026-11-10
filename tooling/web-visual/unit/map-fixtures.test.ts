import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  branchQuest,
  branchTitle,
  MAP_FIXTURES,
  mapDialogTitle,
  mapIdentityKey,
  mapLabel,
  mapSnapshotName,
} from '../tests/helpers/map-fixtures'

const SNAPSHOTS = join(import.meta.dir, '../snapshots')

describe('floor map snapshots', () => {
  test('register unique, valid levels and snapshot names', () => {
    const cases = MAP_FIXTURES.map(({ seed, typed, level }) => {
      expect(seed).toMatch(/^[A-Z]{3}(?:-[A-Z]{3}){2}$/)
      expect(typed.toUpperCase()).toBe(seed.replaceAll('-', ''))
      expect(level.depth).toBeGreaterThan(0)
      if (level.kind === 'branch') expect(level.branch).toBe(1)
      return `${seed}:${mapIdentityKey(level)}`
    })
    const names = MAP_FIXTURES.map(mapSnapshotName)
    expect(new Set(cases).size).toBe(cases.length)
    expect(new Set(names).size).toBe(names.length)
    expect(names).toEqual([
      'AAA-AAA-AAA-F1.png',
      'RZN-LKU-EFS-F16.png',
      'AAA-AAA-AAA-F13-B1-Crystal.png',
      'RZN-LKU-EFS-F13-B1-Gnoll.png',
      'AAA-AAA-AAA-F19-B1-Vault.png',
    ])
  })

  test('cover main floors, both mines and the Vault', () => {
    const kinds = new Set(
      MAP_FIXTURES.map(({ level }) =>
        level.kind === 'main' ? 'main' : level.objective
      )
    )
    expect([...kinds].sort()).toEqual(['Crystal', 'Gnoll', 'Vault', 'main'])
  })

  test('every snapshot is committed', () => {
    for (const fixture of MAP_FIXTURES) {
      expect(existsSync(join(SNAPSHOTS, mapSnapshotName(fixture)))).toBe(true)
    }
  })

  test('names follow the app’s map buttons and dialogs', () => {
    expect(mapLabel({ kind: 'main', depth: 4 })).toBe('floor 4 map')
    expect(mapDialogTitle({ kind: 'main', depth: 4 })).toBe('Floor 4')
    const vault = {
      kind: 'branch',
      depth: 19,
      branch: 1,
      objective: 'Vault',
    } as const
    expect(mapLabel(vault)).toBe('Imp Vault floor 19, branch 1 map')
    expect(mapDialogTitle(vault)).toBe('Imp Vault - Floor 19, branch 1')
    expect(branchTitle('Crystal')).toBe('Crystal Mine')
    expect(branchTitle('Gnoll')).toBe('Gnoll Mine')
    expect(branchQuest('Vault')).toBe('imp')
    expect(branchQuest('Gnoll')).toBe('blacksmith')
  })
})
