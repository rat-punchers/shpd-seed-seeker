import { CONFIG } from '../config'
import { SHPD_VERSION } from '../engine/constants'

/** The app shell: brand and supported game version. */
export function App() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-5 lg:px-8">
          <img
            src="/favicon.svg"
            alt=""
            width={32}
            height={32}
            className="pixelated size-8"
          />
          <h1 className="font-pixel text-px-1">
            {CONFIG.appName}
            <span className="text-muted-foreground"> · </span>
            <span className="text-muted-foreground">SHPD v{SHPD_VERSION}</span>
          </h1>
        </div>
      </header>
      <main className="flex-1" />
    </div>
  )
}
