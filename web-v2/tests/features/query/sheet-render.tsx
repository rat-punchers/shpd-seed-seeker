import { renderToStaticMarkup } from 'react-dom/server'
import type { EditorSheet, QueryState } from '../../../src/engine/types'
import {
  SheetBody,
  sheetTitle,
} from '../../../src/features/advanced/sheet/RequirementEditor'
import {
  openSheet,
  type SheetTarget,
} from '../../../src/features/query/requirements/sheet'

/** The sheet the core opens on `target`, or a failed test. */
export function sheetOn(query: QueryState, target: SheetTarget): EditorSheet {
  const answer = openSheet(query, target)
  if (!answer.ok) throw new Error(answer.error)
  return answer.value
}

/** A sheet as drawn: its title, its subject and its form as a DOM tree. */
export function drawSheet(sheet: EditorSheet) {
  const body = document.createElement('div')
  body.innerHTML = renderToStaticMarkup(
    <SheetBody sheet={sheet} onChange={() => {}} />
  )
  return { title: sheetTitle(sheet), subject: sheet.form.title, body }
}
