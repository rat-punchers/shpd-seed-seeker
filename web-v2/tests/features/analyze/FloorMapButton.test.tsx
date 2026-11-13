import { afterEach, describe, expect, it } from 'bun:test'
import { TooltipProvider } from '@seed-seeker/design/ui/tooltip'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { SeedReport } from '../../../src/engine/types'
import { SeedReportView } from '../../../src/features/analyze/report/SeedReportView'
import { MAP_DEPTHS } from '../../../src/features/level-map/client'
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

const mapButtons = () =>
  [...container.querySelectorAll('button[aria-label^="Expand "]')].map(
    (button) => button.getAttribute('aria-label')
  )

describe('floor map buttons', () => {
  it('open every floor the engine draws, and each quest branch', async () => {
    const report = await realReport('aaa-aaa-aaa.json')
    render(report)
    const floors = report.floors
      .map((floor) => floor.depth)
      .filter((depth) => MAP_DEPTHS.includes(depth))
    expect(mapButtons()).toEqual(
      expect.arrayContaining(floors.map((depth) => `Expand floor ${depth} map`))
    )
    for (const depth of [10, 20, 25]) {
      expect(mapButtons()).not.toContain(`Expand floor ${depth} map`)
    }
    // Branches come from the report: the Blacksmith and Imp quest cards.
    expect(mapButtons().filter((label) => label?.includes('branch'))).toEqual([
      'Expand Crystal Mine floor 13, branch 1 map',
      'Expand Imp Vault floor 19, branch 1 map',
    ])
    const crystal = container.querySelector(
      'button[aria-label="Expand Crystal Mine floor 13, branch 1 map"]'
    )
    expect(crystal?.closest('[data-quest]')?.getAttribute('data-quest')).toBe(
      'blacksmith'
    )
    expect(crystal?.getAttribute('aria-haspopup')).toBe('dialog')
  })

  it('show no branch button when the report lists no branches', async () => {
    const report = await realReport('aaa-aaa-aaa.json')
    render({
      ...report,
      sections: report.sections.filter((section) => section !== 'branches'),
    })
    expect(mapButtons().some((label) => label?.includes('branch'))).toBe(false)
    expect(mapButtons()).toContain('Expand floor 1 map')
  })
})
