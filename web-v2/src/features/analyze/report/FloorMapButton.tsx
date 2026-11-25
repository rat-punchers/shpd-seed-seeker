import { createContext, useContext } from 'react'
import type { ReportBranch, SeedReport } from '../../../engine/types/report'
import { hasLevelMap } from '../../level-map/client'
import {
  FloorMapDialog,
  type FloorMapTarget,
} from '../../level-map/FloorMapDialog'
import type { LevelMapRequest } from '../../level-map/types'
import { bossOf, FloorBossSprite } from './FloorBanner'
import { branchTitle, hasSection } from './report-text'
import { HeldTrinketChip, heldTrinketAt } from './trinket'

export interface ReportMapRun
  extends Omit<LevelMapRequest, 'depth' | 'branch'> {
  maps: FloorMapTarget[]
}

/** Each floor is followed by the quest maps entered from it. */
export function reportMapTargets(report: SeedReport): FloorMapTarget[] {
  const hasBranches = hasSection(report, 'branches')
  return report.floors.flatMap(({ depth, branches }) => {
    const held = heldTrinketAt(report, depth)
    const trinket = held ? (
      <HeldTrinketChip
        key={held.id}
        name={held.name}
        spriteIndex={held.spriteIndex}
        changeable={false}
      />
    ) : undefined
    const targets: FloorMapTarget[] = []
    if (hasLevelMap(depth)) {
      targets.push({
        depth,
        branch: 0,
        leading: bossOf(depth) ? <FloorBossSprite depth={depth} /> : undefined,
        trinket,
      })
    }
    if (hasBranches) {
      for (const branch of branches) {
        if (hasLevelMap(depth, branch.branch)) {
          targets.push({
            depth,
            branch: branch.branch,
            name: branchTitle(branch.kind),
            trinket,
          })
        }
      }
    }
    return targets
  })
}

/** Set by the report view; without it no map buttons show. */
export const ReportMapContext = createContext<ReportMapRun | null>(null)

/** The map button of a main floor the engine can draw. */
export function FloorMapButton({ depth }: { depth: number }) {
  return <ReportMapButton depth={depth} branch={0} />
}

/** The map button of a quest branch from the report's `branches`. */
export function BranchMapButton({
  depth,
  branch,
}: {
  depth: number
  branch: ReportBranch
}) {
  return <ReportMapButton depth={depth} branch={branch.branch} />
}

function ReportMapButton({ depth, branch }: { depth: number; branch: number }) {
  const run = useContext(ReportMapContext)
  if (!run) return null
  const { maps, ...settings } = run
  const initial = maps.findIndex(
    (target) => target.depth === depth && target.branch === branch
  )
  if (initial < 0) return null
  return <FloorMapDialog run={settings} maps={maps} initial={initial} />
}
