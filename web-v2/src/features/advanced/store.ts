import { $query, setQuery } from '../../app/store/query'
import type {
  BoardEdit,
  EditorChange,
  EditorSheet,
  QueryState,
} from '../../engine/types'
import { AppStore } from '../../shared/store/persistent'
import { editBoard } from '../query/requirements/board'
import {
  changeSheet,
  openSheet,
  type SheetTarget,
  saveSheet,
} from '../query/requirements/sheet'
import type { BoardEditReport } from './board/use-board'

/** The open requirement sheet. */
export interface EditorSession {
  sheet: EditorSheet
  /** Why the core could not answer the sheet's last request. */
  notice?: string
}

/** The sheet being edited, or none. */
export const $editor = new AppStore<EditorSession | null>(null)

/**
 * A failure of the editor itself (a sheet it could not open): the Advanced
 * view's boundary reports it and offers to clear the requirements.
 */
export const $editorFailure = new AppStore<string | null>(null)

/** The chip the last save landed on, to bring into view. */
export const $savedFocus = new AppStore<{ key: number } | null>(null)

const patchQuery = (patch: Partial<QueryState>) =>
  setQuery({ ...$query.get(), ...patch })

/**
 * Applies board edits to the saved query, writing the requirements back
 * only when they changed.
 */
export function applyBoardEdits(edits: BoardEdit[]): BoardEditReport {
  const state = $query.get()
  const answer = editBoard(state, edits)
  if (!answer.ok) return { notice: answer.error, rekeyed: [] }
  const { changed, requirements, refused, rekeyed } = answer.value
  if (changed) setQuery({ ...state, requirements })
  return { notice: refused?.message ?? null, rekeyed }
}

/** Opens the sheet, or answers why the core refuses to open it on a row it cannot read. */
export function openEditor(target: SheetTarget): string | null {
  const answer = openSheet($query.get(), target)
  if (answer.ok) $editor.set({ sheet: answer.value })
  else if (answer.key !== undefined) return answer.error
  else $editorFailure.set(answer.error)
  return null
}

export function changeEditor(change: EditorChange): void {
  const session = $editor.get()
  if (!session) return
  const answer = changeSheet(session.sheet, change)
  $editor.set(
    answer.ok ? { sheet: answer.value } : { ...session, notice: answer.error }
  )
}

export function closeEditor(): void {
  $editor.set(null)
}

export function saveEditor(): void {
  const session = $editor.get()
  if (!session) return
  const state = $query.get()
  const answer = saveSheet(state, session.sheet)
  if (!answer.ok) {
    $editor.set({ ...session, notice: answer.error })
    return
  }
  if ('refused' in answer.value) {
    $editor.set({ sheet: answer.value.refused })
    return
  }
  const { changed, requirements, resin, focus } = answer.value.saved
  // Saving a chip unchanged keeps the query as it was.
  if (changed || resin) setQuery({ ...state, requirements, ...resin })
  $editor.set(null)
  if (focus !== null) $savedFocus.set({ key: focus })
}

export function removeResin(): void {
  patchQuery({ arcaneResin: undefined, arcaneResinFilter: undefined })
}

/** The way out of requirements the editor cannot draw. */
export function clearRequirements(): void {
  $editor.set(null)
  $editorFailure.set(null)
  patchQuery({
    requirements: [],
    arcaneResin: undefined,
    arcaneResinFilter: undefined,
  })
}
