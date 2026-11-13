import { BinocularsIcon, WarningCircleIcon } from '@phosphor-icons/react'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@seed-seeker/design/ui/alert'
import { useStore } from '@tanstack/react-store'
import { useMediaQuery } from '../../shared/ui/use-media-query'
import { WorkspaceEmptyPlaceholder } from '../../shared/ui/WorkspaceEmptyPlaceholder'
import { searchStore } from '../search/store'
import { resultsTabsStore } from '../search/tabs'
import { SeedPreview } from './preview/SeedPreview'
import {
  $previewPicks,
  listedMatches,
  PREVIEW_MEDIA,
  pickPreview,
  previewedMatch,
} from './preview/selection'
import { ResultRow } from './ResultRow'
import { ResultsTabs } from './ResultsTabs'
import { ResultsActions, ResultsNotice } from './results/ResultsActions'
import { SearchStatusCard } from './SearchStatusCard'

/** The Find workspace: the results tabs over the shown tab's results. */
export function FindWorkspace() {
  return (
    <div className="flex min-h-full flex-col">
      <ResultsTabs />
      <FindResults />
    </div>
  )
}

/** The shown tab's matches; on wide screens the previewed one is marked. */
function ResultList({ preview }: { preview: boolean }) {
  const matches = useStore(searchStore, (search) => search.matches)
  const tab = useStore(resultsTabsStore, (state) => state.activeId)
  const pick = useStore($previewPicks, (picks) => picks[tab])
  const shown = listedMatches(matches)
  const previewed = preview ? previewedMatch(shown, pick) : undefined
  return (
    <section aria-labelledby="find-results-heading">
      <h2 id="find-results-heading" className="font-pixel text-px-1 mb-3">
        Matching seeds
      </h2>
      <ol className="bg-card divide-y overflow-hidden rounded-lg border">
        {shown.map((match, index) => (
          <li key={match.code}>
            <ResultRow
              match={match}
              index={index}
              preview={preview}
              selected={match === previewed}
              onPreview={pickPreview}
            />
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * The shown tab: the search run, its matches and the results file, with
 * the previewed seed's report beside them on wide screens.
 */
function FindResults() {
  const state = useStore(searchStore, (search) => search.state)
  const error = useStore(searchStore, (search) => search.error)
  const count = useStore(searchStore, (search) => search.matches.length)
  const wide = useMediaQuery(PREVIEW_MEDIA)

  if (state === 'idle' && count === 0) {
    return (
      <WorkspaceEmptyPlaceholder
        icon={BinocularsIcon}
        title="No search yet"
        description="Choose items in the sidebar to start a search, or import results."
      >
        <ResultsActions />
        <ResultsNotice />
      </WorkspaceEmptyPlaceholder>
    )
  }

  const results = (
    <div className="flex min-w-0 flex-col gap-4 p-4 md:p-6 lg:px-4">
      <ResultsActions />
      <ResultsNotice />
      <SearchStatusCard />
      {error ? (
        <Alert variant="destructive">
          <WarningCircleIcon />
          <AlertTitle>Search failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {count > 0 ? (
        <ResultList preview={wide} />
      ) : state === 'running' ? (
        <p className="text-muted-foreground text-sm">
          Matching seeds will appear here as they are found.
        </p>
      ) : state === 'imported' ? (
        <p className="text-muted-foreground text-sm">
          The imported file contained no seeds.
        </p>
      ) : null}
    </div>
  )
  if (!wide) return results
  return (
    <div className="grid grid-cols-[18rem_minmax(0,1fr)] items-start">
      {results}
      <SeedPreview />
    </div>
  )
}
