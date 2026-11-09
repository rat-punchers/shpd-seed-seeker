import { afterEach, beforeEach, expect, it } from 'bun:test'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { App } from '../../src/app/App'
import { preloadFind } from '../../src/app/lazy-find'
import { setMode } from '../../src/app/store/mode'

let root: Root | undefined
let container: HTMLDivElement

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  setMode('analyze')
  container = document.createElement('div')
  document.body.append(container)
  act(() => {
    root = createRoot(container)
    root.render(<App />)
  })
})

afterEach(() => {
  act(() => root?.unmount())
  document.body.innerHTML = ''
})

function heading(level: number): string | undefined {
  return (
    container.querySelector(`h${level}, [aria-level="${level}"]`)
      ?.textContent ?? undefined
  )
}

it('shows the app name and the supported game version', () => {
  expect(container.querySelector('h1')?.textContent).toBe(
    'Seed Seeker · SHPD v4.0.2'
  )
})

it('shows the workspace for the stored mode', async () => {
  expect(heading(2)).toBe('No seeds analyzed yet')
  await act(async () => {
    setMode('find')
    await preloadFind()
  })
  expect(heading(2)).toBe('No search yet')
  const selected = container.querySelector('[role="tab"][aria-selected="true"]')
  expect(selected?.textContent).toBe('Find')
})

it('links the license and attribution and names the engine version', () => {
  const footer = container.querySelector('footer')
  expect(footer?.textContent).toContain('Shattered Pixel Dungeon v4.0.2')
  expect(footer?.textContent).toContain('GPL-3.0-or-later')
  const links = Object.fromEntries(
    [...(footer?.querySelectorAll('a') ?? [])].map((a) => [
      a.textContent,
      a.getAttribute('href'),
    ])
  )
  expect(links.License).toBe('/licenses/COPYING.txt')
  expect(links['Asset attribution']).toBe(
    '/third_party/shattered-pixel-dungeon/ATTRIBUTION.md'
  )
})
