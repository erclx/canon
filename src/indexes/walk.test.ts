import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { $ } from 'bun'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git/env'
import { isIgnored, listIndexes } from '@/indexes/walk'

let root: string

function seedIndex(relativeDir: string): void {
  const dir = join(root, relativeDir)
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'index.md'),
    '---\ntitle: T\nsubtitle: S\n---\n\n# T\n\nS\n',
  )
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-walk-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('listIndexes', () => {
  it('should skip vendored and git trees outside a git repository', async () => {
    seedIndex('real')
    seedIndex('node_modules/pkg')
    seedIndex('.git/weird')

    const found = await listIndexes(root)

    expect(found).toEqual([join(root, 'real', 'index.md')])
  })

  it('should find a nested index at any depth', async () => {
    seedIndex('a/b/c')

    const found = await listIndexes(root)

    expect(found).toEqual([join(root, 'a', 'b', 'c', 'index.md')])
  })

  it('should return an empty list when nothing is indexed', async () => {
    mkdirSync(join(root, 'plain'), { recursive: true })

    expect(await listIndexes(root)).toEqual([])
  })

  it('should sort results so index output is deterministic', async () => {
    seedIndex('zebra')
    seedIndex('alpha')

    const found = await listIndexes(root)

    expect(found).toEqual([
      join(root, 'alpha', 'index.md'),
      join(root, 'zebra', 'index.md'),
    ])
  })
})

describe('isIgnored', () => {
  async function initRepo(ignoreBody: string): Promise<void> {
    // Strips `GIT_DIR` for the same reason the production call does. Run from
    // a git hook, an inherited one sends `init` at the hook's repository and
    // leaves this fixture without one.
    await $`git -C ${root} init --quiet`.env(gitEnv()).quiet()
    writeFileSync(join(root, '.gitignore'), ignoreBody)
  }

  it('should report an ignored folder as ignored', async () => {
    await initRepo('board/\n')
    seedIndex('board')

    expect(await isIgnored(root, join(root, 'board', 'index.md'))).toBe(true)
  })

  it('should report a tracked folder as not ignored', async () => {
    await initRepo('board/\n')
    seedIndex('docs')

    expect(await isIgnored(root, join(root, 'docs', 'index.md'))).toBe(false)
  })

  it('should report nothing as ignored outside a git repository', async () => {
    seedIndex('board')

    expect(await isIgnored(root, join(root, 'board', 'index.md'))).toBe(false)
  })
})
