import { afterEach, describe, expect, it } from 'bun:test'
import { TooltipProvider } from '@seed-seeker/design/ui/tooltip'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { SeedReport } from '../../../src/engine/types'
import { SeedReportView } from '../../../src/features/analyze/report/SeedReportView'
import { realReport } from './fixtures'

let root: Root | undefined
let container: HTMLDivElement

function render(report: SeedReport) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.append(container)
  act(() => {
    root = createRoot(container)
    root.render(
      <TooltipProvider>
        <SeedReportView
          report={report}
          trinketChoice={{ busy: false, select: () => {} }}
        />
      </TooltipProvider>
    )
  })
}

afterEach(() => {
  act(() => root?.unmount())
  document.body.innerHTML = ''
})

const glyphsIn = (element: Element | null | undefined) =>
  [...(element?.querySelectorAll<HTMLElement>('span') ?? [])].filter((span) =>
    span.style.backgroundImage.includes('item_icons.png')
  )

describe('game art in the report', () => {
  it('shows the Ghost quest target as its mob instead of text', async () => {
    const report = await realReport('aaa-aaa-aaa.json')
    render(report)
    const ghost = report.quests.find((quest) => quest.quest === 'ghost')
    const target = container.querySelector(
      `[data-quest="ghost"] [data-quest-target="${ghost?.variant}"]`
    )
    expect(target?.querySelector('[role="img"]')).not.toBeNull()
    expect(target?.textContent).toBe('')
  })

  it('draws a glyph over every identified appearance', async () => {
    render(await realReport('aaa-aaa-aaa.json'))
    expect(glyphsIn(container.querySelector('[data-identities]'))).toHaveLength(
      36
    )
  })

  it('draws a glyph over every listed potion and scroll', async () => {
    const report = await realReport('aaa-aaa-aaa.json')
    render(report)
    const slots = [
      ...container.querySelectorAll('[data-slot="item-box"]'),
    ].filter((slot) =>
      /^(\d+ × )?((Potion|Scroll) of|Exotic)/.test(
        slot.getAttribute('aria-label') ?? ''
      )
    )
    expect(slots.length).toBeGreaterThan(0)
    for (const slot of slots) {
      const label = slot.getAttribute('aria-label')
      expect([label, glyphsIn(slot).length]).toEqual([label, 1])
    }
  })

  it('draws the alchemy pot from the game tiles', async () => {
    render(await realReport('aaa-aaa-aaa.json'))
    const pot = container.querySelector<HTMLElement>(
      '[data-alchemy-pot] span[aria-hidden]'
    )
    expect(pot?.style.backgroundImage).toContain('alchemy_pots')
  })
})
