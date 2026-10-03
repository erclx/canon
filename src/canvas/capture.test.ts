import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addFrame } from '@/canvas/content'
import {
  CAPTURE_SELECTOR,
  captureCanvas,
  resolveCaptureTargets,
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
