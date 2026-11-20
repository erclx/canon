import { expect, test } from '@playwright/test'

/** Every settle on an observer or a transition is bounded explicitly. */
const SETTLE = { timeout: 5_000 }

/**
 * Journeys and layout only a real browser computes. The copy is unit tested
 * beside `web/src/content/copy.ts`, so nothing here asserts wording.
 */

const SECTIONS = [
  'top',
  'roles',
  'worktrees',
  'records',
  'craft',
  'guardrails',
  'evidence',
  'film',
  'drive',
  'board',
  'health',
  'install',
  'setup',
  'try',
]

test('renders the opening, ten sections, and try in order', async ({
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

test('the footer mark takes the reader back to the top', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const brand = page.locator('.site-footer a.brand')
  await brand.scrollIntoViewIfNeeded()

  await brand.click()

  await expect(page.locator('#top h1')).toBeInViewport(SETTLE)
  expect(new URL(page.url()).hash).toBe('#top')
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
    await expect(page.locator('.links > a.sl')).toHaveCount(6)
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

test.describe('section shapes', () => {
  test('roles sets its tray left of the heading at 1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    const head = await page.locator('#roles .sec-head').boundingBox()
    const tray = await page.locator('#roles .tray').boundingBox()

    expect(head).not.toBeNull()
    expect(tray).not.toBeNull()
    expect(tray!.x + tray!.width).toBeLessThanOrEqual(head!.x)
  })

  for (const width of [834, 390]) {
    test(`every split stacks its text over its tray at ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')

      const misplaced = await page
        .locator('main > section.split-left, main > section.split-right')
        .evaluateAll((sections) =>
          sections.flatMap((section) => {
            const head = section.querySelector('.sec-head')
            const tray = section.querySelector('.tray')
            if (!head || !tray) return [`${section.id}: missing`]
            const h = head.getBoundingClientRect()
            const t = tray.getBoundingClientRect()
            return h.bottom <= t.top ? [] : [section.id]
          }),
        )

      expect(misplaced).toEqual([])
    })
  }
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

test.describe('the looping windows and their pause button', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  /** A loop that wraps has to outlast one scene and the rest after it. */
  const WRAP = { timeout: 20_000 }

  test('setup plays on past its last stage', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    const stages = page.locator('#setup .st')
    await expect(stages).toHaveCount(4)
    await page.locator('#setup .tx').scrollIntoViewIfNeeded()
    await expect(stages.first()).toHaveClass(/(^| )on( |$)/, SETTLE)

    await stages.last().locator('.go').click()

    await expect(stages.last()).toHaveClass(/(^| )on( |$)/, SETTLE)
    await expect(stages.first()).toHaveClass(/(^| )on( |$)/, WRAP)
  })

  test('the pause button toggles from the keyboard', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    const pause = page.locator('#roles .pz')

    await pause.focus()
    await page.keyboard.press('Enter')
    const afterEnter = await pause.getAttribute('data-paused')
    await page.keyboard.press('Space')

    expect(afterEnter).toBe('true')
    await expect(pause).toHaveAttribute('data-paused', 'false')
  })

  test('shows no pause button under reduced motion', async ({ page }) => {
    await page.goto('/')
    const buttons = page.locator('.pz')
    expect(await buttons.count()).toBeGreaterThan(0)

    const shown = await buttons.evaluateAll((nodes) =>
      nodes
        .filter((node) => getComputedStyle(node).display !== 'none')
        .map((node) => node.closest('section')?.id ?? '?'),
    )

    expect(shown).toEqual([])
  })

  for (const width of [320, 834, 1440]) {
    test(`every pause button clears what its tray holds at ${width}`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')

      const overlaps = await page
        .locator('.tray:has(> .pz)')
        .evaluateAll((trays) =>
          trays.flatMap((tray) => {
            const button = tray.querySelector(':scope > .pz')
            const content = tray.querySelector(':scope > :not(.pz)')
            if (!button || !content)
              return [`${tray.closest('section')?.id}: missing`]
            const b = button.getBoundingClientRect()
            const c = content.getBoundingClientRect()
            return b.bottom > c.top && b.left < c.right
              ? [tray.closest('section')?.id ?? '?']
              : []
          }),
        )

      expect(await page.locator('.tray:has(> .pz)').count()).toBeGreaterThan(0)
      expect(overlaps).toEqual([])
    })
  }
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

test.describe('the setup section', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('the Start stage prints the files its command writes', async ({
    page,
  }) => {
    await page.goto('/')

    await page.locator('#setup .st').first().locator('.go').click()

    await expect(page.locator('#setup .log .blk').first()).toBeVisible()
    await expect(
      page.locator('#setup .log .blk').first().locator('.row.f'),
    ).toHaveCount(3)
  })

  test('the stage rail raises the running card and fills down to it', async ({
    page,
  }) => {
    await page.goto('/')
    const stages = page.locator('#setup .st')
    const fill = () =>
      page
        .locator('#setup .stages')
        .evaluate((node) => parseFloat(node.style.getPropertyValue('--fill')))
    const surface = (index: number) =>
      stages
        .nth(index)
        .evaluate((node) => getComputedStyle(node).backgroundColor)

    await stages.nth(1).locator('.go').click()
    const second = await fill()
    const running = await surface(1)
    const resting = await surface(2)
    await stages.nth(3).locator('.go').click()

    expect(running).not.toBe(resting)
    expect(second).toBeGreaterThan(0)
    expect(await fill()).toBeGreaterThan(second)
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

  test('replays the night a move a beat, and Replay starts it again', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.clock.install()
    await page.goto('/')
    const stamp = page.locator('#board .after .stamp')
    const replay = page.locator('#board .replay')

    await page.locator('#board .ba').scrollIntoViewIfNeeded()
    await expect(stamp).toHaveText(/^23:00 /, SETTLE)
    await page.clock.runFor(700)
    await expect(stamp).toHaveText(/^23:40 /)
    await page.clock.runFor(5_000)
    await expect(stamp).toHaveText(/what you come back to$/)
    await expect(page.locator('#board .after .cd.wt')).toHaveCount(1)
    await replay.click()

    await expect(stamp).toHaveText(/^23:00 /)
  })

  test('rests where the night ends under reduced motion', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('#board .after .stamp')).toHaveText(
      /what you come back to\s*$/,
    )
    await expect(page.locator('#board .after .cd.wt')).toHaveCount(1)
    await expect(page.locator('#board .replay')).toBeHidden()
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

  test('steps the reel through its stills and ticks each line', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.clock.install()
    await page.goto('/')
    const lines = page.locator('#evidence .ck li')
    const replay = page.locator('#evidence .replay')
    await expect(lines).toHaveCount(5)

    await page.locator('#evidence .film').scrollIntoViewIfNeeded()
    await expect(page.locator('#evidence')).toHaveClass(/(^| )in( |$)/, SETTLE)
    await expect(page.locator('#evidence .strip li.now')).not.toHaveCount(0)
    await expect(lines.nth(0)).toHaveClass(/(^| )done( |$)/)
    await expect(lines.nth(4)).not.toHaveClass(/(^| )done( |$)/)
    await page.clock.runFor(8_000)

    await expect(page.locator('#evidence .ck li.done')).toHaveCount(5)
    await expect(page.locator('#evidence .strip li.now')).toHaveCount(0)
    await expect(replay).toBeVisible()
  })

  test('shows every line ticked and its stills under reduced motion', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.locator('#evidence .ck li')).toHaveCount(5)

    await expect(page.locator('#evidence .ck li.done')).toHaveCount(5)
    await expect(page.locator('#evidence .replay')).toBeHidden()
    const stills = page.locator('#evidence .strip:visible img')
    await expect(stills).toHaveCount(5)
    await stills.first().scrollIntoViewIfNeeded()
    await expect
      .poll(
        () =>
          stills
            .first()
            .evaluate((node: HTMLImageElement) => node.naturalWidth),
        SETTLE,
      )
      .toBeGreaterThan(0)
  })

  test('shows the stills filmed in the theme the page is in', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    const still = page.locator('#evidence .strip:visible img').first()
    await expect(still).toHaveAttribute('src', '/film-beat-1.webp')

    await page.locator('.theme-toggle').click()

    await expect(still).toHaveAttribute('src', '/film-beat-1-light.webp')
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

    await expect(copy).toHaveText('Copied')
    await expect(page.locator('#install [role="status"]')).toHaveText(
      'Copied the three commands',
    )
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied.split('\n')).toHaveLength(3)
  })
})

test.describe('new sections', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test.describe('with motion', () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.clock.install()
      await page.goto('/')
    })

    test('the drive lands its pick, and the pause holds it cleared', async ({
      page,
    }) => {
      const board = page.locator('#drive .dr')

      await expect(board).not.toHaveClass(/\bon\b/)
      await page.clock.runFor(1_900)
      await expect(board).toHaveClass(/\bon\b/)
      await page.clock.runFor(3_500)
      await expect(board).not.toHaveClass(/\bon\b/)
      await page.locator('#drive .pz').click()
      const held = (await board.getAttribute('class')) ?? ''
      await page.clock.runFor(6_000)

      await expect(board).toHaveAttribute('class', held)
    })

    test('the film steps its beats with the reel, and the pause shows the still', async ({
      page,
    }) => {
      const reel = page.locator('#film .stage img')
      await reel.scrollIntoViewIfNeeded()
      await expect
        .poll(
          () => reel.evaluate((node: HTMLImageElement) => node.naturalWidth),
          SETTLE,
        )
        .toBeGreaterThan(0)

      await page.clock.runFor(4_000)
      await expect(page.locator('#film .beats li').nth(1)).toHaveClass(/\bon\b/)
      await page.locator('#film .pz').click()

      await expect(reel).toHaveAttribute('src', /film-still/)
    })

    test('the film ticks its last checklist line before the reel loops', async ({
      page,
    }) => {
      // A paused clock starts the reel's time when it loads and moves it only by runFor, so real time cannot carry it past the loop.
      await page.clock.pauseAt(Date.now() + 1_000)
      const reel = page.locator('#film .stage img')
      await reel.scrollIntoViewIfNeeded()
      await expect
        .poll(
          () => reel.evaluate((node: HTMLImageElement) => node.naturalWidth),
          SETTLE,
        )
        .toBeGreaterThan(0)

      await page.clock.runFor(17_500)

      await expect(page.locator('#film .checks li.done')).toHaveCount(5)
    })
  })

  test('each view lands its full state with no pause under reduced motion', async ({
    page,
  }) => {
    await page.goto('/')

    await expect(page.locator('#drive .dr')).toHaveClass(/\bon\b/)
    await expect(page.locator('#film .checks li.done')).toHaveCount(5)
    await expect(page.locator('#film .pz')).toBeHidden()
    await expect(page.locator('#drive .pz')).toBeHidden()
  })

  test('the film follows the theme toggle to the reel filmed in it', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    const reel = page.locator('#film .stage img')
    await expect(reel).toHaveAttribute('src', '/film.webp')

    await page.locator('.theme-toggle').click()

    await expect(reel).toHaveAttribute('src', '/film-light.webp')
  })

  test('the film shows its still under reduced motion', async ({ page }) => {
    await page.goto('/')
    const reel = page.locator('#film .stage img')
    await reel.scrollIntoViewIfNeeded()

    await expect
      .poll(
        () => reel.evaluate((node: HTMLImageElement) => node.currentSrc),
        SETTLE,
      )
      .toMatch(/film-still/)
  })

  for (const width of [390, 320]) {
    test(`the page with the new views scrolls no sideways at ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 })
      await page.goto('/')

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      )

      expect(overflow).toBe(0)
    })
  }
})
