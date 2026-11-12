import { execaSync } from 'execa'
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git/env'
import { parseBatch, readBlobsAt, spaceEvenly } from '@/git/revision'

let ROOT: string

function git(...args: string[]): string {
  return execaSync('git', ['-C', ROOT, ...args], {
    env: gitEnv(),
    extendEnv: false,
  }).stdout
}

function commitAll(message: string): string {
  git('add', '--all')
  git('commit', '--quiet', '-m', message)
  return git('rev-parse', 'HEAD')
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-revision-'))
  git('init', '--quiet', '--initial-branch=main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('spaceEvenly', () => {
  it('should return every item when the window is smaller than the sample', () => {
    expect(spaceEvenly(['a', 'b'], 6)).toEqual(['a', 'b'])
  })

  it('should keep the first and last item of the window', () => {
    const items = Array.from({ length: 40 }, (_, index) => `c${index}`)

    const picked = spaceEvenly(items, 6)

    expect(picked).toHaveLength(6)
    expect(picked[0]).toBe('c0')
    expect(picked[5]).toBe('c39')
  })

  it('should space the picked items evenly across the window', () => {
    const items = Array.from({ length: 11 }, (_, index) => `c${index}`)

    expect(spaceEvenly(items, 6)).toEqual(['c0', 'c2', 'c4', 'c6', 'c8', 'c10'])
  })

  it('should return the newest item alone when one point is asked for', () => {
    expect(spaceEvenly(['a', 'b'], 1)).toEqual(['b'])
  })
})

describe('parseBatch', () => {
  it('should split records by their size header even when contents hold newlines', () => {
    const buffer = Buffer.from('aaa blob 4\nx\ny\n\nbbb blob 3\nzzz\n', 'utf8')

    const entries = parseBatch(buffer, [
      { path: 'one.txt', mode: '100644' },
      { path: 'two.txt', mode: '100644' },
    ])

    expect(entries).toEqual([
      { path: 'one.txt', mode: '100644', text: 'x\ny\n' },
      { path: 'two.txt', mode: '100644', text: 'zzz' },
    ])
  })
})

describe('readBlobsAt', () => {
  it('should read a file as the revision held it, not as the working tree holds it', async () => {
    writeFileSync(join(ROOT, 'a.ts'), 'old\n')
    const first = commitAll('first')
    writeFileSync(join(ROOT, 'a.ts'), 'new\n')
    commitAll('second')

    const entries = await readBlobsAt(ROOT, first, () => true)

    expect(entries).toEqual([{ path: 'a.ts', mode: '100644', text: 'old\n' }])
  })

  it('should leave out every path the filter rejects', async () => {
    writeFileSync(join(ROOT, 'a.ts'), 'one\n')
    writeFileSync(join(ROOT, 'b.md'), 'two\n')
    const rev = commitAll('first')

    const entries = await readBlobsAt(ROOT, rev, (path) => path.endsWith('.md'))

    expect(entries.map((entry) => entry.path)).toEqual(['b.md'])
  })

  it('should report a symlink with its mode so a caller can tell it from a file', async () => {
    writeFileSync(join(ROOT, 'a.ts'), 'one\n')
    symlinkSync('a.ts', join(ROOT, 'link.ts'))
    const rev = commitAll('first')

    const entries = await readBlobsAt(ROOT, rev, () => true)

    expect(entries.find((entry) => entry.path === 'link.ts')?.mode).toBe(
      '120000',
    )
  })

  it('should return nothing for a revision git cannot resolve', async () => {
    writeFileSync(join(ROOT, 'a.ts'), 'one\n')
    commitAll('first')

    expect(await readBlobsAt(ROOT, 'not-a-real-ref', () => true)).toEqual([])
  })
})
