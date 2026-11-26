import { afterEach, beforeAll, expect, it } from 'bun:test'
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
})

afterEach(() => {
  setQuery(defaultQueryState())
  $shareNotice.set(undefined)
  searchStore.setState(() => initialCoordinatorState())
  localStorage.clear()
})

function shareFragment(json: string) {
  return new URL(encode_share_link(json)).hash
}

it("brings a share link's requirements in as the editor writes them", async () => {
  // A ring stack spelled as a named anchor with a plain copy under label 3.
  await openShareLink(
    shareFragment(
      '{"requirements":[{"item":"wand_frost","kind":"wand"},{"identity_group":3,"item":"ring_might","kind":"ring"},{"identity_group":3,"kind":"ring"}]}'
    )
  )
  expect(toQueryDocument($query.get()).requirements).toEqual([
    { kind: 'wand', item: 'wand_frost' },
    { kind: 'ring', item: 'ring_might' },
    { kind: 'ring', item: 'ring_might' },
  ])
  expect($shareNotice.get()).toBeUndefined()
})

it('says why a share link could not be loaded, and keeps the query', async () => {
  const query = $query.get()
  await openShareLink('#q=not-a-code')
  expect($shareNotice.get()).toBeString()
  expect($shareNotice.get()?.length).toBeGreaterThan(0)
  expect($query.get()).toBe(query)
})

it('will not replace the query of a running search', async () => {
  const query = $query.get()
  searchStore.setState((state) => ({ ...state, state: 'running' }))
  await openShareLink(shareFragment('{"requirements":[{"kind":"wand"}]}'))
  expect($shareNotice.get()).toBe('a search is running — stop it first')
  expect($query.get()).toBe(query)
})
