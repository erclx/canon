import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  acquireSuiteLock,
  type LockHolder,
  type SuiteLockOptions,
  tryAcquire,
} from '@/gate/suite-lock'
import type { LivenessProbes } from '@/sessions/live'

let dir: string
let path: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'suite-lock-'))
  path = join(dir, 'locks', 'tests.lock')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

/** Start times by pid, so a case says which holders are running. */
function probesFor(running: Record<number, string>): LivenessProbes {
  return {
    procStartOf: (pid) => running[pid] ?? null,
    responds: (pid) => running[pid] !== undefined,
  }
}

function optionsFor(
  pid: number,
  running: Record<number, string>,
  overrides: Partial<SuiteLockOptions> = {},
): SuiteLockOptions {
  return {
    path,
    root: `/worktrees/${pid}`,
    pid,
    probes: probesFor(running),
    sleep: async () => {},
    ...overrides,
  }
}

function holderOnDisk(): LockHolder {
  return JSON.parse(readFileSync(path, 'utf8')) as LockHolder
}

function writeLockFile(content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function writeHolder(holder: LockHolder): void {
  writeLockFile(JSON.stringify(holder))
}

describe('acquireSuiteLock', () => {
  it('should grant a free lock without waiting', async () => {
    const running = { 100: '5000' }

    const held = await acquireSuiteLock(optionsFor(100, running))

    expect(held.waitedOn).toBeUndefined()
    expect(holderOnDisk()).toMatchObject({ pid: 100, root: '/worktrees/100' })
  })

  it('should remove the file on release', async () => {
    const held = await acquireSuiteLock(optionsFor(100, { 100: '5000' }))

    held.release()

    expect(existsSync(path)).toBe(false)
  })

  it('should hold a second acquirer until the first releases', async () => {
    const running = { 100: '5000', 200: '6000' }
    const first = await acquireSuiteLock(optionsFor(100, running))
    let sleeps = 0
    const sleep = async () => {
      sleeps += 1
      first.release()
    }

    const second = await acquireSuiteLock(optionsFor(200, running, { sleep }))

    expect(sleeps).toBe(1)
    expect(second.waitedOn).toMatchObject({ pid: 100, root: '/worktrees/100' })
    expect(holderOnDisk()).toMatchObject({ pid: 200 })
  })

  it('should announce the holder once when the wait starts', async () => {
    const running = { 100: '5000', 200: '6000' }
    const first = await acquireSuiteLock(optionsFor(100, running))
    const announced: LockHolder[] = []
    let sleeps = 0
    const sleep = async () => {
      sleeps += 1
      if (sleeps === 2) first.release()
    }

    await acquireSuiteLock(
      optionsFor(200, running, {
        sleep,
        onWait: (holder) => announced.push(holder),
      }),
    )

    expect(announced).toEqual([
      { pid: 100, procStart: '5000', root: '/worktrees/100' },
    ])
  })

  it('should announce nothing when the lock is free', async () => {
    const announced: LockHolder[] = []

    await acquireSuiteLock(
      optionsFor(
        100,
        { 100: '5000' },
        {
          onWait: (holder) => announced.push(holder),
        },
      ),
    )

    expect(announced).toEqual([])
  })

  it('should take over at once from a holder whose process is gone', async () => {
    writeHolder({ pid: 100, procStart: '5000', root: '/worktrees/100' })

    const held = await acquireSuiteLock(
      optionsFor(200, { 200: '6000' }, { sleep: () => Promise.reject() }),
    )

    expect(held.waitedOn).toBeUndefined()
    expect(holderOnDisk()).toMatchObject({ pid: 200 })
  })

  it('should take over from a pid another process has since inherited', async () => {
    writeHolder({ pid: 100, procStart: '5000', root: '/worktrees/100' })

    const held = await acquireSuiteLock(
      optionsFor(200, { 100: '9999', 200: '6000' }),
    )

    expect(held.waitedOn).toBeUndefined()
    expect(holderOnDisk()).toMatchObject({ pid: 200 })
  })

  it('should take over a file that does not parse as a holder', async () => {
    writeLockFile('not json')

    const held = await acquireSuiteLock(optionsFor(200, { 200: '6000' }))

    expect(holderOnDisk()).toMatchObject({ pid: 200 })
    held.release()
  })
})

describe('tryAcquire', () => {
  it('should leave a lock another acquirer took over first to that acquirer', () => {
    writeHolder({ pid: 100, procStart: '5000', root: '/worktrees/100' })
    const winnerOptions = optionsFor(300, { 300: '7000' })
    const loser = optionsFor(200, { 200: '6000' })
    const racing: SuiteLockOptions = {
      ...loser,
      probes: {
        // The loser has read the stale file and is judging it when the winner
        // completes its own takeover underneath.
        procStartOf: (pid) => {
          if (pid === 100) tryAcquire(winnerOptions)
          return pid === 200 ? '6000' : null
        },
        responds: () => false,
      },
    }

    const outcome = tryAcquire(racing)

    expect(outcome.acquired).toBe(false)
    expect(holderOnDisk()).toMatchObject({ pid: 300 })
  })

  it('should leave a file another holder wrote in place on release', async () => {
    const held = await acquireSuiteLock(optionsFor(100, { 100: '5000' }))
    writeFileSync(
      path,
      JSON.stringify({ pid: 200, procStart: '6000', root: '/worktrees/200' }),
    )

    held.release()

    expect(holderOnDisk()).toMatchObject({ pid: 200 })
  })
})
