import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/** Every settle on an observer or a transition is bounded explicitly. */
const SETTLE = { timeout: 5_000 }

/**
 * Journeys and whole-page behavior only a real browser computes: anchors,
 * the stored theme, the film's playback by width and motion preference, and
 * layout at the width floor. What the copy says is unit tested beside
 * `web/src/content/copy.ts`, so nothing here asserts wording.
 */

/** The film for the theme the page shows, and the one it hides. */
async function films(page: Page) {
  const theme = await page.locator('html').getAttribute('data-theme')
  const other = theme === 'light' ? 'dark' : 'light'
  return {
    shown: page.locator(`[data-theme-film="${theme}"]`),
    hidden: page.locator(`[data-theme-film="${other}"]`),
  }
}

test('renders the nine sections', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('main > section')).toHaveCount(9)
})

test('every nav link resolves to a section or an absolute address', async ({
  page,
}) => {
  await page.goto('/')
  const links = page.locator('nav[aria-label="Site"] a')
  const hrefs = await links.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('href') ?? ''),
  )
  expect(hrefs.length).toBeGreaterThan(0)

  const anchors = hrefs.filter((href) => href.startsWith('#'))
  expect(anchors.length).toBeGreaterThan(0)
  for (const href of anchors) {
    await expect(page.locator(href)).toHaveCount(1)
  }
  const outward = hrefs.filter((href) => !href.startsWith('#'))
  expect(outward.filter((href) => !href.startsWith('https://'))).toEqual([])
})

test('following the change lands on the bridge into the six steps', async ({
  page,
}) => {
  await page.goto('/')

  await page.locator('nav[aria-label="Site"] a[href="#how"]').click()

  await expect(page.locator('#how')).toBeInViewport(SETTLE)
})

test('the toggle flips the theme and a reload keeps it', async ({ page }) => {
  await page.goto('/')
  const root = page.locator('html')
  const before = await root.getAttribute('data-theme')
  expect(before).toMatch(/^(light|dark)$/)

  await page.locator('.theme-toggle').click()
  await expect(root).not.toHaveAttribute('data-theme', before as string)
  const after = await root.getAttribute('data-theme')

  await page.reload()
  await expect(root).toHaveAttribute('data-theme', after as string, SETTLE)
})

test.describe('the film at desktop width', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('is muted and looping, and fetches nothing for the hidden theme', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    const { shown, hidden } = await films(page)

    await expect(shown).toHaveJSProperty('muted', true)
    await expect(shown).toHaveJSProperty('loop', true)
    await expect(hidden).toHaveJSProperty('readyState', 0)
    await expect(hidden).toHaveJSProperty('paused', true)
  })

  // Playback needs an H.264 decoder, which only the Chromium build carries on
  // every runner. The attributes above hold on all three engines.
  test('plays on its own, and the theme flip swaps which film plays', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'H.264 playback is Chromium only')
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    const first = await films(page)
    await expect(first.shown).toHaveJSProperty('paused', false, SETTLE)

    await page.locator('.theme-toggle').click()

    await expect(first.hidden).toHaveJSProperty('paused', false, SETTLE)
    await expect(first.shown).toHaveJSProperty('paused', true, SETTLE)
  })

  test('the pause control stops the film it shows', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'H.264 playback is Chromium only')
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    const { shown } = await films(page)
    const control = page.locator('[data-film-pause]')
    await expect(shown).toHaveJSProperty('paused', false, SETTLE)
    const name = await control.textContent()

    await control.click()

    await expect(shown).toHaveJSProperty('paused', true, SETTLE)
    await expect(control).toHaveAttribute('aria-pressed', 'true')
    // A toggle carries its state in aria-pressed alone, so its name holds.
    await expect(control).toHaveText(name ?? '')
  })

  test('waits on its poster with a play control under reduced motion', async ({
    page,
  }) => {
    await page.goto('/')
    const { shown } = await films(page)

    await expect(page.locator('[data-film-play]')).toBeVisible()
    await expect(shown).toHaveJSProperty('paused', true)
    await expect(shown).toHaveJSProperty('readyState', 0)
  })
})

test.describe('the film on a 390 pixel phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('requests no film until the poster is tapped', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    const videos = page.locator('[data-theme-film]')
    await expect(videos).toHaveCount(2)

    await expect(page.locator('[data-film-play]')).toBeVisible()
    for (const index of [0, 1]) {
      await expect(videos.nth(index)).toHaveJSProperty('paused', true)
      await expect(videos.nth(index)).toHaveJSProperty('readyState', 0)
    }
  })
})

test.describe('at the 320 pixel floor', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`the ${theme} page scrolls no wider than the viewport`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme })
      await page.setViewportSize({ width: 320, height: 800 })
      await page.goto('/')
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      )
      expect(overflow).toBe(0)
    })
  }
})

test.describe('the social card', () => {
  const card = '/assets/social-card.png'

  test('both card tags name the composed card on the deployed origin', async ({
    page,
  }) => {
    await page.goto('/')
    const expected = new URL(card, 'https://canon.erclx.dev').href

    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      expected,
    )
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
      'content',
      expected,
    )
  })

  test('the card tags declare the size the served image has', async ({
    page,
    request,
  }) => {
    await page.goto('/')
    const response = await request.get(card)
    expect(response.ok()).toBe(true)

    // A PNG carries its width and height as two big-endian words in the IHDR
    // chunk, at a fixed offset after the eight-byte signature.
    const png = await response.body()
    const size = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }

    expect(size).toEqual({ width: 1200, height: 630 })
    await expect(
      page.locator('meta[property="og:image:width"]'),
    ).toHaveAttribute('content', String(size.width))
    await expect(
      page.locator('meta[property="og:image:height"]'),
    ).toHaveAttribute('content', String(size.height))
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
      'content',
      /\S/,
    )
  })
})
