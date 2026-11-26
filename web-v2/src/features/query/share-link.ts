// Detecting share-link fragments (`#q=CODE`). Decoding the code
// itself happens in the engine, which accepts the full URL text.

/** Whether a URL fragment carries a share code. */
export function hasShareCode(hash: string): boolean {
  return /(^#|[?&])q=/.test(hash)
}
