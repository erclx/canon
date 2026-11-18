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

test('a click into the opening prompt draws no ring, and Tab back draws it', async ({
  page,
}) => {
  await page.goto('/')
  const ask = page.locator('#av-ask')
  const field = page.locator('#top .fld')

  await ask.click()
  await expect(ask).toBeFocused()
  await expect(field).toHaveCSS('outline-style', 'none')

  await page.keyboard.press('Shift+Tab')
  await expect(ask).not.toBeFocused()
  await page.keyboard.press('Tab')

  await expect(ask).toBeFocused()
  await expect(field).toHaveCSS('outline-style', 'solid')
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

test('a click on the prompt mark focuses the input with no ring', async ({
  page,
}) => {
  await page.goto('/')

  await page.locator('#top .ask-line .p').click()

  await expect(page.locator('#av-ask')).toBeFocused()
  await expect(page.locator('#top .fld')).toHaveCSS('outline-style', 'none')
})

test('a press on the prompt dragged off before release leaves Tab its ring', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const ask = page.locator('#av-ask')
  const mark = await page.locator('#top .ask-line .p').boundingBox()
  expect(mark).not.toBeNull()

  await page.mouse.move(mark!.x + mark!.width / 2, mark!.y + mark!.height / 2)
  await page.mouse.down()
  await page.mouse.move(5, 5)
  await page.mouse.up()
  await expect(ask).not.toBeFocused()
  // Focus the control just ahead of the prompt in tab order, so Tab is what lands on it.
  await page.evaluate(() => {
    const target = document.getElementById('av-ask')
    const focusable = [
      ...document.querySelectorAll<HTMLElement>(
        'a[href], button, input, [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((node) => node.offsetParent !== null || node === target)
    const index = target ? focusable.indexOf(target) : -1
    if (index < 1) throw new Error('no control sits ahead of the prompt')
    focusable[index - 1]?.focus()
  })
  await page.keyboard.press('Tab')

  await expect(ask).toBeFocused()
  await expect(page.locator('#top .fld')).toHaveCSS('outline-style', 'solid')
})

test('the opening status line fits on one row at 360', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/')
  const line = page.locator('#av-counts')
  await expect(line).toHaveText(/\S/)

  const cut = await line.evaluate((node) => node.scrollWidth - node.clientWidth)

  expect(cut).toBeLessThanOrEqual(0)
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

  test('worktrees sets its heading left of the tray at 1440', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    const head = await page.locator('#worktrees .sec-head').boundingBox()
    const tray = await page.locator('#worktrees .tray').boundingBox()

    expect(head).not.toBeNull()
    expect(tray).not.toBeNull()
    expect(head!.x + head!.width).toBeLessThanOrEqual(tray!.x)
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

  test('no two banded sections touch, and the opening carries no band', async ({
    page,
  }) => {
    await page.goto('/')

    const shapes = await page
      .locator('main > section')
      .evaluateAll((nodes) =>
        nodes.map((node) => node.classList.contains('banded')),
      )

    expect(shapes[0]).toBe(false)
    expect(shapes.some((banded, i) => banded && shapes[i + 1])).toBe(false)
    expect(shapes.filter(Boolean)).toHaveLength(3)
  })
})

test.describe('the band', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`a banded tray takes the ground and its band the tray grey in ${theme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme })
      await page.goto('/')
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)

      const colors = await page.evaluate(() => {
        const probe = document.createElement('div')
        document.body.append(probe)
        const resolve = (role: string) => {
          probe.style.backgroundColor = `var(${role})`
          return getComputedStyle(probe).backgroundColor
        }
        const ground = resolve('--ground')
        const grey = resolve('--tray')
        probe.remove()
        const banded = [
          ...document.querySelectorAll<HTMLElement>('main > section.banded'),
        ]
        return {
          ground,
          grey,
          bands: banded.map((node) => getComputedStyle(node).backgroundColor),
          trays: banded.map((node) => {
            const tray = node.querySelector('.tray')
            return tray ? getComputedStyle(tray).backgroundColor : 'missing'
          }),
        }
      })

      expect(colors.ground).not.toBe(colors.grey)
      expect(colors.bands).toEqual([colors.grey, colors.grey, colors.grey])
      expect(colors.trays).toEqual([
        colors.ground,
        colors.ground,
        colors.ground,
      ])
    })
  }

  test('the band fills the viewport edge to edge at 1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.locator('.site-nav').evaluate((node) => {
      node.style.visibility = 'hidden'
    })
    const guardrails = page.locator('#guardrails')
    await guardrails.evaluate((node) =>
      window.scrollBy(0, node.getBoundingClientRect().top - 200),
    )
    const box = await guardrails.boundingBox()
    expect(box).not.toBeNull()
    // A row inside the section's top padding, above the heading.
    const y = box!.y + 20
    const pixel = (x: number) =>
      page.screenshot({ clip: { x, y, width: 1, height: 1 } })

    const left = await pixel(2)
    const inside = await pixel(box!.x + 10)
    const right = await pixel(1437)
    const ground = await page.screenshot({
      clip: { x: 2, y: box!.y - 20, width: 1, height: 1 },
    })

    expect(left.equals(inside)).toBe(true)
    expect(right.equals(inside)).toBe(true)
    expect(inside.equals(ground)).toBe(false)
  })
})

test.describe('the craft section', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('plays the last craft scene with the window in view', async ({
    page,
  }) => {
    await page.goto('/')
    const last = page.locator('#craft .pick').last()

    await last.click()

    await expect(page.locator('#craft .win')).toBeInViewport({ ratio: 1 })
    await expect(page.locator('#craft .log')).toContainText(
      'canon:systematic-debugging',
    )
  })

  test('Practice sets the quote larger than the rule beside the window', async ({
    page,
  }) => {
    await page.goto('/')
    const size = (selector: string) =>
      page
        .locator(selector)
        .evaluate((node) => parseFloat(getComputedStyle(node).fontSize))
    const quote = await page.locator('#craft .said').boundingBox()
    const win = await page.locator('#craft .win').boundingBox()

    expect(await size('#craft .p-quote')).toBeGreaterThan(
      await size('#craft .p-rule'),
    )
    expect(quote && win && quote.x + quote.width).toBeLessThanOrEqual(
      win?.x ?? 0,
    )
  })

  test('Practice stacks the window over the pickers at 390', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    const win = await page.locator('#craft .win').boundingBox()
    const picks = await page.locator('#craft .picks').boundingBox()
    const rule = await page.locator('#craft .rl').boundingBox()
    const said = await page.locator('#craft .said').boundingBox()

    expect(win && picks && win.y + win.height).toBeLessThanOrEqual(
      picks?.y ?? 0,
    )
    expect(rule && said && rule.y).toBeLessThan(said?.y ?? 0)
  })

  test('a Practice pick points both links at that skill', async ({ page }) => {
    await page.goto('/')
    const last = page.locator('#craft .pick').last()

    await last.click()

    await expect(page.locator('#craft a.p-file')).toHaveAttribute(
      'href',
      /\/blob\/main\/claude\/skills\/systematic-debugging\//,
    )
    await expect(page.locator('#craft a.src-link')).toHaveAttribute(
      'href',
      /obra\/superpowers/,
    )
  })
})

test.describe('the looping windows and their pause button', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  /** A loop that wraps has to outlast one scene and the rest after it. */
  const WRAP = { timeout: 20_000 }

  test('guardrails plays on past its last scene', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    const parts = page.locator('#guardrails .four > div')
    await expect(parts).toHaveCount(4)
    // The scroll-in tour lights the first part, so the click lands after it.
    await page.locator('#guardrails .tray').scrollIntoViewIfNeeded()
    await expect(parts.first()).toHaveClass(/(^| )lit( |$)/, SETTLE)

    await parts.last().locator('.go').click()

    await expect(parts.last()).toHaveClass(/(^| )lit( |$)/, SETTLE)
    await expect(parts.first()).toHaveClass(/(^| )lit( |$)/, WRAP)
  })

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

  test('a pressed pause button holds the window it sits on', async ({
    page,
  }) => {
    await page.clock.install()
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    const pause = page.locator('#guardrails .pz')
    const log = page.locator('#guardrails .log')
    await page.locator('#guardrails .four .go').nth(1).click()
    await page.clock.runFor(600)
    await expect(log.locator('.tool')).toHaveCount(1, SETTLE)

    await pause.click()
    const held = await log.textContent()
    // Unpaused, the scene appends its next line within 400 ms and moves on to the next scene inside 10 s.
    await page.clock.runFor(10_000)

    await expect(pause).toHaveAttribute('data-paused', 'true')
    expect(await log.textContent()).toBe(held)
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
    await expect(buttons).toHaveCount(6)

    await expect(buttons.first()).toBeHidden()
    await expect(buttons.last()).toBeHidden()
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

      expect(await page.locator('.tray:has(> .pz)').count()).toBe(6)
      expect(overlaps).toEqual([])
    })
  }
})

test.describe('the opening agent view', () => {
  test('a finished worker puts both reviewers of its change into Working', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const working = () =>
      page.locator('#av-list .r:not(.leave):has(.s.sp) .n').allTextContents()
    expect(await working()).toContain('worker-canon-take-timer')

    await expect
      .poll(working, { timeout: 15_000 })
      .not.toContain('worker-canon-take-timer')

    expect(await working()).toEqual(
      expect.arrayContaining([
        'reviewer-canon-take-timer',
        'ui-reviewer-canon-take-timer',
      ]),
    )
  })
})

test.describe('the Guardrails section', () => {
  test('sets the four checks on one line above the window at 1440', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const parts = page.locator('#guardrails .four > div')
    await expect(parts).toHaveCount(4)
    const tops = await parts.evaluateAll((nodes) =>
      nodes.map((node) => Math.round(node.getBoundingClientRect().top)),
    )
    const four = await page.locator('#guardrails .four').boundingBox()
    const win = await page.locator('#guardrails .win').boundingBox()

    expect(new Set(tops).size).toBe(1)
    expect(four && win && four.y + four.height).toBeLessThanOrEqual(win?.y ?? 0)
  })

  test('keeps the window over the checks at 390', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    const four = await page.locator('#guardrails .four').boundingBox()
    const win = await page.locator('#guardrails .win').boundingBox()

    expect(win && four && win.y + win.height).toBeLessThanOrEqual(four?.y ?? 0)
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

  test('the explorer lights the file the front record has open', async ({
    page,
  }) => {
    await page.goto('/')
    const front = page.locator('#records .sheet[data-i="0"]')
    const lit = front.locator('.explorer .on')
    // Intake opens on its second file, so the first tab is the one to switch to.
    await expect(lit).toHaveAttribute('data-f', '1')

    await front.locator('.ftab[data-f="0"]').click()

    await expect(lit).toHaveCount(1)
    await expect(lit).toHaveAttribute('data-f', '0')
    await expect(lit).toBeVisible()
  })

  test('a click on an explorer file opens its tab, out of the tab order', async ({
    page,
  }) => {
    await page.goto('/')
    const front = page.locator('#records .sheet[data-i="0"]')
    const entry = front.locator('.explorer button[data-f="0"]')
    await expect(entry).toHaveAttribute('tabindex', '-1')

    await entry.click()

    await expect(front.locator('.ftab[data-f="0"]')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(entry).toHaveClass(/\bon\b/)
  })

  test('a click on an explorer folder folds the rows under it', async ({
    page,
  }) => {
    await page.goto('/')
    const explorer = page.locator('#records .sheet[data-i="0"] .explorer')
    const files = explorer.locator('button[data-f]')
    const folder = explorer.locator('.fold:has(+ button[data-f])')
    await expect(folder).toHaveCount(1)
    await expect(files.first()).toBeVisible()

    await folder.click()

    await expect(files.first()).toBeHidden()
    await expect(folder).toHaveClass(/\bshut\b/)
    await folder.click()
    await expect(files.first()).toBeVisible()
  })

  test('every explorer folder row draws a chevron and every file row a mark', async ({
    page,
  }) => {
    await page.goto('/')

    const rows = await page
      .locator('#records .explorer > *')
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          file: node.hasAttribute('data-f'),
          chevron: getComputedStyle(node, '::before').maskImage,
          mark: Boolean(node.querySelector('.fi')),
        })),
      )

    expect(rows.filter((row) => !row.file).length).toBeGreaterThan(0)
    expect(rows.filter((row) => row.file).length).toBeGreaterThan(0)
    expect(
      rows.filter((row) => !row.file && !row.chevron.includes('url(')),
    ).toEqual([])
    expect(rows.filter((row) => row.file && !row.mark)).toEqual([])
  })

  test('every explorer chevron and file mark sits on its own row', async ({
    page,
  }) => {
    await page.goto('/')

    // A static row hands its absolute chevron and mark to the explorer, which draws them at its top.
    const positions = await page
      .locator('#records .explorer > *')
      .evaluateAll((nodes) =>
        nodes.map((node) => getComputedStyle(node).position),
      )

    expect(positions.length).toBeGreaterThan(0)
    expect(positions.filter((position) => position === 'static')).toEqual([])
  })

  test('a click on an empty explorer folder changes nothing', async ({
    page,
  }) => {
    await page.goto('/')
    const explorer = page.locator('#records .sheet[data-i="0"] .explorer')
    const empty = explorer.locator('.dir').first()
    await expect(empty).toBeVisible()
    const before = await explorer.innerHTML()

    await empty.click()

    expect(await explorer.innerHTML()).toBe(before)
  })

  test('every view switch puts the source button first', async ({ page }) => {
    await page.goto('/')

    const firsts = await page
      .locator('#records .vt')
      .evaluateAll((groups) =>
        groups.map(
          (group) => (group.firstElementChild as HTMLElement | null)?.dataset.v,
        ),
      )

    expect(firsts).toHaveLength(12)
    expect(firsts.filter((view) => view !== 'src')).toEqual([])
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
