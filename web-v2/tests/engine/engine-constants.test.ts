import { beforeAll, expect, it } from 'bun:test'
import { SHPD_VERSION } from '../../src/engine/constants'
import { getEngineInfo } from '../../src/engine/wasm'
import { loadEngine } from './engine'

/** Local copies of engine facts must match the `engine_info` document. */
beforeAll(loadEngine)

it('the shell game version is the engine version', async () => {
  expect(SHPD_VERSION).toBe((await getEngineInfo()).shpdVersion)
})
