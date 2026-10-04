import { execaSync } from 'execa'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git/env'
import type { WorktreeVerdict } from '@/worktrees/reclaim'
import { reclaimReport } from '@/worktrees/reclaim'
import { type GitResult, removeReclaimable } from '@/worktrees/remove'

let ROOT: string

function git(...args: string[]): string {
  return execaSync('git', ['-C', ROOT, ...args], {
    env: gitEnv(),
    extendEnv: false,
  }).stdout
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-remove-'))
  git('init', '--quiet', '--initial-branch=main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
  git('commit', '--quiet', '--allow-empty', '-m', 'init')
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

function verdict(fields: Partial<WorktreeVerdict> = {}): WorktreeVerdict {
  return {
    path: '/repo/wt-parser',
    branch: 'feat/parser',
    reclaimable: true,
    refusals: [],
    pullRequest: 673,
    sessions: [],
    route: 'worktree',
    missing: false,
    ...fields,
  }
}

/** Records the git calls and answers each one, so a test asserts the sequence. */
function recorder(answer: (args: readonly string[]) => number = () => 0): {
  calls: string[][]
  git: (cwd: string, args: readonly string[]) => Promise<GitResult>
} {
  const calls: string[][] = []

  return {
    calls,
    git: async (_cwd, args) => {
      calls.push([...args])
      return { exitCode: answer(args), stderr: '' }
    },
  }
}

describe('removeReclaimable', () => {
  it('should unlock, remove, then delete the branch for one reclaimable worktree', async () => {
    const { calls, git: spy } = recorder()

    await removeReclaimable([verdict()], { cwd: ROOT, git: spy })

    expect(calls).toEqual([
      ['worktree', 'unlock', '/repo/wt-parser'],
      ['worktree', 'remove', '/repo/wt-parser'],
      ['branch', '-D', 'feat/parser'],
    ])
  })

  it('should leave a worktree no reading called reclaimable untouched', async () => {
    const { calls, git: spy } = recorder()

    await removeReclaimable(
      [verdict({ reclaimable: false, refusals: ['held-by-session'] })],
      { cwd: ROOT, git: spy },
    )

    expect(calls).toEqual([])
  })

  // The sweep clears a registration a failed remove would leave behind, and a
  // branch git still reads as held cannot be deleted, so it runs ahead of the
  // deletes rather than at the end.
  it('should sweep once before the branch deletes when a directory is gone', async () => {
    const { calls, git: spy } = recorder()

    await removeReclaimable(
      [
        verdict({ path: '/repo/a', branch: 'feat/a', missing: true }),
        verdict({ path: '/repo/b', branch: 'feat/b', missing: true }),
      ],
      { cwd: ROOT, git: spy },
    )

    expect(calls.filter((call) => call[1] === 'prune')).toHaveLength(1)
    const prune = calls.findIndex((call) => call[1] === 'prune')
    const firstDelete = calls.findIndex((call) => call[0] === 'branch')
    expect(prune).toBeLessThan(firstDelete)
  })

  it('should not sweep when every directory still stands', async () => {
    const { calls, git: spy } = recorder()

    const report = await removeReclaimable([verdict()], {
      cwd: ROOT,
      git: spy,
    })

    expect(report.pruned).toBe(false)
    expect(calls.some((call) => call[1] === 'prune')).toBe(false)
  })

  // Git refuses to delete a branch a registered worktree holds, so forcing past
  // a failed remove strands a registration pointing at a branch that is gone.
  it('should keep the branch when removing a directory that still stands failed', async () => {
    const { calls, git: spy } = recorder((args) =>
      args[1] === 'remove' ? 128 : 0,
    )

    const report = await removeReclaimable([verdict()], {
      cwd: ROOT,
      git: spy,
    })

    expect(calls.some((call) => call[0] === 'branch')).toBe(false)
    expect(report.outcomes[0]?.removed).toBe(false)
    expect(report.outcomes[0]?.failedAt).toBe('remove')
  })

  it('should report the branch delete as the failing step when only it fails', async () => {
    const { git: spy } = recorder((args) => (args[0] === 'branch' ? 1 : 0))

    const report = await removeReclaimable([verdict()], {
      cwd: ROOT,
      git: spy,
    })

    expect(report.outcomes[0]?.removed).toBe(false)
    expect(report.outcomes[0]?.failedAt).toBe('branch')
  })

  // The hand cleanup this verb was filed against: eight directories deleted
  // outside git, leaving a registration and a branch behind each one.
  it('should clear a worktree whose directory was deleted by hand, and its branch', async () => {
    git('worktree', 'add', '--quiet', '-b', 'feat/parser', 'wt-parser')
    const path = join(ROOT, 'wt-parser')
    rmSync(path, { recursive: true, force: true })

    const report = await reclaimReport({
      cwd: ROOT,
      resolve: async () => ({
        kind: 'resolved',
        dir: '/registry',
        confidence: 'confirmed',
        sessions: [],
      }),
      mergedPullRequests: async () => ({
        kind: 'read',
        merged: [{ branch: 'feat/parser', number: 673 }],
      }),
    })
    if (report.kind !== 'read') throw new Error('expected a readable report')

    const removal = await removeReclaimable(report.worktrees, { cwd: ROOT })

    expect(removal.outcomes.map((outcome) => outcome.removed)).toEqual([true])
    expect(git('worktree', 'list', '--porcelain')).not.toContain('wt-parser')
    expect(git('branch', '--list', 'feat/parser')).toBe('')
  })

  it('should clear a locked worktree that still stands, and its branch', async () => {
    git('worktree', 'add', '--quiet', '-b', 'feat/locked', 'wt-locked')
    const path = join(ROOT, 'wt-locked')
    git('worktree', 'lock', path)

    const removal = await removeReclaimable(
      [verdict({ path, branch: 'feat/locked' })],
      { cwd: ROOT },
    )

    expect(removal.outcomes[0]?.removed).toBe(true)
    expect(existsSync(path)).toBe(false)
    expect(git('branch', '--list', 'feat/locked')).toBe('')
  })
})
