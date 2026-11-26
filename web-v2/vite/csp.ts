import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Plugin } from 'vite'
import { screenShells } from './screen-shells.ts'

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
 * Writes the static screen shells and hashes their inline scripts into CSP.
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
      const dir = options.dir
      const shells = screenShells(html)
      const hashes = [
        ...new Set(shells.flatMap((shell) => inlineScriptHashes(shell.html))),
      ]
      const path = join(dir, '_headers')
      const headers = await readFile(path, 'utf8')
      if (!headers.includes(PLACEHOLDER) || hashes.length === 0)
        this.error(
          `_headers needs ${PLACEHOLDER} and index.html inline scripts`
        )
      await Promise.all([
        writeFile(path, headers.replaceAll(PLACEHOLDER, hashes.join(' '))),
        ...shells.map(async (shell) => {
          const output = join(dir, shell.file)
          await mkdir(dirname(output), { recursive: true })
          await writeFile(output, shell.html)
        }),
      ])
    },
  }
}
