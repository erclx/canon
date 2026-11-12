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
import { census, censusAt, type CensusResult } from '@/census/count'
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

  describe('folders', () => {
    function writeMany(folder: string, count: number, ext = 'ts'): void {
      for (let i = 0; i < count; i += 1) write(`${folder}/f${i}.${ext}`, 'x\n')
    }

    it('should list a folder at 10 files and leave one at 9 out', async () => {
      writeMany('ten', 10)
      writeMany('nine', 9)
      git('add', '--all')

      const result = measured(await census(ROOT))

      expect(result.folders.map((f) => f.path)).toEqual(['ten'])
    })

    it('should count a nested folder apart from its parent', async () => {
      writeMany('parent', 4)
      writeMany('parent/child', 10)
      git('add', '--all')

      const result = measured(await census(ROOT))

      expect(result.folders).toEqual([
        {
          path: 'parent/child',
          files: 10,
          byExtension: [{ extension: 'ts', files: 10 }],
        },
      ])
    })

    it('should break a folder down by extension, then sort by count and path', async () => {
      writeMany('b', 10)
      writeMany('a', 8)
      writeMany('a', 2, 'md')
      git('add', '--all')

      const result = measured(await census(ROOT))

      expect(result.folders).toEqual([
        {
          path: 'a',
          files: 10,
          byExtension: [
            { extension: 'ts', files: 8 },
            { extension: 'md', files: 2 },
          ],
        },
        {
          path: 'b',
          files: 10,
          byExtension: [{ extension: 'ts', files: 10 }],
        },
      ])
    })

    it('should leave an ignored folder out', async () => {
      write('.gitignore', 'ignored/\n')
      writeMany('ignored', 10)
      git('add', '--all')

      const result = measured(await census(ROOT))

      expect(result.folders).toEqual([])
    })

    it('should skip a fixtures folder from the list while the totals still count it', async () => {
      writeMany('src/fixtures/a', 10)
      writeMany('src/__fixtures__', 10)
      git('add', '--all')

      const result = measured(await census(ROOT))

      expect(result.folders).toEqual([])
      expect(result.files).toBe(20)
    })

    it('should count a file named fixtures toward its folder', async () => {
      writeMany('src/a', 9)
      write('src/a/fixtures.ts', 'x\n')
      git('add', '--all')

      const result = measured(await census(ROOT))

      expect(result.folders.map((f) => f.path)).toEqual(['src/a'])
    })

    it('should count files at the repository root under .', async () => {
      writeMany('.', 10)
      git('add', '--all')

      const result = measured(await census(ROOT))

      expect(result.folders.map((f) => f.path)).toEqual(['.'])
    })

    it('should return an empty array when no folder reaches the checkpoint', async () => {
      write('a.ts', 'x\n')
      git('add', '--all')

      const result = measured(await census(ROOT))

      expect(result.folders).toEqual([])
    })
  })
})

describe('censusAt', () => {
  function commitAll(): string {
    git('add', '--all')
    git('commit', '--quiet', '-m', 'snapshot')
    return git('rev-parse', 'HEAD')
  }

  it('should count the tree the revision committed rather than the working tree', async () => {
    write('a.ts', 'one\ntwo\n')
    const first = commitAll()
    write('a.ts', 'one\ntwo\nthree\n')
    write('b.md', 'four\n')
    commitAll()

    const result = measured(await censusAt(ROOT, first))

    expect(result.files).toBe(1)
    expect(result.lines).toBe(2)
  })

  it('should equal census on a clean tree with no untracked files', async () => {
    write('a.ts', 'one\ntwo\n')
    write('docs/b.md', 'three\n')
    write('Dockerfile', 'FROM node\n')
    writeFileSync(join(ROOT, 'logo.bin'), Buffer.from([0x00, 0x01, 0x02]))
    const rev = commitAll()

    const past = measured(await censusAt(ROOT, rev))
    const present = measured(await census(ROOT))

    expect(past).toEqual(present)
  })

  it('should count a symlink toward files and as skipped, never as the link text', async () => {
    write('a.ts', 'one\n')
    symlinkSync('a.ts', join(ROOT, 'link.ts'))
    const rev = commitAll()

    const result = measured(await censusAt(ROOT, rev))

    expect(result.files).toBe(2)
    expect(result.skipped).toBe(1)
    expect(result.lines).toBe(1)
  })

  it('should count a submodule entry toward files and as skipped', async () => {
    write('a.ts', 'one\n')
    const first = commitAll()
    git('update-index', '--add', '--cacheinfo', `160000,${first},vendored`)
    git('commit', '--quiet', '-m', 'add submodule')

    const result = measured(await censusAt(ROOT, 'HEAD'))

    expect(result.files).toBe(2)
    expect(result.skipped).toBe(1)
    expect(result.lines).toBe(1)
  })

  it('should refuse a revision git cannot resolve', async () => {
    write('a.ts', 'one\n')
    commitAll()

    const result = await censusAt(ROOT, 'not-a-real-ref')

    expect(result).toEqual({ kind: 'refused', reason: 'no-git' })
  })
})
