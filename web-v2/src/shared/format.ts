/** A count shortened to three significant figures: 1.25 K, 3.4 M, 812 B. */
export function compactNumber(value: number): string {
  if (value < 1_000) return Math.round(value).toLocaleString()
  const units = [
    ['T', 1e12],
    ['B', 1e9],
    ['M', 1e6],
    ['K', 1e3],
  ] as const
  const [suffix, divisor] = units.find(([, divisor]) => value >= divisor) ?? [
    'K',
    1e3,
  ]
  return `${(value / divisor).toFixed(value / divisor >= 100 ? 0 : 2).replace(/\.00$/, '')} ${suffix}`
}

/** Elapsed time as `12s` or `3m 4s`. */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1_000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

/** An estimated wait, from `<1s` up to days; `—` when there is no estimate. */
export function estimateDuration(milliseconds: number | undefined): string {
  if (
    milliseconds === undefined ||
    !Number.isFinite(milliseconds) ||
    milliseconds < 0
  )
    return '—'
  const seconds = milliseconds / 1_000
  if (seconds < 1) return '<1s'
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3_600)
    return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`
  const hours = Math.floor(seconds / 3_600)
  if (hours < 48) return `${hours}h ${Math.floor((seconds % 3_600) / 60)}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

/** The engine's per-seed match probability as "1 in N". */
export function probabilityLabel(probability: number | null): string {
  if (probability === 0) return 'Match probability ≈ 0'
  if (!probability || probability <= 0) return 'Probability unavailable'
  return `Match probability ≈ 1 in ${compactNumber(1 / probability)}`
}
