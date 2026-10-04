import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  addFrame,
  addPage,
  canvasDir,
  contentHash,
  DEFAULT_FRAME,
  FRAME_GAP,
  listPages,
  moveFrame,
  readPage,
  readSelection,
  renamePage,
  resizeFrame,
  restoreBox,
  writeSelection,
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

describe('moveFrame', () => {
  it('should write the new position and keep the size', () => {
    seedPage('drafts', [])
    addFrame(ROOT, 'drafts', 'hero', { width: 1440, height: 900 })

    const outcome = moveFrame(ROOT, 'drafts', 'hero', { x: 200, y: 120 })

    expect(outcome).toMatchObject({
      ok: true,
      frame: 'hero',
      box: { x: 200, y: 120, width: 1440, height: 900 },
    })
    expect(readPage(ROOT, 'drafts')?.frames[0]).toMatchObject({
      x: 200,
      y: 120,
      width: 1440,
    })
  })

  it('should leave the other frames boxes as they were', () => {
    seedPage('drafts', [])
    addFrame(ROOT, 'drafts', 'a', { width: 400, height: 300 })
    addFrame(ROOT, 'drafts', 'b', { width: 400, height: 300 })

    moveFrame(ROOT, 'drafts', 'a', { x: 5, y: 6 })

    expect(
      readPage(ROOT, 'drafts')?.frames.find((frame) => frame.name === 'b'),
    ).toMatchObject({ x: 400 + FRAME_GAP, y: 0 })
  })

  it('should keep both positions when two moves land one after the other', () => {
    seedPage('drafts', [])
    addFrame(ROOT, 'drafts', 'a', { width: 400, height: 300 })
    addFrame(ROOT, 'drafts', 'b', { width: 400, height: 300 })

    moveFrame(ROOT, 'drafts', 'a', { x: 10, y: 10 })
    moveFrame(ROOT, 'drafts', 'b', { x: 20, y: 20 })

    const frames = readPage(ROOT, 'drafts')?.frames ?? []
    expect(frames.map((frame) => [frame.name, frame.x, frame.y])).toEqual([
      ['a', 10, 10],
      ['b', 20, 20],
    ])
  })

  it('should place a frame the layout has not named at its default size', () => {
    seedPage('drafts', ['hero'])

    const outcome = moveFrame(ROOT, 'drafts', 'hero', { x: 30, y: 40 })

    expect(outcome).toMatchObject({
      ok: true,
      box: { x: 30, y: 40, ...DEFAULT_FRAME },
    })
    expect(readPage(ROOT, 'drafts')?.frames[0]?.placed).toBe(true)
  })

  it('should refuse a frame that does not exist', () => {
    seedPage('drafts', [])

    expect(moveFrame(ROOT, 'drafts', 'hero', { x: 0, y: 0 })).toMatchObject({
      ok: false,
      reason: 'no-frame',
    })
  })

  it('should refuse a page that does not exist', () => {
    expect(moveFrame(ROOT, 'missing', 'hero', { x: 0, y: 0 })).toMatchObject({
      ok: false,
      reason: 'no-page',
    })
  })

  it('should refuse a position that is not a finite number', () => {
    seedPage('drafts', ['hero'])

    expect(
      moveFrame(ROOT, 'drafts', 'hero', { x: Number.NaN, y: 0 }),
    ).toMatchObject({ ok: false, reason: 'invalid-position' })
  })

  it('should refuse rather than overwrite a malformed layout', () => {
    seedPage('drafts', ['hero'], '{ not json')

    expect(moveFrame(ROOT, 'drafts', 'hero', { x: 1, y: 1 })).toMatchObject({
      ok: false,
      reason: 'malformed-layout',
    })
    expect(readFileSync(join(pageDir('drafts'), 'layout.json'), 'utf8')).toBe(
      '{ not json',
    )
  })
})

describe('resizeFrame', () => {
  it('should write the whole box in one write', () => {
    seedPage('drafts', [])
    addFrame(ROOT, 'drafts', 'hero', { width: 1440, height: 900 })

    const outcome = resizeFrame(ROOT, 'drafts', 'hero', {
      x: -20,
      y: 10,
      width: 800,
      height: 600,
    })

    expect(outcome).toMatchObject({
      ok: true,
      frame: 'hero',
      box: { x: -20, y: 10, width: 800, height: 600 },
    })
    expect(readPage(ROOT, 'drafts')?.frames[0]).toMatchObject({
      x: -20,
      y: 10,
      width: 800,
      height: 600,
    })
  })

  it('should leave the other frames boxes as they were', () => {
    seedPage('drafts', [])
    addFrame(ROOT, 'drafts', 'a', { width: 400, height: 300 })
    addFrame(ROOT, 'drafts', 'b', { width: 400, height: 300 })

    resizeFrame(ROOT, 'drafts', 'a', { x: 0, y: 0, width: 200, height: 100 })

    expect(
      readPage(ROOT, 'drafts')?.frames.find((frame) => frame.name === 'b'),
    ).toMatchObject({ x: 400 + FRAME_GAP, y: 0, width: 400, height: 300 })
  })

  it('should place a frame the layout has not named', () => {
    seedPage('drafts', ['hero'])

    const outcome = resizeFrame(ROOT, 'drafts', 'hero', {
      x: 0,
      y: 0,
      width: 640,
      height: 480,
    })

    expect(outcome).toMatchObject({
      ok: true,
      box: { x: 0, y: 0, width: 640, height: 480 },
    })
    expect(readPage(ROOT, 'drafts')?.frames[0]?.placed).toBe(true)
  })

  it('should refuse a zero width', () => {
    seedPage('drafts', ['hero'])

    expect(
      resizeFrame(ROOT, 'drafts', 'hero', {
        x: 0,
        y: 0,
        width: 0,
        height: 300,
      }),
    ).toMatchObject({ ok: false, reason: 'invalid-size' })
  })

  it('should refuse a position that is not a finite number', () => {
    seedPage('drafts', ['hero'])

    expect(
      resizeFrame(ROOT, 'drafts', 'hero', {
        x: Number.NaN,
        y: 0,
        width: 400,
        height: 300,
      }),
    ).toMatchObject({ ok: false, reason: 'invalid-position' })
  })

  it('should refuse a frame that does not exist', () => {
    seedPage('drafts', [])

    expect(
      resizeFrame(ROOT, 'drafts', 'hero', {
        x: 0,
        y: 0,
        width: 400,
        height: 300,
      }),
    ).toMatchObject({ ok: false, reason: 'no-frame' })
  })

  it('should refuse rather than overwrite a malformed layout', () => {
    seedPage('drafts', ['hero'], '{ not json')

    expect(
      resizeFrame(ROOT, 'drafts', 'hero', {
        x: 0,
        y: 0,
        width: 400,
        height: 300,
      }),
    ).toMatchObject({ ok: false, reason: 'malformed-layout' })
    expect(readFileSync(join(pageDir('drafts'), 'layout.json'), 'utf8')).toBe(
      '{ not json',
    )
  })

  it('should keep a move and a resize landing one after the other', () => {
    seedPage('drafts', [])
    addFrame(ROOT, 'drafts', 'a', { width: 400, height: 300 })
    addFrame(ROOT, 'drafts', 'b', { width: 400, height: 300 })

    moveFrame(ROOT, 'drafts', 'a', { x: 10, y: 10 })
    resizeFrame(ROOT, 'drafts', 'b', { x: 600, y: 0, width: 200, height: 100 })

    const frames = readPage(ROOT, 'drafts')?.frames ?? []
    expect(
      frames.map((frame) => [frame.name, frame.x, frame.y, frame.width]),
    ).toEqual([
      ['a', 10, 10, 400],
      ['b', 600, 0, 200],
    ])
  })
})

describe('restoreBox', () => {
  const placed = { x: 0, y: 0, width: 400, height: 300 }

  it('should report the box a move replaced to a caller that asks', () => {
    seedPage('drafts', [])
    addFrame(ROOT, 'drafts', 'hero', { width: 400, height: 300 })
    let replaced: unknown = 'unheard'

    const outcome = moveFrame(
      ROOT,
      'drafts',
      'hero',
      { x: 50, y: 60 },
      (box) => {
        replaced = box
      },
    )

    expect(replaced).toEqual(placed)
    expect(outcome).toEqual({
      ok: true,
      page: 'drafts',
      frame: 'hero',
      file: 'hero.html',
      box: { x: 50, y: 60, width: 400, height: 300 },
    })
  })

  it('should report no box when the layout held none', () => {
    seedPage('drafts', ['hero'])
    let replaced: unknown = 'unheard'

    resizeFrame(
      ROOT,
      'drafts',
      'hero',
      { x: 1, y: 2, width: 30, height: 40 },
      (box) => {
        replaced = box
      },
    )

    expect(replaced).toBeUndefined()
  })

  it('should write the recorded box back when the layout still holds the expected one', () => {
    seedPage('drafts', [])
    addFrame(ROOT, 'drafts', 'hero', { width: 400, height: 300 })
    const moved = { x: 50, y: 60, width: 400, height: 300 }
    moveFrame(ROOT, 'drafts', 'hero', moved)

    const outcome = restoreBox(ROOT, 'drafts', 'hero', moved, placed)

    expect(outcome).toEqual({ ok: true })
    expect(readPage(ROOT, 'drafts')?.frames[0]).toMatchObject(placed)
  })

  it('should drop the box when the frame had none before', () => {
    seedPage('drafts', ['hero'])
    const sized = { x: 1, y: 2, width: 30, height: 40 }
    resizeFrame(ROOT, 'drafts', 'hero', sized)

    restoreBox(ROOT, 'drafts', 'hero', sized, undefined)

    expect(readPage(ROOT, 'drafts')?.frames[0]).toMatchObject({
      placed: false,
    })
  })

  it('should refuse when the layout moved on since', () => {
    seedPage('drafts', [])
    addFrame(ROOT, 'drafts', 'hero', { width: 400, height: 300 })
    const moved = { x: 50, y: 60, width: 400, height: 300 }
    moveFrame(ROOT, 'drafts', 'hero', moved)
    moveFrame(ROOT, 'drafts', 'hero', { x: 90, y: 90 })

    const outcome = restoreBox(ROOT, 'drafts', 'hero', moved, placed)

    expect(outcome).toMatchObject({ ok: false, reason: 'changed' })
    expect(readPage(ROOT, 'drafts')?.frames[0]).toMatchObject({ x: 90, y: 90 })
  })
})

describe('layout lock', () => {
  it('should leave no lock file behind after a move', () => {
    seedPage('drafts', ['hero'])

    moveFrame(ROOT, 'drafts', 'hero', { x: 1, y: 1 })

    expect(existsSync(join(pageDir('drafts'), 'layout.json.lock'))).toBe(false)
  })

  it('should take over a lock a dead writer left behind', () => {
    seedPage('drafts', ['hero'])
    const lock = join(pageDir('drafts'), 'layout.json.lock')
    writeFileSync(lock, '')
    const longAgo = new Date(Date.now() - 60_000)
    utimesSync(lock, longAgo, longAgo)

    const outcome = moveFrame(ROOT, 'drafts', 'hero', { x: 7, y: 8 })

    expect(outcome).toMatchObject({ ok: true, box: { x: 7, y: 8 } })
    expect(existsSync(lock)).toBe(false)
  })

  it('should keep every position when several processes move frames at once', async () => {
    const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    seedPage('drafts', names)
    const content = join(import.meta.dirname, 'content.ts')

    const children = names.map((name, index) =>
      Bun.spawn(
        [
          'bun',
          '-e',
          `import { moveFrame } from ${JSON.stringify(content)}
          moveFrame(${JSON.stringify(ROOT)}, 'drafts', '${name}', { x: ${index + 1}, y: 5 })`,
        ],
        { cwd: join(import.meta.dirname, '..', '..') },
      ),
    )
    await Promise.all(children.map((child) => child.exited))

    const frames = readPage(ROOT, 'drafts')?.frames ?? []
    expect(frames.map((frame) => frame.x)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('should leave no lock file behind after a refused move', () => {
    seedPage('drafts', ['hero'], '{ not json')

    moveFrame(ROOT, 'drafts', 'hero', { x: 1, y: 1 })

    expect(existsSync(join(pageDir('drafts'), 'layout.json.lock'))).toBe(false)
  })
})

describe('selection', () => {
  it('should read none before anything is selected', () => {
    expect(readSelection(ROOT)).toBeUndefined()
  })

  it('should read back the frame written, with its box', () => {
    seedPage('drafts', [])
    addFrame(ROOT, 'drafts', 'hero', { width: 1440, height: 900 })

    const outcome = writeSelection(ROOT, { page: 'drafts', frame: 'hero' })

    expect(outcome).toEqual({ ok: true })
    expect(readSelection(ROOT)).toMatchObject({
      page: 'drafts',
      frame: 'hero',
      file: 'hero.html',
      box: { x: 0, y: 0, width: 1440, height: 900 },
    })
  })

  it('should replace the earlier selection', () => {
    seedPage('drafts', ['a', 'b'])
    writeSelection(ROOT, { page: 'drafts', frame: 'a' })

    writeSelection(ROOT, { page: 'drafts', frame: 'b' })

    expect(readSelection(ROOT)?.frame).toBe('b')
  })

  it('should clear the selection', () => {
    seedPage('drafts', ['a'])
    writeSelection(ROOT, { page: 'drafts', frame: 'a' })

    writeSelection(ROOT, undefined)

    expect(readSelection(ROOT)).toBeUndefined()
  })

  it('should read none when the selected frame has been removed', () => {
    seedPage('drafts', ['a'])
    writeSelection(ROOT, { page: 'drafts', frame: 'a' })
    rmSync(join(pageDir('drafts'), 'a.html'))

    expect(readSelection(ROOT)).toBeUndefined()
  })

  it('should read none when the selected page has been removed', () => {
    seedPage('drafts', ['a'])
    writeSelection(ROOT, { page: 'drafts', frame: 'a' })
    rmSync(pageDir('drafts'), { recursive: true })

    expect(readSelection(ROOT)).toBeUndefined()
  })

  it('should read none when the selection file does not parse', () => {
    seedPage('drafts', ['a'])
    writeFileSync(join(canvasDir(ROOT), 'selection.json'), '{ not json')

    expect(readSelection(ROOT)).toBeUndefined()
  })

  it('should refuse to select a frame that does not exist', () => {
    seedPage('drafts', [])

    expect(
      writeSelection(ROOT, { page: 'drafts', frame: 'hero' }),
    ).toMatchObject({ ok: false, reason: 'no-frame' })
    expect(readSelection(ROOT)).toBeUndefined()
  })

  it('should refuse to select on a page that does not exist', () => {
    expect(writeSelection(ROOT, { page: 'missing', frame: 'a' })).toMatchObject(
      { ok: false, reason: 'no-page' },
    )
  })
})

const BUTTON_FRAME = `<!doctype html>
<html lang="en">
  <head><title>hero</title></head>
  <body><main><h1>Hero</h1><button class="cta primary">Start now</button></main></body>
</html>
`

/** html, head, title, body, main, h1, button: the button sits at index 6. */
const BUTTON = { index: 6, tag: 'button', count: 7 } as const

function seedButtonFrame(): void {
  mkdirSync(pageDir('drafts'), { recursive: true })
  writeFileSync(join(pageDir('drafts'), 'hero.html'), BUTTON_FRAME)
}

describe('element selection', () => {
  it('should read back the element written, with its tag, classes, and text', () => {
    seedButtonFrame()

    const outcome = writeSelection(ROOT, {
      page: 'drafts',
      frame: 'hero',
      element: BUTTON,
    })

    expect(outcome).toEqual({ ok: true })
    expect(readSelection(ROOT)?.element).toEqual({
      index: 6,
      tag: 'button',
      classes: ['cta', 'primary'],
      text: 'Start now',
      stale: false,
    })
  })

  it('should report the selection stale once the frame file changes', () => {
    seedButtonFrame()
    writeSelection(ROOT, { page: 'drafts', frame: 'hero', element: BUTTON })

    writeFileSync(
      join(pageDir('drafts'), 'hero.html'),
      BUTTON_FRAME.replace('<h1>Hero</h1>', '<p>new</p><h1>Hero</h1>'),
    )

    expect(readSelection(ROOT)?.element).toMatchObject({
      index: 6,
      tag: 'button',
      text: 'Start now',
      stale: true,
    })
  })

  it('should refuse an address the file does not hold at that index', () => {
    seedButtonFrame()

    const outcome = writeSelection(ROOT, {
      page: 'drafts',
      frame: 'hero',
      element: { ...BUTTON, count: 9 },
    })

    expect(outcome).toMatchObject({ ok: false, reason: 'address-mismatch' })
    expect(readSelection(ROOT)).toBeUndefined()
  })

  it('should refuse a pick made against an earlier version of the file', () => {
    seedButtonFrame()

    const outcome = writeSelection(ROOT, {
      page: 'drafts',
      frame: 'hero',
      element: { ...BUTTON, hash: 'a-hash-of-another-version' },
    })

    expect(outcome).toMatchObject({ ok: false, reason: 'stale-address' })
    expect(readSelection(ROOT)).toBeUndefined()
  })

  it('should take a pick made against the file as it stands', () => {
    seedButtonFrame()

    const outcome = writeSelection(ROOT, {
      page: 'drafts',
      frame: 'hero',
      element: { ...BUTTON, hash: contentHash(BUTTON_FRAME) },
    })

    expect(outcome).toEqual({ ok: true })
  })

  it('should take a pick on a frame saved with a byte order mark', () => {
    mkdirSync(pageDir('drafts'), { recursive: true })
    const file = `\uFEFF${BUTTON_FRAME}`
    writeFileSync(join(pageDir('drafts'), 'hero.html'), file)

    const outcome = writeSelection(ROOT, {
      page: 'drafts',
      frame: 'hero',
      element: { ...BUTTON, hash: contentHash(file) },
    })

    expect(outcome).toEqual({ ok: true })
  })

  it('should refuse an address that is not a whole number', () => {
    seedButtonFrame()

    const outcome = writeSelection(ROOT, {
      page: 'drafts',
      frame: 'hero',
      element: { ...BUTTON, index: -1 },
    })

    expect(outcome).toMatchObject({ ok: false, reason: 'invalid-address' })
  })

  it('should carry no element when only the frame is selected', () => {
    seedButtonFrame()

    writeSelection(ROOT, { page: 'drafts', frame: 'hero' })

    expect(readSelection(ROOT)?.element).toBeUndefined()
  })
})
