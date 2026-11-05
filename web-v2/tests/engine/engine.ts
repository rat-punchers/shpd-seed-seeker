import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import init from '../../src/engine/pkg/seedfinder.js'

/**
 * Instantiates the engine module from its bytes. Once it is loaded,
 * `initEngine()` in the app's wrappers resolves without fetching.
 */
export async function loadEngine(): Promise<void> {
  await init({
    module_or_path: await readFile(
      join(import.meta.dir, '../../src/engine/pkg/seedfinder_bg.wasm')
    ),
  })
}

/** The repository root, for fixtures committed outside this package. */
export const REPO_ROOT = join(import.meta.dir, '../../..')
