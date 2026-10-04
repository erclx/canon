import { execaSync } from 'execa'
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { census, type CensusResult } from '@/census/count'
import { gitEnv } from '@/git/env'

let ROOT: string

function git(...args: string[]): string {
  return execaSync('git', ['-C', ROOT, ...args], {
    env: gitEnv(),
    extendEnv: false,
  }).stdout
}

function write(path: string, body: string): void {
  const full = join(ROOT, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, body)
}

function measured(result: Awaited<ReturnType<typeof census>>): CensusResult {
  if (result.kind !== 'measured') {
    throw new Error(`Expected a measured result, got: ${result.reason}`)
  }
  return result
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-census-'))
  git('init', '--initial-branch=main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('census', () => {
  it('should count a tracked file, an untracked one, and skip an ignored one', async () => {
    write('a.ts', 'one\ntwo\n')
    git('add', '--all')
    write('.gitignore', 'ignored.ts\n')
    write('b.ts', 'three\n')
    write('ignored.ts', 'four\nfive\nsix\n')

    const result = measured(await census(ROOT))

    expect(result.files).toBe(3)
    expect(result.lines).toBe(4)
  })

  it('should break down file and line counts by extension', async () => {
    write('a.ts', 'one\ntwo\n')
    write('b.ts', 'three\n')
    write('c.md', 'four\nfive\nsix\n')
    git('add', '--all')

    const result = measured(await census(ROOT))

    expect(result.byExtension).toEqual([
      { extension: 'ts', files: 2, lines: 3 },
      { extension: 'md', files: 1, lines: 3 },
    ])
  })

  it('should group a file with no extension under no-extension', async () => {
    write('Dockerfile', 'FROM node\n')
    git('add', '--all')

    const result = measured(await census(ROOT))

    expect(result.byExtension).toEqual([
      { extension: 'no-extension', files: 1, lines: 1 },
    ])
  })

  it('should count a binary file toward files but skip it from lines', async () => {
    write('a.ts', 'one\n')
    writeFileSync(join(ROOT, 'logo.bin'), Buffer.from([0x00, 0x01, 0x02]))
    git('add', '--all')

    const result = measured(await census(ROOT))

    expect(result.files).toBe(2)
    expect(result.skipped).toBe(1)
    expect(result.lines).toBe(1)
    expect(result.byExtension).toEqual(
      expect.arrayContaining([{ extension: 'bin', files: 1, lines: 0 }]),
    )
  })

  it('should count an unreadable file toward files but skip it from lines, the same as a binary one', async () => {
    write('a.ts', 'one\n')
    symlinkSync(join(ROOT, 'missing-target'), join(ROOT, 'dangling.ts'))
    git('add', '--all')

    const result = measured(await census(ROOT))

    expect(result.files).toBe(2)
    expect(result.skipped).toBe(1)
    expect(result.lines).toBe(1)
    expect(result.byExtension).toEqual(
      expect.arrayContaining([{ extension: 'ts', files: 2, lines: 1 }]),
    )
  })

  it('should not count a trailing newline as an extra line', async () => {
    write('a.ts', 'one\ntwo\n')

    const result = measured(await census(ROOT))

    expect(result.lines).toBe(2)
  })

  it('should refuse when git cannot list the tree', async () => {
    rmSync(join(ROOT, '.git'), { recursive: true, force: true })

    const result = await census(ROOT)

    expect(result).toEqual({ kind: 'refused', reason: 'no-git' })
  })
})
