import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import { WorkspaceEmptyPlaceholder } from '../../shared/ui/WorkspaceEmptyPlaceholder'

/** The Analyze workspace: open seed reports. */
export function AnalyzeWorkspace() {
  return (
    <WorkspaceEmptyPlaceholder
      icon={MagnifyingGlassIcon}
      title="No seeds analyzed yet"
      description="Enter a seed in the sidebar to start an analysis."
    />
  )
}
