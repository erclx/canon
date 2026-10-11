import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { addFrame, addPage } from '@/canvas/content'
import { fitCanvas } from '@/canvas/fit'

/**
 * Serves a page with a frame taller than its box, fits it through the real
 * engine, and reads the new height back from `layout.json`. The suite needs a
 * browser binary and skips without one, as the capture walk does.
 */

const PAGE = 'probe'
const WIDTH = 480
const BOX_HEIGHT = 200
const CONTENT_HEIGHT = 700

const TALL = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>tall</title>
    <style>
      body {
        margin: 0;
        font-family: 'Geist Variable';
      }
      main {
        height: ${CONTENT_HEIGHT}px;
      }
    </style>
  </head>
  <body>
    <main>Tall content</main>
  </body>
</html>
`

const VIEWPORT_SIZED = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>viewport-sized</title>
    <style>
      body {
        margin: 0;
        font-family: 'Geist Variable';
      }
      section {
        height: 100vh;
      }
    </style>
  </head>
  <body>
    <section>One</section>
    <section>Two</section>
  </body>
</html>
`

async function browserAvailable(): Promise<boolean> {
  const { chromium } = await import('playwright-core')
  try {
    const browser = await chromium.launch()
    await browser.close()
    return true
  } catch {
    return false
  }
}

const hasBrowser = await browserAvailable()

describe.skipIf(!hasBrowser)('fitCanvas', () => {
  let root = ''

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'canvas-fit-'))
    addPage(root, PAGE)
    const added = addFrame(root, PAGE, 'tall', {
      width: WIDTH,
      height: BOX_HEIGHT,
    })
    if (!added.ok) throw new Error(added.detail)
    writeFileSync(join(root, '.canon', 'canvas', PAGE, added.file), TALL)
    const sized = addFrame(root, PAGE, 'sized', {
      width: WIDTH,
      height: BOX_HEIGHT,
    })
    if (!sized.ok) throw new Error(sized.detail)
    writeFileSync(
      join(root, '.canon', 'canvas', PAGE, sized.file),
      VIEWPORT_SIZED,
    )
  })

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  function layoutHeight(frame = 'tall'): number {
    const layout = JSON.parse(
      readFileSync(join(root, '.canon', 'canvas', PAGE, 'layout.json'), 'utf8'),
    ) as { frames: Record<string, { height: number }> }
    return layout.frames[frame]?.height ?? 0
  }

  it('should report an overflowing frame under a check and fit it on write', async () => {
    const checked = await fitCanvas(root, PAGE, false)

    expect(checked).toMatchObject({
      ok: true,
      written: false,
      rows: expect.arrayContaining([
        expect.objectContaining({
          frame: 'tall',
          height: BOX_HEIGHT,
          fitted: CONTENT_HEIGHT,
        }),
      ]),
    })
    expect(layoutHeight()).toBe(BOX_HEIGHT)

    const fitted = await fitCanvas(root, PAGE, true)

    expect(fitted).toMatchObject({ ok: true, written: true })
    expect(layoutHeight()).toBe(CONTENT_HEIGHT)
  }, 60_000)

  it('should leave a frame sized in viewport units alone and report it', async () => {
    const outcome = await fitCanvas(root, `${PAGE}/sized`, true)

    expect(outcome).toMatchObject({
      ok: true,
      rows: [{ frame: 'sized', viewport: true, height: BOX_HEIGHT }],
    })
    expect(layoutHeight('sized')).toBe(BOX_HEIGHT)
  }, 60_000)
})
