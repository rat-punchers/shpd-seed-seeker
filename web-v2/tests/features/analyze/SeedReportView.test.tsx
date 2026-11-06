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
      // Each item appears once: on its floor, or on its quest's card.
      const items = report.floors.flatMap((floor) => floor.items)
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
      const encounters = report.floors.filter(
        (floor) => (floor.encounters ?? []).length > 0
      )
      expect(all('[aria-label="Initial encounters"]')).toHaveLength(
        encounters.length
      )
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
      floors: report.floors.map(({ encounters, appearances, ...floor }) => ({
        ...floor,
        ...(section === 'encounters' ? {} : { encounters }),
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
      ['encounters', '[aria-label="Initial encounters"]'],
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
    const floor5 = container.querySelector('[data-floor-depth="5"]')
    expect(floor5?.textContent).toContain('Sewers, boss: Goo')
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

  it('lists encounters and what the floor generates them carrying', async () => {
    render(await realReport('aaa-aaa-aaa.json'))
    const encounters = (depth: number) =>
      container.querySelector(
        `[data-floor-depth="${depth}"] [aria-label="Initial encounters"]`
      )?.textContent
    expect(encounters(1)).toContain('No seed-determined base drop')
    expect(encounters(6)).toContain('Crystal Mimic')
    expect(encounters(6)).toContain('Carries Ring of Tenacity +1')
    expect(encounters(7)).toContain('Carries Blazing Assassin')
    expect(encounters(10)).toBeUndefined()
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

  it('lists the conditions of a quest reward', async () => {
    render(await realReport('aaa-aaa-aaa.json'))
    const wand = container.querySelector(
      '[data-quest="wandmaker"] [data-prediction="constrained"]'
    ) as HTMLButtonElement
    act(() => wand.click())
    const panel = document.querySelector(
      '[data-slot="item-detail"]'
    )?.textContent
    expect(panel).toContain(
      'the Old Wandmaker quest is completed before floor 9'
    )
    expect(panel).toContain('choose 1 of 2 Wandmaker Reward options')
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
