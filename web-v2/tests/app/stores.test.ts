import { afterEach, describe, expect, it } from 'bun:test'
import { $mode, setMode } from '../../src/app/store/mode'
import {
  $query,
  $workerCount,
  maxWorkers,
  setQuery,
  setWorkerCount,
} from '../../src/app/store/query'
import {
  $theme,
  applyTheme,
  cycleTheme,
  setTheme,
} from '../../src/app/store/theme'
import { THEME_SCRIPT } from '../../src/app/theme-script'
import { CONFIG, CONFIG_SCRIPT } from '../../src/config'
import { defaultQueryState } from '../../src/features/query/query'
import { enumCodec, persistentStore } from '../../src/shared/store/persistent'

afterEach(() => {
  localStorage.clear()
  document.documentElement.className = ''
})

describe('persistentStore', () => {
  const codec = enumCodec(['a', 'b'] as const, 'a')

  it('starts from the stored value and writes changes back', () => {
    localStorage.setItem('test-key', 'b')
    const store = persistentStore('test-key', 'a', codec)
    expect(store.get()).toBe('b')
    store.set('a')
    expect(localStorage.getItem('test-key')).toBe('a')
  })

  it('falls back for stored text the codec does not know', () => {
    localStorage.setItem('test-key', 'zzz')
    expect(persistentStore('test-key', 'b', codec).get()).toBe('a')
  })
})

it('persists the mode under the prefixed key', () => {
  setMode('find')
  expect(localStorage.getItem('seed-seeker-v2-mode')).toBe('find')
  expect($mode.get()).toBe('find')
  setMode('analyze')
  expect(localStorage.getItem('seed-seeker-v2-mode')).toBe('analyze')
})

it('cycles the theme light → dark → system and persists it', () => {
  setTheme('light')
  cycleTheme()
  expect($theme.get()).toBe('dark')
  cycleTheme()
  expect($theme.get()).toBe('system')
  cycleTheme()
  expect($theme.get()).toBe('light')
  expect(localStorage.getItem('seed-seeker-v2-theme')).toBe('light')
})

it('applies the dark class and color scheme to <html>', () => {
  applyTheme('dark')
  expect(document.documentElement.classList.contains('dark')).toBe(true)
  expect(document.documentElement.style.colorScheme).toBe('dark')
  applyTheme('light')
  expect(document.documentElement.classList.contains('dark')).toBe(false)
  expect(document.documentElement.style.colorScheme).toBe('light')
})

it('applies a stored dark theme before first paint', () => {
  localStorage.setItem(CONFIG.storageKeys.theme, 'dark')
  new Function(CONFIG_SCRIPT + THEME_SCRIPT)()
  expect(document.documentElement.classList.contains('dark')).toBe(true)
})

it('every storage key carries the prefix', () => {
  for (const key of Object.values(CONFIG.storageKeys)) {
    expect(key.startsWith(CONFIG.storagePrefix)).toBe(true)
  }
})

it('persists the query as a query document', () => {
  setQuery({ ...defaultQueryState(), maxDepth: 9 })
  expect(localStorage.getItem(CONFIG.storageKeys.query)).toBe(
    '{"requirements":[],"auto_apply_trinket":true,"max_depth":9}'
  )
  expect($query.get().maxDepth).toBe(9)
  setQuery(defaultQueryState())
})

it('clamps the worker count to the available processors', () => {
  setWorkerCount(maxWorkers() + 8)
  expect($workerCount.get()).toBe(maxWorkers())
  setWorkerCount(0)
  expect($workerCount.get()).toBe(1)
  expect(localStorage.getItem(CONFIG.storageKeys.workers)).toBe('1')
})
