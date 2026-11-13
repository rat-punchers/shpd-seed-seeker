// The floor maps with committed canvas snapshots, and the names the app
// gives their buttons and dialogs. `unit/map-fixtures.test.ts` checks the
// registry under `bun test`.

export interface MainLevel {
  kind: 'main'
  depth: number
}

/** The quest branch levels `level_map` draws in v4.0.2. */
export type BranchObjective = 'Crystal' | 'Gnoll' | 'Vault'

export interface BranchLevel {
  kind: 'branch'
  depth: number
  branch: number
  objective: BranchObjective
}

export type MapLevel = MainLevel | BranchLevel

export interface MapFixture {
  seed: string
  /** What the seed field shows once the seed is typed. */
  typed: string
  level: MapLevel
}

/** Seeds with a real report fixture, so every level is engine output. */
export const MAP_FIXTURES = [
  {
    seed: 'AAA-AAA-AAA',
    typed: 'aaaaaaaaa',
    level: { kind: 'main', depth: 1 },
  },
  {
    seed: 'RZN-LKU-EFS',
    typed: 'rznlkuefs',
    level: { kind: 'main', depth: 16 },
  },
  {
    seed: 'AAA-AAA-AAA',
    typed: 'aaaaaaaaa',
    level: { kind: 'branch', depth: 13, branch: 1, objective: 'Crystal' },
  },
  {
    seed: 'RZN-LKU-EFS',
    typed: 'rznlkuefs',
    level: { kind: 'branch', depth: 13, branch: 1, objective: 'Gnoll' },
  },
  {
    seed: 'AAA-AAA-AAA',
    typed: 'aaaaaaaaa',
    level: { kind: 'branch', depth: 19, branch: 1, objective: 'Vault' },
  },
] as const satisfies readonly MapFixture[]

/** The quest card a branch map opens from (`data-quest`). */
export function branchQuest(objective: BranchObjective): 'blacksmith' | 'imp' {
  return objective === 'Vault' ? 'imp' : 'blacksmith'
}

/** The branch name the report uses (`branchTitle` in web-v2). */
export function branchTitle(objective: BranchObjective): string {
  switch (objective) {
    case 'Crystal':
      return 'Crystal Mine'
    case 'Gnoll':
      return 'Gnoll Mine'
    case 'Vault':
      return 'Imp Vault'
  }
}

export function mapIdentityKey(level: MapLevel): string {
  return level.kind === 'main'
    ? `main:${level.depth}`
    : `branch:${level.depth}:${level.branch}:${level.objective}`
}

/** The map button's name ends with this: `Expand {label}`. */
export function mapLabel(level: MapLevel): string {
  return level.kind === 'main'
    ? `floor ${level.depth} map`
    : `${branchTitle(level.objective)} floor ${level.depth}, branch ${level.branch} map`
}

export function mapDialogTitle(level: MapLevel): string {
  return level.kind === 'main'
    ? `Floor ${level.depth}`
    : `${branchTitle(level.objective)} - Floor ${level.depth}, branch ${level.branch}`
}

export function mapSnapshotName({ seed, level }: MapFixture): string {
  return level.kind === 'main'
    ? `${seed}-F${level.depth}.png`
    : `${seed}-F${level.depth}-B${level.branch}-${level.objective}.png`
}

export function mapTestName({ seed, level }: MapFixture): string {
  return level.kind === 'main'
    ? `${seed} floor ${level.depth} map`
    : `${seed} floor ${level.depth} branch ${level.branch} ${level.objective} map`
}
