import { Tabs, TabsContent } from '@seed-seeker/design/ui/tabs'
import { TooltipProvider } from '@seed-seeker/design/ui/tooltip'
import { useStore } from '@tanstack/react-store'
import { AnalyzeWorkspace } from '../features/analyze'
import { FindWorkspace } from '../features/find'
import { AppSidebar } from './AppSidebar'
import { SiteFooter } from './SiteFooter'
import { $mode, isAppMode, setMode } from './store/mode'

/** The app shell: sidebar with the mode tabs, the active workspace, footer. */
export function App() {
  const mode = useStore($mode)

  return (
    <TooltipProvider delayDuration={200}>
      <Tabs
        value={mode}
        onValueChange={(value) => {
          if (isAppMode(value)) setMode(value)
        }}
        className="flex min-h-svh w-full justify-center gap-0 bg-background"
      >
        <div className="border-border mx-auto grid min-h-svh w-full max-w-6xl grid-cols-1 grid-rows-[1fr_max-content] bg-background lg:border-x">
          <div className="grid grid-cols-1 lg:grid-cols-[max-content_1fr]">
            <AppSidebar />
            <main className="relative min-w-0 flex-1">
              <TabsContent value="analyze" className="mt-0">
                <AnalyzeWorkspace />
              </TabsContent>
              <TabsContent value="find" className="mt-0">
                <FindWorkspace />
              </TabsContent>
            </main>
          </div>
          <SiteFooter />
        </div>
      </Tabs>
    </TooltipProvider>
  )
}
