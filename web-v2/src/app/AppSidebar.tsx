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
import { useSearchRunning } from '../features/find/ResultsTabs'
import { FinderForm } from './lazy-find'
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
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3">
            <img
              src="/favicon.svg"
              alt=""
              width={40}
              height={40}
              className="pixelated size-10"
            />
            <div className="min-w-0">
              <h1 className="font-pixel text-px-1">{CONFIG.appName}</h1>
              <p className="text-muted-foreground text-xs leading-snug">
                Shattered Pixel Dungeon v{SHPD_VERSION}
              </p>
            </div>
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
