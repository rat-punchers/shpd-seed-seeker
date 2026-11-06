import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { initTheme } from './app/store/theme'
import { initEditor } from './engine/editor'
import { initShareLink } from './features/advanced'
import { initAnalyze } from './features/analyze'
import { initFind } from './features/find'
import './index.css'

initTheme()

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found')
const root = createRoot(rootElement)

// Query validation reads the requirements through the lean editor module, so
// it loads before the first render; the search engine stays lazy.
initEditor().then(
  () => {
    initFind()
    initAnalyze()
    initShareLink()
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
