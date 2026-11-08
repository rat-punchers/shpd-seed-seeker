import {
  BinocularsIcon,
  MagnifyingGlassIcon,
  SpinnerGapIcon,
} from '@phosphor-icons/react'
import { TabsList, TabsTrigger } from '@seed-seeker/design/ui/tabs'
import { useStore } from '@tanstack/react-store'
import { CONFIG } from '../config'
import { SHPD_VERSION } from '../engine/constants'
import { ScreenshotSeedSection, SeedForm } from '../features/analyze'
import { FinderForm, useSearchRunning } from '../features/find'
import { $mode } from './store/mode'
import { ThemeToggle } from './ThemeToggle'

/**
 * Brand, theme toggle, the Analyze / Find mode tabs and the mode's form.
 *
 * On desktop the panel is pinned to the window and only the form scrolls
 * inside it. The absolute layer keeps the panel out of the row's height, so
 * a short workspace does not push the footer below the window.
 */
export function AppSidebar() {
  const mode = useStore($mode)
  const searching = useSearchRunning()
  return (
    <aside className="border-border bg-sidebar text-sidebar-foreground lg:relative lg:w-80 lg:shrink-0 lg:border-r">
      <div className="lg:absolute lg:inset-0">
        <div className="flex flex-col gap-4 p-4 lg:sticky lg:top-0 lg:h-svh lg:max-h-full">
          <div className="flex items-center gap-3">
            <img
              src="/favicon.svg"
              alt=""
              width={40}
              height={40}
              className="pixelated size-10 shrink-0"
            />
            <h1 className="font-pixel text-px-1 min-w-0 flex-1">
              {CONFIG.appName}
              <span className="text-muted-foreground"> · </span>
              <span className="text-muted-foreground">
                SHPD v{SHPD_VERSION}
              </span>
            </h1>
            <ThemeToggle />
          </div>

          <TabsList className="grid w-full grid-cols-2" aria-label="Mode">
            <TabsTrigger value="analyze">
              <MagnifyingGlassIcon data-icon="inline-start" />
              Analyze
            </TabsTrigger>
            <TabsTrigger value="find">
              {searching ? (
                <SpinnerGapIcon
                  data-icon="inline-start"
                  className="animate-spin"
                  data-testid="find-searching"
                />
              ) : (
                <BinocularsIcon data-icon="inline-start" />
              )}
              Find
              {searching ? <span className="sr-only"> (searching)</span> : null}
            </TabsTrigger>
          </TabsList>

          {mode === 'find' ? (
            <FinderForm />
          ) : (
            <div className="flex flex-col gap-4 lg:relative lg:-mx-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-4">
              <SeedForm />
              <ScreenshotSeedSection active />
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
