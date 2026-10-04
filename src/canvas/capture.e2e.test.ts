import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Browser } from 'playwright-core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { primaryFontFamily } from '@/capture/sources'
import { captureCanvas, resolveCaptureTargets } from '@/canvas/capture'
import { addFrame, addPage } from '@/canvas/content'
import { startCanvas } from '@/canvas/server'
import { buildDesignCss } from '@/design/css'

/**
 * Captures a frame through the real engine and compares it with the served
 * page a browser draws, so a capture that refuses a frame the canvas renders,
 * or renders it in another face, fails here.
 *
 * The root's base stylesheet embeds the token faces rather than relying on an
 * installed font, and the body frame names a family on `html` that no machine
 * has, so the result does not depend on which fonts the machine carries.
 *
 * The suite needs a browser binary and skips without one, as the shell walk
 * does, so a green pipeline is not evidence this passed.
 */

const PAGE = 'probe'
const WIDTH = 480
const HEIGHT = 320

const BODY_STYLED = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>body-styled</title>
    <style>
      html {
        font-family: "__canon_absent_html_family__";
      }
      body {
        margin: 0;
        font-family: var(--type-body-family);
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Body styled</h1>
      <p>The text inherits its face from body, not from html.</p>
    </main>
  </body>
</html>
`

const UNSTYLED = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>unstyled</title>
  </head>
  <body>
    <p>No family is set anywhere in this frame.</p>
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

function isTimesInstalled(): boolean {
  const result = Bun.spawnSync(['fc-list', 'Times New Roman'], {
    stdout: 'pipe',
    stderr: 'ignore',
  })
  return result.exitCode === 0 && result.stdout.toString().trim() !== ''
}

function provision(root: string): void {
  addPage(root, PAGE)
  for (const [name, html] of [
    ['body-styled', BODY_STYLED],
    ['unstyled', UNSTYLED],
  ] as const) {
    const added = addFrame(root, PAGE, name, { width: WIDTH, height: HEIGHT })
    if (!added.ok) throw new Error(added.detail)
    writeFileSync(join(root, '.canon', 'canvas', PAGE, added.file), html)
  }
  mkdirSync(join(root, '.claude', 'design'), { recursive: true })
  writeFileSync(
    join(root, '.claude', 'design', 'base.css'),
    buildDesignCss(undefined, { embedFonts: true }),
  )
}

describe.skipIf(!hasBrowser)('captureCanvas', () => {
  let root: string
  let browser: Browser

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'canvas-capture-'))
    provision(root)
    const { chromium } = await import('playwright-core')
    browser = await chromium.launch()
  }, 60_000)

  afterAll(async () => {
    await browser?.close()
    rmSync(root, { recursive: true, force: true })
  })

  it('should capture a body-styled frame as the served page renders it', async () => {
    const out = join(root, 'body-styled.png')

    const outcome = await captureCanvas(root, `${PAGE}/body-styled`, out)

    expect(outcome).toMatchObject({
      ok: true,
      captures: [{ result: { status: 'rendered' } }],
    })
    const server = startCanvas(root, { port: 0, shell: new Response('') })
    if (!server.ok) throw new Error(server.detail)
    try {
      const resolved = resolveCaptureTargets(
        root,
        `${PAGE}/body-styled`,
        server.url,
      )
      if (!resolved.ok) throw new Error(resolved.detail)
      const page = await browser.newPage({
        deviceScaleFactor: 2,
        viewport: { width: WIDTH, height: 720 },
      })
      await page.goto(resolved.targets[0]?.url ?? '')
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      const families = await page.evaluate(() => ({
        text: getComputedStyle(document.querySelector('h1') as Element)
          .fontFamily,
        token: getComputedStyle(document.documentElement).getPropertyValue(
          '--type-body-family',
        ),
      }))
      const served = await page
        .locator('html')
        .screenshot({ omitBackground: true })
      await page.close()

      expect(primaryFontFamily(families.text)).toBe(
        primaryFontFamily(families.token),
      )
      expect(Buffer.compare(readFileSync(out), served)).toBe(0)
    } finally {
      await server.stop()
    }
  }, 60_000)

  it.skipIf(isTimesInstalled())(
    'should refuse a frame that sets no family anywhere',
    async () => {
      const outcome = await captureCanvas(
        root,
        `${PAGE}/unstyled`,
        join(root, 'unstyled.png'),
      )

      expect(outcome).toMatchObject({
        ok: true,
        captures: [
          {
            result: {
              status: 'failed',
              reason: expect.stringContaining(
                'Times New Roman is not installed',
              ),
            },
          },
        ],
      })
    },
    60_000,
  )
})
