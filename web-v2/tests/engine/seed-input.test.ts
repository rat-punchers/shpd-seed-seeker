import { beforeAll, describe, expect, it } from 'bun:test'
import { formatSeedCode } from '../../src/engine/wasm'
import { loadEngine } from './engine'

/** The masker lives in the engine, so this checks the real wasm module. */
beforeAll(loadEngine)

describe('seed input formatting', () => {
  it('uppercases partial input', () =>
    expect(formatSeedCode('abc')).toBe('ABC'))
  it('groups and limits a full seed to nine letters', () =>
    expect(formatSeedCode('abc def ghi extra')).toBe('ABC-DEF-GHI'))
})
