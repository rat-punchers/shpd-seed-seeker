import { BinocularsIcon } from '@phosphor-icons/react'
import { WorkspaceEmptyPlaceholder } from '../../shared/ui/WorkspaceEmptyPlaceholder'

/** The Find workspace: the search run and its matches. */
export function FindWorkspace() {
  return (
    <WorkspaceEmptyPlaceholder
      icon={BinocularsIcon}
      title="No search yet"
      description="Choose items in the sidebar to start a search."
    />
  )
}
