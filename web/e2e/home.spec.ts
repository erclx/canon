import { expect, test } from '@playwright/test'

/** Every settle on an observer or a transition is bounded explicitly. */
const SETTLE = { timeout: 5_000 }

/**
 * Journeys and whole-page behavior only a real browser computes: the section
 * list and its anchors, the fixed bar at its folds, the stored theme, the
 * records stage pinned by scroll, and layout at the width floor. What the copy
 * says is unit tested beside `web/src/content/copy.ts`, so nothing here
 * asserts wording.
 */

const SECTIONS = [
  'top',
  'roles',
  'records',
  'craft',
  'guardrails',
  'worktrees',
  'setup',
  'try',
]

test('renders the opening, six sections, and try in order', async ({
  page,
}) => {
  await page.goto('/')

  const ids = await page
    .locator('main > section')
    .evaluateAll((nodes) => nodes.map((node) => node.id))

  expect(ids).toEqual(SECTIONS)
})

test('every nav link and menu entry resolves to a section or an absolute address', async ({
  page,
}) => {
  await page.goto('/')
  const hrefs = await page
    .locator('nav[aria-label="Site"] a')
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('href') ?? ''),
    )

  const anchors = [...new Set(hrefs.filter((href) => href.startsWith('#')))]
  const outward = hrefs.filter((href) => !href.startsWith('#'))
  const missing = await page.evaluate(
    (ids) => ids.filter((id) => !document.querySelector(id)),
    anchors,
  )

  expect(anchors.length).toBeGreaterThan(6)
  expect(missing).toEqual([])
  expect(outward.filter((href) => !href.startsWith('https://'))).toEqual([])
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

test('the opening prompt shows a focus ring when it takes focus', async ({
  page,
}) => {
  await page.goto('/')

  await page.locator('#av-ask').focus()

  await expect(page.locator('#top .fld')).toHaveCSS('outline-style', 'solid')
})

test.describe('the fixed bar', () => {
  test('lands a section jump with its heading below the bar', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    await page.locator('.links > a.sl[href="#guardrails"]').click()

    await expect(page.locator('#guardrails h2')).toBeInViewport(SETTLE)
    const bar = await page.locator('.site-nav').boundingBox()
    const section = await page.locator('#guardrails').boundingBox()
    expect(bar).not.toBeNull()
    expect(section).not.toBeNull()
    // The section's top lands at the bar's bottom, which only scroll-padding-top puts there.
    expect(Math.abs(section!.y - (bar!.y + bar!.height))).toBeLessThan(2)
  })

  for (const width of [1041, 1039, 641, 639]) {
    test(`fits the bar at ${width} with no sideways scroll`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/')

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      )

      expect(overflow).toBe(0)
    })
  }

  test('shows the six section links above 1040', async ({ page }) => {
    await page.setViewportSize({ width: 1041, height: 800 })
    await page.goto('/')

    await expect(page.locator('.links > a.sl:visible')).toHaveCount(6)
    await expect(page.locator('.nbtn')).toBeHidden()
  })

  test('folds the sections into a menu that reaches each one below 1040', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1039, height: 800 })
    await page.goto('/')

    await expect(page.locator('.links > a.sl:visible')).toHaveCount(0)
    await page.locator('.nbtn').click()
    await page.locator('#nav-panel a[href="#setup"]').click()

    await expect(page.locator('#setup')).toBeInViewport(SETTLE)
    await expect(page.locator('.nbtn')).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  test('moves Docs and GitHub into the menu on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 639, height: 800 })
    await page.goto('/')

    await expect(page.locator('.links > a.ext:visible')).toHaveCount(0)
    await page.locator('.nbtn').click()

    await expect(page.locator('#nav-panel a.pext:visible')).toHaveCount(2)
  })

  test('closes the menu on Escape and returns focus to its button', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1039, height: 800 })
    await page.goto('/')
    await page.locator('.nbtn').click()

    await page.keyboard.press('Escape')

    await expect(page.locator('.nbtn')).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    await expect(page.locator('.nbtn')).toBeFocused()
  })
})

test.describe('the records stack', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  /** The stage's top, less the place it pins to, at a scroll offset into the stack. */
  async function stageAt(
    page: import('@playwright/test').Page,
    offset: number,
  ) {
    return page.evaluate((into) => {
      const box = document.querySelector<HTMLElement>('#records .scrolly')
      const stick = box?.querySelector<HTMLElement>('.stick')
      if (!box || !stick) throw new Error('the records stage did not render')
      const start = box.getBoundingClientRect().top + window.scrollY
      const pin = parseFloat(getComputedStyle(stick).top)
      window.scrollTo(0, start - pin + into)
      return {
        drift: stick.getBoundingClientRect().top - pin,
        length: box.offsetHeight - stick.offsetHeight,
      }
    }, offset)
  }

  test('pins below the bar for the length of its sheets', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    const { length } = await stageAt(page, 0)

    const midway = await stageAt(page, Math.round(length / 2))
    const atLast = await stageAt(page, length - 1)

    expect(Math.abs(midway.drift)).toBeLessThan(1)
    expect(Math.abs(atLast.drift)).toBeLessThan(1)
  })

  test('lets go of the stage after the last sheet', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    const { length } = await stageAt(page, 0)

    const past = await stageAt(page, length + 200)

    expect(past.drift).toBeLessThan(-100)
  })

  test('turns the sheets as the page scrolls', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    const { length } = await stageAt(page, 0)

    await stageAt(page, length)

    await expect(
      page.locator('#records .tabs .pick[aria-pressed="true"]'),
    ).toHaveAttribute('data-i', '11', SETTLE)
  })

  test('takes no pinned scroll under reduced motion', async ({ page }) => {
    await page.goto('/')

    const { length } = await stageAt(page, 0)

    expect(length).toBeLessThan(10)
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
    const expected = new URL(card, 'https://canon.erclx.com').href

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
