import type { MapLayer } from '../types'

function sameLayer(a: MapLayer | undefined, b: MapLayer | undefined): boolean {
  return (
    !!a &&
    !!b &&
    a.name === b.name &&
    a.blend === b.blend &&
    a.cells.length === b.cells.length &&
    a.cells.every((sprite, i) => sprite === b.cells[i])
  )
}

/** Preserves draw order when concealed actors add or remove packed layers. */
export function* changedLayerPairs(
  shown: MapLayer[],
  hidden: MapLayer[]
): Generator<[MapLayer | undefined, MapLayer | undefined]> {
  let first = 0
  let lastShown = shown.length
  let lastHidden = hidden.length
  while (
    first < lastShown &&
    first < lastHidden &&
    sameLayer(shown[first], hidden[first])
  ) {
    first++
  }
  while (
    lastShown > first &&
    lastHidden > first &&
    sameLayer(shown[lastShown - 1], hidden[lastHidden - 1])
  ) {
    lastShown--
    lastHidden--
  }
  if (first === lastShown && first === lastHidden) return
  shown = shown.slice(first, lastShown)
  hidden = hidden.slice(first, lastHidden)

  // Find the alignment with the fewest changed sprite slots.
  const rows = shown.length + 1
  const cols = hidden.length + 1
  const cost = new Uint32Array(rows * cols)
  const matches = new Uint8Array(cost.length)
  const costAt = (index: number) => cost[index] ?? Infinity
  const occupied = (layer: MapLayer) =>
    layer.cells.reduce<number>(
      (count, sprite) => count + Number(sprite != null),
      0
    )
  const shownCost = shown.map(occupied)
  const hiddenCost = hidden.map(occupied)
  for (let i = rows - 1; i >= 0; i--) {
    for (let j = cols - 1; j >= 0; j--) {
      const a = shown[i]
      const b = hidden[j]
      const index = i * cols + j
      if (!a && !b) continue
      const remove = a ? costAt(index + cols) + (shownCost[i] ?? 0) : Infinity
      const insert = b ? costAt(index + 1) + (hiddenCost[j] ?? 0) : Infinity
      let replace = Infinity
      if (a && b && a.name === b.name && a.blend === b.blend) {
        replace = costAt(index + cols + 1)
        const length = Math.max(a.cells.length, b.cells.length)
        for (let cell = 0; cell < length; cell++) {
          if ((a.cells[cell] ?? null) !== (b.cells[cell] ?? null)) replace++
        }
      }
      cost[index] = Math.min(remove, insert, replace)
      matches[index] =
        replace <= remove && replace <= insert ? 0 : remove <= insert ? 1 : 2
    }
  }
  let i = 0
  let j = 0
  while (i < shown.length || j < hidden.length) {
    const match = matches[i * cols + j]
    yield [
      match === 2 ? undefined : shown[i++],
      match === 1 ? undefined : hidden[j++],
    ]
  }
}
