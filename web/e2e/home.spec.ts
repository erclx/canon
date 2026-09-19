import { expect, test } from '@playwright/test'

/** Every settle on an observer or a transition is bounded explicitly. */
const SETTLE = { timeout: 5_000 }

/**
 * Journeys and whole-page behavior only a real browser computes: anchors,
 * scroll-spy, the stored theme, the figure build and its still escape, layout
 * at the width floor, and a lazy frame. What each figure derives is unit
 * tested beside `web/src/lib/derive.ts`, so nothing here asserts copy.
 */

test('renders the eleven sections', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('main > section')).toHaveCount(11)
})

test('every nav link lands on a beat of the session', async ({ page }) => {
  await page.goto('/')
  const links = page.locator('nav[aria-label="Sections"] a')
  const count = await links.count()
  expect(count).toBeGreaterThan(0)

  for (let i = 0; i < count; i++) {
    const href = await links.nth(i).getAttribute('href')
    expect(href).toMatch(/^#/)
    await expect(page.locator(href as string)).toHaveCount(1)
  }
})

test('following a nav link marks that beat as the one being read', async ({
  page,
}) => {
  await page.goto('/')
  const link = page.locator('nav[aria-label="Sections"] a[href="#workers"]')

  await link.click()

  await expect(page.locator('#workers')).toBeInViewport(SETTLE)
  await expect(link).toHaveAttribute('aria-current', 'true', SETTLE)
  await expect(
    page.locator('nav[aria-label="Sections"] a[aria-current="true"]'),
  ).toHaveCount(1)
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

test.describe('the closing figures', () => {
  test('build as they arrive when motion is allowed', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    const node = page.locator('#fig-merge [data-build]').first()

    await expect(node).toHaveCSS('opacity', '0')
    await node.scrollIntoViewIfNeeded()
    await expect(node).toHaveClass(/is-built/, SETTLE)
    await expect(node).toHaveCSS('opacity', '1', SETTLE)
  })

  // A full-page capture scrolls nothing, so the observer never fires. Each
  // escape has to land every piece at its end state without a scroll.
  test('reach their end state without a scroll under reduced motion', async ({
    page,
  }) => {
    await page.goto('/')
    const pieces = page.locator('[data-build]')
    const count = await pieces.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      await expect(pieces.nth(i)).toHaveCSS('opacity', '1', SETTLE)
    }
  })

  test('reach their end state without a scroll with ?still', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/?still')
    const pieces = page.locator('[data-build]')
    const count = await pieces.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      await expect(pieces.nth(i)).toHaveCSS('opacity', '1', SETTLE)
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

test('the token preview loads once the merge beat is reached', async ({
  page,
}) => {
  await page.goto('/')
  // The frame is lazy, so it loads only once the beat nears the viewport.
  await page.locator('#fig-tokens').scrollIntoViewIfNeeded()
  const frame = page.frameLocator('#fig-tokens iframe')
  await expect(frame.locator('table').first()).toBeVisible(SETTLE)
})

test('each field lists as many names as its heading counts', async ({
  page,
}) => {
  await page.goto('/')
  const fields = page.locator('[data-field]')
  await expect(fields).toHaveCount(2)

  for (let i = 0; i < 2; i++) {
    const field = fields.nth(i)
    const label = await field.locator('.label').innerText()
    const [total, used] = (label.match(/\d+/g) ?? []).map(Number)
    expect(total).toBeGreaterThan(0)

    await expect(field.locator('li')).toHaveCount(total as number)
    await expect(field.locator('li.on')).toHaveCount(used as number)
  }
})
