import { SpinnerGapIcon } from '@phosphor-icons/react'
import {
  type ComponentType,
  lazy,
  type ReactNode,
  Suspense,
  useState,
} from 'react'
import { $mode } from './store/mode'

type FindChunk = typeof import('./find-chunk')

let loaded: FindChunk | undefined
let loading: Promise<FindChunk> | undefined

/**
 * Loads Find's form and workspace (with Advanced and the item combobox),
 * which Analyze's first screen does not show.
 */
export function preloadFind(): Promise<FindChunk> {
  loading ??= import('./find-chunk').then((chunk) => {
    loaded = chunk
    return chunk
  })
  return loading
}

if ($mode.get() === 'find') void preloadFind()
$mode.subscribe((mode) => {
  if (mode === 'find') void preloadFind()
})

const pickForm = (chunk: FindChunk) => chunk.FinderForm
const pickWorkspace = (chunk: FindChunk) => chunk.FindWorkspace

const LazyFinderForm = lazy(() =>
  preloadFind().then((chunk) => ({ default: pickForm(chunk) }))
)
const LazyFindWorkspace = lazy(() =>
  preloadFind().then((chunk) => ({ default: pickWorkspace(chunk) }))
)

/**
 * Renders a Find component directly once its chunk has loaded, so a page
 * opened in Find paints without a fallback. The choice is fixed per mount:
 * switching branches would remount the component and drop its state.
 */
function Deferred({
  pick,
  Lazy,
  fallback,
}: {
  pick: (chunk: FindChunk) => ComponentType
  Lazy: ComponentType
  fallback: ReactNode
}) {
  const [Loaded] = useState(() => (loaded ? pick(loaded) : undefined))
  if (Loaded) return <Loaded />
  return (
    <Suspense fallback={fallback}>
      <Lazy />
    </Suspense>
  )
}

export function FinderForm() {
  return (
    <Deferred
      pick={pickForm}
      Lazy={LazyFinderForm}
      fallback={
        <div className="text-muted-foreground flex items-center justify-center gap-2 py-8">
          <SpinnerGapIcon className="size-5 animate-spin" />
          <p role="status" className="text-sm">
            Loading Find…
          </p>
        </div>
      }
    />
  )
}

export function FindWorkspace() {
  return (
    <Deferred
      pick={pickWorkspace}
      Lazy={LazyFindWorkspace}
      fallback={
        <div className="text-muted-foreground flex min-h-48 items-center justify-center py-12">
          <SpinnerGapIcon className="size-6 animate-spin" />
        </div>
      }
    />
  )
}
