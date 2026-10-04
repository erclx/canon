import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { canvasDir } from '@/canvas/content'
import {
  clearEditing,
  EDITING_FILE,
  EDITING_TTL_MS,
  markEditing,
  readEditing,
} from '@/canvas/editing'

let ROOT = ''

const NOW = new Date('2026-10-04T12:00:00.000Z')

function later(ms: number): Date {
  return new Date(NOW.getTime() + ms)
}

function seedPage(page: string, frames: string[]): void {
  const dir = join(canvasDir(ROOT), page)
  mkdirSync(dir, { recursive: true })
  for (const frame of frames) {
    writeFileSync(join(dir, `${frame}.html`), `<p>${frame}</p>`)
  }
}

function recordPath(): string {
  return join(canvasDir(ROOT), EDITING_FILE)
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-canvas-editing-'))
  seedPage('drafts', ['hero', 'pricing'])
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('markEditing', () => {
  it('should keep two marks on two frames', () => {
    markEditing(ROOT, 'drafts', 'hero', 'builder', NOW)
    markEditing(ROOT, 'drafts', 'pricing', 'reviewer', NOW)

    expect(readEditing(ROOT, NOW)).toEqual([
      {
        page: 'drafts',
        frame: 'hero',
        by: 'builder',
        since: NOW.toISOString(),
        until: later(EDITING_TTL_MS).toISOString(),
      },
      {
        page: 'drafts',
        frame: 'pricing',
        by: 'reviewer',
        since: NOW.toISOString(),
        until: later(EDITING_TTL_MS).toISOString(),
      },
    ])
  })

  it('should replace an earlier mark on the same frame and move its expiry', () => {
    markEditing(ROOT, 'drafts', 'hero', 'builder', NOW)
    markEditing(ROOT, 'drafts', 'hero', 'other', later(60_000))

    expect(readEditing(ROOT, later(60_000))).toEqual([
      expect.objectContaining({
        frame: 'hero',
        by: 'other',
        until: later(60_000 + EDITING_TTL_MS).toISOString(),
      }),
    ])
  })

  it('should refuse a page that is not on disk', () => {
    const outcome = markEditing(ROOT, 'missing', 'hero', 'builder', NOW)

    expect(outcome).toMatchObject({ ok: false, reason: 'no-page' })
  })

  it('should refuse a frame that is not on disk', () => {
    const outcome = markEditing(ROOT, 'drafts', 'missing', 'builder', NOW)

    expect(outcome).toMatchObject({ ok: false, reason: 'no-frame' })
  })

  it('should overwrite a malformed record with the new mark', () => {
    writeFileSync(recordPath(), '{ not json')

    const outcome = markEditing(ROOT, 'drafts', 'hero', 'builder', NOW)

    expect(outcome).toMatchObject({ ok: true })
    expect(readEditing(ROOT, NOW)).toHaveLength(1)
  })
})

describe('clearEditing', () => {
  it('should clear one frame and leave the other marked', () => {
    markEditing(ROOT, 'drafts', 'hero', 'builder', NOW)
    markEditing(ROOT, 'drafts', 'pricing', 'builder', NOW)

    clearEditing(ROOT, 'drafts', 'hero')

    expect(readEditing(ROOT, NOW).map((mark) => mark.frame)).toEqual([
      'pricing',
    ])
  })

  it('should succeed and write nothing when the frame holds no mark', () => {
    const outcome = clearEditing(ROOT, 'drafts', 'hero')

    expect(outcome).toEqual({ ok: true, cleared: false })
    expect(() => readFileSync(recordPath())).toThrow()
  })
})

describe('readEditing', () => {
  it('should read a mark past its expiry as absent', () => {
    markEditing(ROOT, 'drafts', 'hero', 'builder', NOW)

    expect(readEditing(ROOT, later(EDITING_TTL_MS + 1))).toEqual([])
  })

  it('should read a mark on a removed frame as absent', () => {
    markEditing(ROOT, 'drafts', 'hero', 'builder', NOW)
    rmSync(join(canvasDir(ROOT), 'drafts', 'hero.html'))

    expect(readEditing(ROOT, NOW)).toEqual([])
  })

  it('should read a malformed record as no marks', () => {
    writeFileSync(recordPath(), '{ not json')

    expect(readEditing(ROOT, NOW)).toEqual([])
  })
})
