import { afterEach, beforeAll, expect, it } from 'bun:test'
import { $findView, setFindView } from '../../../src/app/store/find-view'
import { $mode, setMode } from '../../../src/app/store/mode'
import { $query, setQuery } from '../../../src/app/store/query'
import { encode_share_link } from '../../../src/engine/pkg/seedfinder.js'
import {
  $shareNotice,
  openShareLink,
} from '../../../src/features/advanced/share-import'
import {
  defaultQueryState,
  toQueryDocument,
} from '../../../src/features/query/query'
import { initialCoordinatorState } from '../../../src/features/search/coordinator-state'
import { searchStore } from '../../../src/features/search/store'
import { loadEngine } from '../../engine/engine'

beforeAll(async () => {
  await loadEngine()
  // The DOM starts on about:blank, where the history cannot change the URL.
  ;(
    window as unknown as { happyDOM: { setURL(url: string): void } }
  ).happyDOM.setURL('http://127.0.0.1:46001/')
})

afterEach(() => {
  window.history.replaceState(null, '', '/')
  setQuery(defaultQueryState())
  setMode('analyze')
  setFindView('simple')
  $shareNotice.set(undefined)
  searchStore.setState(() => initialCoordinatorState())
  localStorage.clear()
})

/** Opens the app's address with the share code of `json` in its fragment. */
function visitShareLink(json: string) {
  const link = encode_share_link(json)
  window.history.replaceState(null, '', `/${link.slice(link.indexOf('#'))}`)
}

it("brings a share link's requirements in as the editor writes them, in Advanced", async () => {
  // A ring stack spelled as a named anchor with a plain copy under label 3.
  visitShareLink(
    '{"requirements":[{"item":"wand_frost","kind":"wand"},{"identity_group":3,"item":"ring_might","kind":"ring"},{"identity_group":3,"kind":"ring"}]}'
  )
  await openShareLink()
  expect(toQueryDocument($query.get()).requirements).toEqual([
    { kind: 'wand', item: 'wand_frost' },
    { kind: 'ring', item: 'ring_might' },
    { kind: 'ring', item: 'ring_might' },
  ])
  expect($mode.get()).toBe('find')
  expect($findView.get()).toBe('advanced')
  expect($shareNotice.get()).toBeUndefined()
  // The address bar is clean, so a reload does not apply the link again.
  expect(window.location.hash).toBe('')
})

it('says why a share link could not be loaded, and keeps the query', async () => {
  const query = $query.get()
  window.history.replaceState(null, '', '/#q=not-a-code')
  await openShareLink()
  expect($shareNotice.get()).toBeString()
  expect($shareNotice.get()?.length).toBeGreaterThan(0)
  expect($query.get()).toBe(query)
  expect($findView.get()).toBe('advanced')
  expect(window.location.hash).toBe('')
})

it('will not replace the query of a running search', async () => {
  const query = $query.get()
  searchStore.setState((state) => ({ ...state, state: 'running' }))
  visitShareLink('{"requirements":[{"kind":"wand"}]}')
  await openShareLink()
  expect($shareNotice.get()).toBe('a search is running — stop it first')
  expect($query.get()).toBe(query)
})

it('leaves an address without a share code alone', async () => {
  window.history.replaceState(null, '', '/?scout=AAA-AAA-AAA#top')
  await openShareLink()
  expect($mode.get()).toBe('analyze')
  expect(window.location.hash).toBe('#top')
})
