// Runs local CLIs. Secrets go on stdin, never in argv.

export interface RunResult {
  code: number
  stdout: string
  stderr: string
}

export async function run(
  command: string[],
  options: {
    stdin?: string
    env?: Record<string, string | undefined>
    cwd?: string
  } = {}
): Promise<RunResult> {
  try {
    const child = Bun.spawn(command, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdin: options.stdin === undefined ? 'ignore' : new Blob([options.stdin]),
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    return { code, stdout, stderr }
  } catch (error) {
    return {
      code: -1,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
    }
  }
}

/** `env` without the named variables. */
export function envWithout(
  names: string[],
  env: Record<string, string | undefined> = process.env
): Record<string, string | undefined> {
  const copy = { ...env }
  for (const name of names) delete copy[name]
  return copy
}

/** Opens a URL in the default browser. */
export async function openUrl(url: string): Promise<boolean> {
  const opener = process.platform === 'darwin' ? 'open' : 'xdg-open'
  return (await run([opener, url])).code === 0
}
