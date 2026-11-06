import {
  $userPresets,
  builtInPresets,
  type Preset,
} from '../../app/store/presets'
import { setQuery } from '../../app/store/query'
import type { QueryState } from '../../engine/types'
import { AppStore } from '../../shared/store/persistent'
import { fromQueryJson, toQueryJson } from '../query/query'

const cloneQuery = (query: QueryState): QueryState =>
  fromQueryJson(toQueryJson(query))

/** The name being typed for a new preset, or `null` while not naming one. */
export const $presetName = new AppStore<string | null>(null)

/**
 * The preset the query is, as the picker's value: `b:<index>` for an
 * included one, `u:<index>` for a saved one, `''` for none. Presets match by
 * their query document.
 */
export function selectedPreset(
  query: QueryState,
  saved: readonly Preset[]
): string {
  const current = toQueryJson(query)
  const matches = (preset: Preset) => toQueryJson(preset.query) === current
  const included = builtInPresets.findIndex(matches)
  if (included >= 0) return `b:${included}`
  const own = saved.findIndex(matches)
  return own >= 0 ? `u:${own}` : ''
}

/** The preset a picker value names. */
export function presetOf(value: string): Preset | undefined {
  const [scope, index] = value.split(':')
  const list = scope === 'b' ? builtInPresets : $userPresets.get()
  return scope ? list[Number(index)] : undefined
}

/** Replaces the query with a copy of the preset's. */
export function applyPreset(preset: Preset): void {
  setQuery(cloneQuery(preset.query))
}

/** Opens or closes the name field for saving the query as a preset. */
export function toggleNaming(): void {
  $presetName.set($presetName.get() === null ? '' : null)
}

/**
 * Saves the query under the typed name; a preset of the same name (any
 * case) is replaced in place and keeps its spelling.
 */
export function saveNamedPreset(query: QueryState): void {
  const name = ($presetName.get() ?? '').trim()
  if (!name) return
  const snapshot = cloneQuery(query)
  const next = [...$userPresets.get()]
  const existing = next.findIndex(
    (preset) => preset.name.toLowerCase() === name.toLowerCase()
  )
  const same = existing >= 0 ? next[existing] : undefined
  if (same) next[existing] = { name: same.name, query: snapshot }
  else next.push({ name, query: snapshot })
  $userPresets.set(next)
  $presetName.set(null)
}

export function deletePreset(name: string): void {
  $userPresets.set($userPresets.get().filter((preset) => preset.name !== name))
}
