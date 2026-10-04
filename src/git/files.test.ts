import { execaSync } from 'execa'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git/env'
import {
  listChangedFiles,
  listIgnoreAdditions,
  listRenames,
  resolveBaseRef,
} from '@/git/files'

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
  writeFileSync(full, `${body}\n`)
}

function commit(message: string, files: Record<string, string>): void {
  for (const [path, body] of Object.entries(files)) write(path, body)
  git('add', '--all')
  git('commit', '-m', message)
}

function resolved(base: string | undefined): string {
  if (base === undefined) throw new Error('Expected a base ref to resolve.')
  return base
}

/**
 * Leaves the session on a branch the trunk has moved past, and returns the
 * commit the branch left from. That gap is the whole subject here: the trunk
 * tip and the merge base are two different commits, so a resolver reading the
 * ref literally and one reading the range disagree about every path merged in
 * between.
 */
function branchBehindMovedTrunk(): string {
  const mergeBase = git('rev-parse', 'HEAD').trim()
  git('checkout', '-q', '-b', 'feat/parser')
  commit('feat: add the parser', { 'src/parser.ts': 'code' })
  git('checkout', '-q', 'main')
  commit('feat: add the widget', { 'src/widget.ts': 'code' })
  git('checkout', '-q', 'feat/parser')
  return mergeBase
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-git-files-'))
  git('init', '--initial-branch=main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
  commit('chore: init', { 'README.md': 'seed' })
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('resolveBaseRef', () => {
  it('should resolve a named trunk to the merge base rather than to its tip', async () => {
    const mergeBase = branchBehindMovedTrunk()

    const base = await resolveBaseRef(ROOT, 'main')

    expect(base).toBe(mergeBase)
  })

  it('should return an ancestor named by ref as itself', async () => {
    const mergeBase = branchBehindMovedTrunk()

    const base = await resolveBaseRef(ROOT, mergeBase)

    expect(base).toBe(mergeBase)
  })

  it('should resolve the trunk when no ref is named', async () => {
    const mergeBase = branchBehindMovedTrunk()

    const base = await resolveBaseRef(ROOT)

    expect(base).toBe(mergeBase)
  })

  it('should refuse a ref the tree does not carry', async () => {
    const base = await resolveBaseRef(ROOT, 'no-such-ref')

    expect(base).toBeUndefined()
  })

  it('should refuse a ref that resolves but shares no history with HEAD', async () => {
    git('checkout', '-q', '--orphan', 'unrelated')
    commit('chore: unrelated root', { 'OTHER.md': 'other' })
    git('checkout', '-q', 'main')

    const base = await resolveBaseRef(ROOT, 'unrelated')

    expect(base).toBeUndefined()
  })
})

describe('listChangedFiles', () => {
  it('should report the branch paths and none the trunk added after it left', async () => {
    branchBehindMovedTrunk()

    const base = resolved(await resolveBaseRef(ROOT, 'main'))
    const changed = await listChangedFiles(ROOT, base)

    expect(changed).toEqual(['src/parser.ts'])
  })

  it('should keep an uncommitted file in the set', async () => {
    branchBehindMovedTrunk()
    write('src/draft.ts', 'draft')

    const base = resolved(await resolveBaseRef(ROOT, 'main'))
    const changed = await listChangedFiles(ROOT, base)

    expect(changed).toEqual(['src/draft.ts', 'src/parser.ts'])
  })
})

describe('listRenames', () => {
  it('should report a git-detected rename with its old and new path', async () => {
    const base = git('rev-parse', 'HEAD').trim()
    git('mv', 'README.md', 'GUIDE.md')
    git('commit', '-m', 'chore: rename readme')

    const renames = await listRenames(ROOT, base)

    expect(renames).toEqual([{ from: 'README.md', to: 'GUIDE.md' }])
  })

  it('should return no renames when nothing was renamed', async () => {
    const base = git('rev-parse', 'HEAD').trim()
    commit('chore: add a file', { 'src/new.ts': 'code' })

    const renames = await listRenames(ROOT, base)

    expect(renames).toEqual([])
  })
})

describe('listIgnoreAdditions', () => {
  it('should report added patterns and exclude a comment line above them', async () => {
    commit('chore: seed gitignore', { '.gitignore': 'node_modules/' })
    const base = git('rev-parse', 'HEAD').trim()

    commit('chore: ignore captures', {
      '.gitignore': [
        'node_modules/',
        '',
        '# generated captures',
        'web/screenshots/',
        'web/evidence/',
      ].join('\n'),
    })

    const additions = await listIgnoreAdditions(ROOT, base)

    expect(additions).toEqual(['web/screenshots/', 'web/evidence/'])
  })

  it('should return no additions when .gitignore did not change', async () => {
    const base = git('rev-parse', 'HEAD').trim()
    commit('chore: unrelated change', { 'src/other.ts': 'code' })

    const additions = await listIgnoreAdditions(ROOT, base)

    expect(additions).toEqual([])
  })
})
