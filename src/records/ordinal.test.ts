import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { claimOrdinal, highestOrdinal } from '@/records/ordinal'

let ROOT: string

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-ordinal-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

function seed(kind: 'intake' | 'groundwork', name: string): void {
  mkdirSync(join(ROOT, '.canon', kind, name), { recursive: true })
}

describe('highestOrdinal', () => {
  it('should read 0 with neither folder holding an entry', async () => {
    expect(await highestOrdinal(ROOT)).toBe(0)
  })

  it('should read the highest across both folders', async () => {
    seed('intake', '03-alpha')
    seed('groundwork', '07-beta')
    seed('groundwork', '02-gamma')

    expect(await highestOrdinal(ROOT)).toBe(7)
  })

  it('should ignore a name carrying no leading ordinal', async () => {
    seed('intake', 'archive')

    expect(await highestOrdinal(ROOT)).toBe(0)
  })
})

describe('claimOrdinal', () => {
  it('should create the folder and take 01 with neither folder present', async () => {
    const outcome = await claimOrdinal(ROOT, 'intake', 'first-topic')

    expect(outcome).toMatchObject({
      ok: true,
      kind: 'intake',
      slug: 'first-topic',
      ordinal: '01',
      name: '01-first-topic',
    })
  })

  it('should take the next ordinal across both folders', async () => {
    seed('intake', '05-existing')
    seed('groundwork', '03-other')

    const outcome = await claimOrdinal(ROOT, 'groundwork', 'next-topic')

    expect(outcome).toMatchObject({ ok: true, ordinal: '06' })
  })

  it('should retry past a losing race rather than reporting one', async () => {
    // Simulates a second session having already claimed 01 between this
    // call's read and its own create.
    seed('intake', '01-rival')

    const outcome = await claimOrdinal(ROOT, 'intake', 'my-topic')

    expect(outcome).toMatchObject({ ok: true, ordinal: '02' })
  })

  it('should let two concurrent claims for different kinds land on distinct ordinals', async () => {
    // The incident this verb exists for: two sessions independently taking
    // one ordinal for two different record folders. Both calls here read the
    // same starting state and race to claim it.
    const [first, second] = await Promise.all([
      claimOrdinal(ROOT, 'intake', 'one'),
      claimOrdinal(ROOT, 'groundwork', 'two'),
    ])

    expect(first.ok && second.ok).toBe(true)
    if (first.ok && second.ok) {
      expect(first.ordinal).not.toBe(second.ordinal)
    }
  })

  it('should recover a stale reservation left by a process that died before its leaf create', async () => {
    // A lock with no folder behind it in either kind: a process reserved 01
    // and never got to creating its own leaf folder.
    mkdirSync(join(ROOT, '.canon', 'ordinal-locks', '01'), {
      recursive: true,
    })

    const outcome = await claimOrdinal(ROOT, 'intake', 'recovered-topic')

    expect(outcome).toMatchObject({ ok: true, ordinal: '01' })
  })

  it('should not read a lock backed by the other kind as stale', async () => {
    // 01 is genuinely live: groundwork already claimed it, so highestOrdinal
    // has already moved past it before this call even reads the lock.
    seed('groundwork', '01-already-claimed')
    mkdirSync(join(ROOT, '.canon', 'ordinal-locks', '01'), {
      recursive: true,
    })

    const outcome = await claimOrdinal(ROOT, 'intake', 'next-topic')

    expect(outcome).toMatchObject({ ok: true, ordinal: '02' })
  })
})
