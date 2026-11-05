// A one-line spinner for slow steps. Silent when stdout is not a terminal or
// `CI` is set; the cursor is restored on exit either way.
import { green, red } from './style'

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export function spinnerEnabled(
  env: Record<string, string | undefined> = process.env,
  isTTY = Boolean(process.stdout.isTTY)
): boolean {
  return isTTY && !env.CI
}

let cursorHookInstalled = false

function showCursor(): void {
  if (process.stdout.isTTY) process.stdout.write('\x1b[?25h')
}

/** Runs `task` behind a spinner labelled `label`, then prints ✓ or ✗. */
export async function withSpinner<T>(
  label: string,
  task: () => Promise<T>
): Promise<T> {
  if (!spinnerEnabled()) {
    console.log(`   … ${label}`)
    return task()
  }
  if (!cursorHookInstalled) {
    process.on('exit', showCursor)
    cursorHookInstalled = true
  }
  let frame = 0
  process.stdout.write('\x1b[?25l')
  const timer = setInterval(() => {
    process.stdout.write(`\r   ${FRAMES[frame++ % FRAMES.length]} ${label}`)
  }, 80)
  try {
    const result = await task()
    process.stdout.write(`\r\x1b[2K   ${green('✓')} ${label}\n`)
    return result
  } catch (error) {
    process.stdout.write(`\r\x1b[2K   ${red('✗')} ${label}\n`)
    throw error
  } finally {
    clearInterval(timer)
    showCursor()
  }
}
