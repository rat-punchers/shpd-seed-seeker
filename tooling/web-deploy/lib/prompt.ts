// Prompts. Public values echo in the clear; secrets read in raw mode and echo
// one `*` per character, paste included. Every read pauses stdin again so
// the process can exit once the script returns.
import { bold, dim } from './style'

const stdin = process.stdin
let pending = ''

/** Reads one line in cooked mode. Lines that arrived together are kept for later reads. */
function readLine(): Promise<string> {
  return new Promise((resolve, reject) => {
    const take = () => {
      const end = pending.search(/\r?\n/)
      if (end < 0) return false
      const line = pending.slice(0, end)
      pending = pending.slice(end + (pending[end] === '\r' ? 2 : 1))
      resolve(line)
      return true
    }
    if (take()) return
    const onData = (chunk: Buffer | string) => {
      pending += chunk.toString()
      if (take()) cleanup()
    }
    const onEnd = () => {
      cleanup()
      if (pending) {
        const line = pending
        pending = ''
        resolve(line)
      } else reject(new Error('Input closed'))
    }
    const cleanup = () => {
      stdin.off('data', onData)
      stdin.off('end', onEnd)
      stdin.pause()
    }
    stdin.on('data', onData)
    stdin.on('end', onEnd)
    stdin.resume()
  })
}

/** Asks for a public value; an empty answer takes `fallback`. */
export async function ask(
  question: string,
  fallback?: string
): Promise<string> {
  const hint = fallback ? dim(` [${fallback}]`) : ''
  process.stdout.write(`   ${bold('?')} ${question}${hint} `)
  const answer = (await readLine()).trim()
  return answer || fallback || ''
}

/** A yes/no question; Enter takes `fallback`. */
export async function confirm(
  question: string,
  fallback = false
): Promise<boolean> {
  const hint = dim(fallback ? ' [Y/n]' : ' [y/N]')
  process.stdout.write(`   ${bold('?')} ${question}${hint} `)
  const answer = (await readLine()).trim().toLowerCase()
  if (!answer) return fallback
  return answer === 'y' || answer === 'yes'
}

/** State of a secret being typed. */
export interface SecretInput {
  value: string
  done: boolean
  cancelled: boolean
}

/** Bracketed-paste markers some terminals wrap a paste in. */
const PASTE_START = '\x1b[200~'
const PASTE_END = '\x1b[201~'

/**
 * Applies one raw-mode chunk to a secret being typed and returns the new
 * state with the text to echo: one `*` per character (a paste is a chunk of
 * many), `\b \b` to erase one star per backspace. Enter finishes, Ctrl-C
 * cancels, and other control characters are ignored.
 */
export function applySecretChunk(
  state: SecretInput,
  chunk: string
): { state: SecretInput; echo: string } {
  let { value } = state
  let echo = ''
  for (const char of chunk
    .replaceAll(PASTE_START, '')
    .replaceAll(PASTE_END, '')) {
    if (char === '\r' || char === '\n') {
      return {
        state: { value, done: true, cancelled: false },
        echo: `${echo}\n`,
      }
    }
    if (char === '\x03') {
      return {
        state: { value: '', done: true, cancelled: true },
        echo: `${echo}\n`,
      }
    }
    if (char === '\x7f' || char === '\b') {
      if (value) {
        value = [...value].slice(0, -1).join('')
        echo += '\b \b'
      }
      continue
    }
    if (char < ' ') continue
    value += char
    echo += '*'
  }
  return { state: { value, done: false, cancelled: false }, echo }
}

/** Asks for a secret, echoing stars. Without a terminal it reads a plain line. */
export async function askSecret(question: string): Promise<string> {
  process.stdout.write(`   ${bold('?')} ${question} `)
  if (!stdin.isTTY) return (await readLine()).trim()
  return new Promise((resolve, reject) => {
    let state: SecretInput = { value: '', done: false, cancelled: false }
    const onData = (chunk: Buffer | string) => {
      const next = applySecretChunk(state, chunk.toString())
      state = next.state
      process.stdout.write(next.echo)
      if (!state.done) return
      stdin.off('data', onData)
      stdin.setRawMode(false)
      stdin.pause()
      if (state.cancelled) reject(new Error('Cancelled'))
      else resolve(state.value.trim())
    }
    stdin.setRawMode(true)
    stdin.on('data', onData)
    stdin.resume()
  })
}

/** Leaves stdin in cooked mode, paused and unreferenced, so Bun can exit. */
export function releaseStdin(): void {
  if (stdin.isTTY) stdin.setRawMode(false)
  stdin.pause()
  stdin.unref()
}
