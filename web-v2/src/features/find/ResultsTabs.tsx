import { PlusIcon, SpinnerGapIcon, XIcon } from '@phosphor-icons/react'
import { Button } from '@seed-seeker/design/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@seed-seeker/design/ui/tabs'
import { useStore } from '@tanstack/react-store'
import { isSearchActive } from '../search/coordinator-state'
import {
  addResultsTab,
  closeResultsTab,
  resultsTabLabel,
  resultsTabsStore,
  searchingTabId,
  selectResultsTab,
} from '../search/tabs'

interface TabEntry {
  id: number
  searching: boolean
}

const sameTabs = (a: TabEntry[], b: TabEntry[]) =>
  a.length === b.length &&
  a.every(
    (tab, index) =>
      tab.id === b[index]?.id && tab.searching === b[index]?.searching
  )

/** Whether a search is running or stopping in any results tab. */
export function useSearchRunning(): boolean {
  return useStore(
    resultsTabsStore,
    (state) => searchingTabId(state) !== undefined
  )
}

/** Find's results tabs: Find runs in the shown tab, "+" opens an empty one. */
export function ResultsTabs() {
  const activeId = useStore(resultsTabsStore, (state) => state.activeId)
  const tabs = useStore(
    resultsTabsStore,
    (state) =>
      state.tabs.map((tab) => ({
        id: tab.id,
        searching: isSearchActive(tab.search),
      })),
    sameTabs
  )

  return (
    <div className="border-border bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-20 flex min-w-0 max-w-full items-start gap-2 border-b px-3 pt-3 pb-0 backdrop-blur">
      <Tabs
        value={String(activeId)}
        onValueChange={(value) => selectResultsTab(Number(value))}
        className="w-0 min-w-0 flex-1 gap-0"
      >
        <TabsList
          variant="line"
          aria-label="Results"
          className="h-auto w-full flex-nowrap border-b-0 justify-start gap-1 overflow-x-auto lg:h-auto! lg:flex-wrap lg:overflow-x-visible"
        >
          {tabs.map((tab) => {
            const label = resultsTabLabel(tab.id)
            return (
              <div
                key={tab.id}
                className="group/results-tab flex shrink-0 items-center"
              >
                <TabsTrigger value={String(tab.id)} className="gap-1 pr-1">
                  {tab.searching ? (
                    <SpinnerGapIcon
                      className="shrink-0 animate-spin"
                      aria-label="Searching"
                    />
                  ) : null}
                  <span className="text-sm">{label}</span>
                </TabsTrigger>
                {tabs.length > 1 && !tab.searching ? (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex size-5 shrink-0 items-center justify-center rounded-sm opacity-60 group-hover/results-tab:opacity-100"
                    aria-label={`Close ${label}`}
                    onClick={() => closeResultsTab(tab.id)}
                  >
                    <XIcon className="size-3" />
                  </button>
                ) : null}
              </div>
            )
          })}
        </TabsList>
      </Tabs>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="New results tab"
        title="New results tab"
        onClick={() => addResultsTab()}
      >
        <PlusIcon />
      </Button>
    </div>
  )
}
