import { describe, expect, it } from 'bun:test'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  editorLoaded,
  requirementBoard,
  requirementEditor,
} from '../../src/engine/editor'
import type {
  BoardRequest,
  BoardResponse,
  EditorRequest,
  EditorResponse,
} from '../../src/engine/types'
import { REPO_ROOT } from './engine'

/**
 * The shared core pins its editor answers in golden fixtures
 * (docs/requirement-editor.md); the web replays them through its own binding,
 * the lean module the app loads before its first render.
 */
const fixtures = join(REPO_ROOT, 'crates/seedfinder-core/tests/fixtures/editor')

interface Fixture<Request, Response> {
  request: Request | string
  response: Response | { error: string; key?: number }
}

async function replay<Request, Response extends object>(
  prefix: string,
  send: (request: Request) => unknown
): Promise<void> {
  const names = (await readdir(fixtures)).filter((name) =>
    name.startsWith(prefix)
  )
  expect(names.length).toBeGreaterThan(10)
  for (const name of names) {
    const fixture = JSON.parse(
      await readFile(join(fixtures, name), 'utf8')
    ) as Fixture<Request, Response>
    // Requests that are not JSON at all cannot come from this binding.
    if (typeof fixture.request === 'string') continue
    const answer = send(fixture.request)
    if ('error' in fixture.response)
      expect(answer).toEqual({ ok: false, ...fixture.response })
    else expect(answer).toEqual({ ok: true, value: fixture.response })
  }
}

describe('the requirement editor module', () => {
  it('is loaded for every test, as for the app first render', () => {
    expect(editorLoaded()).toBe(true)
  })

  it('answers every golden board request as the core pinned it', async () => {
    await replay<BoardRequest, BoardResponse>('board-', requirementBoard)
  })

  it('answers every golden sheet request as the core pinned it', async () => {
    // Sheet requests carry the very drafts earlier answers returned.
    await replay<EditorRequest, EditorResponse>('editor-', requirementEditor)
  })

  it('answers a request it cannot read with its error rather than throwing', () => {
    const answer = requirementBoard({
      rows: [{ kind: 'wand' } as BoardRequest['rows'][number]],
    })
    expect(answer).toEqual({
      ok: false,
      error: 'row 1: key must be a whole number',
    })
  })
})
