import { afterEach, describe, expect, it } from 'bun:test'
import { TooltipProvider } from '@seed-seeker/design/ui/tooltip'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { SeedReport } from '../../../src/engine/types'
import { hideItemDetail } from '../../../src/features/analyze/report/item-detail-store'
import { SeedReportView } from '../../../src/features/analyze/report/SeedReportView'
import { REAL_FIXTURES, realReport } from './fixtures'

let root: Root | undefined
let container: HTMLDivElement
let picked: string[] = []

function render(report: SeedReport, busy = false) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  picked = []
  container = document.createElement('div')
  document.body.append(container)
  act(() => {
    root = createRoot(container)
    root.render(
      <TooltipProvider>
        <SeedReportView
          report={report}
          trinketChoice={{ busy, select: (trinket) => picked.push(trinket) }}
        />
      </TooltipProvider>
    )
  })
}

afterEach(() => {
  act(() => hideItemDetail())
  act(() => root?.unmount())
  document.body.innerHTML = ''
})

const all = (selector: string) => [...container.querySelectorAll(selector)]
const text = () => container.textContent ?? ''
const slots = () => all('[data-slot="item-box"]')

describe('a real report', () => {
  for (const file of REAL_FIXTURES) {
    it(`renders every section ${file} lists, and only those`, async () => {
      const report = await realReport(file)
      render(report)
      expect(container.querySelector('[data-seed-title]')?.textContent).toBe(
        report.seed.code
      )
      // Each item but gold, keys and quest items appears once: on its
      // floor, or on its quest's card.
      const unlisted = ['ceremonial_candle', 'corpse_dust', 'embers']
      const items = report.floors
        .flatMap((floor) => floor.items)
        .filter(
          (item) =>
            item.category !== 'gold' &&
            item.category !== 'key' &&
            !unlisted.includes(item.id)
        )
      expect(slots()).toHaveLength(items.length)
      expect(all('[data-rail-depth]')).toHaveLength(report.floors.length)
      expect(all('[data-floor-depth]')).toHaveLength(report.floors.length)
      expect(
        all('[data-quest]').map((card) => card.getAttribute('data-quest'))
      ).toEqual(report.quests.map((quest) => quest.quest))
      const identities = container.querySelector('[data-identities]')
      expect(identities?.querySelectorAll('[role="img"]')).toHaveLength(36)
      // The Catalyst choice sits on the floor the trinket is picked on.
      const band = container.querySelector('[data-trinket-choice]')
      expect(
        band?.closest('[data-floor-depth]')?.getAttribute('data-floor-depth')
      ).toBe(String(report.trinkets.timing?.selectionDepth))
      expect(band?.querySelectorAll('[role="radio"]')).toHaveLength(4)
      const pots = report.floors.flatMap((floor) => floor.appearances ?? [])
      expect(all('[data-alchemy-pot]')).toHaveLength(pots.length)
      expect(all('[aria-label="Initial encounters"]')).toHaveLength(0)
      expect(
        all('[aria-label="Per-slot reward outlook"]').length +
          all('[aria-label="Wand reward outlook"]').length
      ).toBe(2)
    })
  }

  it('hides each section the report does not list', async () => {
    const report = await realReport('aaa-aaa-aaa.json')
    // A report leaves out the fields of a section it does not list.
    const without = (section: SeedReport['sections'][number]): SeedReport => ({
      ...report,
      sections: report.sections.filter((listed) => listed !== section),
      floors: report.floors.map(({ appearances, ...floor }) => ({
        ...floor,
        ...(section === 'alchemyPots' ? {} : { appearances }),
      })),
      quests: report.quests.map(
        ({ slots, upgradesPinned, totalUpgradeValue, ...quest }) =>
          section === 'questRewardSlots'
            ? quest
            : { ...quest, slots, upgradesPinned, totalUpgradeValue }
      ),
    })
    for (const [section, selector] of [
      ['alchemyPots', '[data-alchemy-pot]'],
      ['questRewardSlots', '[aria-label="Per-slot reward outlook"]'],
      ['questRewardSlots', '[aria-label="Wand reward outlook"]'],
    ] as const) {
      render(without(section))
      expect(`${section}: ${all(selector).length}`).toBe(`${section}: 0`)
      act(() => root?.unmount())
      document.body.innerHTML = ''
    }
  })

  it('labels a floor with its feeling and its boss', async () => {
    const report = await realReport('aaa-aaa-aaa.json')
    render(report)
    const floor2 = container.querySelector('[data-floor-depth="2"]')
    expect(floor2?.querySelector('[data-feeling]')?.textContent).toBe('Chasm')
    expect(floor2?.querySelector('[data-boss]')).toBeNull()
    const floor5 = container.querySelector('[data-floor-depth="5"]')
    expect(floor5?.textContent).toContain('Sewers, boss: Goo')
    expect(
      all('[data-boss]').map((block) => block.getAttribute('data-boss'))
    ).toEqual(['Goo', 'Tengu', 'DM-300', 'Dwarf King'])
    expect(
      container
        .querySelector('[data-rail-depth="3"]')
        ?.getAttribute('aria-label')
    ).toContain('Sad Ghost quest')
  })

  it('opens the description of an item on click', async () => {
    const report = await realReport('aaa-aaa-aaa.json')
    render(report)
    const wand = slots().find((slot) =>
      slot.getAttribute('aria-label')?.startsWith('Wand of frost')
    ) as HTMLButtonElement
    act(() => wand.click())
    const panel = document.querySelector('[data-slot="item-detail"]')
    expect(panel?.textContent).toContain('Floor 1, Heap')
    act(() => wand.click())
    expect(document.querySelector('[data-slot="item-detail"]')).toBeNull()
  })

  it('picks a trinket, and pressing the picked one again picks none', async () => {
    const report = await realReport('aaa-aaa-aaa.json')
    render({
      ...report,
      trinkets: { ...report.trinkets, selected: 'mimic_tooth' },
    })
    const offer = (name: string) =>
      container.querySelector(
        `[role="radio"][aria-label="${name}"]`
      ) as HTMLElement
    act(() => offer('Parchment Scrap').click())
    act(() => offer('Mimic Tooth').click())
    expect(picked).toEqual(['parchment_scrap', 'none'])
  })
})

describe('the engine-filled sections of AAA-AAA-AAA', () => {
  const depthOf = (element: Element | null | undefined) =>
    element?.closest('[data-floor-depth]')?.getAttribute('data-floor-depth')

  it('places the Catalyst on floor 4 and says what each offer changes', async () => {
    render(await realReport('aaa-aaa-aaa.json'))
    const band = container.querySelector('[data-trinket-choice]')
    expect(depthOf(band)).toBe('4')
    const effect = (name: string) =>
      band?.querySelector(`[role="radio"][aria-label="${name}"]`)?.textContent
    expect(effect('Mimic Tooth')).toContain('Changes later floors')
    expect(effect('Dimensional Sundial')).toContain('No effect on floors')
    expect(band?.textContent).toContain(
      'Floors 5+ are generated with no trinket.'
    )
    expect(all('[aria-label^="Generated with "]')).toHaveLength(0)
  })

  it('describes Catalyst offers and transmutations with their in-game text', async () => {
    const report = await realReport('aaa-aaa-aaa.json')
    render(report)
    const detail = () =>
      document.querySelector('[data-slot="item-detail"]')?.textContent ?? ''
    const [offer] = report.trinkets.offers
    const button = container.querySelector(
      `[role="radio"][aria-label="${offer?.name}"]`
    ) as HTMLElement
    act(() => {
      button.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }))
    })
    expect(offer?.description).toBeTruthy()
    expect(detail()).toContain(offer?.description ?? '')
    expect(detail()).toContain('Offered by the Trinket Catalyst.')
    act(() => hideItemDetail())

    const third = report.trinkets.transmutationOrder[2]
    const slot = container.querySelector(
      '[data-transmutation-order] li:nth-child(3) button'
    ) as HTMLButtonElement
    act(() => slot.click())
    expect(detail()).toContain(third?.description ?? '')
    expect(detail()).toContain('Transmutation result 3.')
    act(() => slot.click())
    expect(document.querySelector('[data-slot="item-detail"]')).toBeNull()
  })

  it('draws the alchemy pots on their floors', async () => {
    render(await realReport('aaa-aaa-aaa.json'))
    expect(
      all('[data-alchemy-pot]').map(
        (pot) => `${depthOf(pot)}: ${pot.getAttribute('aria-label')}`
      )
    ).toEqual([
      '4: Alchemy pot, laboratory',
      '9: Alchemy pot, laboratory',
      '13: Alchemy pot, laboratory',
      '17: Alchemy pot, secret laboratory, in a secret room',
      '19: Alchemy pot, laboratory',
      '23: Alchemy pot, laboratory',
    ])
  })

  it('leaves gold, keys and quest items out of the item lists', async () => {
    const report = await realReport('aaa-aaa-aaa.json')
    expect(
      report.floors.some((floor) =>
        floor.items.some((item) => item.id === 'ceremonial_candle')
      )
    ).toBe(true)
    render(report)
    const labels = slots().map((slot) => slot.getAttribute('aria-label') ?? '')
    expect(
      labels.some((label) =>
        /^(Gold|Iron key|Golden key|Crystal key|Ceremonial candle|Corpse dust)\b/i.test(
          label
        )
      )
    ).toBe(false)
  })

  it('marks gameplay-variable items', async () => {
    render(await realReport('aaa-aaa-aaa.json'))
    const floor6 = container.querySelector('[data-floor-depth="6"]')
    expect(
      floor6
        ?.querySelector('[data-prediction="variable"]')
        ?.getAttribute('aria-label')
    ).toStartWith('Scroll holder')
    expect(
      floor6?.querySelector(
        '[aria-label="About items that vary with gameplay"]'
      )
    ).not.toBeNull()
    expect(text()).not.toContain('matches the query')
  })

  it('describes an item with its in-game text, like the map', async () => {
    const report = await realReport('aaa-aaa-aaa.json')
    render(report)
    const detail = () =>
      document.querySelector('[data-slot="item-detail"]')?.textContent ?? ''
    const wand = container.querySelector(
      '[data-quest="wandmaker"] [data-prediction="constrained"]'
    ) as HTMLButtonElement
    act(() => wand.click())
    const rewards = report.floors
      .flatMap((floor) => floor.items)
      .filter((item) => item.source === 'wandmaker_reward')
      .map((item) => item.description ?? '')
    expect(rewards.every(Boolean)).toBe(true)
    expect(rewards.some((text) => detail().includes(text))).toBe(true)
    expect(detail()).toContain('Where to find')
    expect(detail()).not.toContain('Fixed by the seed')
    expect(detail()).not.toContain('Conditions')
    expect(detail()).not.toContain('Varies with play')

    const variable = container.querySelector(
      '[data-prediction="variable"]'
    ) as HTMLButtonElement
    act(() => variable.click())
    expect(detail()).toContain('Varies with play')
  })

  it('offers the Wandmaker and Imp reward outlooks', async () => {
    render(await realReport('aaa-aaa-aaa.json'))
    expect(
      container.querySelector(
        '[data-quest="wandmaker"] [aria-label="Wand reward outlook"]'
      )
    ).not.toBeNull()
    expect(
      container.querySelector(
        '[data-quest="imp"] [aria-label="Per-slot reward outlook"]'
      )
    ).not.toBeNull()
  })
})
