import { afterEach, expect, it } from 'bun:test'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { ReportItem } from '../../../src/engine/types'
import { ItemRangeDetails } from '../../../src/features/analyze/report/ItemRangeDetails'
import { realReport } from './fixtures'

let root: Root | undefined

afterEach(() => {
  act(() => root?.unmount())
  document.body.innerHTML = ''
})

function render(item: ReportItem): string {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const container = document.createElement('div')
  document.body.append(container)
  act(() => {
    root = createRoot(container)
    root.render(<ItemRangeDetails item={item} />)
  })
  return container.textContent ?? ''
}

// The engine reports exact ranges for the committed seeds. This test widens
// a real item to cover the rest of the format.
it('lists ranges that are not fixed and no conditions', async () => {
  const report = await realReport('aaa-aaa-aaa.json')
  const item = report.floors[0]?.items[0] as ReportItem
  const text = render({
    ...item,
    prediction: 'constrained',
    ranges: {
      level: { min: 0, max: 2 },
      tier: { min: 2, max: 3 },
      quantity: { min: 1, max: 1 },
    },
    conditions: [
      { type: 'challenge', challenge: 'on_diet', enabled: false },
      {
        type: 'trinket',
        events: [
          {
            beforeDepth: 2,
            kind: 'acquired',
            trinket: 'mimic_tooth',
            minUpgrades: 3,
          },
        ],
      },
      { type: 'inventory', requirement: 'wand_frost' },
    ],
  })
  expect(text).toContain('Starts between +0 to +2.')
  expect(text).toContain('Tier 2 to 3.')
  expect(text).not.toContain('Quantity')
  expect(text).not.toContain('Conditions')
  expect(text).not.toContain('On Diet')
})

it('renders nothing for an item the seed fixes outright', async () => {
  const report = await realReport('aaa-aaa-aaa.json')
  const exact = report.floors
    .flatMap((floor) => floor.items)
    .find((item) => item.prediction === 'exact') as ReportItem
  expect(render(exact)).toBe('')
})
