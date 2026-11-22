import { execaSync } from 'execa'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git/env'
import { branchRefs, fastForwardMain, listWorktrees } from '@/git/worktree'

let ROOT: string

function git(...args: string[]): string {
  return execaSync('git', ['-C', ROOT, ...args], {
    env: gitEnv(),
    extendEnv: false,
  }).stdout
}

beforeEach(() => {
  ROOT = realpathSync(mkdtempSync(join(tmpdir(), 'canon-worktree-list-')))
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

  // `git show-ref --verify` exits 128 for a half match and no repository, so the read is `for-each-ref`.
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

describe('fastForwardMain', () => {
  let BASE: string
  let MAIN: string
  let OTHER: string

  function run(cwd: string, ...args: string[]): string {
    return execaSync('git', ['-C', cwd, ...args], {
      env: gitEnv(),
      extendEnv: false,
    }).stdout
  }

  function clone(name: string): string {
    const path = join(BASE, name)
    run(BASE, 'clone', '--quiet', join(BASE, 'origin.git'), path)
    run(path, 'config', 'user.email', 'test@example.com')
    run(path, 'config', 'user.name', 'Test')
    run(path, 'config', 'core.hooksPath', join(BASE, 'no-hooks'))
    return path
  }

  function landOnOrigin(message: string): string {
    run(OTHER, 'pull', '--quiet', '--ff-only')
    run(OTHER, 'commit', '--quiet', '--allow-empty', '-m', message)
    run(OTHER, 'push', '--quiet', 'origin', 'main')
    return run(OTHER, 'rev-parse', 'HEAD')
  }

  function head(path: string): string {
    return run(path, 'rev-parse', 'HEAD')
  }

  beforeEach(() => {
    BASE = realpathSync(mkdtempSync(join(tmpdir(), 'canon-ff-main-')))
    run(
      BASE,
      'init',
      '--quiet',
      '--bare',
      '--initial-branch=main',
      'origin.git',
    )
    run(ROOT, 'remote', 'add', 'origin', join(BASE, 'origin.git'))
    run(ROOT, 'push', '--quiet', 'origin', 'main')
    MAIN = clone('main')
    OTHER = clone('other')
  })

  afterEach(() => {
    rmSync(BASE, { recursive: true, force: true })
  })

  it('should fast-forward a clean main to the commit its remote gained', async () => {
    const landed = landOnOrigin('feat: merged elsewhere')

    expect(await fastForwardMain(MAIN)).toEqual({
      outcome: 'pulled',
      reason: 'fast-forwarded',
    })
    expect(head(MAIN)).toBe(landed)
  })

  it('should report a main already at its remote as up to date', async () => {
    expect(await fastForwardMain(MAIN)).toEqual({
      outcome: 'pulled',
      reason: 'up-to-date',
    })
  })

  it('should refuse a main with tracked changes and leave it where it was', async () => {
    const before = head(MAIN)
    landOnOrigin('feat: merged elsewhere')
    writeFileSync(join(MAIN, 'tracked.txt'), 'one\n')
    run(MAIN, 'add', 'tracked.txt')

    expect(await fastForwardMain(MAIN)).toEqual({
      outcome: 'refused',
      reason: 'dirty-tree',
    })
    expect(head(MAIN)).toBe(before)
  })

  it('should refuse a main that diverged from its remote and leave it where it was', async () => {
    landOnOrigin('feat: merged elsewhere')
    run(MAIN, 'commit', '--quiet', '--allow-empty', '-m', 'local only')
    const before = head(MAIN)

    expect(await fastForwardMain(MAIN)).toEqual({
      outcome: 'refused',
      reason: 'diverged',
    })
    expect(head(MAIN)).toBe(before)
  })

  it('should skip a main checked out on a branch other than the trunk', async () => {
    landOnOrigin('feat: merged elsewhere')
    run(MAIN, 'checkout', '--quiet', '-b', 'feat/elsewhere')
    const before = head(MAIN)

    expect(await fastForwardMain(MAIN)).toEqual({
      outcome: 'skipped',
      reason: 'off-trunk',
    })
    expect(head(MAIN)).toBe(before)
  })

  it('should skip a run from a linked worktree and leave the main worktree where it was', async () => {
    const before = head(MAIN)
    landOnOrigin('feat: merged elsewhere')
    const linked = join(BASE, 'linked')
    run(MAIN, 'worktree', 'add', '--quiet', '-b', 'feat/linked', linked)

    expect(await fastForwardMain(linked)).toEqual({
      outcome: 'skipped',
      reason: 'linked-worktree',
    })
    expect(head(MAIN)).toBe(before)
  })

  it('should refuse pull-failed when the remote cannot be read', async () => {
    rmSync(join(BASE, 'origin.git'), { recursive: true, force: true })

    expect(await fastForwardMain(MAIN)).toEqual({
      outcome: 'refused',
      reason: 'pull-failed',
    })
  })

  it('should skip a directory outside a git repository', async () => {
    const notARepo = mkdtempSync(join(tmpdir(), 'canon-ff-none-'))

    try {
      expect(await fastForwardMain(notARepo)).toEqual({
        outcome: 'skipped',
        reason: 'not-a-repo',
      })
    } finally {
      rmSync(notARepo, { recursive: true, force: true })
    }
  })
})
