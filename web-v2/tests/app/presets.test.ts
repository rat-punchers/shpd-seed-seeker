import { afterEach, describe, expect, it } from 'bun:test'
import { $userPresets, builtInPresets } from '../../src/app/store/presets'
import { $query, setQuery } from '../../src/app/store/query'
import {
  $presetName,
  applyPreset,
  deletePreset,
  presetOf,
  saveNamedPreset,
  selectedPreset,
  toggleNaming,
} from '../../src/features/advanced/presets'
import {
  defaultQueryState,
  fromQueryJson,
  toQueryJson,
} from '../../src/features/query/query'
import { validateQuery } from '../../src/features/query/validation'

/** Each preset as the shared query-document format writes it. */
const documents: [string, string][] = [
  [
    'DISINTEGRATE',
    `{"auto_apply_trinket":true,"max_depth":19,"requirements":[
      {"item":"wand_disintegration","kind":"wand","upgrade":{"at_least":3}},
      {"item":"wand_disintegration","kind":"wand"},
      {"item":"wand_disintegration","kind":"wand"},
      {"item":"eye_of_newt","kind":"trinket","trinket_transmutations":1},
      {"item":"ring_energy","kind":"ring","upgrade":{"at_least":2}}]}`,
  ],
  [
    'Guerilla Assassin',
    `{"auto_apply_trinket":true,"requirements":[
      {"effect":"Blooming","item":"assassins_blade","kind":"weapon","max_depth":7,"upgrade":3},
      {"effect":"Camouflage","kind":"armor"},
      {"item":"ring_arcana","kind":"ring","upgrade":{"at_least":2}}]}`,
  ],
  [
    'Ring of Wealth',
    `{
      "floor_requirements":[{"any_rooms":["garden","secret_garden"],"depth":17,"feeling":"dark"}],
      "requirements":[
      {"item":"ring_wealth","kind":"ring","upgrade":4},
      {"item":"dried_rose","kind":"artifact","max_depth":9},
      {"kind":"armor","max_depth":4,"tier":{"at_most":4},"upgrade":3},
      {"kind":"weapon","max_depth":9,"tier":{"at_most":4},"upgrade":3},
      {"item":"dimensional_sundial","kind":"trinket","trinket_transmutations":1}]}`,
  ],
  [
    'Necromancer',
    `{"auto_apply_trinket":true,"max_depth":14,"wandmaker_quest":"corpse_dust","requirements":[
      {"item":"wand_corruption","kind":"wand","upgrade":3},
      {"kind":"melee_weapon","tier":{"exact":5},"upgrade":3},
      {"item":"plate_armor","kind":"armor","upgrade":3}]}`,
  ],
  [
    'Blood Berserker',
    `{"auto_apply_trinket":true,"requirements":[
      {"effect":"Vampiric","kind":"melee_weapon","tier":{"exact":5},"upgrade":3},
      {"effect":"Thorns","item":"plate_armor","kind":"armor","upgrade":3},
      {"item":"ring_arcana","kind":"ring","upgrade":4},
      {"item":"chalice_of_blood","kind":"artifact"}]}`,
  ],
]

afterEach(() => {
  $userPresets.set([])
  $presetName.set(null)
  setQuery(defaultQueryState())
  localStorage.clear()
})

describe('built-in presets', () => {
  it('ships queries the editor accepts', () => {
    for (const preset of builtInPresets)
      expect(validateQuery(preset.query).errors).toEqual([])
  })

  it.each(['Necromancer', 'Blood Berserker'])(
    '%s keeps its T5 melee filter when exported',
    (name) => {
      const preset = builtInPresets.find((entry) => entry.name === name)
      const weapon = preset?.query.requirements.find(
        (entry) => entry.kind === 'melee_weapon'
      )
      expect(weapon).toMatchObject({
        kind: 'melee_weapon',
        tier: { mode: 'exact', value: 5 },
        upgrade: { mode: 'exact', value: 3 },
      })
      expect(
        fromQueryJson(toQueryJson(preset?.query ?? defaultQueryState()))
          .requirements
      ).toEqual(preset?.query.requirements ?? [])
    }
  )

  it('is the query each preset was taken from', () => {
    expect(builtInPresets.map((preset) => preset.name)).toEqual(
      documents.map(([name]) => name)
    )
    for (const [index, [, document]] of documents.entries())
      expect(builtInPresets[index]?.query).toEqual(fromQueryJson(document))
  })
})

describe('applying and saving presets', () => {
  it('loads an included preset and names it as the selection', () => {
    const preset = presetOf('b:3')
    expect(preset?.name).toBe('Necromancer')
    if (preset) applyPreset(preset)
    expect($query.get()).toEqual(preset?.query ?? defaultQueryState())
    // A copy: editing the query leaves the preset alone.
    expect($query.get()).not.toBe(preset?.query)
    expect(selectedPreset($query.get(), $userPresets.get())).toBe('b:3')
    setQuery({ ...$query.get(), maxDepth: 9 })
    expect(selectedPreset($query.get(), $userPresets.get())).toBe('')
  })

  it('saves the query under a name, replaces a same-named one, and deletes it', () => {
    setQuery(fromQueryJson('{"requirements":[{"kind":"wand"}]}'))
    toggleNaming()
    expect($presetName.get()).toBe('')
    $presetName.set('  My wands ')
    saveNamedPreset($query.get())
    expect($presetName.get()).toBeNull()
    expect($userPresets.get().map((preset) => preset.name)).toEqual([
      'My wands',
    ])
    expect(selectedPreset($query.get(), $userPresets.get())).toBe('u:0')
    // Stored as query documents under the prefixed key.
    expect(
      JSON.parse(localStorage.getItem('seed-seeker-v2-presets') ?? '[]')
    ).toEqual([
      { name: 'My wands', query: JSON.parse(toQueryJson($query.get())) },
    ])

    setQuery(fromQueryJson('{"requirements":[{"kind":"ring"}]}'))
    toggleNaming()
    $presetName.set('my WANDS')
    saveNamedPreset($query.get())
    expect($userPresets.get()).toHaveLength(1)
    expect($userPresets.get()[0]?.name).toBe('My wands')
    expect($userPresets.get()[0]?.query.requirements[0]?.kind).toBe('ring')

    deletePreset('My wands')
    expect($userPresets.get()).toEqual([])
  })

  it('saves nothing under a blank name', () => {
    toggleNaming()
    $presetName.set('   ')
    saveNamedPreset($query.get())
    expect($userPresets.get()).toEqual([])
    expect($presetName.get()).toBe('   ')
  })
})
