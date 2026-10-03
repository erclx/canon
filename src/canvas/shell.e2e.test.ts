import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Browser, Page } from 'playwright-core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Walks the canvas shell in a real browser: open, select a frame, pick an
 * element from its layers, and switch to the Theme tab. Each state asserts a
 * fact a simulated DOM cannot see and writes a screenshot for eyes, never for
 * comparison against a stored image. Component tests once passed while the
 * served page rendered blank, which is the gap this closes. Each case is one
 * state of a single walk on one page, so they run in order and share it.
 *
 * The server runs as a subprocess against a temporary root, on a port the
 * kernel just handed out. Bun binds with port reuse on by default on Linux, so
 * the serve verb's own walk from its default port shares the port with an
 * operator's canvas already listening there, and requests reach either process.
 *
 * The suite needs a browser binary. CI installs none, so it skips there rather
 * than failing, which means a green pipeline is not evidence this passed. Run
 * it locally before a change to the shell ships.
 */

const CLI = resolve(import.meta.dirname, '..', 'cli.ts')
const SHOTS = resolve(
  import.meta.dirname,
  '..',
  '..',
  '.canon',
  'tmp',
  'canvas-walk',
)
const PAGE = 'walk'
const FRAME = 'hello'

const HELLO = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <h1 class="title">Hello canvas</h1>
    <p>One paragraph under the heading.</p>
  </body>
</html>
`

const SECOND = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <h2>Second frame</h2>
  </body>
</html>
`

const BASE_CSS = `:root {
  --color-ink: #1a1a1a;
  --space-md: 16px;
}
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

function runCli(args: readonly string[]): void {
  const result = Bun.spawnSync(['bun', CLI, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (result.exitCode !== 0) {
    throw new Error(`canon ${args.join(' ')} exited ${result.exitCode}`)
  }
}

/** Two frames on one page, plus a token stylesheet so the Theme tab has rows. */
function provision(root: string): void {
  runCli(['canvas', 'page', 'add', PAGE, '--root', root, '--json'])
  for (const name of [FRAME, 'second']) {
    runCli([
      'canvas',
      'frame',
      'add',
      PAGE,
      name,
      '--width',
      '480',
      '--height',
      '320',
      '--root',
      root,
      '--json',
    ])
  }
  const content = join(root, '.canon', 'canvas', PAGE)
  writeFileSync(join(content, `${FRAME}.html`), HELLO)
  writeFileSync(join(content, 'second.html'), SECOND)
  mkdirSync(join(root, '.claude', 'design'), { recursive: true })
  writeFileSync(join(root, '.claude', 'design', 'base.css'), BASE_CSS)
}

/** Reads stdout until the serve record arrives, since the port is not fixed. */
async function readServeUrl(
  stdout: ReadableStream<Uint8Array>,
): Promise<string> {
  const decoder = new TextDecoder()
  let buffered = ''
  for await (const chunk of stdout) {
    buffered += decoder.decode(chunk, { stream: true })
    // The last segment may be a record cut mid-chunk, so only whole lines parse.
    for (const line of buffered.split('\n').slice(0, -1)) {
      if (!line.startsWith('{')) continue
      const record = JSON.parse(line) as { ok: boolean; url?: string }
      if (!record.ok || !record.url) {
        throw new Error(`canvas serve refused: ${line}`)
      }
      return record.url
    }
  }
  throw new Error('canvas serve exited before printing its record')
}

/** A port nothing listens on, since the serve verb cannot detect a live one. */
function freePort(): number {
  const probe = Bun.serve({ port: 0, fetch: () => new Response('') })
  const port = Number(probe.port)
  probe.stop(true)
  return port
}

describe.skipIf(!hasBrowser)('canvas shell in a browser', () => {
  let root: string
  let server: ReturnType<typeof Bun.spawn> | undefined
  let browser: Browser
  let page: Page

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'canvas-walk-'))
    mkdirSync(SHOTS, { recursive: true })
    provision(root)

    const spawned = Bun.spawn(
      [
        'bun',
        CLI,
        'canvas',
        'serve',
        '--root',
        root,
        '--port',
        String(freePort()),
        '--json',
      ],
      { stdout: 'pipe', stderr: 'ignore' },
    )
    server = spawned
    const url = await readServeUrl(spawned.stdout)

    const { chromium } = await import('playwright-core')
    browser = await chromium.launch()
    page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
    // The shell holds /api/events open, so networkidle never arrives.
    await page.goto(url, { waitUntil: 'load' })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    server?.kill()
    await server?.exited
    rmSync(root, { recursive: true, force: true })
  })

  it('should list the provisioned page once the shell renders', async () => {
    const pages = page.getByRole('list', { name: 'Pages' })

    // An empty client bundle loads a blank page, and fails here rather than
    // passing on four white screenshots.
    await expect
      .poll(() => pages.getByRole('button').allInnerTexts(), {
        timeout: 15_000,
      })
      .toEqual([expect.stringContaining(PAGE)])
    await page.screenshot({ path: join(SHOTS, 'open.png') })
  }, 30_000)

  it('should outline the frame a row selects', async () => {
    await page
      .getByRole('list', { name: 'Frames' })
      .getByTitle(FRAME, { exact: true })
      .click()

    const selected = page.locator(`.frame[data-frame="${FRAME}"]`)
    await expect.poll(() => selected.getAttribute('data-selected')).toBe('true')
    await page.screenshot({ path: join(SHOTS, 'frame.png') })
  })

  it('should name the picked tag in the inspector', async () => {
    await page
      .getByRole('button', { name: `Show layers of ${FRAME}`, exact: true })
      .click()
    // The inspector names the tag before the server accepts the address, so
    // only the settled request shows the pick held.
    const [response] = await Promise.all([
      page.waitForResponse(
        (sent) =>
          sent.url().endsWith('/api/selection') &&
          sent.request().method() === 'POST',
      ),
      page
        .getByRole('list', { name: `Layers of ${FRAME}`, exact: true })
        .locator('button.layer', { hasText: /^h1/ })
        .click(),
    ])
    expect(response.status()).toBe(200)

    const detail = page.locator('section[aria-label="Element"] .detail')
    await expect.poll(() => detail.textContent()).toBe('h1.title')
    await page.screenshot({ path: join(SHOTS, 'element.png') })
  })

  it('should keep the picked element inside the details panel', async () => {
    const overflow = await page
      .locator('.panel-right')
      .evaluate((panel) => panel.scrollWidth - panel.clientWidth)

    expect(overflow).toBeLessThanOrEqual(0)
  })

  it('should list tokens on the Theme tab', async () => {
    await page.getByRole('tab', { name: 'Theme' }).click()

    const tokens = page.locator('section[aria-label="Theme"] li.token')
    await expect.poll(() => tokens.count()).toBeGreaterThan(0)
    await page.screenshot({ path: join(SHOTS, 'theme.png') })
  })
})
