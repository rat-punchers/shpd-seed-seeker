import { isBossFloor, regionOf } from '@seed-seeker/design/lib/regions'
import { Sprite } from '@seed-seeker/design/spd/sprite'
import { cn } from '@seed-seeker/design/utils'
import type { ReactNode } from 'react'
import { useFilmFrame } from '../../../shared/ui/use-film-frame'
import { BOSS_FILMS, REGION_STRIPS, type SpriteFilm } from './art'

function FilmSprite({ film }: { film: SpriteFilm }) {
  const frame = useFilmFrame(film.frames.length, film.frameDurationMs)
  const sprite = film.frames[frame] ?? film.frames[0]
  return sprite ? <Sprite sprite={sprite} scale={2} /> : null
}

/** Bosses are fixed by depth in v4.0.2 (`Dungeon.bossLevel`). */
const BOSSES: Record<number, string> = {
  5: 'Goo',
  10: 'Tengu',
  15: 'DM-300',
  20: 'Dwarf King',
  25: 'Yog-Dzewa',
}

export function bossOf(depth: number): string | undefined {
  return isBossFloor(depth) ? BOSSES[depth] : undefined
}

/**
 * Floor header: a region-colored depth block, then a strip of the region's
 * tiles, darkened so the outlined white title reads in either theme. Kept
 * under 64px tall so a sticky stack of banners stays compact.
 */
export function FloorBanner({
  depth,
  title,
  headingLevel = 3,
  showDepth = true,
  leading,
  meta,
  children,
  action,
}: {
  depth: number
  /** Defaults to `Floor {depth}`. */
  title?: string
  headingLevel?: 3 | 4
  /** The depth block and the boss. Off for quest banners inside a floor. */
  showDepth?: boolean
  /** Before the title, such as the quest giver. */
  leading?: ReactNode
  /** Short text after the title. Defaults to the region; `null` hides it. */
  meta?: ReactNode
  /** Marks after the title, such as the feeling or alchemy pots. */
  children?: ReactNode
  /** Trailing control. */
  action?: ReactNode
}) {
  const region = regionOf(depth)
  const boss = showDepth ? bossOf(depth) : undefined
  const bossFilm = boss ? BOSS_FILMS[depth] : undefined
  const Heading = headingLevel === 4 ? 'h4' : 'h3'
  const metaText =
    meta === undefined
      ? boss
        ? `${region.name}, boss: ${boss}`
        : region.name
      : meta

  return (
    <div className="border-border flex h-14 w-full items-stretch overflow-hidden border-y bg-black">
      {showDepth ? (
        <div
          aria-hidden
          data-boss={boss}
          className={cn(
            'text-region-foreground inset-shadow-raised relative grid w-14 shrink-0 place-items-center',
            region.fill
          )}
        >
          {bossFilm ? (
            <FilmSprite film={bossFilm} />
          ) : (
            <span className="font-pixel text-px-2">{depth}</span>
          )}
        </div>
      ) : null}
      <div
        className="pixelated relative flex min-w-0 flex-1 items-center gap-3 px-3"
        style={{
          backgroundImage: `url(${REGION_STRIPS[region.id]})`,
          backgroundSize: '256px 64px',
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-linear-to-r from-black/75 via-black/50 to-black/30"
        />
        {leading ? (
          <div className="relative flex shrink-0 items-center">{leading}</div>
        ) : null}
        <div className="relative flex min-w-0 items-baseline gap-2.5">
          <Heading className="ink-outline font-pixel text-px-1 whitespace-nowrap text-white">
            {title ?? `Floor ${depth}`}
          </Heading>
          {metaText != null && metaText !== false ? (
            <span className="truncate text-sm font-semibold text-white/85">
              {metaText}
            </span>
          ) : null}
        </div>
        {children ? (
          <div className="relative flex min-w-0 items-center gap-2">
            {children}
          </div>
        ) : null}
        {action ? <div className="relative ml-auto">{action}</div> : null}
      </div>
    </div>
  )
}
