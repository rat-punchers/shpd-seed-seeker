import { afterEach, expect, it } from 'bun:test'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { ReportItem } from '../../../src/engine/types'
import { ItemName } from '../../../src/features/analyze/report/ItemName'
import { effectTextColor } from '../../../src/features/analyze/report/item-glow'
import { itemTitle } from '../../../src/features/analyze/report/report-text'
import { realReport } from './fixtures'

let root: Root | undefined

afterEach(() => {
  act(() => root?.unmount())
  document.body.innerHTML = ''
})

async function gear(overrides: Partial<ReportItem>): Promise<ReportItem> {
  const report = await realReport('aaa-aaa-aaa.json')
  const item = report.floors[0]?.items[0] as ReportItem
  return { ...item, ...overrides }
}

function render(item: ReportItem): HTMLElement {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const container = document.createElement('p')
  document.body.append(container)
  act(() => {
    root = createRoot(container)
    root.render(<ItemName item={item} />)
  })
  return container
}

it('titles items in the game’s order', async () => {
  const blade = await gear({
    name: "Assassin's blade",
    category: 'weapon',
    upgrade: 4,
    effect: { name: 'Shocking', kind: 'enchantment' },
  })
  expect(itemTitle(blade)).toBe("Shocking assassin's blade +4")
  const armor = await gear({
    name: 'Plate armor',
    category: 'armor',
    upgrade: 3,
    effect: { name: 'Anti-Entropy', kind: 'curse' },
  })
  expect(itemTitle(armor)).toBe('Plate armor of anti-entropy +3')
  const plain = await gear({ name: 'Mace', upgrade: -1, effect: null })
  expect(itemTitle(plain)).toBe('Mace -1')
})

it('colors the effect and upgrade and keeps the title text intact', async () => {
  const blade = await gear({
    name: "Assassin's blade",
    category: 'weapon',
    upgrade: 4,
    effect: { name: 'Blazing', kind: 'enchantment' },
  })
  const title = render(blade)
  expect(title.textContent).toBe(itemTitle(blade))
  const effect = title.querySelector<HTMLElement>('[data-item-effect]')
  expect(effect?.textContent).toBe('Blazing ')
  expect(effectTextColor(blade.effect)).toBe(
    'oklch(from #ff4400 var(--effect-text-l) clamp(0.1, c, 0.17) h)'
  )
  expect(effectTextColor({ name: 'Shocking', kind: 'enchantment' })).toBe(
    'var(--color-info)'
  )
  expect(title.querySelector('[data-item-upgrade]')?.className).toBe(
    'text-tier-1'
  )
})

it('reads curses and negative upgrades in red', async () => {
  const mace = await gear({
    name: 'Mace',
    category: 'weapon',
    upgrade: -2,
    effect: { name: 'Annoying', kind: 'curse' },
  })
  const title = render(mace)
  expect(
    title.querySelector<HTMLElement>('[data-item-effect]')?.style.color
  ).toBe('var(--color-destructive)')
  expect(title.querySelector('[data-item-upgrade]')?.className).toBe(
    'text-destructive'
  )
})
