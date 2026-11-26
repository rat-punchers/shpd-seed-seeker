import { batch } from '@tanstack/store'
import { CONFIG } from '../config'
import {
  readSeedLink,
  type SeedLink,
  scoutLinkSeed,
  seedPath,
} from '../features/analyze/seed-link'
import {
  $activeSeedId,
  $sessions,
  findSession,
} from '../features/analyze/sessions'
import { hasShareCode } from '../features/query/share-link'
import { $findView, setFindView } from './store/find-view'
import { $mode, setMode } from './store/mode'

const { analyze, find, advanced } = CONFIG.routes

export interface InitialRoute {
  seed?: SeedLink
  legacySeed?: string
  queryShare?: string
}

export function readInitialRoute(url: URL): InitialRoute {
  const path = url.pathname.replace(/\/+$/, '') || '/'
  let entry: InitialRoute = {}

  batch(() => {
    if (hasShareCode(url.hash)) {
      setFindView('advanced')
      setMode('find')
      entry = { queryShare: url.hash }
    } else if (path === find || path === advanced) {
      setFindView(path === find ? 'simple' : 'advanced')
      setMode('find')
    } else if (path === analyze) {
      setMode('analyze')
      const seed = readSeedLink(url.searchParams)
      entry = seed ? { seed } : { legacySeed: scoutLinkSeed(url.search) }
    } else {
      const legacySeed = scoutLinkSeed(url.search)
      if (legacySeed) {
        setMode('analyze')
        entry = { legacySeed }
      }
    }
  })
  return entry
}

export function syncBrowserRoute(initial: URL): void {
  // Keep unrelated parameters and fragments on entry; route inputs are consumed.
  const extra = new URLSearchParams(initial.search)
  for (const key of ['seed', 'challenge', 'lore', 'trinket', 'scout', 'share'])
    extra.delete(key)
  const hash = hasShareCode(initial.hash) ? '' : initial.hash
  let current = `${initial.pathname}${initial.search}${initial.hash}`

  const sync = () => {
    const screen =
      $mode.get() === 'find'
        ? $findView.get() === 'advanced'
          ? 'advanced'
          : 'find'
        : 'analyze'
    const path =
      screen === 'analyze'
        ? seedPath(findSession($activeSeedId.get()))
        : CONFIG.routes[screen]
    const next = new URL(path, initial.origin)
    for (const [key, value] of extra) next.searchParams.append(key, value)
    const href = `${next.pathname}${next.search}${hash}`
    if (href === current) return
    window.history.replaceState(window.history.state, '', href)
    document.title = CONFIG.screenTitles[screen]
    current = href
  }

  sync()
  $mode.subscribe(sync)
  $findView.subscribe(sync)
  $activeSeedId.subscribe(sync)
  $sessions.subscribe(sync)
}
