import { CheckIcon } from '@phosphor-icons/react'
import { cn } from '@seed-seeker/design/utils'
import type { CSSProperties } from 'react'
import type { ChipFace, ChipTag, ResinChipView } from '../../../engine/types'
import { effectGlows, type Glow } from '../../../shared/sprites/glow'
import { requirementArt } from '../../../shared/sprites/requirement-art'
import { ARCANE_RESIN_SPRITE, itemArt } from '../../../shared/sprites/sprites'
import { ItemSprite } from '../../../shared/ui/ItemSprite'

/** A chip's sprite size: one whole cell. */
const SPRITE = 16

/**
 * A tag's look by its style. The resin a chip counts (`credit`) keeps the
 * plain tag's color and its own slot style, so it can be tinted apart.
 */
const TAG_CLASS: Record<ChipTag['style'], string> = {
  plain: 'text-warning',
  upgrade: 'text-tier-1',
  credit: 'text-warning',
}

function Tags({ tags }: { tags: ChipTag[] }) {
  return tags.map((tag) => (
    <span
      key={tag.text}
      data-slot="chip-tag"
      data-style={tag.style}
      className={cn(
        'font-mono text-xs font-semibold whitespace-nowrap',
        TAG_CLASS[tag.style]
      )}
      title={tag.tooltip ?? undefined}
    >
      {tag.text}
    </span>
  ))
}

function UncursedCheck({ title }: { title: string }) {
  return (
    <span
      data-slot="chip-check"
      className="text-tier-1 inline-flex"
      title={title}
    >
      <CheckIcon className="size-3" weight="bold" />
    </span>
  )
}

/** Evenly spaced effect colors around a ring, for a chip of several effects. */
function effectRingStyle(glows: Glow[]): CSSProperties {
  const band = 360 / glows.length
  const stops = glows.map((glow, index) => `${glow.color} ${index * band}deg`)
  stops.push(`${glows[0]?.color ?? 'transparent'} 360deg`)
  return { backgroundImage: `conic-gradient(${stops.join(', ')})` }
}

const DOT = 'inline-block size-2.5 shrink-0 rounded-full border border-border'

/** The effect cue: a named item's single effect glows on its sprite instead. */
function EffectCue({ face, glows }: { face: ChipFace; glows: Glow[] }) {
  const effect = face.effect
  if (!effect) return null
  const [glow] = glows
  if (glows.length > 1)
    return (
      <span
        data-slot="chip-effect"
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white [text-shadow:0_0_2px_#000]"
        style={effectRingStyle(glows)}
        title={effect.label}
      >
        {glows.length}
      </span>
    )
  if (glow)
    return face.item ? null : (
      <span
        data-slot="chip-effect"
        className={DOT}
        style={{ backgroundColor: glow.color }}
        title={effect.label}
      />
    )
  return (
    <span
      data-slot="chip-effect"
      className={cn(
        DOT,
        effect.any_enchantment
          ? 'bg-[conic-gradient(#ff4400,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff4400)]'
          : 'bg-degraded'
      )}
      title={effect.label}
    />
  )
}

/** A chip's sprite; a wildcard draws its kind's silhouette with a mark. */
function ChipSprite({ face, glow }: { face: ChipFace; glow: Glow | null }) {
  const art = requirementArt(face)
  if (face.item) return <ItemSprite art={art} size={SPRITE} glow={glow} />
  return (
    <span className="relative inline-flex shrink-0" aria-hidden>
      <span className="opacity-45 grayscale">
        <ItemSprite art={art} size={SPRITE} />
      </span>
      <span className="text-tier-1 absolute inset-0 flex items-center justify-center font-pixel text-xs">
        ?
      </span>
    </span>
  )
}

/**
 * What a chip shows of an item (sprite, name, tags, effect cue, trailing tags,
 * the uncursed check) without its badges, so the board's chip and the drag
 * ghost draw a face the same way.
 */
export function ItemFace({ face }: { face: ChipFace }) {
  const effect = face.effect
  const glows =
    effect && !effect.any_enchantment ? effectGlows(effect.effects) : []
  return (
    <>
      <ChipSprite
        face={face}
        glow={glows.length === 1 ? (glows[0] ?? null) : null}
      />
      <span data-slot="chip-name" className="min-w-0 truncate">
        {face.name}
      </span>
      <Tags tags={face.tags} />
      <EffectCue face={face} glows={glows} />
      <Tags tags={face.trailing_tags} />
      {face.uncursed ? <UncursedCheck title="Uncursed" /> : null}
    </>
  )
}

/**
 * The resin chip's face; the drag ghost shows only its amount, which the core
 * always puts first.
 */
export function ResinChipBody({
  chip,
  amountOnly,
}: {
  chip: ResinChipView
  amountOnly?: boolean
}) {
  return (
    <>
      <ItemSprite art={itemArt(ARCANE_RESIN_SPRITE)} size={SPRITE} />
      <span data-slot="chip-name" className="min-w-0 truncate">
        {chip.name}
      </span>
      <Tags tags={amountOnly ? chip.tags.slice(0, 1) : chip.tags} />
      {!amountOnly && chip.uncursed ? (
        <UncursedCheck title="Uncursed wands" />
      ) : null}
    </>
  )
}

/** The look every chip shares: a raised slab with its face in a row. */
export const CHIP_CLASS =
  'inline-flex max-w-full min-h-8 items-center gap-1.5 rounded-sm border border-border bg-card px-2 py-1 text-sm inset-shadow-raised select-none touch-none outline-none focus-visible:ring-2 focus-visible:ring-ring'
