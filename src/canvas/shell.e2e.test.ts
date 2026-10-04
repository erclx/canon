import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
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
 * kernel just handed out, so the walk never starts at a port an operator's
 * canvas holds. Bun turns port reuse on in production mode, which the serve
 * verb runs in, so the bind passes `reusePort: false` to walk past a held port.
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
  --type-body-family: Georgia, serif;
  --type-heading-size: 2rem;
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

  it('should point the tab icon at the served brand icon', async () => {
    const href = await page.locator('link[rel="icon"]').getAttribute('href')

    expect(href).toBe('/api/icon.svg')
  })

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

  /** Steps the toolbar zoom toward a percent, which moves by a factor per press. */
  async function zoomToward(percent: number): Promise<number> {
    const readout = page.locator('.toolbar .zoom')
    const read = async () =>
      Number.parseInt((await readout.textContent()) ?? '', 10)
    for (let step = 0; step < 30; step += 1) {
      const current = await read()
      const next = current * (current > percent ? 1 / 1.2 : 1.2)
      if (Math.abs(next - percent) >= Math.abs(current - percent)) break
      await page
        .getByRole('button', {
          name: current > percent ? 'Zoom out' : 'Zoom in',
          exact: true,
        })
        .click()
    }
    return read()
  }

  /** Zooms, then centers a frame from its row so its label is on screen. */
  async function selectFrameAt(percent: number, name = FRAME): Promise<number> {
    const zoom = await zoomToward(percent)
    await page.getByRole('tab', { name: 'Pages' }).click()
    await page
      .getByRole('list', { name: 'Frames' })
      .getByTitle(name, { exact: true })
      .click()
    await expect
      .poll(() =>
        page
          .locator(`.frame[data-frame="${name}"] .selection`)
          .getAttribute('data-selection'),
      )
      .toBe('frame')
    return zoom
  }

  /** Every zoom draws the label and the handles at one screen size. */
  async function screenSizes(): Promise<{ label: number; handle: number }> {
    const frame = page.locator(`.frame[data-frame="${FRAME}"]`)
    const label = await frame.locator('.frame-name').boundingBox()
    const handle = await frame
      .locator('.selection [data-handle="se"]')
      .boundingBox()
    return { label: label?.height ?? 0, handle: handle?.width ?? 0 }
  }

  it('should draw a selected frame label and handles at one screen size zoomed out', async () => {
    const zoom = await selectFrameAt(25)
    const sizes = await screenSizes()

    // A short row gives up the size and the theme switch before the name.
    const second = page.locator('.frame[data-frame="second"] .frame-name')
    const clipped = await second.evaluate(
      (name) => name.scrollWidth - name.clientWidth,
    )

    expect(zoom).toBeLessThanOrEqual(30)
    expect(sizes.label).toBeGreaterThan(10)
    expect(sizes.label).toBeLessThan(20)
    expect(sizes.handle).toBeCloseTo(24, 0)
    expect(clipped).toBeLessThanOrEqual(0)
    await page.screenshot({ path: join(SHOTS, 'frame-selected-25.png') })
  }, 30_000)

  it('should draw a selected frame label and handles at one screen size zoomed in', async () => {
    const zoom = await selectFrameAt(200)
    const sizes = await screenSizes()

    expect(zoom).toBeGreaterThanOrEqual(170)
    expect(sizes.label).toBeGreaterThan(10)
    expect(sizes.label).toBeLessThan(20)
    expect(sizes.handle).toBeCloseTo(24, 0)
    await page.screenshot({ path: join(SHOTS, 'frame-selected-200.png') })
  }, 30_000)

  it('should draw handles and a size chip on a selected element', async () => {
    await selectFrameAt(100)
    await page
      .getByRole('list', { name: `Layers of ${FRAME}`, exact: true })
      .locator('button.layer', { hasText: /^p/ })
      .click()

    const overlay = page.locator(
      `.frame[data-frame="${FRAME}"] .selection[data-selection="element"]`,
    )
    await expect.poll(() => overlay.locator('[data-handle]').count()).toBe(4)
    await expect
      .poll(() => overlay.locator('.selection-chip').textContent())
      .toMatch(/^\d+ × \d+$/)
    await page.screenshot({ path: join(SHOTS, 'element-selected.png') })
  }, 30_000)

  it('should resize a frame by a corner drag divided by the zoom', async () => {
    const zoom = (await selectFrameAt(50, 'second')) / 100
    const handle = await page
      .locator('.frame[data-frame="second"] .selection [data-handle="se"]')
      .boundingBox()
    if (!handle) throw new Error('no handle on screen')
    const startX = handle.x + handle.width / 2
    const startY = handle.y + handle.height / 2

    const written = page.waitForRequest(
      (sent) =>
        sent.url().endsWith('/api/frames/resize') && sent.method() === 'POST',
    )
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 50, startY + 25, { steps: 5 })
    await page.mouse.up()
    const request = await written
    const box = request.postDataJSON() as { width: number; height: number }

    // The readout rounds the zoom to a whole percent, so the check allows it.
    expect((await request.response())?.status()).toBe(200)
    expect(Math.abs(box.width - (480 + 50 / zoom))).toBeLessThan(4)
    expect(Math.abs(box.height - (320 + 25 / zoom))).toBeLessThan(4)
  }, 30_000)

  it('should keep the flex and appearance controls inside the panel in both themes', async () => {
    const row = HELLO.replace(
      '<p>One paragraph under the heading.</p>',
      '<div class="row" style="display: flex; justify-content: center; gap: 8px; border-radius: 6px; opacity: 0.8"><span>One</span><span>Two</span></div>',
    )
    writeFileSync(join(root, '.canon', 'canvas', PAGE, `${FRAME}.html`), row)
    const grid = page.getByRole('radiogroup', { name: 'Alignment' })
    await expect
      .poll(
        async () => {
          await page
            .getByRole('list', { name: `Layers of ${FRAME}`, exact: true })
            .locator('button.layer', { hasText: /^div\.row/ })
            .click({ timeout: 2_000 })
            .catch(() => undefined)
          return grid.count()
        },
        { timeout: 15_000 },
      )
      .toBe(1)

    const panel = page.locator('.panel-right')
    const opacity = page.getByRole('textbox', { name: 'opacity', exact: true })
    const overflowIn = () =>
      panel.evaluate((element) => element.scrollWidth - element.clientWidth)
    const toggle = page.getByRole('button', {
      name: /^Switch to (light|dark) theme$/,
    })
    await opacity.scrollIntoViewIfNeeded()
    const first = await overflowIn()
    await panel.screenshot({ path: join(SHOTS, 'layout-a.png') })
    await toggle.click()
    const second = await overflowIn()
    await panel.screenshot({ path: join(SHOTS, 'layout-b.png') })
    await toggle.click()

    expect([first, second]).toEqual([0, 0])
    expect(await opacity.inputValue()).toBe('80%')
    expect(
      await grid
        .getByRole('radio', { name: 'top center' })
        .getAttribute('aria-checked'),
    ).toBe('true')
  }, 30_000)

  it('should show the editing badge at a low and a high zoom in both themes and clear it on done', async () => {
    const target = `${PAGE}/${FRAME}`
    runCli(['canvas', 'editing', target, '--by', 'worker-a', '--root', root])
    const frame = page.locator(`.frame[data-frame="${FRAME}"]`)
    const badge = frame.locator('.frame-editing')
    await expect.poll(() => badge.textContent()).toBe('worker-a editing')

    const toggle = page.getByRole('button', {
      name: /^Switch to (light|dark) theme$/,
    })
    /* The name keeps the row, and a badge on it never covers the switch. */
    const overlap = () =>
      frame.evaluate((figure) => {
        const box = (selector: string) =>
          figure.querySelector(selector)?.getBoundingClientRect()
        const name = figure.querySelector('.frame-name')
        const tag = box('.frame-editing')
        const theme = box('.frame-theme')
        const isCovering =
          tag && theme && tag.width > 0 && theme.width > 0
            ? tag.right > theme.left &&
              tag.left < theme.right &&
              tag.bottom > theme.top &&
              tag.top < theme.bottom
            : false
        return {
          clipped: name ? name.scrollWidth - name.clientWidth : -1,
          isCovering,
        }
      })

    const states: { clipped: number; isCovering: boolean }[] = []
    for (const zoom of [25, 200]) {
      await selectFrameAt(zoom)
      for (const shot of ['a', 'b']) {
        states.push(await overlap())
        await page.screenshot({
          path: join(SHOTS, `editing-${zoom}-${shot}.png`),
        })
        await toggle.click()
      }
    }

    runCli(['canvas', 'editing', target, '--done', '--root', root])
    await expect.poll(() => badge.textContent()).toBe('')

    expect(states).toEqual(
      Array.from({ length: 4 }, () => ({ clipped: 0, isCovering: false })),
    )
    expect(await frame.getAttribute('data-editing')).toBeNull()
  }, 45_000)

  it('should keep the typography controls inside the panel in both themes', async () => {
    const heading = HELLO.replace(
      '<h1 class="title">',
      '<h1 class="title" style="font-family: var(--type-body-family); line-height: 1.2; letter-spacing: -0.02em; text-align: center">',
    )
    writeFileSync(
      join(root, '.canon', 'canvas', PAGE, `${FRAME}.html`),
      heading,
    )
    const family = page.getByRole('textbox', { name: 'family', exact: true })
    await expect
      .poll(
        async () => {
          await page
            .getByRole('list', { name: `Layers of ${FRAME}`, exact: true })
            .locator('button.layer', { hasText: /^h1\.title/ })
            .click({ timeout: 2_000 })
            .catch(() => undefined)
          return family.inputValue({ timeout: 2_000 }).catch(() => '')
        },
        { timeout: 15_000 },
      )
      .toBe('--type-body-family')

    const panel = page.locator('.panel-right')
    const overflowIn = () =>
      panel.evaluate((element) => element.scrollWidth - element.clientWidth)
    const toggle = page.getByRole('button', {
      name: /^Switch to (light|dark) theme$/,
    })
    await page
      .getByRole('group', { name: 'text alignment' })
      .scrollIntoViewIfNeeded()
    // An earlier case's edit leaves Saved up on a timer, so the shot waits it out.
    await expect
      .poll(() => panel.locator('.saved').count(), { timeout: 10_000 })
      .toBe(0)
    const first = await overflowIn()
    await panel.screenshot({ path: join(SHOTS, 'typography-a.png') })
    await toggle.click()
    const second = await overflowIn()
    await panel.screenshot({ path: join(SHOTS, 'typography-b.png') })
    await toggle.click()

    expect([first, second]).toEqual([0, 0])
    expect(await family.inputValue()).toBe('--type-body-family')
    expect(
      await page
        .getByRole('textbox', { name: 'line height', exact: true })
        .inputValue(),
    ).toBe('1.2')
    expect(
      await page
        .getByRole('button', { name: 'Align center' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
  }, 30_000)

  /** The plane's transform, which moves with every pan and zoom. */
  function planeTransform(): Promise<string> {
    return page
      .locator('.plane')
      .evaluate((plane) => (plane as HTMLElement).style.transform)
  }

  it('should pan rather than pick when the pan tool drags over a frame', async () => {
    await selectFrameAt(100)
    const tools = page.getByRole('toolbar', { name: 'Tools' })
    await tools.getByRole('button', { name: 'Pan (H)' }).click()
    const body = await page
      .locator(`.frame[data-frame="${FRAME}"] iframe`)
      .boundingBox()
    if (!body) throw new Error('no frame on screen')
    const startX = body.x + body.width / 2
    const startY = body.y + body.height / 2
    const before = await planeTransform()
    const picks: string[] = []
    page.on('request', (sent) => {
      if (sent.url().endsWith('/api/selection')) picks.push(sent.url())
    })

    // A frame under the pan tool takes no pointer, so the press lands behind it.
    const hit = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.tagName,
      [startX, startY],
    )
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 80, startY + 40, { steps: 4 })
    await page.mouse.up()

    expect(hit).not.toBe('IFRAME')
    expect(
      await tools
        .getByRole('button', { name: 'Pan (H)' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    await expect.poll(planeTransform).not.toBe(before)
    expect(picks).toEqual([])
    await page.screenshot({ path: join(SHOTS, 'pan-tool.png') })
    await page.keyboard.press('v')
    expect(
      await tools
        .getByRole('button', { name: 'Move (V)' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
  }, 30_000)

  it('should pan with Space held after a pick moved focus into the frame', async () => {
    const frameDoc = page.frameLocator(`.frame[data-frame="${FRAME}"] iframe`)
    await frameDoc.locator('h1').click()
    // The drag starts on the heading, where a press would begin a text selection.
    const heading = await frameDoc.locator('h1').boundingBox()
    if (!heading) throw new Error('no heading on screen')
    const startX = heading.x + heading.width / 2
    const startY = heading.y + heading.height / 2
    const before = await planeTransform()
    const picks: string[] = []
    page.on('request', (sent) => {
      if (sent.url().endsWith('/api/selection')) picks.push(sent.url())
    })

    await page.keyboard.down('Space')
    await expect
      .poll(() =>
        page
          .getByRole('button', { name: 'Pan (H)' })
          .getAttribute('aria-pressed'),
      )
      .toBe('true')
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX - 60, startY - 30, { steps: 4 })
    await page.mouse.up()
    await page.keyboard.up('Space')

    await expect.poll(planeTransform).not.toBe(before)
    expect(picks).toEqual([])
    expect(
      await page
        .getByRole('button', { name: 'Move (V)' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    // A pan leaves no text selection painting over the frames it crossed.
    expect(
      await page.evaluate(() => document.getSelection()?.isCollapsed ?? true),
    ).toBe(true)
  }, 30_000)

  it('should pan from a picked element handle with Space held and leave no selection', async () => {
    await selectFrameAt(100)
    await page
      .frameLocator(`.frame[data-frame="${FRAME}"] iframe`)
      .locator('h1')
      .click()
    const handle = await page
      .locator(
        `.frame[data-frame="${FRAME}"] .selection[data-selection="element"] [data-handle="se"]`,
      )
      .boundingBox()
    if (!handle) throw new Error('no handle on screen')
    const startX = handle.x + handle.width / 2
    const startY = handle.y + handle.height / 2
    const before = await planeTransform()
    const edits: string[] = []
    page.on('request', (sent) => {
      if (sent.url().endsWith('/api/frames/edit')) edits.push(sent.url())
    })

    await page.keyboard.down('Space')
    await expect
      .poll(() => page.locator('main.surface').getAttribute('data-tool'))
      .toBe('pan')
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 120, startY + 80, { steps: 8 })
    await page.mouse.up()
    await page.keyboard.up('Space')

    // A handle sets its own pointer events, so it must yield to a pan too.
    await expect.poll(planeTransform).not.toBe(before)
    expect(edits).toEqual([])
    expect(
      await page.evaluate(() => document.getSelection()?.isCollapsed ?? true),
    ).toBe(true)
  }, 30_000)

  it('should pan from a picked element text with Space held and leave no selection in either document', async () => {
    await selectFrameAt(100)
    const frameDoc = page.frameLocator(`.frame[data-frame="${FRAME}"] iframe`)
    await frameDoc.locator('h1').click()
    const heading = await frameDoc.locator('h1').boundingBox()
    if (!heading) throw new Error('no heading on screen')
    const before = await planeTransform()

    // The press lands on the heading's text, read as a second click soon after the pick.
    await page.keyboard.down('Space')
    await page.mouse.down({ clickCount: 2 })
    await page.mouse.move(heading.x + 120, heading.y + 132, { steps: 6 })
    await page.mouse.up({ clickCount: 2 })
    await page.keyboard.up('Space')

    await expect.poll(planeTransform).not.toBe(before)
    const selections = await page.evaluate((name) => {
      const iframe = document.querySelector<HTMLIFrameElement>(
        `.frame[data-frame="${name}"] iframe`,
      )
      return {
        shell: document.getSelection()?.type,
        frame: iframe?.contentDocument?.getSelection()?.type,
      }
    }, FRAME)
    expect(selections.shell).not.toBe('Range')
    expect(selections.frame).not.toBe('Range')
  }, 30_000)

  it('should fit every frame on Shift+1', async () => {
    await selectFrameAt(200)
    await page.locator('main.surface').focus()

    await page.keyboard.press('Shift+Digit1')

    const viewport = await page.locator('.viewport').boundingBox()
    const strip = await page
      .getByRole('toolbar', { name: 'Tools' })
      .boundingBox()
    if (!viewport || !strip) throw new Error('no viewport on screen')
    for (const name of [FRAME, 'second']) {
      const box = await page
        .locator(`.frame[data-frame="${name}"]`)
        .boundingBox()
      if (!box) throw new Error(`no ${name} on screen`)
      // The label sits above the box, so the box clears the strip's right edge.
      expect(box.x).toBeGreaterThanOrEqual(strip.x + strip.width)
      expect(box.y).toBeGreaterThanOrEqual(viewport.y)
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.x + viewport.width)
      expect(box.y + box.height).toBeLessThanOrEqual(
        viewport.y + viewport.height,
      )
    }
    await page.screenshot({ path: join(SHOTS, 'fit.png') })
  }, 30_000)

  it('should list tokens on the Theme tab', async () => {
    await page.getByRole('tab', { name: 'Theme' }).click()

    const tokens = page.locator('section[aria-label="Theme"] li.token')
    await expect.poll(() => tokens.count()).toBeGreaterThan(0)
    await page.screenshot({ path: join(SHOTS, 'theme.png') })
  })

  function frameFile(): string {
    return readFileSync(
      join(root, '.canon', 'canvas', PAGE, `${FRAME}.html`),
      'utf8',
    )
  }

  it('should undo an edit from the keyboard, redo it from the button, and drop it once the file moved on', async () => {
    writeFileSync(join(root, '.canon', 'canvas', PAGE, `${FRAME}.html`), HELLO)
    await page.getByRole('tab', { name: 'Pages' }).click()
    const background = page.getByRole('textbox', {
      name: 'background',
      exact: true,
    })
    await expect
      .poll(
        async () => {
          await page
            .getByRole('list', { name: `Layers of ${FRAME}`, exact: true })
            .locator('button.layer', { hasText: /^h1\.title/ })
            .click({ timeout: 2_000 })
            .catch(() => undefined)
          return background.isVisible()
        },
        { timeout: 15_000 },
      )
      .toBe(true)

    await background.fill('336699')
    await background.press('Enter')
    await expect.poll(frameFile, { timeout: 10_000 }).toContain('336699')
    const undo = page.getByRole('button', { name: 'Undo (Ctrl+Z)' })
    await expect.poll(() => undo.isEnabled()).toBe(true)
    await page
      .getByRole('toolbar', { name: 'Tools' })
      .screenshot({ path: join(SHOTS, 'undo-controls.png') })

    await page.locator('main.surface').focus()
    await page.keyboard.press('Control+z')
    await expect.poll(frameFile, { timeout: 10_000 }).toBe(HELLO)

    await page.getByRole('button', { name: 'Redo (Ctrl+Shift+Z)' }).click()
    await expect.poll(frameFile, { timeout: 10_000 }).toContain('336699')

    const moved = frameFile().replace('336699', '993366')
    writeFileSync(join(root, '.canon', 'canvas', PAGE, `${FRAME}.html`), moved)
    const [response] = await Promise.all([
      page.waitForResponse(
        (sent) =>
          sent.url().endsWith('/api/history/undo') &&
          sent.request().method() === 'POST',
      ),
      undo.click(),
    ])
    const notice = page.locator('.history-notice')
    await expect.poll(() => notice.textContent()).toContain('Could not undo')
    await page.screenshot({ path: join(SHOTS, 'undo-dropped.png') })

    expect(response.status()).toBe(200)
    expect(frameFile()).toBe(moved)
  }, 45_000)

  it('should hide both panels on backslash, give the surface the width, and keep it across a reload', async () => {
    await page.locator('main.surface').focus()

    await page.keyboard.press('Backslash')

    const shell = page.locator('.shell')
    await expect
      .poll(() => shell.getAttribute('class'))
      .toContain('panels-hidden')
    const viewport = await page.locator('.viewport').boundingBox()
    expect(viewport?.width).toBe(1600)
    await page.screenshot({ path: join(SHOTS, 'panels-hidden.png') })

    await page.reload({ waitUntil: 'load' })
    await expect
      .poll(() => shell.getAttribute('class'), { timeout: 15_000 })
      .toContain('panels-hidden')
    await page.getByRole('button', { name: 'Show panels (\\)' }).click()
    await expect
      .poll(() => shell.getAttribute('class'))
      .not.toContain('panels-hidden')
  }, 30_000)

  it('should widen the pages panel by a drag on its handle', async () => {
    const panel = page.locator('nav.panel-left')
    const before = (await panel.boundingBox())?.width ?? 0
    const handle = page.getByRole('separator', { name: 'Resize pages panel' })
    const box = await handle.boundingBox()
    if (!box) throw new Error('the handle has no box')

    await page.mouse.move(box.x + 2, box.y + 200)
    await page.mouse.down()
    await page.mouse.move(box.x + 42, box.y + 200)
    await page.mouse.move(box.x + 82, box.y + 200)
    await page.mouse.up()

    await expect
      .poll(async () => (await panel.boundingBox())?.width)
      .toBe(before + 80)
    await page.screenshot({ path: join(SHOTS, 'panels-resized.png') })
  }, 30_000)
})
