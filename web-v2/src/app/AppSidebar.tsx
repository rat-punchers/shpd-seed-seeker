import { BinocularsIcon, MagnifyingGlassIcon } from '@phosphor-icons/react'
import { TabsList, TabsTrigger } from '@seed-seeker/design/ui/tabs'
import { CONFIG } from '../config'
import { SHPD_VERSION } from '../engine/constants'
import { ThemeToggle } from './ThemeToggle'

/** Brand, theme toggle and the Analyze / Find mode tabs. */
export function AppSidebar() {
  return (
    <aside className="border-border bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:h-full lg:max-h-svh lg:w-80 lg:shrink-0 lg:self-start lg:overflow-y-auto lg:border-r">
      <div className="flex flex-col gap-4 p-4">
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
            <span className="text-muted-foreground">SHPD v{SHPD_VERSION}</span>
          </h1>
          <ThemeToggle />
        </div>

        <TabsList className="grid w-full grid-cols-2" aria-label="Mode">
          <TabsTrigger value="analyze">
            <MagnifyingGlassIcon data-icon="inline-start" />
            Analyze
          </TabsTrigger>
          <TabsTrigger value="find">
            <BinocularsIcon data-icon="inline-start" />
            Find
          </TabsTrigger>
        </TabsList>
      </div>
    </aside>
  )
}
