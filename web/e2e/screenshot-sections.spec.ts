import { execFile } from 'node:child_process'
import { mkdtemp, readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

const run = promisify(execFile)

/** Every settle on an observer or a transition is bounded explicitly. */
const SETTLE = { timeout: 5_000 }

/** The capture itself launches a browser and shoots eighteen frames. */
const CAPTURE_TIMEOUT = 180_000

const HARNESS = fileURLToPath(
  new URL('../../tooling/web/configs/e2e/screenshot.ts', import.meta.url),
)

/**
 * The viewport the `home` cases declare. A frame is compared against a box
 * read in this page, so a section whose height follows the viewport has to be
 * measured at the height the harness used.
 */
const VIEWPORT = { width: 1280, height: 800 }

/**
 * The sections the `home` cases name, one frame each. Restated rather than
 * imported, because the harness is a script with a top-level browser launch
 * and exports nothing.
 */
const SECTIONS = [
  'top',
  'proof',
  'ask',
  'rules',
  'skills',
  'plan',
  'dispatch',
  'workers',
  'gate',
  'memory',
  'evidence',
  'loop',
  'merge',
  'provenance',
  'start',
  'field',
  'close',
] as const

interface Size {
  readonly width: number
  readonly height: number
}

/**
 * A screenshot rounds its clip out to whole device pixels at both edges, so a
 * section whose box is fractional comes back up to this much taller than the
 * box it was cut from.
 */
const CLIP_SLACK = 2

/** Reads a PNG's declared dimensions out of the IHDR chunk that opens every PNG at a fixed offset. */
async function measurePng(file: string): Promise<Size> {
  const bytes = await readFile(file)
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ])
  if (!bytes.subarray(0, 8).equals(signature)) {
    throw new Error(`${file} is not a PNG`)
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

async function measureSection(page: Page, name: string): Promise<Size> {
  const box = await page.locator(`#${name}`).boundingBox()
  if (box === null) {
    throw new Error(
      `#${name} renders no box for the frame to be compared against`,
    )
  }
  return { width: box.width, height: box.height }
}

/**
 * Brings the page to the state the harness shoots from. Its own settle scrolls
 * every named section into view, which is what fires the observer behind a
 * build and loads a frame marked lazy, then returns to the top.
 */
async function settle(page: Page): Promise<void> {
  for (const name of SECTIONS) {
    await page.locator(`#${name}`).scrollIntoViewIfNeeded()
  }
  await page.evaluate(() => window.scrollTo(0, 0))
}

test.use({ viewport: VIEWPORT })

test.describe('the section capture', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'the harness drives chromium itself, so a second project recaptures the same frames',
  )

  test('writes one frame per named section beside the whole-page frame', async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(CAPTURE_TIMEOUT)
    expect(baseURL).toBeTruthy()
    const out = await mkdtemp(path.join(tmpdir(), 'canon-section-capture-'))

    // `--require-base-url` skips the case flagged `evidence: true`, leaving the
    // dark case alone to run, which halves what this test waits for.
    await run('bun', [HARNESS, '--require-base-url'], {
      cwd: out,
      env: { ...process.env, SCREENSHOT_BASE_URL: baseURL },
    })
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    // A lazy image and a lazy frame each take their own height once they load,
    // so a box read before the same settle the harness runs is the height of a
    // section that has not finished arriving.
    await settle(page)

    const home = path.join(out, 'screenshots', 'localhost', 'home')

    // Read what the run wrote before measuring what was asked for. The list
    // below is a copy of the harness's own, so a section dropped from the
    // harness fails the measurement loudly while one added to it would fail
    // nothing, and the eighteenth frame would reach the committed baseline
    // with nothing having checked where it was cut from.
    const written = await readdir(home, { withFileTypes: true })
    expect(
      written
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort(),
    ).toEqual([...SECTIONS].sort())

    const frames = await Promise.all(
      SECTIONS.map(async (name) => ({
        name,
        frame: await measurePng(path.join(home, name, 'dark.png')),
        section: await measureSection(page, name),
      })),
    )

    const cut = (frame: number, section: number) =>
      frame >= Math.floor(section) && frame <= Math.ceil(section) + CLIP_SLACK

    const mismatched = frames
      .filter(
        ({ frame, section }) =>
          !cut(frame.width, section.width) ||
          !cut(frame.height, section.height),
      )
      .map(
        ({ name, frame, section }) =>
          `${name} ${frame.width}x${frame.height} cut from ${section.width}x${section.height}`,
      )
    expect(mismatched).toEqual([])

    const whole = await measurePng(path.join(home, 'dark.png'))
    expect(whole.width).toBe(VIEWPORT.width)
    expect(whole.height).toBeGreaterThan(VIEWPORT.height)
  })

  test('shoots a figure that builds on arrival at its end state', async ({
    page,
  }) => {
    await page.goto('/')
    const pieces = page.locator('#merge [data-build]')
    await expect(pieces.first()).toBeAttached(SETTLE)
    const count = await pieces.count()

    await settle(page)

    await expect
      .poll(
        async () =>
          pieces.evaluateAll(
            (nodes) =>
              nodes.filter((node) => getComputedStyle(node).opacity === '1')
                .length,
          ),
        SETTLE,
      )
      .toBe(count)
    await expect(
      page.frameLocator('#fig-tokens iframe').locator('table').first(),
    ).toBeVisible(SETTLE)
  })
})
