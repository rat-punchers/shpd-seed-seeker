import { Sprite } from '@seed-seeker/design/spd/sprite'
import { useFilmFrame } from '../../../shared/ui/use-film-frame'
import type { SpriteFilm } from './art'

/** A looping idle film; holds its first frame under reduced motion. */
export function FilmSprite({
  film,
  scale = 2,
  label,
}: {
  film: SpriteFilm
  scale?: number
  /** Accessible name. Omit when a visible label sits next to the sprite. */
  label?: string
}) {
  const frame = useFilmFrame(film.frames.length, film.frameDurationMs)
  const sprite = film.frames[frame] ?? film.frames[0]
  return sprite ? <Sprite sprite={sprite} scale={scale} label={label} /> : null
}
