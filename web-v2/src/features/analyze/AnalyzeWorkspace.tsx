import {
  MagnifyingGlassIcon,
  SpinnerGapIcon,
  XIcon,
} from '@phosphor-icons/react'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@seed-seeker/design/ui/tabs'
import { useStore } from '@tanstack/react-store'
import { type TouchEvent, useRef } from 'react'
import { WorkspaceEmptyPlaceholder } from '../../shared/ui/WorkspaceEmptyPlaceholder'
import { resultsTabLabel } from '../search/tabs'
import { stepActiveResult, swipeDelta } from './navigation'
import { usePublishedHeight } from './report/hooks'
import { SessionPane } from './SessionPane'
import {
  $activeSeedId,
  $sessions,
  closeSession,
  type SeedSession,
  setActiveSeed,
} from './sessions'

/** Horizontal swipes over a report step through Find's results on touch. */
function useResultSwipe() {
  const start = useRef<{ x: number; y: number } | undefined>(undefined)
  return {
    onTouchStart: (event: TouchEvent) => {
      const touch = event.touches[0]
      start.current =
        touch && event.touches.length === 1
          ? { x: touch.clientX, y: touch.clientY }
          : undefined
    },
    onTouchEnd: (event: TouchEvent) => {
      const from = start.current
      start.current = undefined
      const touch = event.changedTouches[0]
      if (!from || !touch) return
      const delta = swipeDelta(from, { x: touch.clientX, y: touch.clientY })
      if (delta !== 0) stepActiveResult(delta)
    },
  }
}

/** A tab opened from Find is named after its results tab. */
const tabLabel = (session: SeedSession) =>
  session.results === undefined
    ? session.seed
    : resultsTabLabel(session.results)

/** The Analyze workspace: one tab per open seed. */
export function AnalyzeWorkspace() {
  const sessions = useStore($sessions)
  const activeId = useStore($activeSeedId)
  const tabsRef = useRef<HTMLDivElement>(null)
  usePublishedHeight(tabsRef, '--seed-tabs-height', sessions.length > 0)
  const swipe = useResultSwipe()

  if (sessions.length === 0) {
    return (
      <WorkspaceEmptyPlaceholder
        icon={MagnifyingGlassIcon}
        title="No seeds analyzed yet"
        description="Enter a seed in the sidebar to start an analysis."
      />
    )
  }

  const value = sessions.some((session) => session.id === activeId)
    ? (activeId ?? '')
    : (sessions[0]?.id ?? '')
  return (
    <Tabs value={value} onValueChange={setActiveSeed} className="gap-0">
      <div
        ref={tabsRef}
        className="border-border bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-20 flex min-w-0 max-w-full items-start gap-2 border-b px-3 pt-3 pb-0 backdrop-blur"
      >
        <TabsList
          variant="line"
          aria-label="Open seeds"
          className="h-auto w-0 min-w-0 flex-1 flex-nowrap justify-start gap-1 overflow-x-auto lg:h-auto! lg:flex-wrap lg:overflow-x-visible"
        >
          {sessions.map((session) => (
            <div
              key={session.id}
              className="group/seed-tab flex min-w-0 max-w-56 shrink-0 items-center"
            >
              <TabsTrigger value={session.id} className="min-w-0 gap-1 pr-1">
                {session.status === 'loading' ||
                session.status === 'pending' ? (
                  <SpinnerGapIcon className="shrink-0 animate-spin" />
                ) : null}
                <span
                  className={`truncate text-sm ${session.results === undefined ? 'font-mono' : ''}`}
                >
                  {tabLabel(session)}
                </span>
              </TabsTrigger>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex size-5 shrink-0 items-center justify-center rounded-sm opacity-60 group-hover/seed-tab:opacity-100"
                aria-label={`Close ${tabLabel(session)}`}
                onClick={() => closeSession(session.id)}
              >
                <XIcon className="size-3" />
              </button>
            </div>
          ))}
        </TabsList>
      </div>

      <div className="flex flex-col gap-4 p-4 md:p-6" {...swipe}>
        {sessions.map((session) => (
          <TabsContent key={session.id} value={session.id} className="mt-0">
            <SessionPane session={session} />
          </TabsContent>
        ))}
      </div>
    </Tabs>
  )
}
