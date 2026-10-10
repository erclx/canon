import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  decideDue,
  passesVocabulary,
  readDueCache,
  writeDueCache,
  type DueCache,
  type DueInput,
} from '@/upstream/due'

const NOW = new Date('2026-10-10T12:00:00Z')

const makeInput = (overrides: Partial<DueInput> = {}): DueInput => ({
  installed: '2.1.296',
  cursor: { version: '2.1.289', date: '2026-10-08', intake: 'digest' },
  gap: { releases: 3, lines: [] },
  now: NOW,
  ...overrides,
})

describe('passesVocabulary', () => {
  it('should pass an Added line naming a canon surface', () => {
    expect(passesVocabulary('Added `--bg` flag to start a session')).toBe(true)
  })

  it('should not pass an Added line naming no surface', () => {
    expect(passesVocabulary('Added a progress bar to the spinner')).toBe(false)
  })

  it('should not pass a Changed line even when it names a surface', () => {
    expect(passesVocabulary('Changed the hook timeout default')).toBe(false)
  })
})

describe('decideDue', () => {
  it('should report due with no-cursor when nothing is stored', () => {
    const result = decideDue(makeInput({ cursor: null }))

    expect(result).toMatchObject({ due: true, reason: 'no-cursor' })
  })

  it('should not be due when the installed version equals the cursor', () => {
    const result = decideDue(
      makeInput({
        installed: '2.1.289',
        cursor: { version: '2.1.289', date: '2026-01-01', intake: 'digest' },
      }),
    )

    expect(result).toMatchObject({ due: false, reason: 'current' })
  })

  it('should not be due when the installed version is older than the cursor', () => {
    const result = decideDue(
      makeInput({
        installed: '2.1.280',
        cursor: { version: '2.1.289', date: '2026-01-01', intake: 'digest' },
      }),
    )

    expect(result).toMatchObject({ due: false, reason: 'current' })
  })

  it('should not be due when the installed version is unknown', () => {
    const result = decideDue(makeInput({ installed: null }))

    expect(result).toMatchObject({ due: false, reason: 'unknown-version' })
  })

  it('should be due once the cursor is a week old and the install is ahead', () => {
    const result = decideDue(
      makeInput({
        cursor: { version: '2.1.289', date: '2026-10-01', intake: 'digest' },
      }),
    )

    expect(result).toMatchObject({ due: true, reason: 'week', releases: 3 })
  })

  it('should be due when the cursor is exactly seven days old', () => {
    const result = decideDue(
      makeInput({
        cursor: { version: '2.1.289', date: '2026-10-03', intake: 'digest' },
        now: new Date('2026-10-10T00:00:00Z'),
      }),
    )

    expect(result).toMatchObject({ due: true, reason: 'week' })
  })

  it('should not be due when the cursor is under seven days old and no line matches', () => {
    const result = decideDue(
      makeInput({
        cursor: { version: '2.1.289', date: '2026-10-04', intake: 'digest' },
      }),
    )

    expect(result).toMatchObject({ due: false, reason: 'recent' })
  })

  it('should be due sooner when an Added line in the gap names a surface', () => {
    const result = decideDue(
      makeInput({
        gap: {
          releases: 1,
          lines: ['Added mods, a way to extend the interface'],
        },
      }),
    )

    expect(result).toMatchObject({
      due: true,
      reason: 'vocabulary',
      releases: 1,
    })
  })

  it('should report due on the week without a count when the gap was not read', () => {
    const result = decideDue(
      makeInput({
        cursor: { version: '2.1.289', date: '2026-10-01', intake: 'digest' },
        gap: null,
      }),
    )

    expect(result).toMatchObject({
      due: true,
      reason: 'week',
      releases: null,
    })
  })

  it('should not be due on the vocabulary path when the gap was not read', () => {
    const result = decideDue(makeInput({ gap: null }))

    expect(result).toMatchObject({ due: false, reason: 'recent' })
  })

  it('should read an unreadable cursor date as no age', () => {
    const result = decideDue(
      makeInput({
        cursor: { version: '2.1.289', date: 'not-a-date', intake: 'digest' },
      }),
    )

    expect(result).toMatchObject({ due: false, reason: 'recent' })
  })
})

describe('the due cache', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-due-cache-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  const makeCache = (overrides: Partial<DueCache> = {}): DueCache => ({
    checkedAt: '2026-10-10T08:00:00Z',
    installed: '2.1.296',
    cursor: '2.1.289',
    gap: { releases: 3, lines: [] },
    ...overrides,
  })

  it('should read nothing when no check was stored', () => {
    expect(readDueCache(root, '2.1.296', '2.1.289', NOW)).toBeNull()
  })

  it('should return a stored check under a day old for the same versions', async () => {
    await writeDueCache(root, makeCache())

    expect(readDueCache(root, '2.1.296', '2.1.289', NOW)).toMatchObject({
      gap: { releases: 3 },
    })
  })

  it('should read nothing once the check is a day old', async () => {
    await writeDueCache(root, makeCache({ checkedAt: '2026-10-09T12:00:00Z' }))

    expect(readDueCache(root, '2.1.296', '2.1.289', NOW)).toBeNull()
  })

  it('should read nothing when the installed version changed', async () => {
    await writeDueCache(root, makeCache())

    expect(readDueCache(root, '2.1.297', '2.1.289', NOW)).toBeNull()
  })

  it('should read nothing when the cursor moved', async () => {
    await writeDueCache(root, makeCache())

    expect(readDueCache(root, '2.1.296', '2.1.290', NOW)).toBeNull()
  })

  it('should keep a failed read for the day so a rate limit is not retried', async () => {
    await writeDueCache(root, makeCache({ gap: null }))

    expect(readDueCache(root, '2.1.296', '2.1.289', NOW)).toMatchObject({
      gap: null,
    })
  })
})
