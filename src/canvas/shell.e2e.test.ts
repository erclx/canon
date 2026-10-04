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
  --color-clay: #c76b5f;
  --space-md: 16px;
}

[data-theme='light'] {
  --color-clay: #f2c4bc;
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

  it('should keep long values inside the details panel in both themes', async () => {
    // A long class list, a long font stack, and a width wider than any panel.
    const stress = HELLO.replace(
      '<h1 class="title">',
      `<h1 class="title ${Array.from({ length: 6 }, (_, n) => `very-long-utility-class-${n}`).join(' ')}" style="width: 2000.75px; font-family: 'A Very Long Display Family', 'Another Long Fallback Family', system-ui, sans-serif">`,
    )
    writeFileSync(join(root, '.canon', 'canvas', PAGE, `${FRAME}.html`), stress)
    const width = page.getByRole('textbox', { name: 'width', exact: true })
    await expect
      .poll(
        // Each try is bounded, since an action waits forever by default and a
        // reload can leave the row or the field missing for a moment.
        async () => {
          await page
            .getByRole('list', { name: `Layers of ${FRAME}`, exact: true })
            .locator('button.layer', { hasText: /^h1/ })
            .click({ timeout: 2_000 })
            .catch(() => undefined)
          return width.inputValue({ timeout: 2_000 }).catch(() => '')
        },
        { timeout: 15_000 },
      )
      .toBe('2001')

    const panel = page.locator('.panel-right')
    const overflowIn = () =>
      panel.evaluate((element) => element.scrollWidth - element.clientWidth)
    const toggle = page.getByRole('button', {
      name: /^Switch to (light|dark) theme$/,
    })
    const first = await overflowIn()
    await panel.screenshot({ path: join(SHOTS, 'inspector-a.png') })
    await toggle.click()
    const second = await overflowIn()
    await panel.screenshot({ path: join(SHOTS, 'inspector-b.png') })
    await toggle.click()

    expect([first, second]).toEqual([0, 0])
  }, 30_000)

  it('should open the full picker inside the window in both themes', async () => {
    const swatch = page.getByRole('button', { name: 'background picker' })
    const picker = page.getByRole('dialog', { name: 'background color' })
    const toggle = page.getByRole('button', {
      name: /^Switch to (light|dark) theme$/,
    })
    /*
     * Opens the picker, captures it, and closes it from the keyboard. Returns
     * how far it reaches past the window on each side, the page's own
     * sideways scroll, and how far it covers the details panel, all of which
     * should be zero or less.
     */
    const capture = async (shot: string) => {
      await swatch.click()
      await expect
        .poll(() => picker.getByRole('slider').count())
        .toBeGreaterThan(0)
      const reach = await picker.evaluate((element) => {
        const box = element.getBoundingClientRect()
        const root = document.documentElement
        const panel = document.querySelector('.panel-right')
        return [
          -box.left,
          -box.top,
          box.right - root.clientWidth,
          box.bottom - root.clientHeight,
          root.scrollWidth - root.clientWidth,
          box.right - (panel?.getBoundingClientRect().left ?? box.right),
        ].map((value) => Math.max(0, Math.ceil(value)))
      })
      await page.screenshot({ path: join(SHOTS, shot) })
      await page.keyboard.press('Escape')
      return reach
    }

    const first = await capture('picker-a.png')
    const isSwatchFocused = await swatch.evaluate(
      (element) => element === document.activeElement,
    )
    await toggle.click()
    const second = await capture('picker-b.png')
    await toggle.click()

    expect([first, second]).toEqual([
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
    ])
    expect(isSwatchFocused).toBe(true)
    expect(await picker.count()).toBe(0)
  }, 30_000)

  it('should track the first drag on the alpha strip after opening', async () => {
    await page.getByRole('button', { name: 'background picker' }).click()
    const alpha = page
      .getByRole('dialog', { name: 'background color' })
      .getByRole('slider', { name: 'alpha' })
    const box = await alpha.boundingBox()
    if (!box) throw new Error('the alpha strip has no box')
    const x = box.x + box.width / 2
    const edits: string[] = []
    const record = (request: { url(): string; method(): string }) => {
      if (
        request.url().endsWith('/api/frames/edit') &&
        request.method() === 'POST'
      ) {
        edits.push(request.url())
      }
    }
    page.on('request', record)

    // Pressed on the track below the thumb, where the range fires its first
    // input before focus leaves the area, so the area's blur sees a session
    // it did not open.
    await page.mouse.move(x, box.y + box.height * 0.2)
    await page.mouse.down()
    for (const step of [0.4, 0.6, 0.8, 0.95]) {
      await page.mouse.move(x, box.y + box.height * step)
    }
    const during = await alpha.inputValue()
    const postedMidDrag = edits.length
    await page.keyboard.press('Escape')
    await page.mouse.up()
    page.off('request', record)

    expect([Number(during) < 20, postedMidDrag]).toEqual([true, 0])
  }, 30_000)

  it('should list the color tokens behind the tokens icon', async () => {
    const list = page.getByRole('dialog', { name: 'background token list' })

    await page.getByRole('button', { name: 'background tokens' }).click()

    await expect
      .poll(() => list.getByRole('option').allInnerTexts())
      .toEqual(['--color-ink', '--color-clay'])
    await page.screenshot({ path: join(SHOTS, 'tokens.png') })
    await page.keyboard.press('Escape')
    expect(await list.count()).toBe(0)
  })

  it('should keep a picked token following the frame theme', async () => {
    const [response] = await Promise.all([
      page.waitForResponse(
        (sent) =>
          sent.url().endsWith('/api/frames/edit') &&
          sent.request().method() === 'POST',
      ),
      (async () => {
        await page.getByRole('button', { name: 'background tokens' }).click()
        await page
          .getByRole('dialog', { name: 'background token list' })
          .getByRole('option', { name: '--color-clay' })
          .click()
      })(),
    ])
    expect(response.status()).toBe(200)

    const heading = page
      .locator(`.frame[data-frame="${FRAME}"] iframe`)
      .contentFrame()
      .locator('h1')
    const background = () =>
      heading
        .evaluate((element) => getComputedStyle(element).backgroundColor, {
          timeout: 2_000,
        })
        .catch(() => '')
    // A read taken while the frame reloads comes back empty or stale, so each
    // poll waits for one of the token's two values rather than any change.
    const clay = /^rgb\((199, 107, 95|242, 196, 188)\)$/
    await expect.poll(background, { timeout: 15_000 }).toMatch(clay)
    const before = await background()
    await page
      .getByRole('button', { name: new RegExp(`^Show ${FRAME} in `) })
      .click()
    const settled = async () => {
      const value = await background()
      return value !== before && clay.test(value) ? value : ''
    }
    await expect.poll(settled, { timeout: 15_000 }).toMatch(clay)
    const after = await settled()
    await page
      .getByRole('button', { name: new RegExp(`^Show ${FRAME} in `) })
      .click()

    expect(new Set([before, after])).toEqual(
      new Set(['rgb(199, 107, 95)', 'rgb(242, 196, 188)']),
    )
  }, 45_000)

  it('should keep focus on the tokens icon after a keyboard pick reloads the frame', async () => {
    await page.getByRole('button', { name: 'background tokens' }).focus()
    // Pressed back to back with no wait, since a key typed straight after the
    // one that opened the list has to reach it rather than the icon.
    await page.keyboard.press('Enter')
    await page.keyboard.press('ArrowUp')
    const [response] = await Promise.all([
      page.waitForResponse(
        (sent) =>
          sent.url().endsWith('/api/frames/edit') &&
          sent.request().method() === 'POST',
      ),
      page.keyboard.press('Enter'),
    ])
    expect(response.status()).toBe(200)

    // The field reading the new token proves the inspector remounted on the
    // reloaded frame, so focus read alongside it is focus after the reload.
    const field = page.getByRole('textbox', { name: 'background', exact: true })
    await expect
      .poll(
        async () => [
          await field.inputValue({ timeout: 2_000 }).catch(() => ''),
          await page.evaluate(() =>
            document.activeElement?.getAttribute('aria-label'),
          ),
        ],
        { timeout: 15_000 },
      )
      .toEqual(['--color-ink', 'background tokens'])
  }, 45_000)

  it('should post one edit for a drag across the area', async () => {
    const edits: string[] = []
    const record = (request: { url(): string; method(): string }) => {
      if (
        request.url().endsWith('/api/frames/edit') &&
        request.method() === 'POST'
      ) {
        edits.push(request.url())
      }
    }
    await page.getByRole('button', { name: 'background picker' }).click()
    const area = page
      .getByRole('dialog', { name: 'background color' })
      .getByRole('slider', { name: 'saturation and brightness' })
    const box = await area.boundingBox()
    if (!box) throw new Error('the area has no box')
    page.on('request', record)

    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2)
    await page.mouse.down()
    for (const step of [0.35, 0.5, 0.65, 0.8]) {
      await page.mouse.move(box.x + box.width * step, box.y + box.height * step)
    }
    const [response] = await Promise.all([
      page.waitForResponse(
        (sent) =>
          sent.url().endsWith('/api/frames/edit') &&
          sent.request().method() === 'POST',
      ),
      page.mouse.up(),
    ])
    // The reload settles before the count is read, so a second write would
    // land, and the picker reopens on the reloaded frame.
    const field = page.getByRole('textbox', { name: 'background', exact: true })
    await expect
      .poll(
        async () => [
          await field.inputValue({ timeout: 2_000 }).catch(() => ''),
          await page.getByRole('dialog', { name: 'background color' }).count(),
        ],
        { timeout: 15_000 },
      )
      .toEqual([expect.stringMatching(/^[0-9a-f]{6}$/), 1])
    await page.screenshot({ path: join(SHOTS, 'picker-drag.png') })
    page.off('request', record)
    await page.keyboard.press('Escape')

    expect(response.status()).toBe(200)
    expect(edits).toHaveLength(1)
  }, 45_000)

  it('should list tokens on the Theme tab', async () => {
    await page.getByRole('tab', { name: 'Theme' }).click()

    const tokens = page.locator('section[aria-label="Theme"] li.token')
    await expect.poll(() => tokens.count()).toBeGreaterThan(0)
    await page.screenshot({ path: join(SHOTS, 'theme.png') })
  })
})
