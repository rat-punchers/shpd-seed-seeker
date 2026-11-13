import { expect, it } from 'bun:test'
import { act } from 'react'
import {
  badges,
  boardElement,
  cancelDrag,
  chip,
  chipWhere,
  click,
  DISINTEGRATION,
  dragOver,
  ENERGY,
  FROST,
  ghost,
  installBoardHarness,
  openMenu,
  pointer,
  press,
  release,
  render,
  requirements,
  status,
  tags,
} from './board-harness'

installBoardHarness()

const ghostName = () =>
  ghost()?.querySelector('[data-slot="chip-name"]')?.textContent
const ghostBadge = () => ghost()?.querySelector('[data-slot="stack-badge"]')
const clusters = () => document.querySelector('[data-slot="cluster"]')

it('drags one item: the ghost is the chip alone, and a round trip folds back', async () => {
  await render(
    JSON.stringify({ requirements: [DISINTEGRATION, DISINTEGRATION, FROST] })
  )
  expect(badges('Wand of Disintegration')).toEqual(['×2'])
  const disintegration = chip('Wand of Disintegration')
  await dragOver(disintegration, chip('Wand of Frost'))
  expect(ghostName()).toBe('Wand of Disintegration')
  expect(ghostBadge()).toBeNull()
  expect(ghost()?.textContent).not.toContain('×')
  await release(disintegration)
  // One Disintegration joins; the other stays where it was.
  expect(requirements()).toEqual([
    DISINTEGRATION,
    { any_of: [FROST, DISINTEGRATION] },
  ])
  expect(badges('Wand of Frost')).toEqual([])

  const member = chipWhere('Wand of Disintegration', true)
  await dragOver(member, boardElement())
  expect(boardElement()?.getAttribute('data-drop-state')).toBe('detach')
  await release(member)
  expect(requirements()).toEqual([DISINTEGRATION, FROST, DISINTEGRATION])
  expect(clusters()).toBeNull()
  expect(badges('Wand of Disintegration')).toEqual(['×2'])
})

it('drags a bare copy of a stack: only the origin reads +4, and a round trip folds back', async () => {
  await render(
    JSON.stringify({
      requirements: [{ ...ENERGY, upgrade: 4 }, ENERGY, ENERGY, DISINTEGRATION],
    })
  )
  const energy = chip('Ring of Energy')
  expect(tags(energy)).toEqual(['+4'])
  await dragOver(energy, chip('Wand of Disintegration'))
  // The ghost is the core's lifted face: a plain ring, no badges.
  expect(ghostName()).toBe('Ring of Energy')
  expect(tags(ghost() as Element)).toEqual([])
  expect(ghostBadge()).toBeNull()
  // The dimmed origin keeps its +4 and the two rings it leaves.
  expect(tags(energy)).toEqual(['+4'])
  expect(badges('Ring of Energy')).toEqual(['×2'])
  await release(energy)
  expect(requirements()).toEqual([
    { ...ENERGY, upgrade: 4 },
    ENERGY,
    { any_of: [DISINTEGRATION, ENERGY] },
  ])
  const member = chipWhere('Ring of Energy', true)
  expect(tags(member)).toEqual([])
  expect(member.getAttribute('aria-label')).toBe('Ring of Energy, any upgrade')
  const stack = chipWhere('Ring of Energy', false)
  expect(tags(stack)).toEqual(['+4'])
  expect(stack.querySelector('[data-slot="stack-badge"]')?.textContent).toBe(
    '×2'
  )

  // The member has no copies: it moves itself, and folds back into the stack.
  await dragOver(member, boardElement())
  expect(tags(ghost() as Element)).toEqual([])
  await release(member)
  expect(requirements()).toEqual([
    { ...ENERGY, upgrade: 4 },
    ENERGY,
    DISINTEGRATION,
    ENERGY,
  ])
  expect(clusters()).toBeNull()
  expect(badges('Ring of Energy')).toEqual(['×3'])
  expect(tags(chip('Ring of Energy'))).toEqual(['+4'])
})

it("detaches a bare copy of a member's stack, which keeps its +2 in the cluster", async () => {
  await render(
    JSON.stringify({
      requirements: [
        {
          any_of: [{ ...FROST, upgrade: 2, identity_group: 1 }, DISINTEGRATION],
        },
        { kind: 'wand', identity_group: 1 },
      ],
    })
  )
  const frost = chip('Wand of Frost')
  expect(tags(frost)).toEqual(['+2'])
  await dragOver(frost, boardElement())
  expect(ghostName()).toBe('Wand of Frost')
  expect(tags(ghost() as Element)).toEqual([])
  expect(tags(frost)).toEqual(['+2'])
  await release(frost)
  expect(requirements()).toEqual([
    { any_of: [{ ...FROST, upgrade: 2 }, DISINTEGRATION] },
    FROST,
  ])
  expect(tags(chipWhere('Wand of Frost', true))).toEqual(['+2'])
  expect(tags(chipWhere('Wand of Frost', false))).toEqual([])
})

it('names and draws a stack picked up to join as the bare copy that moves', async () => {
  await render(
    JSON.stringify({
      requirements: [{ ...ENERGY, upgrade: 4 }, ENERGY, ENERGY, DISINTEGRATION],
    })
  )
  expect(chip('Ring of Energy').getAttribute('aria-label')).toBe(
    'Ring of Energy, exactly +4'
  )
  await openMenu('Ring of Energy')
  await click('orEither/or with…')
  const energy = chip('Ring of Energy')
  expect(energy.getAttribute('data-pick')).toBe('source')
  expect(tags(energy)).toEqual([])
  expect(energy.querySelector('[data-slot="stack-badge"]')).toBeNull()
  expect(energy.getAttribute('aria-label')).toBe('Ring of Energy, any upgrade')
  expect(status()).toBe('Either/or with… choose a chip for Ring of Energy')
  await act(async () => energy.focus())
  expect(
    document.querySelector('[data-slot="popover-title"]')?.textContent
  ).toBe('Ring of Energy')
  expect(document.querySelector('[data-slot="popover-relation"]')).toBeNull()
  await press(chip('Wand of Disintegration'), 'Enter')
  expect(requirements()).toEqual([
    { ...ENERGY, upgrade: 4 },
    ENERGY,
    { any_of: [DISINTEGRATION, ENERGY] },
  ])
  expect(tags(chipWhere('Ring of Energy', false))).toEqual(['+4'])
})

it("draws the ghost with the chip's whole face: its trailing tags and uncursed check", async () => {
  await render(
    JSON.stringify({
      requirements: [
        { ...FROST, exclude_resin: true, uncursed: true },
        DISINTEGRATION,
      ],
    })
  )
  const frost = chip('Wand of Frost')
  expect(frost.textContent).toContain('No resin')
  await dragOver(frost, chip('Wand of Disintegration'))
  expect(ghostName()).toBe('Wand of Frost')
  expect(ghost()?.textContent).toContain('No resin')
  expect(ghost()?.querySelector('[title="Uncursed"]')).not.toBeNull()
  await release(frost)
})

it('leaves a dimmed origin showing what its stack keeps, and its badges again after', async () => {
  await render(
    JSON.stringify({
      requirements: [{ ...ENERGY, upgrade: 4 }, ENERGY, ENERGY, FROST],
    })
  )
  expect(badges('Ring of Energy')).toEqual(['×3'])
  const energy = chip('Ring of Energy')
  await dragOver(energy, chip('Wand of Frost'))
  // The origin keeps two rings; the ghost is the one that moves.
  expect(energy.hasAttribute('data-dragging')).toBe(true)
  expect(badges('Ring of Energy')).toEqual(['×2'])
  expect(energy.querySelector('[title="2 of the same kind"]')).not.toBeNull()
  expect(ghostBadge()).toBeNull()
  // A cancelled drag puts the chip's own badges back.
  await cancelDrag(energy)
  expect(energy.hasAttribute('data-dragging')).toBe(false)
  expect(badges('Ring of Energy')).toEqual(['×3'])

  // A combined level the two rings left can still reach stays on the origin.
  await openMenu('Ring of Energy')
  await click('ΣCount levels together')
  expect(badges('Ring of Energy')).toEqual(['≤3', 'Σ ≥ 3'])
  await dragOver(chip('Ring of Energy'), chip('Wand of Frost'))
  expect(badges('Ring of Energy')).toEqual(['≤2', 'Σ ≥ 3'])
  await act(async () =>
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  )
  expect(badges('Ring of Energy')).toEqual(['≤3', 'Σ ≥ 3'])
})

it("leaves a member's origin as remove_one would, and a chip with no copies as it was", async () => {
  // Two Frosts, or one Disintegration.
  await render(
    JSON.stringify({
      requirements: [
        { any_of: [{ ...FROST, identity_group: 1 }, DISINTEGRATION] },
        { kind: 'wand', identity_group: 1 },
      ],
    })
  )
  const frost = chip('Wand of Frost')
  expect(badges('Wand of Frost')).toEqual(['×2'])
  await dragOver(frost, boardElement())
  expect(badges('Wand of Frost')).toEqual([])
  await cancelDrag(frost)
  expect(badges('Wand of Frost')).toEqual(['×2'])

  // Disintegration has no copies: the whole chip leaves its placeholder.
  const disintegration = chip('Wand of Disintegration')
  await dragOver(disintegration, boardElement())
  expect(disintegration.hasAttribute('data-dragging')).toBe(true)
  expect(badges('Wand of Disintegration')).toEqual([])
  expect(badges('Wand of Frost')).toEqual(['×2'])
  await cancelDrag(disintegration)
})

it('takes one item on the remove zone, and the whole stack from the menu', async () => {
  const drop = async (element: HTMLElement) => {
    await dragOver(element, () =>
      document.querySelector('[data-drop="delete"]')
    )
    await act(async () => element.dispatchEvent(pointer('pointermove', 70, 70)))
    expect(
      document.querySelector('[data-slot="ghost-tag"][data-kind="remove"]')
        ?.textContent
    ).toBe('remove')
    await release(element)
  }
  const LIGHTNING = { kind: 'wand', item: 'wand_lightning' }
  await render(
    JSON.stringify({
      requirements: [
        FROST,
        FROST,
        { any_of: [{ ...DISINTEGRATION, identity_group: 1 }, LIGHTNING] },
        { kind: 'wand', identity_group: 1 },
        { kind: 'wand', identity_group: 1 },
      ],
    })
  )
  expect(badges('Wand of Frost')).toEqual(['×2'])
  expect(badges('Wand of Disintegration')).toEqual(['×3'])
  // A lone stack gives up one item.
  await drop(chip('Wand of Frost'))
  expect(badges('Wand of Frost')).toEqual([])
  // So does a member's.
  await drop(chip('Wand of Disintegration'))
  expect(badges('Wand of Disintegration')).toEqual(['×2'])
  expect(requirements()).toEqual([
    FROST,
    { any_of: [{ ...DISINTEGRATION, identity_group: 1 }, LIGHTNING] },
    { kind: 'wand', identity_group: 1 },
  ])
  // The menu's Remove takes the member with its copies.
  await openMenu('Wand of Disintegration')
  await click('Remove')
  expect(requirements()).toEqual([FROST, LIGHTNING])
})
