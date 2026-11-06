// Region floor strips and quest giver sprites from the design package.
import blacksmithUrl from '@seed-seeker/design/assets/sprites/blacksmith.png'
import ghostUrl from '@seed-seeker/design/assets/sprites/ghost.png'
import impUrl from '@seed-seeker/design/assets/sprites/imp.png'
import wandmakerUrl from '@seed-seeker/design/assets/sprites/wandmaker.png'
import cavesUrl from '@seed-seeker/design/assets/textures/caves.png'
import cityUrl from '@seed-seeker/design/assets/textures/city.png'
import hallsUrl from '@seed-seeker/design/assets/textures/halls.png'
import prisonUrl from '@seed-seeker/design/assets/textures/prison.png'
import sewersUrl from '@seed-seeker/design/assets/textures/sewers.png'
import type { RegionId } from '@seed-seeker/design/lib/regions'
import type { Sprite } from '@seed-seeker/design/lib/sprites'
import type { QuestName } from '../../../engine/types'

/** A 128×32 strip of the region's floor tiles, drawn at 2× behind a banner. */
export const REGION_STRIPS: Record<RegionId, string> = {
  sewers: sewersUrl,
  prison: prisonUrl,
  caves: cavesUrl,
  city: cityUrl,
  halls: hallsUrl,
}

/** First frame of a mob `TextureFilm`. */
function npc(url: string, sheetWidth: number, w: number, h: number): Sprite {
  return { url, sheetWidth, sheetHeight: 16, x: 0, y: 0, w, h }
}

export const QUEST_NPCS: Record<QuestName, Sprite> = {
  ghost: npc(ghostUrl, 128, 14, 15),
  wandmaker: npc(wandmakerUrl, 64, 12, 14),
  blacksmith: npc(blacksmithUrl, 64, 13, 16),
  imp: npc(impUrl, 64, 12, 14),
}
