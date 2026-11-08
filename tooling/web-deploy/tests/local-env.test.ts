import { describe, expect, it } from 'bun:test'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  mergeEnv,
  parseEnv,
  readLocalEnv,
  writeLocalEnv,
} from '../lib/local-env'

describe('parseEnv', () => {
  it('reads assignments, skipping comments and blank lines', () => {
    expect(
      parseEnv('# deploy\n\nA=1\nexport B = two \nC="three"\nD=\n')
    ).toEqual({ A: '1', B: 'two', C: 'three', D: '' })
  })
})

describe('mergeEnv', () => {
  it('creates the file from nothing', () => {
    expect(mergeEnv('', { A: '1' })).toBe('A=1\n')
  })

  it('replaces keys in place and keeps other lines', () => {
    expect(mergeEnv('# c\nA=old\nOTHER=x', { A: 'new', B: '2' })).toBe(
      '# c\nA=new\nOTHER=x\nB=2\n'
    )
  })
})

describe('local .env file', () => {
  it('writes values readable by the owner only and reads them back', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'web-deploy-'))
    const path = join(dir, '.env')
    try {
      await writeFile(path, 'KEEP=me\nCLOUDFLARE_ACCOUNT_ID=old\n')
      expect(
        await writeLocalEnv(
          { CLOUDFLARE_ACCOUNT_ID: 'acc', CLOUDFLARE_API_TOKEN: 'tok' },
          path
        )
      ).toEqual({ ok: true, message: '' })
      expect(await readFile(path, 'utf8')).toBe(
        'KEEP=me\nCLOUDFLARE_ACCOUNT_ID=acc\nCLOUDFLARE_API_TOKEN=tok\n'
      )
      expect((await stat(path)).mode & 0o777).toBe(0o600)
      expect((await readLocalEnv(path)).CLOUDFLARE_API_TOKEN).toBe('tok')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('reads a missing file as empty', async () => {
    expect(await readLocalEnv(join(tmpdir(), 'no-such-dir', '.env'))).toEqual(
      {}
    )
  })
})
