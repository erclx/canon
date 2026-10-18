import { describe, expect, it } from 'vitest'
import type { ListenerReader } from '@/listeners/machine'
import { stopListeners } from '@/worktrees/stop'

const MAIN = '/repo'
const GONE = '/repo/.claude/worktrees/feat-a'
const KEPT = '/repo/.claude/worktrees/feat-b'

interface FakeListener {
  readonly pid: number
  readonly port: number
  readonly cwd: string
}

function fakeReader(
  listeners: readonly FakeListener[] | undefined,
): ListenerReader {
  return {
    async listListeners() {
      return listeners?.map(({ pid, port }) => ({ pid, port }))
    },
    async cwdOf(pid) {
      return listeners?.find((listener) => listener.pid === pid)?.cwd
    },
  }
}

function recordKills(): {
  readonly signaled: number[]
  kill(pid: number): boolean
} {
  const signaled: number[] = []
  return {
    signaled,
    kill(pid) {
      signaled.push(pid)
      return true
    },
  }
}

describe('stopListeners', () => {
  it('should stop a listener inside a removed worktree and report its port', async () => {
    const reader = fakeReader([{ pid: 10, port: 5173, cwd: `${GONE}/web` }])
    const { signaled, kill } = recordKills()

    const report = await stopListeners([GONE], { reader, kill, dryRun: false })

    expect(signaled).toEqual([10])
    expect(report).toEqual({
      kind: 'read',
      stopped: [{ path: GONE, pids: [10], ports: [5173] }],
    })
  })

  it('should leave a listener in the main checkout, a sibling, and a nested worktree alone', async () => {
    const reader = fakeReader([
      { pid: 1, port: 3000, cwd: MAIN },
      { pid: 2, port: 3001, cwd: KEPT },
      { pid: 3, port: 3002, cwd: `${GONE}/.claude/worktrees/inner` },
    ])
    const { signaled, kill } = recordKills()

    const report = await stopListeners([GONE], { reader, kill, dryRun: false })

    expect(signaled).toEqual([])
    expect(report).toEqual({ kind: 'read', stopped: [] })
  })

  it('should signal a pid holding two sockets once and report both ports', async () => {
    const reader = fakeReader([
      { pid: 10, port: 4322, cwd: GONE },
      { pid: 10, port: 4321, cwd: GONE },
    ])
    const { signaled, kill } = recordKills()

    const report = await stopListeners([GONE], { reader, kill, dryRun: false })

    expect(signaled).toEqual([10])
    expect(report).toEqual({
      kind: 'read',
      stopped: [{ path: GONE, pids: [10], ports: [4321, 4322] }],
    })
  })

  it('should read cwd against each removed path rather than the process directory', async () => {
    const reader = fakeReader([
      { pid: 10, port: 5173, cwd: GONE },
      { pid: 20, port: 5174, cwd: KEPT },
    ])
    const { signaled, kill } = recordKills()

    const report = await stopListeners([GONE, KEPT], {
      reader,
      kill,
      dryRun: false,
    })

    expect(signaled).toEqual([10, 20])
    expect(report).toMatchObject({ kind: 'read' })
    expect(report.kind === 'read' && report.stopped.map((s) => s.path)).toEqual(
      [GONE, KEPT],
    )
  })

  it('should report what a dry run would stop without signaling', async () => {
    const reader = fakeReader([{ pid: 10, port: 5173, cwd: GONE }])
    const { signaled, kill } = recordKills()

    const report = await stopListeners([GONE], { reader, kill, dryRun: true })

    expect(signaled).toEqual([])
    expect(report).toEqual({
      kind: 'read',
      stopped: [{ path: GONE, pids: [10], ports: [5173] }],
    })
  })

  it('should report the stop as unread when the machine has no listener reader', async () => {
    const reader = fakeReader(undefined)
    const { signaled, kill } = recordKills()

    const report = await stopListeners([GONE], { reader, kill, dryRun: false })

    expect(signaled).toEqual([])
    expect(report).toEqual({ kind: 'unread' })
  })

  it('should leave a pid out of the report when the signal did not land', async () => {
    const reader = fakeReader([{ pid: 10, port: 5173, cwd: GONE }])

    const report = await stopListeners([GONE], {
      reader,
      kill: () => false,
      dryRun: false,
    })

    expect(report).toEqual({ kind: 'read', stopped: [] })
  })
})
