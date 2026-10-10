import { mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  advanceCursor,
  compareVersions,
  llmsDifference,
  readCursor,
  readLastLlms,
} from '@/upstream/cursor'

let ROOT: string

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-upstream-'))
  mkdirSync(join(ROOT, '.canon'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('readCursor', () => {
  it('should read a missing cursor as null', () => {
    expect(readCursor(ROOT)).toBeNull()
  })
})

describe('advanceCursor', () => {
  it('should write the cursor and read it back', async () => {
    const outcome = await advanceCursor(ROOT, {
      version: '2.1.289',
      intake: 'claude-code-2-1-257-to-2-1-289',
      today: '2026-10-10',
      llms: 'a\nb\n',
    })

    expect(outcome).toEqual({ kind: 'advanced' })
    expect(readCursor(ROOT)).toEqual({
      version: '2.1.289',
      date: '2026-10-10',
      intake: 'claude-code-2-1-257-to-2-1-289',
    })
    expect(readLastLlms(ROOT)).toBe('a\nb\n')
  })

  it('should refuse a version older than the stored cursor', async () => {
    await advanceCursor(ROOT, {
      version: '2.1.289',
      intake: 'x',
      today: '2026-10-10',
      llms: null,
    })

    const outcome = await advanceCursor(ROOT, {
      version: '2.1.100',
      intake: 'y',
      today: '2026-10-11',
      llms: null,
    })

    expect(outcome).toEqual({ kind: 'refused', reason: 'older-than-cursor' })
    expect(readCursor(ROOT)?.version).toBe('2.1.289')
  })

  it('should refuse a version that is not dotted numbers', async () => {
    const outcome = await advanceCursor(ROOT, {
      version: 'latest',
      intake: 'x',
      today: '2026-10-10',
      llms: null,
    })

    expect(outcome).toEqual({ kind: 'refused', reason: 'invalid-version' })
  })

  it('should keep the last llms.txt when none is supplied', async () => {
    await advanceCursor(ROOT, {
      version: '2.1.1',
      intake: 'x',
      today: '2026-10-10',
      llms: 'kept\n',
    })

    await advanceCursor(ROOT, {
      version: '2.1.2',
      intake: 'y',
      today: '2026-10-11',
      llms: null,
    })

    expect(readLastLlms(ROOT)).toBe('kept\n')
  })

  it('should leave no temp file behind', async () => {
    await advanceCursor(ROOT, {
      version: '2.1.1',
      intake: 'x',
      today: '2026-10-10',
      llms: 'a\n',
    })

    expect(readdirSync(join(ROOT, '.canon', 'upstream')).sort()).toEqual([
      'cursor.json',
      'llms.txt',
    ])
  })
})

describe('compareVersions', () => {
  it('should compare segments as numbers rather than text', () => {
    expect(compareVersions('2.1.100', '2.1.99')).toBeGreaterThan(0)
    expect(compareVersions('2.1.9', '2.1.9')).toBe(0)
    expect(compareVersions('2.0.300', '2.1.0')).toBeLessThan(0)
  })
})

describe('llmsDifference', () => {
  it('should report pages added and removed since the last run', () => {
    const diff = llmsDifference('a\nb\nc\n', 'b\nc\nd\n')

    expect(diff).toEqual({ added: ['d'], removed: ['a'] })
  })

  it('should report every line as added when there is no last copy', () => {
    expect(llmsDifference(null, 'a\nb\n')).toEqual({
      added: ['a', 'b'],
      removed: [],
    })
  })
})
