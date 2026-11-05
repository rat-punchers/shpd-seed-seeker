// Terminal styling: colors only on an interactive terminal without
// `NO_COLOR` or `CI`.

export function colorEnabled(
  env: Record<string, string | undefined> = process.env,
  isTTY = Boolean(process.stdout.isTTY)
): boolean {
  return isTTY && env.NO_COLOR === undefined && !env.CI
}

const useColor = colorEnabled()

function paint(code: string) {
  return (text: string) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text)
}

export const bold = paint('1')
export const dim = paint('2')
export const red = paint('31')
export const green = paint('32')
export const yellow = paint('33')
export const cyan = paint('36')

export function heading(step: number, title: string): void {
  console.log(`\n${bold(`${step}. ${title}`)}`)
}

/** What a value is for and what access it must carry, shown before any prompt. */
export interface Brief {
  usedFor: string
  needs: { name: string; why: string }[]
  /** A warning when the local source of the value is usually under-scoped. */
  inferHint?: string
}

export function printBrief(brief: Brief): void {
  console.log(`   ${dim('Used for:')} ${brief.usedFor}`)
  console.log(`   ${dim('Needs:')}`)
  for (const need of brief.needs) {
    console.log(`     • ${bold(need.name)}: ${need.why}`)
  }
  if (brief.inferHint) console.log(`   ⚠️  ${yellow(brief.inferHint)}`)
}
