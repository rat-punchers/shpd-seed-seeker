import { afterEach, expect, it } from 'bun:test'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { App } from '../../src/app/App'

let root: Root | undefined

afterEach(() => {
  act(() => root?.unmount())
  document.body.innerHTML = ''
})

it('shows the app name and the supported game version', () => {
  const container = document.createElement('div')
  document.body.append(container)
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  act(() => {
    root = createRoot(container)
    root.render(<App />)
  })
  expect(container.querySelector('h1')?.textContent).toBe(
    'Seed Seeker · SHPD v4.0.2'
  )
})
