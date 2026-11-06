import { afterEach, describe, expect, it } from 'bun:test'
import { TooltipProvider } from '@seed-seeker/design/ui/tooltip'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { SeedReport } from '../../../src/engine/types'
import { hideItemDetail } from '../../../src/features/analyze/report/item-detail-store'
import { SeedReportView } from '../../../src/features/analyze/report/SeedReportView'
import { REAL_FIXTURES, realReport, syntheticReport } from './fixtures'

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
      // The Catalyst choice sits above the floors without trinket timing.
      const band = container.querySelector('[data-trinket-choice]')
      expect(band?.closest('[data-floor-depth]')).toBeNull()
      expect(band?.querySelectorAll('[role="radio"]')).toHaveLength(4)
      // Sections the engine does not fill are not drawn.
      for (const [section, selector] of [
        ['encounters', '[aria-label="Initial encounters"]'],
        ['alchemyPots', '[data-alchemy-pot]'],
        ['questRewardSlots', '[aria-label="Per-slot reward outlook"]'],
      ] as const) {
        if (report.sections.includes(section)) continue
        expect(container.querySelector(selector)).toBeNull()
      }
    })
  }

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

describe('the synthetic report with every section', () => {
  it('marks it as synthetic', async () => {
    const report = await syntheticReport()
    expect(report.notes[0]).toStartWith('Synthetic fixture')
  })

  it('places the Catalyst on its selection floor and marks floors generated with the pick', async () => {
    render(await syntheticReport())
    const band = container.querySelector('[data-trinket-choice]')
    expect(
      band?.closest('[data-floor-depth]')?.getAttribute('data-floor-depth')
    ).toBe('3')
    expect(band?.textContent).toContain('Changes floors, not modeled')
    expect(band?.textContent).toContain(
      'Floors 4+ are generated with Mimic Tooth.'
    )
    const chips = all(
      '[aria-label="Generated with Mimic Tooth. Change trinket"]'
    )
    expect(
      chips.map((chip) =>
        chip.closest('[data-floor-depth]')?.getAttribute('data-floor-depth')
      )
    ).toEqual(['4', '9', '13', '19'])
  })

  it('draws alchemy pots, encounters and the query summary', async () => {
    render(await syntheticReport())
    expect(
      all('[data-alchemy-pot]').map((pot) => pot.getAttribute('aria-label'))
    ).toEqual(['Alchemy pot, laboratory', 'Alchemy pot, in a secret room'])
    const encounters = container.querySelector(
      '[data-floor-depth="1"] [aria-label="Initial encounters"]'
    )
    expect(encounters?.textContent).toContain('Rat')
    expect(encounters?.textContent).toContain(
      '12.5% runtime chance: Mystery Meat'
    )
    expect(text()).toContain('Carries Ring of Haste +1')
    expect(container.querySelector('[data-query-summary]')?.textContent).toBe(
      'Matches 1 of 2 query requirements.'
    )
  })

  it('marks matched and gameplay-variable items', async () => {
    render(await syntheticReport())
    const floor1 = container.querySelector('[data-floor-depth="1"]')
    expect(
      floor1?.querySelector('[data-matched]')?.getAttribute('aria-label')
    ).toBe('Wand of frost, matches the query')
    expect(
      floor1
        ?.querySelector('[data-prediction="variable"]')
        ?.getAttribute('aria-label')
    ).toBe('30–60 × Gold')
    expect(
      floor1?.querySelector(
        '[aria-label="About items that vary with gameplay"]'
      )
    ).not.toBeNull()
  })

  it('lists the conditions and ranges of a constrained item', async () => {
    render(await syntheticReport())
    const mail = container.querySelector(
      '[data-floor-depth="2"] [data-prediction="constrained"]'
    ) as HTMLButtonElement
    act(() => mail.click())
    const panel = document.querySelector(
      '[data-slot="item-detail"]'
    )?.textContent
    expect(panel).toContain('Starts between +0 to +2.')
    expect(panel).toContain('On Diet is disabled')
    expect(panel).toContain(
      'Mimic Tooth is acquired at +3 or better before floor 2'
    )
    expect(panel).toContain('the Sad Ghost quest is completed before floor 2')
  })

  it('offers the Wandmaker and Imp reward outlooks', async () => {
    render(await syntheticReport())
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
