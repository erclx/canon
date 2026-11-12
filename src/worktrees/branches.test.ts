import { execaSync } from 'execa'
import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git/env'
import type { ResolvedSession } from '@/sessions/resolve'
import {
  type BranchInput,
  branchReport,
  type BranchVerdict,
} from '@/worktrees/branches'

let ROOT: string

function git(...args: string[]): string {
  return execaSync('git', ['-C', ROOT, ...args], {
    env: gitEnv(),
    extendEnv: false,
  }).stdout
}

beforeEach(() => {
  ROOT = realpathSync(mkdtempSync(join(tmpdir(), 'canon-branches-')))
  git('init', '--quiet', '--initial-branch=main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
  git('commit', '--quiet', '--allow-empty', '-m', 'init')
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

/** Creates a branch off main carrying one commit, and returns its tip. */
function branchWithCommit(name: string): string {
  const tip = git('commit-tree', '-m', name, '-p', 'main', 'main^{tree}')
  git('update-ref', `refs/heads/${name}`, tip)
  return tip
}

function input(fields: Partial<BranchInput> = {}): BranchInput {
  return {
    cwd: ROOT,
    worktreeBranches: new Set(['main']),
    merged: [],
    sessions: [],
    repository: null,
    ...fields,
  }
}

function session(fields: Partial<ResolvedSession>): ResolvedSession {
  return {
    name: 'canon-1',
    pid: 1,
    sessionId: 'id-1',
    cwd: '/repo',
    kind: 'interactive',
    status: 'idle',
    via: 'pid',
    confidence: 'confirmed',
    startedAt: null,
    statusUpdatedAt: null,
    statusDwellMs: null,
    repository: null,
    worktree: null,
    branch: null,
    unresolved: null,
    ...fields,
  }
}

async function verdictFor(
  branch: string,
  fields: Partial<BranchInput>,
): Promise<BranchVerdict | undefined> {
  const report = await branchReport(input(fields))
  if (report.kind !== 'read') throw new Error(report.detail)
  return report.branches.find((entry) => entry.branch === branch)
}

describe('branchReport', () => {
  describe('reclaimable', () => {
    it('takes a branch sitting at its merged pull request head', async () => {
      const tip = branchWithCommit('feat/parser')

      const verdict = await verdictFor('feat/parser', {
        merged: [{ branch: 'feat/parser', number: 41, headOid: tip }],
      })

      expect(verdict).toEqual({
        branch: 'feat/parser',
        tip,
        reclaimable: true,
        refusals: [],
        pullRequest: 41,
      })
    })

    it('takes a branch behind its merged head', async () => {
      const tip = branchWithCommit('feat/parser')
      const head = git('commit-tree', '-m', 'later', '-p', tip, `${tip}^{tree}`)

      const verdict = await verdictFor('feat/parser', {
        merged: [{ branch: 'feat/parser', number: 41, headOid: head }],
      })

      expect(verdict?.reclaimable).toBe(true)
    })

    it('judges a name merged twice against every merged head', async () => {
      const first = branchWithCommit('feat/parser')
      const unrelated = git(
        'commit-tree',
        '-m',
        'other',
        '-p',
        'main',
        'main^{tree}',
      )

      const verdict = await verdictFor('feat/parser', {
        merged: [
          { branch: 'feat/parser', number: 90, headOid: unrelated },
          { branch: 'feat/parser', number: 41, headOid: first },
        ],
      })

      expect(verdict?.reclaimable).toBe(true)
      expect(verdict?.pullRequest).toBe(41)
    })
  })

  describe('kept', () => {
    it('keeps a branch with a commit past its merged head', async () => {
      const head = branchWithCommit('feat/parser')
      const tip = git('commit-tree', '-m', 'more', '-p', head, `${head}^{tree}`)
      git('update-ref', 'refs/heads/feat/parser', tip)

      const verdict = await verdictFor('feat/parser', {
        merged: [{ branch: 'feat/parser', number: 41, headOid: head }],
      })

      expect(verdict?.reclaimable).toBe(false)
      expect(verdict?.refusals).toEqual(['not-in-merged-head'])
    })

    it('keeps a branch whose merged head is absent locally', async () => {
      branchWithCommit('feat/parser')

      const verdict = await verdictFor('feat/parser', {
        merged: [
          {
            branch: 'feat/parser',
            number: 41,
            headOid: 'a'.repeat(40),
          },
        ],
      })

      expect(verdict?.refusals).toEqual(['head-unreadable'])
    })

    it('keeps a branch whose merged read carried no head', async () => {
      branchWithCommit('feat/parser')

      const verdict = await verdictFor('feat/parser', {
        merged: [{ branch: 'feat/parser', number: 41 }],
      })

      expect(verdict?.refusals).toEqual(['head-unreadable'])
    })

    it('keeps a branch with no merged pull request', async () => {
      branchWithCommit('feat/parser')

      const verdict = await verdictFor('feat/parser', {})

      expect(verdict?.refusals).toEqual(['no-merged-pull-request'])
      expect(verdict?.pullRequest).toBeNull()
    })

    it('keeps master even when a pull request merged under the name', async () => {
      git('branch', 'master', 'main')
      const tip = git('rev-parse', 'master')

      const verdict = await verdictFor('master', {
        merged: [{ branch: 'master', number: 7, headOid: tip }],
      })

      expect(verdict?.refusals).toEqual(['trunk'])
    })

    it('keeps the branch origin/HEAD names', async () => {
      const tip = branchWithCommit('trunk')
      git('update-ref', 'refs/remotes/origin/trunk', tip)
      git(
        'symbolic-ref',
        'refs/remotes/origin/HEAD',
        'refs/remotes/origin/trunk',
      )

      const verdict = await verdictFor('trunk', {
        merged: [{ branch: 'trunk', number: 7, headOid: tip }],
      })

      expect(verdict?.refusals).toEqual(['trunk'])
    })

    it('keeps a branch a live session in this repository holds', async () => {
      const tip = branchWithCommit('feat/parser')

      const verdict = await verdictFor('feat/parser', {
        repository: '/repo',
        sessions: [session({ repository: '/repo', branch: 'feat/parser' })],
        merged: [{ branch: 'feat/parser', number: 41, headOid: tip }],
      })

      expect(verdict?.refusals).toEqual(['held-by-session'])
    })

    it('ignores a session holding the same name in another repository', async () => {
      const tip = branchWithCommit('feat/parser')

      const verdict = await verdictFor('feat/parser', {
        repository: '/repo',
        sessions: [session({ repository: '/other', branch: 'feat/parser' })],
        merged: [{ branch: 'feat/parser', number: 41, headOid: tip }],
      })

      expect(verdict?.reclaimable).toBe(true)
    })
  })

  describe('candidates', () => {
    it('never lists a branch a worktree holds', async () => {
      const tip = branchWithCommit('feat/parser')

      const report = await branchReport(
        input({
          worktreeBranches: new Set(['main', 'feat/parser']),
          merged: [{ branch: 'feat/parser', number: 41, headOid: tip }],
        }),
      )

      expect(report).toEqual({ kind: 'read', branches: [] })
    })

    it('refuses when the branch listing fails', async () => {
      const report = await branchReport(input({ cwd: join(ROOT, 'missing') }))

      expect(report.kind).toBe('unreadable')
    })
  })
})
