import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { type Page, expect, test } from '@playwright/test'

/** Every settle on an observer or a transition is bounded explicitly. */
const SETTLE = { timeout: 5_000 }

/**
 * Journeys and layout only a real browser computes. The copy is unit tested
 * beside `web/src/content/copy.ts`, so nothing here asserts wording.
 */

const SECTIONS = [
  'top',
  'worktrees',
  'records',
  'craft',
  'guardrails',
  'evidence',
  'board',
  'health',
  'install',
]

test('renders the opening and eight sections in order', async ({ page }) => {
  await page.goto('/')

  const ids = await page
    .locator('main > section')
    .evaluateAll((nodes) => nodes.map((node) => node.id))

  expect(ids).toEqual(SECTIONS)
})

test('parts each section from the one above by a 1 px soft rule', async ({
  page,
}) => {
  await page.goto('/')

  const tops = await page
    .locator('main > section')
    .evaluateAll((nodes) =>
      nodes.map((node) => getComputedStyle(node).borderTopWidth),
    )

  expect(tops).toEqual(['0px', ...SECTIONS.slice(1).map(() => '1px')])
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

  for (const width of [1101, 1099, 901, 899, 641, 639]) {
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

  test('shows all eight section links above 1100', async ({ page }) => {
    await page.setViewportSize({ width: 1101, height: 800 })
    await page.goto('/')

    await expect(page.locator('.links > a.sl:visible')).toHaveCount(8)
    await expect(page.locator('.nbtn')).toBeHidden()
  })

  test('drops Worktrees and Health from the bar under 1100', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1099, height: 800 })
    await page.goto('/')

    const shown = page.locator('.links > a.sl:visible')
    await expect(shown).toHaveCount(6)
    await expect(shown.filter({ hasText: /Worktrees|Health/ })).toHaveCount(0)
  })

  test('folds the sections, Docs, and GitHub into Menu under 900', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 899, height: 800 })
    await page.goto('/')

    await expect(page.locator('.links > a.sl:visible')).toHaveCount(0)
    await expect(page.locator('.links > a.ext:visible')).toHaveCount(0)
    await page.locator('.nbtn').click()
    await expect(page.locator('#nav-panel a.pext:visible')).toHaveCount(2)
    await page.locator('#nav-panel a[href="#install"]').click()

    await expect(page.locator('#install')).toBeInViewport(SETTLE)
    await expect(page.locator('.nbtn')).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  test('closes the menu on Escape and returns focus to its button', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 899, height: 800 })
    await page.goto('/')
    await page.locator('.nbtn').click()

    await page.keyboard.press('Escape')

    await expect(page.locator('.nbtn')).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    await expect(page.locator('.nbtn')).toBeFocused()
  })

  for (const width of [834, 700]) {
    test(`keeps the open menu inside the viewport at ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/')

      await page.locator('.nbtn').click()
      const panel = await page.locator('#nav-panel').boundingBox()

      expect(panel).not.toBeNull()
      expect(panel!.x).toBeGreaterThanOrEqual(0)
      expect(panel!.x + panel!.width).toBeLessThanOrEqual(width)
    })
  }

  test('shows its rule only once the page scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const bar = page.locator('.site-nav')
    await expect(bar).not.toHaveClass(/(^| )scrolled( |$)/)
    await expect(bar).toHaveCSS('border-bottom-color', 'rgba(0, 0, 0, 0)')

    await page.mouse.wheel(0, 400)

    await expect(bar).toHaveClass(/(^| )scrolled( |$)/, SETTLE)
    await expect(bar).not.toHaveCSS('border-bottom-color', 'rgba(0, 0, 0, 0)')
  })
})

test.describe('the footer columns', () => {
  test('sets three link columns beside the mark at 1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    const tops = await page
      .locator('.site-footer .col')
      .evaluateAll((columns) =>
        columns.map((column) => Math.round(column.getBoundingClientRect().top)),
      )
    const lead = await page.locator('.site-footer .lead').boundingBox()

    expect(tops).toHaveLength(3)
    expect(new Set(tops).size).toBe(1)
    expect(lead).not.toBeNull()
    expect(Math.abs(lead!.y - tops[0]!)).toBeLessThan(2)
  })

  test('every footer section link reaches its section, and none reads as a nav link', async ({
    page,
  }) => {
    await page.goto('/')
    const anchors = await page
      .locator('.site-footer .col a[href^="#"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')))

    const missing = await page.evaluate(
      (ids) => ids.filter((id) => !id || !document.querySelector(id)),
      anchors,
    )

    expect(anchors.length).toBeGreaterThan(6)
    expect(missing).toEqual([])
    await expect(page.locator('.site-footer a.sl')).toHaveCount(0)
    await expect(page.locator('.links > a.sl')).toHaveCount(8)
  })

  test('a footer section link lands its section under the bar', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    await page.locator('.site-footer .col a[href="#worktrees"]').click()

    await expect(page.locator('#worktrees h2')).toBeInViewport(SETTLE)
    expect(new URL(page.url()).hash).toBe('#worktrees')
  })

  for (const width of [900, 840, 641]) {
    test(`sets three link columns in one row under the mark at ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')

      const boxes = await page
        .locator('.site-footer .col')
        .evaluateAll((columns) =>
          columns.map((column) => {
            const box = column.getBoundingClientRect()
            return { top: Math.round(box.top), left: Math.round(box.left) }
          }),
        )
      const lead = await page.locator('.site-footer .lead').boundingBox()

      expect(boxes).toHaveLength(3)
      expect(new Set(boxes.map((box) => box.top)).size).toBe(1)
      expect(new Set(boxes.map((box) => box.left)).size).toBe(3)
      expect(lead).not.toBeNull()
      expect(lead!.y + lead!.height).toBeLessThanOrEqual(boxes[0]!.top)
    })
  }

  test('carries no base line under the columns', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('.site-footer .col')).toHaveCount(3)
    await expect(page.locator('.site-footer .base')).toHaveCount(0)
  })

  test('pairs the columns two by two at 390', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 })
    await page.goto('/')

    const lefts = await page
      .locator('.site-footer .col')
      .evaluateAll((columns) =>
        columns.map((column) =>
          Math.round(column.getBoundingClientRect().left),
        ),
      )

    expect(lefts).toHaveLength(3)
    expect(lefts[0]).toBe(lefts[2])
    expect(lefts[1]).toBeGreaterThan(lefts[0]!)
  })
})

test('the footer mark carries no underline under hover', async ({ page }) => {
  await page.goto('/')
  const brand = page.locator('.site-footer a.brand')
  const link = page.locator('.site-footer a:not(.brand)').first()
  await brand.scrollIntoViewIfNeeded()

  await link.hover()
  const linkLine = await link.evaluate(
    (node) => getComputedStyle(node).textDecorationLine,
  )
  await brand.hover()
  const brandLine = await brand.evaluate(
    (node) => getComputedStyle(node).textDecorationLine,
  )

  expect(linkLine).toBe('underline')
  expect(brandLine).toBe('none')
})

test.describe('the craft section', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('a chip swaps the quote and points both links at that skill', async ({
    page,
  }) => {
    await page.goto('/')
    const chips = page.locator('#craft .chip')
    await expect(chips).toHaveCount(8)

    await chips.last().click()

    const shown = page.locator('#craft .pair:visible')
    await expect(shown).toHaveCount(1)
    await expect(shown.locator('a.path')).toHaveAttribute(
      'href',
      /\/blob\/main\/claude\/skills\/systematic-debugging\//,
    )
    await expect(shown.locator('a.src')).toHaveAttribute(
      'href',
      /obra\/superpowers/,
    )
    await expect(chips.last()).toHaveAttribute('aria-pressed', 'true')
  })

  test('sets every quote beside its rule at 1440', async ({ page }) => {
    await page.goto('/')
    const chips = page.locator('#craft .chip')
    const count = await chips.count()
    expect(count).toBe(8)

    for (let index = 0; index < count; index += 1) {
      await chips.nth(index).click()
      const shown = page.locator('#craft .pair:visible')
      await expect(shown).toHaveCount(1)
      const quote = await shown.locator('blockquote').boundingBox()
      const rule = await shown.locator('.rule').boundingBox()
      expect(quote).not.toBeNull()
      expect(rule).not.toBeNull()

      expect(rule!.x).toBeGreaterThan(quote!.x + quote!.width)
      expect(rule!.y).toBeLessThan(quote!.y + quote!.height)
    }
  })

  test('stacks the rule under its quote at 834', async ({ page }) => {
    await page.setViewportSize({ width: 834, height: 900 })
    await page.goto('/')
    const shown = page.locator('#craft .pair:visible')
    const quote = await shown.locator('blockquote').boundingBox()
    const rule = await shown.locator('.rule').boundingBox()
    expect(quote).not.toBeNull()
    expect(rule).not.toBeNull()

    expect(rule!.y).toBeGreaterThan(quote!.y + quote!.height)
  })

  test('sets the quote larger than the rule it became', async ({ page }) => {
    await page.goto('/')
    const size = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((node) => parseFloat(getComputedStyle(node).fontSize))

    expect(await size('#craft .pair:visible blockquote')).toBeGreaterThan(
      await size('#craft .pair:visible .rule .text'),
    )
  })
})

test.describe('the opening relay', () => {
  test('passes the change card to card, and Pause holds it', async ({
    page,
  }) => {
    await page.clock.install()
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    const cards = page.locator('#top .relay .st')
    const pause = page.locator('#top .pz-relay')
    await expect(cards).toHaveCount(5)
    await expect(cards.nth(0)).toHaveClass(/(^| )act( |$)/, SETTLE)

    await page.clock.runFor(1_400)
    await expect(cards.nth(1)).toHaveClass(/(^| )act( |$)/, SETTLE)
    await pause.click()
    await page.clock.runFor(5_000)

    await expect(cards.nth(1)).toHaveClass(/(^| )act( |$)/)
    await expect(pause).toHaveText('Play')
    await expect(pause).toHaveAccessibleName('Play the handoff')
  })

  test('rests with every card unlit and no pause under reduced motion', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.locator('#top .relay .st')).toHaveCount(5)

    await expect(page.locator('#top .relay .st.act')).toHaveCount(0)
    await expect(page.locator('#top .pz-relay')).toBeHidden()
  })

  test('stacks the orchestrator above the cards at 390', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 })
    await page.goto('/')
    const bar = await page.locator('#top .ob').boundingBox()
    const first = await page.locator('#top .relay .st').first().boundingBox()
    expect(bar).not.toBeNull()
    expect(first).not.toBeNull()

    expect(bar!.y + bar!.height).toBeLessThanOrEqual(first!.y)
  })
})

test.describe('the worktree graph', () => {
  test('draws its branches out of main once the graph is in view', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const section = page.locator('#worktrees')
    const tracks = page.locator('#worktrees .track')
    await expect(section).toHaveClass(/(^| )armed( |$)/)
    await expect(section).not.toHaveClass(/(^| )in( |$)/)

    await page.locator('#worktrees .graph').scrollIntoViewIfNeeded()

    await expect(section).toHaveClass(/(^| )in( |$)/, SETTLE)
    await expect(tracks).toHaveCount(3)
    await expect(tracks.first()).toHaveCSS('transform', 'none', SETTLE)
  })

  test('shows its branches drawn under reduced motion', async ({ page }) => {
    await page.goto('/')
    const tracks = page.locator('#worktrees .track')
    await expect(tracks).toHaveCount(3)

    await expect(page.locator('#worktrees')).not.toHaveClass(/(^| )armed( |$)/)
    await expect(tracks.first()).toHaveCSS('transform', 'none')
    await expect(page.locator('#worktrees .meta').first()).toHaveCSS(
      'opacity',
      '1',
    )
  })
})

test.describe('the guardrail stamps', () => {
  test('land in firing order once the grid is in view', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const stamps = page.locator('#guardrails .stamp')
    await expect(stamps).toHaveCount(4)
    await expect(page.locator('#guardrails')).toHaveClass(/(^| )armed( |$)/)
    await expect(stamps.first()).toHaveCSS('opacity', '0')

    await page.locator('#guardrails .grid').scrollIntoViewIfNeeded()
    await expect(page.locator('#guardrails')).toHaveClass(
      /(^| )in( |$)/,
      SETTLE,
    )
    const delays = await stamps.evaluateAll((nodes) =>
      nodes.map((node) => parseFloat(getComputedStyle(node).transitionDelay)),
    )

    expect(delays).toEqual([...delays].sort((a, b) => a - b))
    expect(new Set(delays).size).toBe(4)
    await expect(stamps.last()).toHaveCSS('opacity', '1', SETTLE)
  })

  test('show all four landed under reduced motion', async ({ page }) => {
    await page.goto('/')
    const stamps = page.locator('#guardrails .stamp')
    await expect(stamps).toHaveCount(4)

    await expect(page.locator('#guardrails')).not.toHaveClass(/(^| )armed( |$)/)
    await expect(stamps.last()).toHaveCSS('opacity', '1')
  })

  test('stack one stamp a row at 390', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 })
    await page.goto('/')
    const boxes = await page
      .locator('#guardrails .stamp')
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getBoundingClientRect().left),
      )

    expect(boxes).toHaveLength(4)
    expect(new Set(boxes).size).toBe(1)
  })
})

test.describe('the records fan', () => {
  test('a chip brings its record to the front', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const chips = page.locator('#records .chip')
    await expect(chips).toHaveCount(12)
    const front = page.locator('#records .sheet[data-at="0"]')
    await expect(front).toHaveAttribute('aria-label', 'Plan')

    await chips.filter({ hasText: 'Board' }).click()

    await expect(front).toHaveAttribute('aria-label', 'Board')
    await expect(front).toContainText('In flight')
    await expect(chips.filter({ hasText: 'Board' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(
      page.locator('#records .sheet:not([aria-hidden])'),
    ).toHaveCount(1)
  })

  test('fans the two records either side of the front one', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    const shown = await page
      .locator('#records .sheet')
      .evaluateAll((nodes) =>
        nodes
          .filter((node) => getComputedStyle(node).visibility === 'visible')
          .map((node) => node.getAttribute('aria-label')),
      )

    expect(shown).toEqual(['Intake', 'Groundwork', 'Plan', 'Task', 'Board'])
  })

  test('shows the front record alone at 390', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 })
    await page.goto('/')
    await expect(page.locator('#records .sheet')).toHaveCount(12)

    await expect(page.locator('#records .sheet:visible')).toHaveCount(1)
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
  const card = '/og-image.png'

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

    // IHDR holds width and height as big-endian words at bytes 16 and 20.
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

test.describe('the page name', () => {
  test('the tab reads the capitalized name alone', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle('Canon')
  })

  test('the share label reads the host rather than repeating the name', async ({
    page,
  }) => {
    await page.goto('/')

    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
      'content',
      'canon.erclx.com',
    )
  })
})

test.describe('the board night', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  /** The first move lands this long after the board arrives, and each next one a beat later. */
  const FIRST = 600
  const BEAT = 1200
  const MOVES = 6

  const settleFonts = (page: Page) =>
    page.evaluate(async () => {
      await document.fonts.ready
    })

  const arrive = async (page: Page) => {
    await page.locator('#board .after .bd').scrollIntoViewIfNeeded()
    await expect(page.locator('#board .after .stamp')).toHaveText(
      /^23:00 /,
      SETTLE,
    )
  }

  test('replays the night a move a beat, and Replay starts it again', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.clock.install()
    await page.goto('/')
    const stamp = page.locator('#board .after .stamp')

    await arrive(page)
    await page.clock.runFor(FIRST)
    await expect(stamp).toHaveText(
      /^23:40 · the orchestrator moves take-timer$/,
    )
    await page.clock.runFor(MOVES * BEAT)
    await expect(stamp).toHaveText(/what you come back to$/)
    await expect(page.locator('#board .after .cd.wt')).toHaveCount(1)
    await page.locator('#board .replay').click()

    await expect(stamp).toHaveText(/^23:00 /)
  })

  for (const width of [1440, 390]) {
    test(`holds the section at one height through the night at ${width}`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.setViewportSize({ width, height: 900 })
      await page.clock.install()
      await page.goto('/')
      await settleFonts(page)
      const section = page.locator('#board')
      const height = async () => (await section.boundingBox())?.height ?? 0
      const before = await height()
      expect(before).toBeGreaterThan(0)

      await arrive(page)
      const during: number[] = []
      for (let step = 0; step < MOVES * 4 + 2; step += 1) {
        await page.clock.runFor(BEAT / 4)
        during.push(await height())
      }

      await expect(page.locator('#board .after .stamp')).toHaveText(
        /what you come back to$/,
      )
      expect(new Set([...during, await height()])).toEqual(new Set([before]))
    })
  }

  test('starts the night only once the moving board is in view', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.clock.install()
    await page.goto('/')
    const stamp = page.locator('#board .after .stamp')
    await expect(page.locator('#board')).toHaveClass(/(^| )armed( |$)/)

    await page.evaluate(() => {
      const board = document.getElementById('board')
      if (!board) throw new Error('the page carries no #board section')
      window.scrollBy(0, board.getBoundingClientRect().top - innerHeight + 300)
    })
    await page.clock.runFor(FIRST + 2 * BEAT)
    await expect(stamp).toHaveText(/^23:00 /)
    await page.locator('#board .after .bd').scrollIntoViewIfNeeded()
    await page.clock.runFor(FIRST)

    await expect(stamp).toHaveText(/^23:40 /, SETTLE)
  })

  test('opens a slot, carries the row, and keeps it in place through a scroll', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.clock.install()
    await page.goto('/')
    const after = page.locator('#board .after')
    const ghost = page.locator('#board .ghost')
    const fly = page.locator('#board .fly')
    const moved = page.locator('#board .after .cd.mv')
    /** A box in the second board's frame, where the slot and the landed row are drawn. */
    const offset = async (node: typeof ghost) => {
      const frame = await after.boundingBox()
      const box = await node.boundingBox()
      if (!frame || !box) throw new Error('the board or the row is not drawn')
      return { x: box.x - frame.x, y: box.y - frame.y }
    }

    await arrive(page)
    await page.clock.runFor(FIRST)
    await expect(ghost).toHaveCount(1)
    const slot = await offset(ghost)
    await page.clock.runFor(300)
    await expect(fly).toHaveCount(1)
    const scrolled = await page.evaluate(() => scrollY)
    await page.mouse.wheel(0, 120)
    await expect
      .poll(() => page.evaluate(() => scrollY), SETTLE)
      .toBeGreaterThan(scrolled)
    await page.clock.runFor(500)

    await expect(fly).toHaveCount(0)
    await expect(ghost).toHaveCount(0)
    await expect(moved).toHaveAttribute('data-name', 'take-timer')
    expect(await offset(moved)).toEqual(slot)
  })

  test('marks a row that changes in place with no slot or travel', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.clock.install()
    await page.goto('/')

    await arrive(page)
    await page.clock.runFor(FIRST + 2 * BEAT)

    await expect(page.locator('#board .after .stamp')).toHaveText(/sync-stamp$/)
    await expect(page.locator('#board .after .cd.mv')).toHaveAttribute(
      'data-name',
      'sync-stamp',
    )
    await expect(page.locator('#board .ghost, #board .fly')).toHaveCount(0)
  })

  test('rests where the night ends under reduced motion until Replay is pressed', async ({
    page,
  }) => {
    await page.clock.install()
    await page.goto('/')
    const stamp = page.locator('#board .after .stamp')
    const replay = page.locator('#board .replay')

    await expect(stamp).toHaveText(/what you come back to\s*$/)
    await expect(page.locator('#board .after .cd.wt')).toHaveCount(1)
    await expect(replay).toBeVisible()
    await page.clock.runFor(FIRST + MOVES * BEAT)
    await expect(stamp).toHaveText(/what you come back to\s*$/)
    await replay.click()

    await expect(stamp).toHaveText(/^23:00 /)
    await page.clock.runFor(FIRST)
    await expect(stamp).toHaveText(/^23:40 /)
    await expect(page.locator('#board .ghost, #board .fly')).toHaveCount(0)
    await page.clock.runFor(MOVES * BEAT)
    await expect(stamp).toHaveText(/what you come back to\s*$/)
  })
})

test.describe('the health ranking', () => {
  test('grows its bars past the checkpoint once in view', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const bar = page.locator('#health .trk i').first()
    const check = page.locator('#health .ck').first()
    await expect(page.locator('#health .rk')).toHaveCount(3)
    await expect(bar).toHaveCSS('width', '0px')

    await page.locator('#health .rank').scrollIntoViewIfNeeded()

    await expect(page.locator('#health')).toHaveClass(/(^| )in( |$)/, SETTLE)
    await expect
      .poll(
        async () =>
          ((await bar.boundingBox())?.width ?? 0) >
          ((await check.boundingBox())?.x ?? 0) -
            ((await bar.boundingBox())?.x ?? 0),
        SETTLE,
      )
      .toBe(true)
  })

  test('shows its bars grown under reduced motion', async ({ page }) => {
    await page.goto('/')
    const bars = page.locator('#health .trk i')
    await expect(bars).toHaveCount(3)

    await expect(page.locator('#health')).not.toHaveClass(/(^| )armed( |$)/)
    expect((await bars.first().boundingBox())?.width ?? 0).toBeGreaterThan(0)
    await expect(page.locator('#health .sp li')).toHaveCount(6)
  })
})

test.describe('the evidence section', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  /** The stamp `scripts/core/regen-web-film.ts` writes beside the reel the page plays. */
  const stamp = Object.fromEntries(
    readFileSync(
      fileURLToPath(new URL('../../assets/loops/reel.stamp', import.meta.url)),
      'utf8',
    )
      .split('\n')
      .filter(Boolean)
      .map((line) => [
        line.slice(0, line.indexOf(': ')),
        line.slice(line.indexOf(': ') + 2),
      ]),
  )

  test('rests on its still, plays on its control, and stops on it again', async ({
    page,
  }) => {
    await page.goto('/')
    const frame = page.locator('#evidence .frame')
    const play = page.locator('#evidence .play')
    await expect(frame).toHaveAttribute('src', '/reel-still.webp')
    await frame.scrollIntoViewIfNeeded()
    await expect
      .poll(
        () => frame.evaluate((node: HTMLImageElement) => node.naturalWidth),
        SETTLE,
      )
      .toBeGreaterThan(0)

    await play.click()
    await expect(frame).toHaveAttribute('src', '/reel.webp')
    await expect(play).toHaveAccessibleName('Stop the reel')
    await play.click()

    await expect(frame).toHaveAttribute('src', '/reel-still.webp')
    await expect(play).toHaveAccessibleName('Play the reel')
  })

  test('returns to its still once the reel has played through', async ({
    page,
  }) => {
    await page.clock.install()
    await page.goto('/')
    const frame = page.locator('#evidence .frame')

    await page.locator('#evidence .play').click()
    await expect(frame).toHaveAttribute('src', '/reel.webp')
    await page.clock.runFor(Math.ceil(Number(stamp['reel-seconds']) * 1000))

    await expect(frame).toHaveAttribute('src', '/reel-still.webp')
  })

  test('plays nothing on its own once in view', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    const frame = page.locator('#evidence .frame')

    await frame.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)

    await expect(frame).toHaveAttribute('src', '/reel-still.webp')
  })

  test('links the pull request its stamp names', async ({ page }) => {
    await page.goto('/')
    const link = page.locator('#evidence figcaption a')
    expect(stamp['pull-request']).toMatch(/^\d+$/)

    await expect(link).toHaveAttribute('href', stamp.address ?? '')
    await expect(link).toHaveText(`pull request #${stamp['pull-request']}`)
    await expect(page.locator('#evidence')).not.toContainText('#412')
  })

  test('draws the reel no wider than it was recorded', async ({ page }) => {
    await page.goto('/')
    const frame = await page.locator('#evidence .frame').boundingBox()

    expect(frame).not.toBeNull()
    expect(frame!.width).toBeLessThanOrEqual(Number(stamp.width))
    expect(frame!.width).toBeGreaterThan(Number(stamp.width) / 2)
  })
})

test.describe('the install section', () => {
  test('the copy control says it copied the three commands', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'Only Chromium grants clipboard permissions to a test',
    )
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/')
    const copy = page.locator('#install .copy')

    await copy.click()

    await expect(copy.locator('.now')).toHaveText('Copied')
    await expect(copy).toHaveAccessibleName('Copied')
    await expect(page.locator('#install [role="status"]')).toHaveText(
      'Copied the three commands',
    )
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied.split('\n')).toHaveLength(3)
  })

  test('holds the command card at one size through a copy at 840', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 840, height: 900 })
    await page.goto('/')
    const card = page.locator('#install .cmd')
    const copy = page.locator('#install .copy')
    await card.scrollIntoViewIfNeeded()
    const before = await card.boundingBox()
    const width = (await copy.boundingBox())?.width

    await copy.click()
    await expect(copy.locator('.now')).toHaveText('Copied')

    expect(before).not.toBeNull()
    expect((await card.boundingBox())?.height).toBe(before!.height)
    expect((await copy.boundingBox())?.width).toBe(width)
  })

  test('sets the heading beside the command card at 1440 and above it at 834', async ({
    page,
  }) => {
    const place = async (width: number) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')
      const head = await page.locator('#install h2').boundingBox()
      const card = await page.locator('#install .cmd').boundingBox()
      expect(head).not.toBeNull()
      expect(card).not.toBeNull()
      return { head: head!, card: card! }
    }

    const wide = await place(1440)
    expect(wide.card.x).toBeGreaterThan(wide.head.x + wide.head.width)
    const narrow = await place(834)
    expect(narrow.card.y).toBeGreaterThan(narrow.head.y + narrow.head.height)
    await expect(page.locator('#install .term, #install .stg')).toHaveCount(0)
  })
})
