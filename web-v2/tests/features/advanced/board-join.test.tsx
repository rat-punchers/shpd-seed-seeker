import { expect, it } from 'bun:test'
import { act } from 'react'
import { $query } from '../../../src/app/store/query'
import {
  badges,
  boardElement,
  chip,
  chipWhere,
  click,
  DISINTEGRATION,
  dragOver,
  FROST,
  ghost,
  installBoardHarness,
  menuCount,
  openMenu,
  press,
  release,
  render,
  requirements,
  status,
} from './board-harness'

installBoardHarness()

const dropState = (element: Element) => element.getAttribute('data-drop-state')
const clusterBadges = () =>
  document.querySelectorAll('[data-slot="cluster"] > [data-slot="stack-badge"]')
const group = (label: string) =>
  document.querySelector(`fieldset[data-slot="cluster"][aria-label="${label}"]`)

it('joins across categories onto a stack, which keeps its count on its own chip', async () => {
  await render(
    '{"requirements":[{"kind":"ring","item":"ring_might","upgrade":2},{"kind":"ring","item":"ring_might"},{"kind":"wand"}]}'
  )
  const wand = chip('Any wand')
  await dragOver(wand, chip('Ring of Might'))
  expect(dropState(chip('Ring of Might'))).toBe('alternative')
  expect(status()).toBeUndefined()
  await release(wand)
  expect(requirements()).toEqual([
    {
      any_of: [
        { kind: 'ring', item: 'ring_might', upgrade: 2, identity_group: 1 },
        { kind: 'wand' },
      ],
    },
    { kind: 'ring', identity_group: 1 },
  ])
  // Two Rings of Might, or one wand: the ×2 is the ring's alone.
  expect(badges('Ring of Might')).toEqual(['×2'])
  expect(badges('Any wand')).toEqual([])
  expect(clusterBadges()).toHaveLength(0)
})

it('refuses a join that needs a stack label when none is free, says why and keeps the query', async () => {
  await render(
    JSON.stringify({
      requirements: [
        ...['wand', 'armor', 'ring', 'weapon'].flatMap((kind, index) => [
          { kind, upgrade: 1, identity_group: index + 1 },
          { kind, identity_group: index + 1 },
        ]),
        FROST,
        FROST,
        DISINTEGRATION,
      ],
    })
  )
  const query = $query.get()
  const disintegration = chip('Wand of Disintegration')
  await dragOver(disintegration, chip('Wand of Frost'))
  expect(dropState(chip('Wand of Frost'))).toBe('refused')
  expect(
    document.querySelector('[data-slot="ghost-tag"][data-kind="or"]')
  ).toBeNull()
  const message =
    'Every group label is in use. Remove a stack or a combined level first.'
  expect(status()).toBe(message)
  await release(disintegration)
  expect($query.get()).toBe(query)
  expect(status()).toBe(message)
})

it("draws each member's stack on its own chip and steps it from the member's menu", async () => {
  // One label on every member: two of whichever matched, drawn as each ×2.
  await render(
    JSON.stringify({
      requirements: [
        {
          any_of: [
            { ...FROST, identity_group: 1 },
            { ...DISINTEGRATION, identity_group: 1 },
          ],
        },
        { kind: 'wand', identity_group: 1 },
      ],
    })
  )
  expect(badges('Wand of Frost')).toEqual(['×2'])
  expect(badges('Wand of Disintegration')).toEqual(['×2'])
  expect(clusterBadges()).toHaveLength(0)
  await openMenu('Wand of Frost')
  expect(
    document.querySelector('[role="menu"] [aria-label="How many"]')
  ).not.toBeNull()
  await click('One more')
  expect(menuCount()).toBe('3')
  expect(badges('Wand of Frost')).toEqual(['×3'])
  expect(badges('Wand of Disintegration')).toEqual(['×2'])
  // The stacks differ now, so Frost takes a label of its own.
  expect(requirements()).toEqual([
    {
      any_of: [
        { ...FROST, identity_group: 2 },
        { ...DISINTEGRATION, identity_group: 1 },
      ],
    },
    { kind: 'wand', identity_group: 1 },
    { kind: 'wand', identity_group: 2 },
    { kind: 'wand', identity_group: 2 },
  ])
  // The inline stepper is the member's too.
  await click('×2')
  expect(
    chip('Wand of Disintegration').querySelector(
      '[data-slot="stack-edit"][aria-label="How many"]'
    )
  ).not.toBeNull()
})

it("keeps a stacked target's stack as a member, and detaches one copy of it", async () => {
  await render(JSON.stringify({ requirements: [FROST, FROST, DISINTEGRATION] }))
  const disintegration = chip('Wand of Disintegration')
  await dragOver(disintegration, chip('Wand of Frost'))
  await release(disintegration)
  // Two Frosts, or one Disintegration.
  expect(requirements()).toEqual([
    { any_of: [{ ...FROST, identity_group: 1 }, DISINTEGRATION] },
    { kind: 'wand', identity_group: 1 },
  ])
  expect(badges('Wand of Frost')).toEqual(['×2'])
  expect(badges('Wand of Disintegration')).toEqual([])

  const frost = chip('Wand of Frost')
  await dragOver(frost, boardElement())
  expect(ghost()?.querySelector('[data-slot="stack-badge"]')).toBeNull()
  await release(frost)
  expect(requirements()).toEqual([{ any_of: [FROST, DISINTEGRATION] }, FROST])
  for (const clustered of [true, false])
    expect(
      chipWhere('Wand of Frost', clustered).querySelector(
        '[data-slot="stack-badge"]'
      )
    ).toBeNull()
})

it('shows a chip picked up to join without its badges', async () => {
  await render(JSON.stringify({ requirements: [FROST, FROST, DISINTEGRATION] }))
  await openMenu('Wand of Frost')
  await click('orEither/or with…')
  const frost = chip('Wand of Frost')
  expect(frost.getAttribute('data-pick')).toBe('source')
  expect(frost.querySelector('[data-slot="stack-badge"]')).toBeNull()
  await press(chip('Wand of Disintegration'), 'Enter')
  // One Frost joins; the other stays behind.
  expect(requirements()).toEqual([FROST, { any_of: [DISINTEGRATION, FROST] }])
  expect(
    chipWhere('Wand of Frost', false).querySelector('[data-slot="stack-badge"]')
  ).toBeNull()
})

it('joins by drag and by pick, and a lone chip stays put on the board', async () => {
  await render(
    '{"requirements":[{"kind":"wand"},{"kind":"wand","item":"wand_frost"},{"kind":"ring"}]}'
  )
  const frost = chip('Wand of Frost')
  await dragOver(frost, chip('Any wand'))
  expect(dropState(chip('Any wand'))).toBe('alternative')
  expect(
    document.querySelector('[data-slot="ghost-tag"][data-kind="or"]')
      ?.textContent
  ).toBe('or')
  await release(frost)
  expect(group('Any of 2')).not.toBeNull()
  expect(requirements()).toEqual([
    { any_of: [{ kind: 'wand' }, { kind: 'wand', item: 'wand_frost' }] },
    { kind: 'ring' },
  ])

  const query = $query.get()
  const ring = chip('Any ring')
  await dragOver(ring, boardElement())
  await release(ring)
  expect($query.get()).toBe(query)

  await openMenu('Any ring')
  await click('orEither/or with…')
  expect(status()).toBe('Either/or with… choose a chip for Any ring')
  expect(chip('Any wand').getAttribute('data-pick')).toBe('pickable')
  await act(async () =>
    chip('Wand of Frost').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    )
  )
  expect(group('Any of 3')).not.toBeNull()
  await openMenu('Any ring')
  await click('On its own')
  expect(group('Any of 2')).not.toBeNull()
})
