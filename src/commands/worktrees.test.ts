import { describe, expect, it } from 'vitest'
import {
  describe as describeVerdict,
  reclaimRecord,
  retireMembersExit,
  retireMembersRecord,
} from '@/commands/worktrees'
import type {
  Half,
  HalfState,
  MemberOutcome,
  MemberRefusal,
} from '@/worktrees/members'
import type { HeldSession, WorktreeVerdict } from '@/worktrees/reclaim'
import type { RemovalOutcome, RemovalReport } from '@/worktrees/remove'

function removed(path: string, branch: string): RemovalOutcome {
  return { path, branch, removed: true, failedAt: null, detail: null }
}

function failed(path: string, branch: string): RemovalOutcome {
  return {
    path,
    branch,
    removed: false,
    failedAt: 'branch',
    detail: 'the branch is not fully merged',
  }
}

function removal(
  outcomes: readonly RemovalOutcome[],
  pruned = false,
): RemovalReport {
  return { outcomes, pruned }
}

describe('reclaimRecord', () => {
  it('should count every removal that closed and carry no refusal reason', () => {
    const record = reclaimRecord({
      kind: 'read',
      dryRun: false,
      reclaimable: 2,
      removal: removal([removed('/a', 'feat/a'), removed('/b', 'feat/b')]),
    })

    expect(record.reason).toBeNull()
    expect(record.reclaimable).toBe(2)
    expect(record.removed).toBe(2)
    expect(record.failed).toBe(0)
    expect(record.outcomes).toHaveLength(2)
  })

  it('should split the counts when one removal closed and another did not', () => {
    const record = reclaimRecord({
      kind: 'read',
      dryRun: false,
      reclaimable: 2,
      removal: removal([removed('/a', 'feat/a'), failed('/b', 'feat/b')]),
    })

    expect(record.removed).toBe(1)
    expect(record.failed).toBe(1)
  })

  it('should report the sweep flag the removal returned', () => {
    const record = reclaimRecord({
      kind: 'read',
      dryRun: false,
      reclaimable: 1,
      removal: removal([removed('/a', 'feat/a')], true),
    })

    expect(record.pruned).toBe(true)
  })

  it('should carry the refusal reason and detail when the reading was unreadable', () => {
    const record = reclaimRecord({
      kind: 'unreadable',
      reason: 'gh-missing',
      detail: 'gh is not on the path',
      dryRun: false,
    })

    expect(record.reason).toBe('gh-missing')
    expect(record.detail).toBe('gh is not on the path')
    expect(record.removed).toBe(0)
    expect(record.failed).toBe(0)
    expect(record.outcomes).toEqual([])
  })

  it('should report zero of everything when nothing was reclaimable', () => {
    const record = reclaimRecord({
      kind: 'read',
      dryRun: false,
      reclaimable: 0,
      removal: null,
    })

    expect(record.reason).toBeNull()
    expect(record.reclaimable).toBe(0)
    expect(record.removed).toBe(0)
    expect(record.pruned).toBe(false)
  })

  it('should separate a dry run from an empty reading by the reclaimable count', () => {
    const record = reclaimRecord({
      kind: 'read',
      dryRun: true,
      reclaimable: 3,
      removal: null,
    })

    expect(record.dryRun).toBe(true)
    expect(record.reclaimable).toBe(3)
    expect(record.removed).toBe(0)
  })

  it('should count the processes a stop signaled', () => {
    const record = reclaimRecord({
      kind: 'read',
      dryRun: false,
      reclaimable: 2,
      removal: removal([removed('/a', 'feat/a'), removed('/b', 'feat/b')]),
      stop: {
        kind: 'read',
        stopped: [
          { path: '/a', pids: [10, 11], ports: [5173] },
          { path: '/b', pids: [20], ports: [4321, 4322] },
        ],
      },
    })

    expect(record.stopped).toBe(3)
  })

  it('should say the stop was unread rather than zero when the machine has no listener reader', () => {
    const record = reclaimRecord({
      kind: 'read',
      dryRun: false,
      reclaimable: 1,
      removal: removal([removed('/a', 'feat/a')]),
      stop: { kind: 'unread' },
    })

    expect(record.stopped).toBeNull()
  })

  it('should report zero stopped when no stop ran', () => {
    const record = reclaimRecord({
      kind: 'read',
      dryRun: false,
      reclaimable: 0,
      removal: null,
    })

    expect(record.stopped).toBe(0)
  })

  it('should keep outcomes last with stopped ahead of it', () => {
    const serialized = JSON.stringify(
      reclaimRecord({
        kind: 'read',
        dryRun: false,
        reclaimable: 1,
        removal: removal([removed('/a', 'feat/a')]),
      }),
    )

    expect(serialized.indexOf('"stopped"')).toBeGreaterThan(
      serialized.indexOf('"pruned"'),
    )
    expect(serialized.indexOf('"outcomes"')).toBeGreaterThan(
      serialized.indexOf('"stopped"'),
    )
  })

  it('should place outcomes last so a pattern anchored on a scalar cannot reach it', () => {
    const serialized = JSON.stringify(
      reclaimRecord({
        kind: 'read',
        dryRun: false,
        reclaimable: 1,
        removal: removal([removed('/a', 'feat/a')]),
      }),
    )

    expect(serialized.indexOf('"outcomes"')).toBeGreaterThan(
      serialized.indexOf('"failed"'),
    )
  })
})

function heldVerdict(sessions: readonly HeldSession[]): WorktreeVerdict {
  return {
    path: '/repo/.claude/worktrees/wt-parser',
    branch: 'feat/parser',
    reclaimable: false,
    refusals: ['held-by-session'],
    pullRequest: 673,
    sessions,
    route: 'session',
    missing: false,
  }
}

describe('describe', () => {
  it('should print the real removal command for a resolved background holder', () => {
    const row = describeVerdict(
      heldVerdict([{ name: 'worker-parser', kind: 'bg', id: 'abcd1234' }]),
    )

    expect(row).toContain("claude rm 'abcd1234'")
  })

  it('should point an unresolved background holder at the manual cross-reference', () => {
    const row = describeVerdict(
      heldVerdict([{ name: 'worker-parser', kind: 'bg', id: null }]),
    )

    expect(row).toContain('worker-parser')
    expect(row).toContain('claude agents --json')
    expect(row).not.toContain("claude rm 'null'")
  })

  it('should name an interactive holder as having no removal route', () => {
    const row = describeVerdict(
      heldVerdict([
        { name: 'orchestrator-parser', kind: 'interactive', id: null },
      ]),
    )

    expect(row).toContain('orchestrator-parser')
    expect(row).toContain('until its terminal closes')
    expect(row).not.toContain('claude rm')
  })
})

function half(state: HalfState, ...reasons: MemberRefusal[]): Half {
  return { state, reasons, detail: null }
}

function outcome(
  branch: string,
  origin: Half,
  local: Half,
  worktree: Half | null = null,
): MemberOutcome {
  return {
    branch,
    origin,
    local,
    worktree: worktree === null ? null : { ...worktree, path: `/wt/${branch}` },
  }
}

describe('retireMembersRecord', () => {
  it('should count a member whose every present half went as retired', () => {
    const record = retireMembersRecord(7, false, {
      kind: 'read',
      members: [
        outcome('feat/a', half('deleted'), half('deleted'), half('deleted')),
        outcome('feat/b', half('absent'), half('deleted')),
      ],
    })

    expect(record).toMatchObject({
      pullRequest: 7,
      reason: null,
      retired: 2,
      kept: 0,
      failed: 0,
    })
  })

  it('should count a member with any half kept as kept rather than retired', () => {
    const record = retireMembersRecord(7, false, {
      kind: 'read',
      members: [
        outcome(
          'feat/a',
          half('deleted'),
          half('kept', 'not-in-merged-head'),
          half('kept', 'not-in-merged-head'),
        ),
      ],
    })

    expect(record).toMatchObject({ retired: 0, kept: 1, failed: 0 })
  })

  it('should count a member with any half failed as failed, ahead of kept', () => {
    const record = retireMembersRecord(7, false, {
      kind: 'read',
      members: [
        outcome('feat/a', half('failed'), half('kept', 'worktree-kept')),
      ],
    })

    expect(record).toMatchObject({ retired: 0, kept: 0, failed: 1 })
  })

  it('should count nothing retired for a member already gone everywhere', () => {
    const record = retireMembersRecord(7, false, {
      kind: 'read',
      members: [outcome('feat/a', half('absent'), half('absent'))],
    })

    expect(record.retired).toBe(0)
  })

  it('should count what a dry run would retire', () => {
    const record = retireMembersRecord(7, true, {
      kind: 'read',
      members: [outcome('feat/a', half('would-delete'), half('would-delete'))],
    })

    expect(record).toMatchObject({ dryRun: true, retired: 1 })
  })

  it('should carry the refusal and no members when the run was refused', () => {
    const record = retireMembersRecord(7, false, {
      kind: 'refused',
      reason: 'open-pull-request',
      detail: 'feat/b has an open pull request',
      members: ['feat/a', 'feat/b'],
    })

    expect(record).toMatchObject({
      reason: 'open-pull-request',
      detail: 'feat/b has an open pull request',
      retired: 0,
      members: [],
    })
  })

  it('should place members last so a pattern anchored on a scalar cannot reach it', () => {
    const serialized = JSON.stringify(
      retireMembersRecord(7, false, {
        kind: 'read',
        members: [outcome('feat/a', half('deleted'), half('deleted'))],
      }),
    )

    expect(serialized.indexOf('"members"')).toBeGreaterThan(
      serialized.indexOf('"failed"'),
    )
  })
})

describe('retireMembersExit', () => {
  it('should exit 0 when every member retired', () => {
    const record = retireMembersRecord(7, false, {
      kind: 'read',
      members: [outcome('feat/a', half('deleted'), half('deleted'))],
    })

    expect(retireMembersExit(record)).toBe(0)
  })

  it('should exit 0 when a member was kept, since keeping is a refusal working', () => {
    const record = retireMembersRecord(7, false, {
      kind: 'read',
      members: [
        outcome('feat/a', half('kept', 'not-in-merged-head'), half('deleted')),
      ],
    })

    expect(retireMembersExit(record)).toBe(0)
  })

  it('should exit 0 on a body naming no members, the ordinary merge', () => {
    const record = retireMembersRecord(7, false, {
      kind: 'refused',
      reason: 'no-members',
      detail: 'no line',
      members: [],
    })

    expect(retireMembersExit(record)).toBe(0)
  })

  it('should exit 1 when the run was refused', () => {
    const record = retireMembersRecord(7, false, {
      kind: 'refused',
      reason: 'gh-failed',
      detail: 'HTTP 401',
      members: [],
    })

    expect(retireMembersExit(record)).toBe(1)
  })

  it('should exit 1 when a deletion failed', () => {
    const record = retireMembersRecord(7, false, {
      kind: 'read',
      members: [outcome('feat/a', half('failed'), half('deleted'))],
    })

    expect(retireMembersExit(record)).toBe(1)
  })
})
