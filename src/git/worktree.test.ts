import { execaSync } from 'execa'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git/env'
import { branchRefs, listWorktrees } from '@/git/worktree'

let ROOT: string

function git(...args: string[]): string {
  return execaSync('git', ['-C', ROOT, ...args], {
    env: gitEnv(),
    extendEnv: false,
  }).stdout
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-worktree-list-'))
  git('init', '--quiet', '--initial-branch=main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
  git('commit', '--quiet', '--allow-empty', '-m', 'init')
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('listWorktrees', () => {
  it('should report the branch a linked worktree holds', async () => {
    git('worktree', 'add', '--quiet', '-b', 'feat/parser', 'wt-linked')

    const entries = await listWorktrees(ROOT)

    expect(entries).toContainEqual(
      expect.objectContaining({
        path: join(ROOT, 'wt-linked'),
        branch: 'feat/parser',
      }),
    )
  })

  it('should report a detached worktree as holding no branch', async () => {
    git('worktree', 'add', '--quiet', '--detach', 'wt-detached')

    const entries = await listWorktrees(ROOT)
    const detached = entries.find((entry) => entry.path.endsWith('wt-detached'))

    expect(detached?.branch).toBeNull()
  })

  it('should report the main worktree among the entries', async () => {
    const entries = await listWorktrees(ROOT)

    expect(entries).toContainEqual({ path: ROOT, branch: 'main' })
  })

  it('should report no worktree outside a git repository', async () => {
    const notARepo = mkdtempSync(join(tmpdir(), 'canon-worktree-none-'))

    try {
      expect(await listWorktrees(notARepo)).toEqual([])
    } finally {
      rmSync(notARepo, { recursive: true, force: true })
    }
  })
})

describe('branchRefs', () => {
  it('should report no ref for a branch nothing has created', async () => {
    expect(await branchRefs('feat/parser', ROOT)).toEqual({
      readable: true,
      refs: [],
    })
  })

  it('should report the local head naming the branch', async () => {
    git('branch', 'feat/parser')

    expect(await branchRefs('feat/parser', ROOT)).toEqual({
      readable: true,
      refs: ['refs/heads/feat/parser'],
    })
  })

  it('should report the origin remote-tracking ref naming the branch', async () => {
    git('update-ref', 'refs/remotes/origin/feat/parser', 'HEAD')

    expect(await branchRefs('feat/parser', ROOT)).toEqual({
      readable: true,
      refs: ['refs/remotes/origin/feat/parser'],
    })
  })

  it('should report both refs when the branch exists locally and on origin', async () => {
    git('branch', 'feat/parser')
    git('update-ref', 'refs/remotes/origin/feat/parser', 'HEAD')

    const report = await branchRefs('feat/parser', ROOT)

    expect(report.refs).toEqual([
      'refs/heads/feat/parser',
      'refs/remotes/origin/feat/parser',
    ])
  })

  // `git show-ref --verify` exits 128 for a half match and 128 for a directory
  // that is no repository, which is why the read is `for-each-ref`. An absent
  // branch and a failed read have to answer differently or the caller reads a
  // failure as a clean branch.
  it('should separate an unreadable tree from a branch that does not exist', async () => {
    const notARepo = mkdtempSync(join(tmpdir(), 'canon-refs-none-'))

    try {
      expect(await branchRefs('feat/parser', notARepo)).toEqual({
        readable: false,
        refs: [],
      })
    } finally {
      rmSync(notARepo, { recursive: true, force: true })
    }
  })

  it('should read the directory it was given when the environment names another repository', async () => {
    const other = mkdtempSync(join(tmpdir(), 'canon-refs-other-'))
    execaSync(
      'git',
      ['-C', other, 'init', '--quiet', '--initial-branch=main'],
      {
        env: gitEnv(),
        extendEnv: false,
      },
    )
    git('branch', 'feat/parser')

    process.env.GIT_DIR = join(other, '.git')
    try {
      const report = await branchRefs('feat/parser', ROOT)

      expect(report.refs).toEqual(['refs/heads/feat/parser'])
    } finally {
      delete process.env.GIT_DIR
      rmSync(other, { recursive: true, force: true })
    }
  })
})
