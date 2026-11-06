import { $query } from '../../app/store/query'
import { encodeQueryDocument, encodeShareLink } from '../../engine/wasm'
import { AppStore } from '../../shared/store/persistent'
import { toQueryJson } from '../query/query'

/** What Copy and Share produce: the query document, or a link to it. */
export type CopyKind = 'search' | 'link'

/** Which of the two just reached the clipboard, for its "Copied" mark. */
export const $copied = new AppStore<CopyKind | null>(null)

/** Why the last copy failed, to say beside the buttons. */
export const $copyError = new AppStore<string | null>(null)

const COPIED_MS = 1_200
let timer: ReturnType<typeof setTimeout> | undefined

/**
 * The engine's share link, pointed at this app: the engine writes the web
 * app's fixed address, and the fragment carries the whole query.
 */
export function linkHere(link: string, origin: string): string {
  const cut = link.indexOf('#')
  return cut === -1 ? link : `${origin}/${link.slice(cut)}`
}

/**
 * Copies the saved query. Share copies a link; Copy copies the query
 * document itself, which the CLI reads and every app's results import
 * accepts back.
 */
export async function copyQuery(kind: CopyKind): Promise<void> {
  const json = toQueryJson($query.get())
  try {
    const text =
      kind === 'link'
        ? linkHere(await encodeShareLink(json), window.location.origin)
        : await encodeQueryDocument(json)
    await navigator.clipboard.writeText(text)
  } catch (error) {
    $copyError.set(
      `Could not copy: ${error instanceof Error ? error.message : String(error)}`
    )
    return
  }
  $copyError.set(null)
  $copied.set(kind)
  clearTimeout(timer)
  timer = setTimeout(() => {
    if ($copied.get() === kind) $copied.set(null)
  }, COPIED_MS)
}
