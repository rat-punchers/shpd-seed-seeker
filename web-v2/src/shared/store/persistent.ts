import { Store } from '@tanstack/store'

/** A TanStack store with a plain setter. */
export class AppStore<T> extends Store<T> {
  set(value: T) {
    this.setState(() => value)
  }
}

export interface Codec<T> {
  encode: (value: T) => string
  decode: (value: string) => T
}

/**
 * A store that starts from `localStorage[key]` (through `codec`) and writes
 * every change back. Storage can be unavailable (privacy modes, tests); the
 * store then keeps its value in memory only.
 */
export function persistentStore<T>(
  key: string,
  initialValue: T,
  codec: Codec<T>
): AppStore<T> {
  let value = initialValue
  try {
    const stored = localStorage.getItem(key)
    if (stored !== null) value = codec.decode(stored)
  } catch {
    // Keep the default when storage cannot be read.
  }
  const store = new AppStore(value)
  store.subscribe((next) => {
    try {
      localStorage.setItem(key, codec.encode(next))
    } catch {
      // Keep the in-memory value when storage cannot be written.
    }
  })
  return store
}

/** A codec for a string union; unknown stored text decodes to `fallback`. */
export function enumCodec<T extends string>(
  values: readonly T[],
  fallback: T
): Codec<T> {
  return {
    encode: (value) => value,
    decode: (text) =>
      (values as readonly string[]).includes(text) ? (text as T) : fallback,
  }
}
