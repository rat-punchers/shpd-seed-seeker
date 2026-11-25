import type { MapCurve, MapEmitter, Rectangle } from '../types'

export function curveValue(curve: MapCurve, progress: number): number {
  const points = curve.points
  const p = Math.max(0, Math.min(1, progress)) * 1000
  const point = (index: number): [number, number] => points[index] ?? [0, 0]
  const right = points.findIndex(([x]) => x >= p)
  let value: number
  if (right <= 0) value = point(right === 0 ? 0 : points.length - 1)[1]
  else {
    const [x0, y0] = point(right - 1),
      [x1, y1] = point(right)
    value = y0 + ((y1 - y0) * (p - x0)) / (x1 - x0)
  }
  value /= 1000
  return curve.sqrt ? Math.sqrt(value) : value
}

export function particleState(
  emitter: MapEmitter,
  particle: MapEmitter['particles'][number],
  elapsed: number
) {
  const clock = Math.max(0, elapsed) - (emitter.startMs ?? 0)
  // Scheduled hazards start with the captured first turn; ambient emitters
  // retain their prewarmed loops. Never wrap a future first emission backward.
  if (emitter.startMs !== undefined && clock < particle.birthMs) return null
  const age =
    (((clock - particle.birthMs) % emitter.loopMs) + emitter.loopMs) %
    emitter.loopMs
  if (age >= particle.lifespanMs) return null
  const seconds = age / 1000,
    progress = age / particle.lifespanMs
  return {
    x:
      particle.position[0] / 1000 +
      emitter.velocity[0] * seconds +
      (emitter.acceleration[0] * seconds * seconds) / 2,
    y:
      particle.position[1] / 1000 +
      emitter.velocity[1] * seconds +
      (emitter.acceleration[1] * seconds * seconds) / 2,
    scale: (particle.scale / 1000) * curveValue(emitter.scale, progress),
    alpha: curveValue(emitter.alpha, progress),
    scaleX: emitter.scaleX ? curveValue(emitter.scaleX, progress) : 1,
    scaleY: emitter.scaleY ? curveValue(emitter.scaleY, progress) : 1,
    angle: ((particle.angle + emitter.angularSpeed * seconds) * Math.PI) / 180,
  }
}

/** The largest value a stretch curve reaches; 1 without a curve. */
function curvePeak(curve: MapCurve | undefined): number {
  if (!curve) return 1
  return Math.max(...curve.points.map(([x]) => curveValue(curve, x / 1000)))
}

export function emitterBounds(
  emitter: MapEmitter,
  width: number,
  size: number
): Rectangle {
  const positions: [number, number][] = []
  for (const particle of emitter.particles) {
    // Include trajectory extrema, not just its endpoints (e.g. upward sparks).
    const end = particle.lifespanMs / 1000
    const times = [0, end]
    for (const axis of [0, 1] as const) {
      const t = -emitter.velocity[axis] / emitter.acceleration[axis]
      if (t > 0 && t < end) times.push(t)
    }
    for (const t of times)
      positions.push(
        ([0, 1] as const).map(
          (axis) =>
            particle.position[axis] / 1000 +
            emitter.velocity[axis] * t +
            (emitter.acceleration[axis] * t * t) / 2
        ) as [number, number]
      )
  }
  const maxCurve =
    Math.max(...emitter.scale.points.map(([, value]) => value)) / 1000
  const maxScale =
    ((emitter.scale.sqrt ? Math.sqrt(maxCurve) : maxCurve) *
      Math.max(...emitter.particles.map((particle) => particle.scale))) /
    1000
  const radius =
    (Math.hypot(
      emitter.image.destination[2] * curvePeak(emitter.scaleX),
      emitter.image.destination[3] * curvePeak(emitter.scaleY)
    ) *
      maxScale) /
      2 +
    1
  const x = Math.floor(
    (emitter.cell % width) * size +
      Math.min(...positions.map(([x]) => x)) -
      radius
  )
  const y = Math.floor(
    Math.floor(emitter.cell / width) * size +
      Math.min(...positions.map(([, y]) => y)) -
      radius
  )
  return [
    x,
    y,
    Math.ceil(Math.max(...positions.map(([x]) => x))) -
      Math.floor(Math.min(...positions.map(([x]) => x))) +
      Math.ceil(radius) * 2 +
      2,
    Math.ceil(Math.max(...positions.map(([, y]) => y))) -
      Math.floor(Math.min(...positions.map(([, y]) => y))) +
      Math.ceil(radius) * 2 +
      2,
  ]
}
