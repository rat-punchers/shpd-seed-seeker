// The local `web-v2/.env`, which `bun run deploy` and wrangler both load, so
// a manual deploy uses the same credentials as CI.
import { chmod, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export const LOCAL_ENV_NAME = 'web-v2/.env'
export const LOCAL_ENV = fileURLToPath(
  new URL('../../../web-v2/.env', import.meta.url)
)

/** The `KEY=value` assignments in a dotenv text. */
export function parseEnv(text: string): Record<string, string> {
  const values: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const match = /^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=\s*(.*?)\s*$/.exec(line)
    if (match)
      values[match[1] as string] =
        match[2]?.replace(/^(['"])(.*)\1$/, '$2') ?? ''
  }
  return values
}

/** Replaces the given keys in place, appends missing ones, keeps the rest. */
export function mergeEnv(text: string, values: Record<string, string>): string {
  const pending = new Map(Object.entries(values))
  const lines = text === '' ? [] : text.replace(/\n$/, '').split('\n')
  const merged = lines.map((line) => {
    const key = /^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=/.exec(line)?.[1]
    if (key === undefined || !pending.has(key)) return line
    const value = pending.get(key) as string
    pending.delete(key)
    return `${key}=${value}`
  })
  for (const [key, value] of pending) merged.push(`${key}=${value}`)
  return `${merged.join('\n')}\n`
}

export async function readLocalEnv(
  path = LOCAL_ENV
): Promise<Record<string, string>> {
  return parseEnv(await readFile(path, 'utf8').catch(() => ''))
}

/** Writes the values into the file, readable by the owner only. */
export async function writeLocalEnv(
  values: Record<string, string>,
  path = LOCAL_ENV
): Promise<{ ok: boolean; message: string }> {
  try {
    const current = await readFile(path, 'utf8').catch(() => '')
    await writeFile(path, mergeEnv(current, values), { mode: 0o600 })
    await chmod(path, 0o600)
    return { ok: true, message: '' }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}
