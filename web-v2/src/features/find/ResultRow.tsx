import { ArrowRightIcon, CheckIcon, CopyIcon } from '@phosphor-icons/react'
import { Button } from '@seed-seeker/design/ui/button'
import { cn } from '@seed-seeker/design/utils'
import { useEffect, useRef, useState } from 'react'
import type { ParsedSeed } from '../../engine/types'
import { getItem } from '../../shared/game/catalog'
import { itemArt } from '../../shared/sprites/sprites'
import { ItemSprite } from '../../shared/ui/ItemSprite'
import { analyzeMatch } from './run'

/** The trinket the search chose: its sprite, and its name where it fits. */
function TrinketMark({ match }: { match: ParsedSeed }) {
  const trinket = match.selectedTrinket
    ? getItem(match.selectedTrinket)
    : undefined
  if (trinket)
    return (
      <span
        className="text-muted-foreground flex min-w-0 items-center gap-1 text-xs"
        title={trinket.name}
      >
        <ItemSprite art={itemArt(trinket.sprite)} size={16} />
        <span className="sr-only truncate @[20rem]:not-sr-only">
          {trinket.name}
        </span>
      </span>
    )
  if (match.selectedTrinket !== null) return null
  return (
    <span className="text-muted-foreground sr-only text-xs @[20rem]:not-sr-only">
      No trinket
    </span>
  )
}

/**
 * One matching seed. With the preview on screen, clicking the row previews
 * it and double-clicking opens it in Analyze; without, clicking opens it.
 */
export function ResultRow({
  match,
  index,
  selected = false,
  preview = false,
  onPreview,
}: {
  match: ParsedSeed
  index: number
  selected?: boolean
  /** The preview is on screen, so the row previews instead of opening. */
  preview?: boolean
  onPreview?: (code: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)

  // Keep the previewed row in view as J/K walk the list.
  useEffect(() => {
    if (selected && preview)
      rowRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [selected, preview])

  function copy() {
    void navigator.clipboard?.writeText(match.code).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1_200)
    })
  }

  const open = () => analyzeMatch(match)
  return (
    <div
      ref={rowRef}
      data-testid="result-row"
      data-selected={selected || undefined}
      className={cn(
        'group/result @container relative flex items-center gap-2 border-l-2 py-1 pr-1 pl-2',
        selected
          ? 'border-primary bg-accent inset-shadow-pressed'
          : 'hover:bg-muted border-transparent'
      )}
      style={{
        scrollMarginTop: 'calc(var(--results-tabs-height, 3rem) + 0.5rem)',
      }}
    >
      <span className="text-muted-foreground w-7 shrink-0 text-right font-mono text-xs tabular-nums">
        {index + 1}
      </span>
      <h3 className="shrink-0 font-mono text-sm">{match.code}</h3>
      <div className="flex min-w-0 flex-1">
        <TrinketMark match={match} />
      </div>
      <button
        type="button"
        className="focus-visible:ring-ring absolute inset-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset"
        aria-label={preview ? `Preview ${match.code}` : undefined}
        aria-current={selected && preview ? 'true' : undefined}
        aria-hidden={preview ? undefined : true}
        tabIndex={preview ? undefined : -1}
        onClick={() => (preview ? onPreview?.(match.code) : open())}
        onDoubleClick={preview ? open : undefined}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="relative opacity-0 group-hover/result:opacity-100 group-data-selected/result:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
        aria-label={`Copy seed ${match.code}`}
        title="Copy seed"
        onClick={copy}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="relative"
        aria-label={`Analyze seed ${match.code}`}
        title="Analyze seed"
        onClick={open}
      >
        <ArrowRightIcon />
      </Button>
    </div>
  )
}
