import { expect, it, spyOn } from 'bun:test'
import { act } from 'react'
import { $query, setQuery } from '../../../src/app/store/query'
import * as editor from '../../../src/engine/editor'
import { requirementBoard } from '../../../src/engine/editor'
import type { ItemSource } from '../../../src/engine/types'
import { AdvancedQuery } from '../../../src/features/advanced'
import { RequirementBoard } from '../../../src/features/advanced/board/RequirementBoard'
import { fromQueryJson } from '../../../src/features/query/query'
import {
  badges,
  button,
  chip,
  click,
  dragOver,
  draw,
  installBoardHarness,
  menuCount,
  openMenu,
  pointer,
  press,
  release,
  render,
  requirements,
  status,
} from './board-harness'

installBoardHarness()

it("steps a stack from its menu, which follows the stack's fresh count", async () => {
  await render(
    '{"requirements":[{"kind":"ring","item":"ring_might","upgrade":2}]}'
  )
  await openMenu('Ring of Might')
  expect(button('ΣCount levels together')).toBeUndefined()
  await click('One more')
  expect($query.get().requirements).toHaveLength(2)
  expect(menuCount()).toBe('2')
  await click('One more')
  expect($query.get().requirements).toHaveLength(3)
  expect(menuCount()).toBe('3')
  expect(button('One more')?.disabled).toBe(true)
  await click('ΣCount levels together')
  expect(badges('Ring of Might')).toEqual(['≤3', 'Σ ≥ 3'])
  expect(document.body.textContent).toContain('1 requirement')
})

it("bounds both count steppers by the core's count_max", async () => {
  const answer = requirementBoard({
    rows: [
      { key: 1, kind: 'ring', item: 'ring_might' },
      { key: 2, kind: 'ring', item: 'ring_might' },
    ],
  })
  if (!answer.ok) throw new Error(answer.error)
  const [item] = answer.value.items
  const ring = item?.chips[0]
  if (!item || !ring) throw new Error('no ring chip')
  expect(ring.stack).toMatchObject({
    count: 2,
    max: 3,
    can_grow: true,
    count_max: 3,
  })
  const drawWith = (count_max: number) =>
    draw(
      <RequirementBoard
        items={[
          {
            ...item,
            chips: [{ ...ring, stack: { ...ring.stack, count_max } }],
          },
        ]}
        onEdits={() => ({ notice: null, rekeyed: [] })}
        onEdit={() => null}
        onAdd={() => {}}
      />
    )
  await drawWith(3)
  await openMenu('Ring of Might')
  expect(button('One more')?.disabled).toBe(false)
  // A stack that may only shed copies: the core bounds it at its count.
  await drawWith(2)
  expect(button('One more')?.disabled).toBe(true)
  await click('×2')
  const inline = document.querySelector('[data-slot="stack-edit"]')
  expect(inline?.getAttribute('aria-label')).toBe('How many')
  expect(button('One more', inline ?? document)?.disabled).toBe(true)
})

it("styles the resin chip's credit apart from its filter, each tag with the core's hover text", async () => {
  await render(
    '{"arcane_resin":"auto","arcane_resin_filter":{"include_mage_wand":true,"max_depth":9},"requirements":[{"kind":"wand","item":"wand_frost","upgrade":3}]}'
  )
  const tagsOf = (within: Element | null) =>
    [...(within?.querySelectorAll('[data-slot="chip-tag"]') ?? [])].map(
      (tag) => ({
        text: tag.textContent,
        style: tag.getAttribute('data-style'),
        title: tag.getAttribute('title'),
      })
    )
  expect(tagsOf(document.querySelector('[data-slot="resin-chip"]'))).toEqual([
    {
      text: 'Auto',
      style: 'credit',
      title:
        'Enough resin to upgrade kept wands to +3, excluding No resin wands and reforge copies',
    },
    {
      text: 'Mage +2',
      style: 'credit',
      title: 'Starting Magic Missile contributes 2 resin',
    },
    { text: 'F≤9', style: 'plain', title: null },
  ])
  // A requirement chip's tags carry no hover text of their own.
  expect(tagsOf(chip('Wand of Frost'))).toEqual([
    { text: '+3', style: 'upgrade', title: null },
  ])
})

it("steps a combined level down to off and back on at the core's default", async () => {
  await render('{"requirements":[{"kind":"ring","item":"ring_might"}]}')
  await openMenu('Ring of Might')
  await click('One more')
  await click('ΣCount levels together')
  expect(badges('Ring of Might')).toEqual(['≤2', 'Σ ≥ 2'])
  await click('Σ ≥ 2')
  await click('Lower total')
  expect(badges('Ring of Might')).toEqual(['≤2', 'Σ ≥ 1'])
  await click('Lower total')
  // Off: the stepper stays open at the core's "Σ ≥ 0", with nothing to lower.
  expect(badges('Ring of Might')).toEqual(['×2', 'Σ ≥ 0'])
  expect(button('Lower total')?.disabled).toBe(true)
  expect(requirements()).toEqual([
    { kind: 'ring', item: 'ring_might' },
    { kind: 'ring', item: 'ring_might' },
  ])
  await click('Raise total')
  expect(badges('Ring of Might')).toEqual(['≤2', 'Σ ≥ 2'])
})

it('opens the menu and removes a chip from the keyboard, or by dropping it on the remove zone', async () => {
  await render(
    '{"requirements":[{"kind":"wand"},{"kind":"ring"},{"kind":"armor"}]}'
  )
  await press(chip('Any wand'), '.')
  expect(document.querySelector('[role="menu"]')).not.toBeNull()
  expect(button('Edit…')).toBeDefined()
  await press(chip('Any wand'), 'Escape')
  expect(document.querySelector('[role="menu"]')).toBeNull()
  await press(chip('Any ring'), 'Delete')
  expect(requirements()).toEqual([{ kind: 'wand' }, { kind: 'armor' }])
  const armor = chip('Any armor')
  await dragOver(armor, () => document.querySelector('[data-drop="delete"]'))
  // The remove zone appears once the drag has begun.
  await act(async () => armor.dispatchEvent(pointer('pointermove', 70, 70)))
  expect(
    document.querySelector('[data-slot="delete-zone"][data-over]')
  ).not.toBeNull()
  expect(
    document.querySelector('[data-slot="ghost-tag"][data-kind="remove"]')
      ?.textContent
  ).toBe('remove')
  await release(armor)
  expect(requirements()).toEqual([{ kind: 'wand' }])
  expect(document.querySelector('[data-drop="delete"]')).toBeNull()
})

it("says why a row the core cannot read won't open, and lets it be removed", async () => {
  await render(
    '{"requirements":[{"kind":"wand","item":"wand_of_wonders"},{"kind":"ring"}]}'
  )
  const unknown = chip('Unknown requirement')
  expect(unknown.hasAttribute('data-problem')).toBe(true)
  await press(unknown, 'Enter')
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(status()).toBe(
    "This requirement cannot be read: unknown item 'wand_of_wonders'."
  )
  expect(document.querySelector('[role="alert"]')).toBeNull()
  await openMenu('Unknown requirement')
  expect(button('Edit…')).toBeUndefined()
  expect(button('orEither/or with…')).toBeUndefined()
  await click('Remove')
  expect(requirements()).toEqual([{ kind: 'ring' }])
})

it('marks a chip whose requirement has a problem and explains it on hover', async () => {
  await render('{"requirements":[{"kind":"wand","max_depth":30}]}')
  const wand = chip('Any wand')
  expect(wand.hasAttribute('data-problem')).toBe(true)
  expect(wand.getAttribute('aria-label')).toBe(
    'Any wand, any upgrade, floors 1–30'
  )
  await act(async () => wand.focus())
  expect(
    document.querySelector('[data-slot="popover-problem"]')?.textContent
  ).toBe('Requirement floor must be 1 through 24.')
})

it('offers to clear the requirements when the editor cannot draw them', async () => {
  // React reports the error the boundary catches.
  const quiet = spyOn(console, 'error').mockImplementation(() => {})
  setQuery({
    ...fromQueryJson('{"requirements":[{"kind":"wand"}]}'),
    arcaneResin: 2,
    arcaneResinFilter: { uncursed: true, source: 'nowhere' as ItemSource },
  })
  await draw(<AdvancedQuery />)
  const alert = () =>
    [...document.querySelectorAll('[role="alert"]')].find((element) =>
      element.textContent?.includes('The requirements could not be shown')
    )
  expect(alert()).toBeDefined()
  await click('Clear requirements')
  expect($query.get().requirements).toEqual([])
  expect($query.get().arcaneResin).toBeUndefined()
  expect(alert()).toBeUndefined()
  expect(button('Add')).toBeDefined()
  expect(document.body.textContent).toContain('No requirements')
  quiet.mockRestore()
})

it('reports a sheet the editor cannot open, and clears the requirements', async () => {
  const quiet = spyOn(console, 'error').mockImplementation(() => {})
  const trap = spyOn(editor, 'requirementEditor').mockReturnValueOnce({
    ok: false,
    error: 'the editor trapped',
  })
  await render('{"requirements":[{"kind":"wand"}]}')
  await press(chip('Any wand'), 'Enter')
  expect(trap).toHaveBeenCalled()
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    'The requirements could not be shown: the editor trapped'
  )
  await click('Clear requirements')
  expect($query.get().requirements).toEqual([])
  expect(document.querySelector('[role="alert"]')).toBeNull()
  trap.mockRestore()
  quiet.mockRestore()
})

it('refuses a drop onto the resin chip and keeps the query', async () => {
  await render(
    '{"arcane_resin":3,"requirements":[{"kind":"wand","item":"wand_frost"}]}'
  )
  const query = $query.get()
  const frost = chip('Wand of Frost')
  await dragOver(frost, document.querySelector('[data-slot="resin-chip"]'))
  await release(frost)
  expect($query.get()).toBe(query)
})
