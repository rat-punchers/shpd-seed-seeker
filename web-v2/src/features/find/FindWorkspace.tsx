import { BinocularsIcon, WarningCircleIcon } from '@phosphor-icons/react'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@seed-seeker/design/ui/alert'
import { useStore } from '@tanstack/react-store'
import { WorkspaceEmptyPlaceholder } from '../../shared/ui/WorkspaceEmptyPlaceholder'
import { RESULT_CAP } from '../search/coordinator-state'
import { searchStore } from '../search/store'
import { ResultCard } from './ResultCard'
import { SearchStatusCard } from './SearchStatusCard'

/** The Find workspace: the search run and its matches. */
export function FindWorkspace() {
  const state = useStore(searchStore, (search) => search.state)
  const error = useStore(searchStore, (search) => search.error)
  const matches = useStore(searchStore, (search) => search.matches)

  if (state === 'idle' && matches.length === 0) {
    return (
      <WorkspaceEmptyPlaceholder
        icon={BinocularsIcon}
        title="No search yet"
        description="Choose items in the sidebar to start a search."
      />
    )
  }

  // The store keeps every delivered match for refine soundness; the list
  // shows at most the advertised cap.
  const shown = matches.slice(0, RESULT_CAP)
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <SearchStatusCard />
      {error ? (
        <Alert variant="destructive">
          <WarningCircleIcon />
          <AlertTitle>Search failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {shown.length > 0 ? (
        <section aria-labelledby="find-results-heading" className="@container">
          <h2 id="find-results-heading" className="font-pixel text-px-1 mb-3">
            Matching seeds
          </h2>
          <ol className="grid gap-3 @2xl:grid-cols-2">
            {shown.map((match, index) => (
              <li key={match.code}>
                <ResultCard match={match} index={index} />
              </li>
            ))}
          </ol>
        </section>
      ) : state === 'running' ? (
        <p className="text-muted-foreground text-sm">
          Matching seeds will appear here as they are found.
        </p>
      ) : null}
    </div>
  )
}
