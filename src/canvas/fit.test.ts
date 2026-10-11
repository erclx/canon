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
import { addFrame, addPage } from '@/canvas/content'
import {
  firstFamily,
  fitCanvas,
  isOwed,
  type Measured,
  planFit,
} from '@/canvas/fit'

function measured(overrides: Partial<Measured> = {}): Measured {
  return {
    page: 'drafts',
    frame: 'hero',
    box: { x: 0, y: 0, width: 480, height: 300 },
    contentHeight: 300,
    contentWidth: 480,
    renderedHeight: 300,
    family: 'Geist Variable',
    ...overrides,
  }
}

const SERVED = new Set(['Geist Variable', 'Noto Sans Mono', 'Excalifont'])

/** A read a viewer would draw, which floors at the box height. */
function drawn(contentHeight: number, boxHeight = 300): Partial<Measured> {
  return { contentHeight, renderedHeight: Math.max(contentHeight, boxHeight) }
}

describe('planFit', () => {
  it('should set the height to the content, rounded up', () => {
    const [row] = planFit([measured(drawn(412.2))], SERVED)

    expect(row).toMatchObject({ height: 300, fitted: 413 })
  })

  it('should shrink a box taller than its content', () => {
    const [row] = planFit([measured(drawn(120))], SERVED)

    expect(row?.fitted).toBe(120)
  })

  it('should flag a first family the canvas does not serve', () => {
    const [row] = planFit([measured({ family: 'DejaVu Sans' })], SERVED)

    expect(row).toMatchObject({ font: true, family: 'DejaVu Sans' })
  })

  it('should not flag a served family', () => {
    const rows = planFit(
      [
        measured({ family: 'Geist Variable' }),
        measured({ family: 'Noto Sans Mono' }),
        measured({ family: 'Excalifont' }),
      ],
      SERVED,
    )

    expect(rows.map((row) => row.font)).toEqual([false, false, false])
  })

  it('should report a content wider than the box and never widen it', () => {
    const [row] = planFit([measured({ contentWidth: 900 })], SERVED)

    expect(row).toMatchObject({ wide: true })
    expect(row).not.toHaveProperty('width')
  })

  it('should not flag a family the served sheet declares for the project', () => {
    const [row] = planFit(
      [measured({ family: 'Inter' })],
      new Set([...SERVED, 'Inter']),
    )

    expect(row?.font).toBe(false)
  })

  it('should keep the height of a frame whose height is set in viewport units', () => {
    const [row] = planFit(
      [measured({ contentHeight: 19, renderedHeight: 600 })],
      SERVED,
    )

    expect(row).toMatchObject({ viewport: true, height: 300, fitted: 300 })
  })

  it('should not flag a frame whose content is shorter than its box', () => {
    const [row] = planFit([measured(drawn(120))], SERVED)

    expect(row).toMatchObject({ viewport: false, fitted: 120 })
  })
})

describe('isOwed', () => {
  it('should be false for a fitted frame in a served family', () => {
    const [row] = planFit([measured()], SERVED)

    expect(row && isOwed(row)).toBe(false)
  })

  it('should be true for a height off, a wide frame, or a font', () => {
    const rows = planFit(
      [
        measured(drawn(301)),
        measured({ contentWidth: 481 }),
        measured({ family: 'DejaVu Sans' }),
        measured({ contentHeight: 19, renderedHeight: 600 }),
      ],
      SERVED,
    )

    expect(rows.map(isOwed)).toEqual([true, true, true, true])
  })
})

describe('firstFamily', () => {
  it('should take the first entry without its quotes', () => {
    expect(firstFamily('"Geist Variable", system-ui, sans-serif')).toBe(
      'Geist Variable',
    )
  })
})

describe('fitCanvas with the server and browser stood in', () => {
  let ROOT = ''

  beforeEach(() => {
    ROOT = mkdtempSync(join(tmpdir(), 'canon-canvas-fit-'))
    addPage(ROOT, 'drafts')
    addFrame(ROOT, 'drafts', 'hero', { width: 480, height: 300 })
  })

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true })
  })

  const start = () =>
    ({
      ok: true,
      root: ROOT,
      content: '',
      host: '127.0.0.1',
      port: 1,
      url: 'http://127.0.0.1:1/',
      stop: async () => {},
    }) as const

  function layoutHeight(): number {
    const layout = JSON.parse(
      readFileSync(
        join(ROOT, '.canon', 'canvas', 'drafts', 'layout.json'),
        'utf8',
      ),
    ) as { frames: Record<string, { height: number }> }
    return layout.frames.hero?.height ?? 0
  }

  const taller = async () => [measured(drawn(640))]

  it('should write the fitted height through the layout', async () => {
    const outcome = await fitCanvas(ROOT, 'drafts', true, {
      start,
      measure: taller,
    })

    expect(outcome).toMatchObject({ ok: true, written: true })
    expect(layoutHeight()).toBe(640)
  })

  it('should write nothing under a check and still report the row', async () => {
    const outcome = await fitCanvas(ROOT, 'drafts', false, {
      start,
      measure: taller,
    })

    expect(outcome).toMatchObject({
      ok: true,
      written: false,
      rows: [{ frame: 'hero', height: 300, fitted: 640 }],
    })
    expect(layoutHeight()).toBe(300)
  })

  it('should not flag a family the project declares in its own sheet', async () => {
    const design = join(ROOT, '.claude', 'design', 'project')
    mkdirSync(join(design, 'fonts'), { recursive: true })
    writeFileSync(join(design, 'fonts', 'inter.woff2'), 'wOF2inter')
    writeFileSync(
      join(design, 'fonts.css'),
      "@font-face { font-family: 'Inter'; src: url('fonts/inter.woff2'); }",
    )

    const outcome = await fitCanvas(ROOT, 'drafts', false, {
      start,
      measure: async () => [measured({ family: 'Inter' })],
    })

    expect(outcome).toMatchObject({ ok: true, rows: [{ font: false }] })
  })

  it('should refuse a page that does not exist before serving anything', async () => {
    const outcome = await fitCanvas(ROOT, 'missing', true, {
      start: () => {
        throw new Error('served a refused target')
      },
    })

    expect(outcome).toMatchObject({ ok: false, reason: 'no-page' })
  })
})
