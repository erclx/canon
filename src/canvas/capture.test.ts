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
import { addFrame, type Frame } from '@/canvas/content'
import {
  buildComposite,
  CAPTURE_SELECTOR,
  COMPOSITE_SELECTOR,
  captureCanvas,
  captureComposite,
  resolveCaptureTargets,
  resolveCompositeTarget,
} from '@/canvas/capture'

let ROOT = ''

const BASE = 'http://127.0.0.1:8790/'

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-canvas-capture-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

function seedFrame(page: string, frame: string, width?: number): void {
  const dir = join(ROOT, '.canon', 'canvas', page)
  mkdirSync(dir, { recursive: true })
  if (width === undefined) {
    writeFileSync(join(dir, `${frame}.html`), `<p>${frame}</p>`)
    return
  }
  addFrame(ROOT, page, frame, { width, height: 700 })
}

describe('captureCanvas with the server and engine stood in', () => {
  function fakeServer(stopped: string[]) {
    return () =>
      ({
        ok: true,
        root: ROOT,
        content: '',
        host: '127.0.0.1',
        port: 1,
        url: 'http://127.0.0.1:1/',
        stop: async () => {
          stopped.push('stopped')
        },
      }) as const
  }

  it('should report a server that will not start as no-server', async () => {
    seedFrame('drafts', 'hero')

    const outcome = await captureCanvas(ROOT, 'drafts/hero', undefined, {
      start: () => ({
        ok: false,
        reason: 'no-port',
        detail: 'no free port between 1 and 2',
      }),
    })

    expect(outcome).toMatchObject({ ok: false, reason: 'no-server' })
    expect(outcome.ok === false && outcome.detail).toContain(
      'no free port between 1 and 2',
    )
  })

  it('should report an error thrown inside the capture as capture-failed', async () => {
    seedFrame('drafts', 'hero')
    const stopped: string[] = []

    const outcome = await captureCanvas(ROOT, 'drafts/hero', undefined, {
      start: fakeServer(stopped),
      capture: async () => {
        throw new Error('browser would not launch')
      },
    })

    expect(outcome).toMatchObject({ ok: false, reason: 'capture-failed' })
    expect(outcome.ok === false && outcome.detail).toContain(
      'browser would not launch',
    )
  })

  it('should stop the server it started after a failed capture', async () => {
    seedFrame('drafts', 'hero')
    const stopped: string[] = []

    await captureCanvas(ROOT, 'drafts/hero', undefined, {
      start: fakeServer(stopped),
      capture: async () => {
        throw new Error('boom')
      },
    })

    expect(stopped).toEqual(['stopped'])
  })

  it('should hand the engine the served address, the frame width, and the PNG path', async () => {
    seedFrame('drafts', 'phone', 390)
    const calls: unknown[] = []

    const outcome = await captureCanvas(ROOT, 'drafts/phone', '/out/p.png', {
      start: fakeServer([]),
      capture: async (source, options) => {
        calls.push([source, options])
        return []
      },
    })

    expect(outcome).toMatchObject({ ok: true })
    expect(calls).toEqual([
      [
        'http://127.0.0.1:1/frames/drafts/phone.html',
        { selector: 'html', width: 390, outDir: '/out/p.png' },
      ],
    ])
  })
})

describe('captureCanvas', () => {
  it('should refuse a missing page without creating the canvas folder', async () => {
    const outcome = await captureCanvas(ROOT, 'missing')

    expect(outcome).toMatchObject({ ok: false, reason: 'no-page' })
    expect(existsSync(join(ROOT, '.canon', 'canvas'))).toBe(false)
  })
})

describe('resolveCaptureTargets', () => {
  it('should resolve a frame to its served address', () => {
    seedFrame('drafts', 'hero')

    const outcome = resolveCaptureTargets(ROOT, 'drafts/hero', BASE)

    expect(outcome).toMatchObject({
      ok: true,
      targets: [
        {
          page: 'drafts',
          frame: 'hero',
          url: `${BASE}frames/drafts/hero.html`,
        },
      ],
    })
  })

  it('should take the width from the layout and not the default', () => {
    seedFrame('drafts', 'phone', 390)

    const outcome = resolveCaptureTargets(ROOT, 'drafts/phone', BASE)

    expect(outcome).toMatchObject({ ok: true, targets: [{ width: 390 }] })
  })

  it('should resolve a page to one target per frame', () => {
    seedFrame('drafts', 'hero', 1440)
    seedFrame('drafts', 'phone', 390)

    const outcome = resolveCaptureTargets(ROOT, 'drafts', BASE)

    expect(outcome).toMatchObject({
      ok: true,
      targets: [
        { frame: 'hero', width: 1440 },
        { frame: 'phone', width: 390 },
      ],
    })
  })

  it('should never resolve to a file on disk', () => {
    seedFrame('drafts', 'hero')

    const outcome = resolveCaptureTargets(ROOT, 'drafts', BASE)

    expect(
      outcome.ok && outcome.targets.every((t) => t.url.startsWith('http://')),
    ).toBe(true)
  })

  it('should capture the whole document so the frame is not cropped to its body', () => {
    expect(CAPTURE_SELECTOR).toBe('html')
  })

  it('should write beside the session scratch when no destination is named', () => {
    seedFrame('drafts', 'hero')

    const outcome = resolveCaptureTargets(ROOT, 'drafts/hero', BASE)

    expect(outcome).toMatchObject({
      ok: true,
      targets: [
        {
          pngPath: join(
            ROOT,
            '.canon',
            'tmp',
            'canvas-capture',
            'drafts',
            'hero.png',
          ),
        },
      ],
    })
  })

  it('should read the destination of a frame as the PNG itself', () => {
    seedFrame('drafts', 'hero')

    const outcome = resolveCaptureTargets(
      ROOT,
      'drafts/hero',
      BASE,
      '/out/h.png',
    )

    expect(outcome).toMatchObject({
      ok: true,
      targets: [{ pngPath: '/out/h.png' }],
    })
  })

  it('should read the destination of a page as a directory', () => {
    seedFrame('drafts', 'hero')

    const outcome = resolveCaptureTargets(ROOT, 'drafts', BASE, '/out')

    expect(outcome).toMatchObject({
      ok: true,
      targets: [{ pngPath: join('/out', 'hero.png') }],
    })
  })

  it('should refuse a page that does not exist', () => {
    expect(resolveCaptureTargets(ROOT, 'missing', BASE)).toMatchObject({
      ok: false,
      reason: 'no-page',
    })
  })

  it('should refuse a frame that does not exist', () => {
    seedFrame('drafts', 'hero')

    expect(resolveCaptureTargets(ROOT, 'drafts/nope', BASE)).toMatchObject({
      ok: false,
      reason: 'no-frame',
    })
  })

  it('should refuse a page that holds no frame', () => {
    mkdirSync(join(ROOT, '.canon', 'canvas', 'empty'), { recursive: true })

    expect(resolveCaptureTargets(ROOT, 'empty', BASE)).toMatchObject({
      ok: false,
      reason: 'no-frame',
    })
  })

  it('should refuse an address with more than a page and a frame', () => {
    expect(resolveCaptureTargets(ROOT, 'a/b/c', BASE)).toMatchObject({
      ok: false,
      reason: 'invalid-name',
    })
  })
})

function frameAt(
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
): Frame {
  return { name, file: `${name}.html`, x, y, width, height, placed: true }
}

describe('buildComposite', () => {
  it('should size a one-frame composite to that frame with no padding', () => {
    const composite = buildComposite(
      'drafts',
      [frameAt('hero', 300, 120, 1440, 900)],
      BASE,
    )

    expect(composite).toMatchObject({
      width: 1440,
      height: 900,
      placements: [
        { frame: 'hero', left: 0, top: 0, width: 1440, height: 900 },
      ],
    })
  })

  it('should offset every frame from the top left of the union of the boxes', () => {
    const composite = buildComposite(
      'drafts',
      [
        frameAt('hero', -100, -50, 300, 200),
        frameAt('wide', 400, 0, 1440, 900),
      ],
      BASE,
    )

    expect(composite).toMatchObject({
      width: 1940,
      height: 950,
      placements: [
        { frame: 'hero', left: 0, top: 0, width: 300, height: 200 },
        { frame: 'wide', left: 500, top: 50, width: 1440, height: 900 },
      ],
    })
  })

  it('should keep the layout order so overlapping frames paint as on the board', () => {
    const composite = buildComposite(
      'drafts',
      [frameAt('b', 0, 0, 100, 100), frameAt('a', 50, 50, 100, 100)],
      BASE,
    )

    expect(composite.placements.map((p) => p.frame)).toEqual(['b', 'a'])
  })

  it('should point each frame at its served address', () => {
    const composite = buildComposite(
      'drafts',
      [frameAt('hero', 0, 0, 100, 100)],
      BASE,
    )

    expect(composite.placements[0]?.url).toBe(`${BASE}frames/drafts/hero.html`)
  })

  it('should write one positioned iframe per frame inside the captured container', () => {
    const composite = buildComposite(
      'drafts',
      [
        frameAt('hero', -100, -50, 300, 200),
        frameAt('wide', 400, 0, 1440, 900),
      ],
      BASE,
    )

    expect(composite.html).toContain('id="canvas-composite"')
    expect(composite.html).toContain('width:1940px;height:950px')
    expect(composite.html).toContain(
      `src="${BASE}frames/drafts/wide.html" style="left:500px;top:50px;width:1440px;height:900px"`,
    )
    expect(COMPOSITE_SELECTOR).toBe('#canvas-composite')
  })
})

describe('resolveCompositeTarget', () => {
  it('should resolve a page to one composite of its frames', () => {
    seedFrame('drafts', 'hero', 1440)
    seedFrame('drafts', 'phone', 390)

    const outcome = resolveCompositeTarget(ROOT, 'drafts', BASE)

    expect(outcome).toMatchObject({
      ok: true,
      target: {
        page: 'drafts',
        composite: { placements: [{ frame: 'hero' }, { frame: 'phone' }] },
      },
    })
  })

  it('should land beside the per-frame folder when no destination is named', () => {
    seedFrame('drafts', 'hero')

    const outcome = resolveCompositeTarget(ROOT, 'drafts', BASE)

    expect(outcome).toMatchObject({
      ok: true,
      target: {
        pngPath: join(ROOT, '.canon', 'tmp', 'canvas-capture', 'drafts.png'),
      },
    })
  })

  it('should read the destination as the PNG itself', () => {
    seedFrame('drafts', 'hero')

    const outcome = resolveCompositeTarget(ROOT, 'drafts', BASE, '/out/b.png')

    expect(outcome).toMatchObject({
      ok: true,
      target: { pngPath: '/out/b.png' },
    })
  })

  it('should refuse a frame address with a reason naming the page-only rule', () => {
    seedFrame('drafts', 'hero')

    const outcome = resolveCompositeTarget(ROOT, 'drafts/hero', BASE)

    expect(outcome).toMatchObject({ ok: false, reason: 'invalid-name' })
    expect(outcome.ok === false && outcome.detail).toContain('takes a page')
  })

  it('should refuse a page that does not exist', () => {
    expect(resolveCompositeTarget(ROOT, 'missing', BASE)).toMatchObject({
      ok: false,
      reason: 'no-page',
    })
  })

  it('should refuse a page that holds no frame', () => {
    mkdirSync(join(ROOT, '.canon', 'canvas', 'empty'), { recursive: true })

    expect(resolveCompositeTarget(ROOT, 'empty', BASE)).toMatchObject({
      ok: false,
      reason: 'no-frame',
    })
  })
})

describe('captureComposite with the server and engine stood in', () => {
  const server = () =>
    ({
      ok: true,
      root: ROOT,
      content: '',
      host: '127.0.0.1',
      port: 1,
      url: 'http://127.0.0.1:1/',
      stop: async () => undefined,
    }) as const

  it('should hand the engine the written document at the container width', async () => {
    seedFrame('drafts', 'hero', 1440)
    seedFrame('drafts', 'phone', 390)
    const calls: [string, unknown][] = []

    const outcome = await captureComposite(ROOT, 'drafts', '/out/b.png', {
      start: server,
      capture: async (source, options) => {
        calls.push([source, options])
        return [
          {
            status: 'rendered',
            source,
            pngPath: '/out/b.png',
            width: 3820,
            height: 1800,
          },
        ]
      },
    })

    expect(outcome).toMatchObject({
      ok: true,
      composite: {
        target: { page: 'drafts' },
        result: { status: 'rendered' },
      },
    })
    expect(calls[0]?.[1]).toEqual({
      selector: '#canvas-composite',
      width: 1910,
      outDir: '/out',
    })
    expect(calls[0]?.[0]).toMatch(/b\.html$/)
  })

  it('should write a document whose frames load from the served address', async () => {
    seedFrame('drafts', 'hero', 1440)
    let written = ''

    await captureComposite(ROOT, 'drafts', undefined, {
      start: server,
      capture: async (source) => {
        written = readFileSync(source, 'utf8')
        return []
      },
    })

    expect(written).toContain(
      'src="http://127.0.0.1:1/frames/drafts/hero.html"',
    )
  })

  it('should report an engine that renders nothing as capture-failed', async () => {
    seedFrame('drafts', 'hero')

    const outcome = await captureComposite(ROOT, 'drafts', undefined, {
      start: server,
      capture: async () => [],
    })

    expect(outcome).toMatchObject({ ok: false, reason: 'capture-failed' })
  })

  it('should refuse a missing page without creating the canvas folder', async () => {
    const outcome = await captureComposite(ROOT, 'missing')

    expect(outcome).toMatchObject({ ok: false, reason: 'no-page' })
    expect(existsSync(join(ROOT, '.canon', 'canvas'))).toBe(false)
  })
})
