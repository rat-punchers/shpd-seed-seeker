import { createContext, useContext } from 'react'
import type { ChallengeName } from '../../../engine/types'
import type { ReportBranch } from '../../../engine/types/report'
import { hasLevelMap } from '../../level-map/client'
import { FloorMapDialog } from '../../level-map/FloorMapDialog'
import { branchTitle } from './report-text'

/** The run a report's maps are generated for. */
export interface ReportMapRun {
  seed: string
  challenges: readonly ChallengeName[]
  /** The selected Catalyst offer id, or null for No Trinket. */
  selectedTrinket: string | null
}

/** Set by the report view; without it no map buttons show. */
export const ReportMapContext = createContext<ReportMapRun | null>(null)

/** The map button of a main floor the engine can draw. */
export function FloorMapButton({ depth }: { depth: number }) {
  const run = useContext(ReportMapContext)
  if (!run || !hasLevelMap(depth)) return null
  return <FloorMapDialog request={{ ...run, depth, branch: 0 }} />
}

/** The map button of a quest branch from the report's `branches`. */
export function BranchMapButton({
  depth,
  branch,
}: {
  depth: number
  branch: ReportBranch
}) {
  const run = useContext(ReportMapContext)
  if (!run || !hasLevelMap(depth, branch.branch)) return null
  const name = branchTitle(branch.kind)
  const identity = `Floor ${depth}, branch ${branch.branch}`
  return (
    <FloorMapDialog
      request={{ ...run, depth, branch: branch.branch }}
      mapLabel={`${name} ${identity.toLowerCase()} map`}
      dialogTitle={`${name} - ${identity}`}
    />
  )
}
