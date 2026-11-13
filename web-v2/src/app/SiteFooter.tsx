import { CONFIG } from '../config'
import { SHPD_VERSION } from '../engine/constants'

const LINK = 'underline-offset-2 hover:text-foreground hover:underline'

/** License, attribution and the game version the engine reproduces. */
export function SiteFooter() {
  return (
    <footer className="border-border text-muted-foreground flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-t px-4 py-4 text-xs">
      <span>
        Engine:{' '}
        <a
          href={CONFIG.links.shpd}
          target="_blank"
          rel="noreferrer"
          className={LINK}
        >
          Shattered Pixel Dungeon
        </a>{' '}
        v{SHPD_VERSION}
      </span>
      <span aria-hidden="true">·</span>
      <span>GPL-3.0-or-later</span>
      <span aria-hidden="true">·</span>
      <a href={CONFIG.links.license} className={LINK}>
        License
      </a>
      <span aria-hidden="true">·</span>
      <a href={CONFIG.links.attribution} className={LINK}>
        Asset attribution
      </a>
    </footer>
  )
}
