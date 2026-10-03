import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  addFrame,
  addPage,
  canvasDir,
  DEFAULT_FRAME,
  FRAME_GAP,
  listPages,
  readPage,
  renamePage,
} from '@/canvas/content'

let ROOT = ''

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-canvas-content-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

function pageDir(page: string): string {
  return join(ROOT, '.canon', 'canvas', page)
}

function seedPage(page: string, frames: string[], layout?: string): void {
  mkdirSync(pageDir(page), { recursive: true })
  for (const frame of frames) {
    writeFileSync(join(pageDir(page), `${frame}.html`), `<p>${frame}</p>`)
  }
  if (layout !== undefined) {
    writeFileSync(join(pageDir(page), 'layout.json'), layout)
  }
}

describe('canvasDir', () => {
  it('should resolve under the record root', () => {
    expect(canvasDir(ROOT)).toBe(join(ROOT, '.canon', 'canvas'))
  })
})

describe('listPages', () => {
  it('should return no pages when the canvas folder is absent', () => {
    expect(listPages(ROOT)).toEqual([])
  })

  it('should list each page folder by name in order', () => {
    seedPage('drafts', [])
    seedPage('approved', [])

    expect(listPages(ROOT).map((page) => page.name)).toEqual([
      'approved',
      'drafts',
    ])
  })
})

describe('readPage', () => {
  it('should place each frame at the box its layout names', () => {
    seedPage(
      'drafts',
      ['hero'],
      JSON.stringify({
        frames: { hero: { x: 40, y: 60, width: 800, height: 600 } },
      }),
    )

    const page = readPage(ROOT, 'drafts')

    expect(page?.frames).toEqual([
      {
        name: 'hero',
        file: 'hero.html',
        x: 40,
        y: 60,
        width: 800,
        height: 600,
        placed: true,
      },
    ])
  })

  it('should place frames in a default row when the page has no layout', () => {
    seedPage('drafts', ['a', 'b'])

    const page = readPage(ROOT, 'drafts')

    expect(page?.frames.map(({ x, y, placed }) => ({ x, y, placed }))).toEqual([
      { x: 0, y: 0, placed: false },
      { x: DEFAULT_FRAME.width + FRAME_GAP, y: 0, placed: false },
    ])
  })

  it('should place an unplaced frame after the rightmost placed one', () => {
    seedPage(
      'drafts',
      ['a', 'b'],
      JSON.stringify({
        frames: { a: { x: 100, y: 20, width: 400, height: 300 } },
      }),
    )

    const unplaced = readPage(ROOT, 'drafts')?.frames.find(
      (frame) => frame.name === 'b',
    )

    expect(unplaced?.x).toBe(100 + 400 + FRAME_GAP)
  })

  it('should drop a layout entry whose frame file is gone', () => {
    seedPage(
      'drafts',
      ['a'],
      JSON.stringify({
        frames: {
          a: { x: 0, y: 0, width: 400, height: 300 },
          gone: { x: 500, y: 0, width: 400, height: 300 },
        },
      }),
    )

    expect(readPage(ROOT, 'drafts')?.frames.map((frame) => frame.name)).toEqual(
      ['a'],
    )
  })

  it('should report a malformed layout and still list the frames', () => {
    seedPage('drafts', ['a'], '{ not json')

    const page = readPage(ROOT, 'drafts')

    expect(page?.layoutIssue).toBe('malformed')
    expect(page?.frames.map((frame) => frame.name)).toEqual(['a'])
  })

  it('should ignore a layout entry carrying a non-numeric box', () => {
    seedPage(
      'drafts',
      ['a'],
      JSON.stringify({ frames: { a: { x: 'left', y: 0 } } }),
    )

    expect(readPage(ROOT, 'drafts')?.frames[0]?.placed).toBe(false)
  })

  it('should return undefined for a page that does not exist', () => {
    expect(readPage(ROOT, 'missing')).toBeUndefined()
  })
})

describe('addPage', () => {
  it('should create the page folder', () => {
    const outcome = addPage(ROOT, 'drafts')

    expect(outcome).toEqual({ ok: true, page: 'drafts' })
    expect(existsSync(pageDir('drafts'))).toBe(true)
  })

  it('should refuse a page that already exists', () => {
    seedPage('drafts', [])

    expect(addPage(ROOT, 'drafts')).toMatchObject({
      ok: false,
      reason: 'exists',
    })
  })

  it('should refuse a name that climbs out of the canvas folder', () => {
    expect(addPage(ROOT, '../escape')).toMatchObject({
      ok: false,
      reason: 'invalid-name',
    })
  })
})

describe('renamePage', () => {
  it('should move the page folder with its frames', () => {
    seedPage('drafts', ['hero'])

    const outcome = renamePage(ROOT, 'drafts', 'approved')

    expect(outcome).toEqual({ ok: true, page: 'approved' })
    expect(existsSync(join(pageDir('approved'), 'hero.html'))).toBe(true)
    expect(existsSync(pageDir('drafts'))).toBe(false)
  })

  it('should refuse a source page that does not exist', () => {
    expect(renamePage(ROOT, 'missing', 'approved')).toMatchObject({
      ok: false,
      reason: 'no-page',
    })
  })

  it('should refuse a target page that already exists', () => {
    seedPage('drafts', [])
    seedPage('approved', [])

    expect(renamePage(ROOT, 'drafts', 'approved')).toMatchObject({
      ok: false,
      reason: 'exists',
    })
  })
})

describe('addFrame', () => {
  it('should write the frame file and record its box in the layout', () => {
    seedPage('drafts', [])

    const outcome = addFrame(ROOT, 'drafts', 'hero', {
      width: 1440,
      height: 900,
    })

    expect(outcome).toMatchObject({ ok: true, page: 'drafts', frame: 'hero' })
    expect(existsSync(join(pageDir('drafts'), 'hero.html'))).toBe(true)
    const layout = JSON.parse(
      readFileSync(join(pageDir('drafts'), 'layout.json'), 'utf8'),
    )
    expect(layout.frames.hero).toEqual({
      x: 0,
      y: 0,
      width: 1440,
      height: 900,
    })
  })

  it('should place a new frame to the right of the existing ones', () => {
    seedPage('drafts', [])
    addFrame(ROOT, 'drafts', 'a', { width: 400, height: 300 })

    addFrame(ROOT, 'drafts', 'b', { width: 400, height: 300 })

    const b = readPage(ROOT, 'drafts')?.frames.find(
      (frame) => frame.name === 'b',
    )
    expect(b).toMatchObject({ x: 400 + FRAME_GAP, y: 0, placed: true })
  })

  it('should refuse a frame on a page that does not exist', () => {
    expect(
      addFrame(ROOT, 'missing', 'hero', { width: 400, height: 300 }),
    ).toMatchObject({ ok: false, reason: 'no-page' })
  })

  it('should refuse a frame that already exists', () => {
    seedPage('drafts', ['hero'])

    expect(
      addFrame(ROOT, 'drafts', 'hero', { width: 400, height: 300 }),
    ).toMatchObject({ ok: false, reason: 'exists' })
  })

  it('should refuse rather than overwrite a malformed layout', () => {
    seedPage('drafts', [], '{ not json')

    expect(
      addFrame(ROOT, 'drafts', 'hero', { width: 400, height: 300 }),
    ).toMatchObject({ ok: false, reason: 'malformed-layout' })
    expect(readFileSync(join(pageDir('drafts'), 'layout.json'), 'utf8')).toBe(
      '{ not json',
    )
  })

  it('should refuse a non-positive size', () => {
    seedPage('drafts', [])

    expect(
      addFrame(ROOT, 'drafts', 'hero', { width: 0, height: 300 }),
    ).toMatchObject({ ok: false, reason: 'invalid-size' })
  })
})
