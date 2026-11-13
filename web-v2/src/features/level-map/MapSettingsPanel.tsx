import {
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
} from '@phosphor-icons/react'
import { Button } from '@seed-seeker/design/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@seed-seeker/design/ui/tooltip'
import type { ReactNode } from 'react'

/** The zoom controls over the map's top-left corner. */
export function MapSettingsPanel({
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
}: {
  canZoomIn: boolean
  canZoomOut: boolean
  onZoomIn: () => void
  onZoomOut: () => void
}) {
  return (
    <div
      className="dark border-border bg-background/30 text-foreground shadow-window absolute top-2 left-2 z-10 flex items-center gap-0.5 rounded-sm border p-1 backdrop-blur-[2px]"
      data-testid="map-settings-panel"
    >
      <ZoomButton
        label="Zoom map out"
        tooltip="Zoom out"
        enabled={canZoomOut}
        onClick={onZoomOut}
      >
        <MagnifyingGlassMinusIcon />
      </ZoomButton>
      <ZoomButton
        label="Zoom map in"
        tooltip="Zoom in"
        enabled={canZoomIn}
        onClick={onZoomIn}
      >
        <MagnifyingGlassPlusIcon />
      </ZoomButton>
    </div>
  )
}

function ZoomButton({
  label,
  tooltip,
  enabled,
  onClick,
  children,
}: {
  label: string
  tooltip: string
  enabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-disabled={!enabled}
          className="aria-disabled:opacity-40"
          onClick={() => {
            if (enabled) onClick()
          }}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent className="dark">{tooltip}</TooltipContent>
    </Tooltip>
  )
}
