import { describe, expect, it } from 'bun:test'
import { applySecretChunk, type SecretInput } from '../lib/prompt'
import { envWithout } from '../lib/shell'
import { spinnerEnabled } from '../lib/spinner'
import { colorEnabled } from '../lib/style'

const EMPTY: SecretInput = { value: '', done: false, cancelled: false }

/** Feeds chunks in order, collecting the echo. */
function type(...chunks: string[]) {
  let state = EMPTY
  let echo = ''
  for (const chunk of chunks) {
    const next = applySecretChunk(state, chunk)
    state = next.state
    echo += next.echo
  }
  return { state, echo }
}

describe('secret input', () => {
  it('echoes one star per typed character', () => {
    expect(type('a', 'b', 'c')).toEqual({
      state: { value: 'abc', done: false, cancelled: false },
      echo: '***',
    })
  })

  it('echoes one star per pasted character', () => {
    expect(type('\x1b[200~secret\x1b[201~').echo).toBe('******')
  })

  it('erases one star per backspace and none past the start', () => {
    const { state, echo } = type('ab', '\x7f', '\x7f', '\x7f', 'c')
    expect(state.value).toBe('c')
    expect(echo).toBe('**\b \b\b \b*')
  })

  it('finishes on Enter and keeps the value', () => {
    expect(type('tok', '\r').state).toEqual({
      value: 'tok',
      done: true,
      cancelled: false,
    })
  })

  it('cancels on Ctrl-C without a value', () => {
    expect(type('tok', '\x03').state).toEqual({
      value: '',
      done: true,
      cancelled: true,
    })
  })

  it('ignores other control characters', () => {
    expect(type('a\tb\x1b').state.value).toBe('ab')
  })
})

describe('terminal detection', () => {
  it('colors only an interactive terminal without NO_COLOR or CI', () => {
    expect(colorEnabled({}, true)).toBe(true)
    expect(colorEnabled({}, false)).toBe(false)
    expect(colorEnabled({ NO_COLOR: '' }, true)).toBe(false)
    expect(colorEnabled({ CI: 'true' }, true)).toBe(false)
  })

  it('spins only on an interactive terminal outside CI', () => {
    expect(spinnerEnabled({}, true)).toBe(true)
    expect(spinnerEnabled({ CI: '1' }, true)).toBe(false)
    expect(spinnerEnabled({}, false)).toBe(false)
  })
})

it('strips variables from the environment handed to wrangler', () => {
  expect(
    envWithout(['CLOUDFLARE_API_TOKEN'], {
      CLOUDFLARE_API_TOKEN: 'x',
      HOME: '/h',
    })
  ).toEqual({
    HOME: '/h',
  })
})
