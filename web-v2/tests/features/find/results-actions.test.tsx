import {
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  mock,
  spyOn,
} from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { TooltipProvider } from '@seed-seeker/design/ui/tooltip'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { $query, setQuery } from '../../../src/app/store/query'
import { encode_query_document } from '../../../src/engine/pkg/seedfinder.js'
import { FindWorkspace } from '../../../src/features/find'
import {
  decodeResultsFile,
  RESULTS_FILE_NAME,
} from '../../../src/features/find/results/results-file'
import { $resultsNotice } from '../../../src/features/find/results/results-io'
import {
  defaultQueryState,
  toQueryDocument,
} from '../../../src/features/query/query'
import { initialCoordinatorState } from '../../../src/features/search/coordinator-state'
import { searchStore } from '../../../src/features/search/store'
import { loadEngine, REPO_ROOT } from '../../engine/engine'

let root: Root | undefined
let host: HTMLDivElement
let fixture: string
const readText = mock<() => Promise<string>>()
let clipboard: unknown

beforeAll(async () => {
  await loadEngine()
  fixture = await readFile(
    join(
      REPO_ROOT,
      'crates/seedfinder-core/tests/fixtures/results-export-v1.json'
    ),
    'utf8'
  )
})

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  clipboard = { readText }
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    get: () => clipboard,
  })
  readText.mockReset()
  readText.mockResolvedValue(fixture)
  setQuery(defaultQueryState())
  searchStore.setState(() => initialCoordinatorState())
  host = document.createElement('div')
  document.body.append(host)
  await act(async () => {
    root = createRoot(host)
    root.render(
      <TooltipProvider>
        <FindWorkspace />
      </TooltipProvider>
    )
  })
})

afterEach(async () => {
  await act(async () => root?.unmount())
  host.remove()
  Reflect.deleteProperty(navigator, 'clipboard')
  setQuery(defaultQueryState())
  searchStore.setState(() => initialCoordinatorState())
  $resultsNotice.set(undefined)
  localStorage.clear()
})

const named = (label: string) =>
  host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)
const pasteButton = () => named('Import results or a search from the clipboard')
const fileButton = () => named('Import results or a search from a file')
const paste = () => act(async () => pasteButton()?.click())
const alertText = () => host.querySelector('[role="alert"]')?.textContent

it('reads only on demand and imports the query, seeds and trinkets', async () => {
  expect(readText).not.toHaveBeenCalled()
  await paste()
  const imported = decodeResultsFile(fixture)
  expect(readText).toHaveBeenCalledTimes(1)
  expect(toQueryDocument($query.get())).toEqual(imported.queryDocument)
  expect(searchStore.state.state).toBe('imported')
  expect(searchStore.state.matches.map((match) => match.code)).toEqual(
    imported.seeds
  )
  expect(
    searchStore.state.matches.map((match) => match.selectedTrinket)
  ).toEqual(imported.trinkets)
  expect(host.querySelectorAll('[data-testid="result-card"]')).toHaveLength(2)
  // The fixture was written for an older game, so the import says so.
  expect(
    host.querySelector('[data-testid="results-notice"]')?.textContent
  ).toContain('Shattered Pixel Dungeon v3.3.8; this app targets v4.0.2')
  expect(host.querySelector('[role="alert"]')).toBeNull()
  expect(host.textContent).toContain('2 seeds loaded from a file.')
})

it('imports a picked JSON file through the same path', async () => {
  const input = host.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error('no file input')
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: [new File([fixture], 'results.json', { type: 'application/json' })],
  })
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }))
    // `File.text()` resolves on a later task.
    await new Promise((resolve) => setTimeout(resolve, 10))
  })
  expect(searchStore.state.matches.map((match) => match.code)).toEqual(
    decodeResultsFile(fixture).seeds
  )
  expect(readText).not.toHaveBeenCalled()
})

it('loads a copied search into the query and keeps the results list', async () => {
  await paste()
  const results = searchStore.state
  const copied = encode_query_document(
    JSON.stringify({
      requirements: [{ item: 'wand_fireblast', upgrade: { at_least: 3 } }],
    })
  )
  readText.mockResolvedValueOnce(copied)
  await paste()
  expect(host.querySelector('[role="alert"]')).toBeNull()
  expect(toQueryDocument($query.get())).toEqual(
    decodeResultsFile(copied).queryDocument
  )
  expect(searchStore.state).toBe(results)
})

for (const [name, text, message] of [
  ['empty', '  \n', 'The clipboard has no text'],
  ['invalid', '{broken', ''],
  ['oversized', `${' '.repeat(2 * 1024 * 1024 + 1)}{}`, ''],
] as const)
  it(`keeps the current query and results for ${name} clipboard text`, async () => {
    await paste()
    const query = $query.get()
    const results = searchStore.state
    readText.mockResolvedValueOnce(text)
    await paste()
    expect(alertText()).toContain(message)
    expect($query.get()).toBe(query)
    expect(searchStore.state).toBe(results)
  })

it('explains a denied clipboard read and keeps file import available', async () => {
  readText.mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'))
  await paste()
  expect(alertText()).toContain('Allow clipboard access')
  expect(fileButton()?.disabled).toBe(false)
  expect(searchStore.state.state).toBe('idle')
})

it('explains when the browser has no clipboard API', async () => {
  clipboard = undefined
  await paste()
  expect(alertText()).toContain('Open this page over HTTPS')
  expect(readText).not.toHaveBeenCalled()
})

for (const state of ['running', 'stopping'] as const) {
  it(`disables imports and export while ${state}`, async () => {
    await paste()
    await act(async () =>
      searchStore.setState((current) => ({ ...current, state }))
    )
    expect(pasteButton()?.disabled).toBe(true)
    expect(fileButton()?.disabled).toBe(true)
    expect(named('Export results to a file')?.disabled).toBe(true)
  })

  it(`rejects a pending read if the search becomes ${state}`, async () => {
    let resolve: (text: string) => void = () => {}
    readText.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done
      })
    )
    await paste()
    const query = $query.get()
    await act(async () =>
      searchStore.setState((current) => ({ ...current, state }))
    )
    const search = searchStore.state
    await act(async () => resolve(fixture))
    expect(alertText()).toContain('Stop it before importing')
    expect($query.get()).toBe(query)
    expect(searchStore.state).toBe(search)
  })
}

it('exports the shown results with their search-time query, and Clear drops them', async () => {
  expect(named('Export results to a file')?.disabled).toBe(true)
  const query = { auto_apply_trinket: true, requirements: [{ kind: 'ring' }] }
  await act(async () =>
    searchStore.setState((current) => ({
      ...current,
      state: 'completed',
      query: query as never,
      matches: [
        { code: 'AAA-AAA-AAB', value: 1, selectedTrinket: null },
        { code: 'AAA-AAA-AAC', value: 2, selectedTrinket: null },
      ],
    }))
  )
  // The live query differs from the one that found the results.
  setQuery(defaultQueryState())
  const blobs: Blob[] = []
  const created = spyOn(URL, 'createObjectURL').mockImplementation(
    (blob: Blob | MediaSource) => {
      blobs.push(blob as Blob)
      return 'blob:results'
    }
  )
  const revoked = spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  const downloads: string[] = []
  const clicked = spyOn(
    HTMLAnchorElement.prototype,
    'click'
  ).mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push(this.download)
  })
  try {
    await act(async () => named('Export results to a file')?.click())
    expect(downloads).toEqual([RESULTS_FILE_NAME])
    const decoded = decodeResultsFile(await (blobs[0] as Blob).text())
    expect(decoded.seeds).toEqual(['AAA-AAA-AAB', 'AAA-AAA-AAC'])
    expect(decoded.trinkets).toEqual([null, null])
    expect(decoded.queryDocument.requirements).toEqual([{ kind: 'ring' }])
    expect(revoked).toHaveBeenCalledWith('blob:results')
  } finally {
    created.mockRestore()
    revoked.mockRestore()
    clicked.mockRestore()
  }
  act(() => $resultsNotice.set({ kind: 'error', text: 'stale' }))
  await act(async () => named('Clear results')?.click())
  expect(searchStore.state.matches).toEqual([])
  expect($resultsNotice.get()).toBeUndefined()
})
