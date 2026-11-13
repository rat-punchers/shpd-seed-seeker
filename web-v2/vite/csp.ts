import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Plugin } from 'vite'

const PLACEHOLDER = 'INLINE_SCRIPT_HASHES'
const INLINE_SCRIPT = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g

/** The CSP source for each inline script, hashed over its exact text. */
export function inlineScriptHashes(html: string): string[] {
  return [...html.matchAll(INLINE_SCRIPT)].map(([, body = '']) => {
    const digest = createHash('sha256').update(body).digest('base64')
    return `'sha256-${digest}'`
  })
}

/**
 * Fills the emitted `_headers` Content-Security-Policy with the hashes of the
 * emitted `index.html`'s inline scripts, so they run without 'unsafe-inline'.
 */
export function contentSecurityPolicy(): Plugin {
  return {
    name: 'seed-seeker-csp',
    apply: 'build',
    enforce: 'post',
    async writeBundle(options, bundle) {
      const page = bundle['index.html']
      if (!options.dir || page?.type !== 'asset') return
      const html =
        typeof page.source === 'string'
          ? page.source
          : new TextDecoder().decode(page.source)
      const hashes = inlineScriptHashes(html)
      const path = join(options.dir, '_headers')
      const headers = await readFile(path, 'utf8')
      if (!headers.includes(PLACEHOLDER) || hashes.length === 0)
        this.error(
          `_headers needs ${PLACEHOLDER} and index.html inline scripts`
        )
      await writeFile(path, headers.replaceAll(PLACEHOLDER, hashes.join(' ')))
    },
  }
}
