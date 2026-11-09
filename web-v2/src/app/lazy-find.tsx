import { type ComponentType, lazy, Suspense, useState } from 'react'
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
}: {
  pick: (chunk: FindChunk) => ComponentType
  Lazy: ComponentType
}) {
  const [Loaded] = useState(() => (loaded ? pick(loaded) : undefined))
  if (Loaded) return <Loaded />
  return (
    <Suspense fallback={null}>
      <Lazy />
    </Suspense>
  )
}

export function FinderForm() {
  return <Deferred pick={pickForm} Lazy={LazyFinderForm} />
}

export function FindWorkspace() {
  return <Deferred pick={pickWorkspace} Lazy={LazyFindWorkspace} />
}
