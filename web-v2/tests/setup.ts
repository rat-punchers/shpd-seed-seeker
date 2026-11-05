import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { initEditor } from '../src/engine/editor'

// A DOM for component tests.
GlobalRegistrator.register()

// The app loads the requirement editor before its first render; every test
// file gets it the same way, instantiated from its bytes.
await initEditor(
  await readFile(
    join(import.meta.dir, '../src/engine/editor-pkg/seedfinder_editor_bg.wasm')
  )
)
