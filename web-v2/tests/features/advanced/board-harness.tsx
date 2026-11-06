import { afterEach, beforeEach, expect } from 'bun:test'
import { TooltipProvider } from '@seed-seeker/design/ui/tooltip'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { $query, setQuery } from '../../../src/app/store/query'
import { AdvancedQuery } from '../../../src/features/advanced'
import { $editor, $editorFailure } from '../../../src/features/advanced/store'
import {
  defaultQueryState,
  fromQueryJson,
  toQueryDocument,
} from '../../../src/features/query/query'

// Drives the Advanced view as the requirement board tests of the old web did:
// chips found by name, gestures sent as DOM events, the saved query read back.

export let host: HTMLDivElement
let root: Root

/** Installs a fresh host and an empty query around every test of the file. */
export function installBoardHarness(): void {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    setQuery(defaultQueryState())
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    document.body.innerHTML = ''
    $editor.set(null)
    $editorFailure.set(null)
    setQuery(defaultQueryState())
    restoreHitTesting()
    localStorage.clear()
  })
}

export async function draw(element: ReactNode): Promise<void> {
  await act(async () =>
    root.render(<TooltipProvider>{element}</TooltipProvider>)
  )
}

/** Shows the Advanced view of the query document `json`. */
export async function render(json: string): Promise<void> {
  setQuery(fromQueryJson(json))
  await draw(<AdvancedQuery />)
}

const chips = () =>
  [...document.querySelectorAll<HTMLElement>('[data-drop="chip"]')].map(
    (element) => ({
      element,
      name: element.querySelector('[data-slot="chip-name"]')?.textContent,
    })
  )

export function chip(name: string): HTMLElement {
  const found = chips().find((entry) => entry.name === name)?.element
  expect(found).toBeDefined()
  return found as HTMLElement
}

/** The chip named `name` inside a cluster, or outside every cluster. */
export function chipWhere(name: string, clustered: boolean): HTMLElement {
  const found = chips().find(
    (entry) =>
      entry.name === name &&
      (entry.element.closest('[data-slot="cluster"]') !== null) === clustered
  )?.element
  expect(found).toBeDefined()
  return found as HTMLElement
}

export const button = (
  name: string,
  within: ParentNode = document
): HTMLButtonElement | undefined =>
  [...within.querySelectorAll<HTMLButtonElement>('button')].find(
    (element) =>
      (element.getAttribute('aria-label') ?? element.textContent?.trim()) ===
      name
  )

export async function click(name: string, within: ParentNode = document) {
  const found = button(name, within)
  expect(found).toBeDefined()
  await act(async () => found?.click())
}

export async function openMenu(name: string) {
  await act(async () =>
    chip(name).dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 })
    )
  )
}

export async function press(element: HTMLElement, key: string) {
  await act(async () =>
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  )
}

export const pointer = (type: string, x: number, y: number) =>
  new PointerEvent(type, {
    bubbles: true,
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    clientX: x,
    clientY: y,
  })

const realElementFromPoint = document.elementFromPoint

function restoreHitTesting() {
  document.elementFromPoint = realElementFromPoint
}

/**
 * Lifts `source` and holds it over `target`, as far as hit-testing goes; a
 * function finds a target that appears only once the drag has begun.
 */
export async function dragOver(
  source: HTMLElement,
  target: Element | null | (() => Element | null)
) {
  source.setPointerCapture = () => {}
  document.elementFromPoint = () =>
    typeof target === 'function' ? target() : target
  await act(async () => source.dispatchEvent(pointer('pointerdown', 20, 20)))
  await act(async () => source.dispatchEvent(pointer('pointermove', 60, 60)))
}

export async function release(source: HTMLElement) {
  await act(async () => source.dispatchEvent(pointer('pointerup', 60, 60)))
}

export async function cancelDrag(source: HTMLElement) {
  await act(async () => source.dispatchEvent(pointer('pointercancel', 60, 60)))
}

export const status = () =>
  document.querySelector('[data-slot="board-status"]')?.textContent ?? undefined

export const badges = (name: string) =>
  [...chip(name).querySelectorAll('[data-slot="stack-badge"]')].map(
    (badge) => badge.textContent
  )

export const tags = (element: Element) =>
  [...element.querySelectorAll('[data-slot="chip-tag"]')].map(
    (tag) => tag.textContent
  )

export const ghost = () =>
  document.querySelector<HTMLElement>('[data-slot="chip-ghost"]')

export const boardElement = () => document.querySelector('[data-drop="board"]')

export const menuCount = () =>
  document.querySelector('[data-slot="menu-count"]')?.textContent

export const requirements = (): unknown[] =>
  toQueryDocument($query.get()).requirements

export const FROST = { kind: 'wand', item: 'wand_frost' }
export const DISINTEGRATION = { kind: 'wand', item: 'wand_disintegration' }
export const ENERGY = { kind: 'ring', item: 'ring_energy' }
