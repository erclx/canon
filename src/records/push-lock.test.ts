import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { withLock } from '@/records/push-lock'

let DIR: string
let LOCK: string

beforeEach(() => {
  DIR = mkdtempSync(join(tmpdir(), 'canon-push-lock-'))
  LOCK = join(DIR, 'push.lock')
})

afterEach(() => {
  rmSync(DIR, { recursive: true, force: true })
})

/** A workload that records how many holders ran at once, so overlap is countable. */
function overlapProbe(holdMs: number) {
  const seen = { active: 0, peak: 0 }
  const run = async (): Promise<string> => {
    seen.active += 1
    seen.peak = Math.max(seen.peak, seen.active)
    await new Promise((settle) => setTimeout(settle, holdMs))
    seen.active -= 1
    return 'done'
  }
  return { seen, run }
}

describe('withLock', () => {
  it('should run concurrent holders one at a time', async () => {
    const { seen, run } = overlapProbe(60)
    const timing = { waitMs: 5_000, staleMs: 60_000 }

    const results = await Promise.all([
      withLock(LOCK, timing, run),
      withLock(LOCK, timing, run),
      withLock(LOCK, timing, run),
    ])

    expect(results).toEqual([
      { busy: false, value: 'done' },
      { busy: false, value: 'done' },
      { busy: false, value: 'done' },
    ])
    expect(seen.peak).toBe(1)
    expect(existsSync(LOCK)).toBe(false)
  })

  it('should keep a holder running past the stale age from losing its lock', async () => {
    const { seen, run } = overlapProbe(300)
    const timing = { waitMs: 5_000, staleMs: 40 }

    await Promise.all([
      withLock(LOCK, timing, run),
      withLock(LOCK, timing, run),
    ])

    expect(seen.peak).toBe(1)
  })

  it('should answer busy while a fresh lock is held', async () => {
    writeFileSync(LOCK, 'other-holder')

    const result = await withLock(
      LOCK,
      { waitMs: 150, staleMs: 60_000 },
      async () => 'ran',
    )

    expect(result).toEqual({ busy: true })
    expect(readFileSync(LOCK, 'utf8')).toBe('other-holder')
  })

  it('should take over a lock older than the stale age', async () => {
    writeFileSync(LOCK, 'dead-holder')
    const past = new Date(Date.now() - 120_000)
    utimesSync(LOCK, past, past)

    const result = await withLock(
      LOCK,
      { waitMs: 1_000, staleMs: 60_000 },
      async () => 'ran',
    )

    expect(result).toEqual({ busy: false, value: 'ran' })
    expect(existsSync(LOCK)).toBe(false)
  })

  it('should leave a lock another holder took in its place on release', async () => {
    const result = await withLock(
      LOCK,
      { waitMs: 1_000, staleMs: 60_000 },
      async () => {
        writeFileSync(LOCK, 'next-holder')
        return 'ran'
      },
    )

    expect(result).toEqual({ busy: false, value: 'ran' })
    expect(readFileSync(LOCK, 'utf8')).toBe('next-holder')
  })

  it('should release the lock when the holder throws', async () => {
    const failing = withLock(
      LOCK,
      { waitMs: 1_000, staleMs: 60_000 },
      async () => {
        throw new Error('push failed')
      },
    )

    await expect(failing).rejects.toThrow('push failed')
    expect(existsSync(LOCK)).toBe(false)
  })
})
