import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { preloadFind } from './app/lazy-find'
import { $mode } from './app/store/mode'
import { initTheme } from './app/store/theme'
import { initEditor } from './engine/editor'
import { initShareLink } from './features/advanced/share-import'
import { initAnalyze } from './features/analyze'
import { initFind } from './features/find/run'
import './index.css'

initTheme()

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found')
const root = createRoot(rootElement)

// Query validation reads the requirements through the lean editor module, so
// it loads before the first render; the search engine stays lazy.
initEditor().then(
  async () => {
    initFind()
    initAnalyze()
    initShareLink()
    // A page opening in Find (saved mode or share link) paints Find at once,
    // not the empty lazy fallback.
    if ($mode.get() === 'find') await preloadFind().catch(() => undefined)
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    )
  },
  (error: unknown) =>
    root.render(
      <p role="alert" className="p-4 text-destructive">
        Seed Seeker could not load its requirement editor (
        {error instanceof Error ? error.message : String(error)}). Reload the
        page to try again.
      </p>
    )
)
