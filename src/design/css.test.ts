import { describe, expect, it } from 'vitest'
import { COMPONENTS, TEACH_STYLESHEET_COMPONENTS } from '@/design/components'
import { buildDesignCss, slug, unmappedOnLight } from '@/design/css'
import { HAND_DRAWN_FONT_FACES } from '@/design/fonts'
import type { DesignTokens } from '@/design/tokens'
import { TOKENS } from '@/design/tokens'

const minimal = (overrides: Partial<DesignTokens> = {}): DesignTokens => ({
  personality: '',
  preamble: '',
  color: [],
  colorNote: '',
  typeScale: [],
  typography: [],
  typographyNote: '',
  spacing: [],
  spacingNote: '',
  borders: [],
  bordersNote: '',
  layout: '',
  motion: '',
  iconography: '',
  ...overrides,
})

describe('slug', () => {
  it('reduces a role to the name a custom property carries', () => {
    expect(slug('Line height')).toBe('line-height')
    expect(slug('light-background')).toBe('light-background')
  })
})

describe('buildDesignCss', () => {
  it('emits one custom property per color role a browser can render', () => {
    const css = buildDesignCss()

    expect(css).toContain('--color-background: #0f0e0c;')
    expect(css).toContain('--color-light-muted: #6e6d6c;')
  })

  it('leaves an ANSI role out, since no browser renders one', () => {
    const css = buildDesignCss()

    expect(css).not.toContain('--color-warning')
    expect(css).not.toContain('--color-error')
  })

  it('emits success, which holds a hex a browser does render', () => {
    expect(buildDesignCss()).toContain('--color-success: #61c454;')
  })

  it('carries the spacing, type, and radius layers beside the colors', () => {
    const css = buildDesignCss()

    expect(css).toContain('--space-md: 0.875rem;')
    expect(css).toContain('--type-body-lh: 1.65;')
    expect(css).toContain(
      '--type-body-family: Geist Variable, DejaVu Sans, sans-serif;',
    )
    expect(css).toContain(
      '--type-code-family: Noto Sans Mono, DejaVu Sans Mono, monospace;',
    )
    expect(css).toContain('--t0: 3.175rem;')
    expect(css).toContain('--t6: 0.6875rem;')
    expect(css).toContain('--radius-marker: 999px;')
  })

  it('gives every role a size the type scale offers', () => {
    const sizes = new Set(TOKENS.typeScale.map((step) => step.size))

    expect(TOKENS.typography.filter((role) => !sizes.has(role.size))).toEqual(
      [],
    )
  })

  it('drops a radius the record declares as none rather than emitting it', () => {
    expect(buildDesignCss()).not.toContain('--radius-rule')
  })

  it('remaps a role onto its light counterpart under the light theme', () => {
    expect(buildDesignCss()).toContain(
      '--color-background: var(--color-light-background);',
    )
  })

  it('emits no gap notice once every role carries a light counterpart', () => {
    const css = buildDesignCss()

    expect(unmappedOnLight()).toEqual([])
    expect(css).not.toContain('no light counterpart')
  })

  it('maps every role the light theme block stands in for', () => {
    const css = buildDesignCss()

    // The four that closed the gap. Each one carries text on a light ground,
    // or is the surface step behind it, so a page reading any of them used to
    // resolve a dark value against a light canvas.
    expect(css).toContain('--color-chrome: var(--color-light-chrome);')
    expect(css).toContain('--color-text-body: var(--color-light-text-body);')
    expect(css).toContain(
      '--color-text-secondary: var(--color-light-text-secondary);',
    )
    expect(css).toContain('--color-success: var(--color-light-success);')
  })

  it('carries every component rule by default', () => {
    const css = buildDesignCss()

    for (const component of COMPONENTS) {
      expect(css).toContain(component.rules)
    }
  })

  it('emits only the properties a component reads when asked for tokens alone', () => {
    const css = buildDesignCss(undefined, { components: false })

    expect(css).not.toContain('.status::before')
    expect(css).toContain('--color-accent:')
  })

  it('emits only an explicit component list, leaving the generic default out', () => {
    const custom = {
      name: 'custom',
      note: 'A component built for this test alone.',
      reads: [] as const,
      rules: '.custom { color: red; }',
    }

    const css = buildDesignCss(undefined, { components: [custom] })

    expect(css).toContain('.custom { color: red; }')
    expect(css).not.toContain('.status::before')
  })

  it('embeds only an explicit font list, leaving the mono default out', () => {
    const custom = { family: 'Custom Face', weight: '400', base64: 'AAAA' }

    const css = buildDesignCss(undefined, { embedFonts: [custom] })

    expect(css).toContain("font-family: 'Custom Face';")
    expect(css).toContain('base64,AAAA')
    expect(css.match(/@font-face/g)).toHaveLength(1)
  })

  it('prepends a banner only when the caller supplies one', () => {
    expect(
      buildDesignCss(undefined, { banner: 'Written by a test' }),
    ).toContain('/* Written by a test */')
    expect(buildDesignCss().startsWith(':root {')).toBe(true)
  })

  it('names no light counterpart when every role has one', () => {
    const tokens = minimal({
      color: [
        { role: 'text', intent: 'copy', value: '#111111' },
        { role: 'light-text', intent: 'copy on light', value: '#eeeeee' },
      ],
    })

    expect(unmappedOnLight(tokens)).toEqual([])
    expect(buildDesignCss(tokens)).not.toContain('no light counterpart')
  })

  it('reads every property a component declares it reads', () => {
    const css = buildDesignCss()

    for (const component of COMPONENTS) {
      for (const property of component.reads) {
        expect(css).toContain(`${property}:`)
      }
    }
  })

  it('reads every property the teach chrome set declares it reads', () => {
    const css = buildDesignCss(undefined, {
      components: TEACH_STYLESHEET_COMPONENTS,
    })

    for (const component of TEACH_STYLESHEET_COMPONENTS) {
      for (const property of component.reads) {
        expect(css).toContain(`${property}:`)
      }
    }
  })

  describe('teach footer and anchor chrome', () => {
    const teachCss = (): string =>
      buildDesignCss(undefined, { components: TEACH_STYLESHEET_COMPONENTS })

    const declarationsOf = (css: string, selector: string): string =>
      [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .filter((match) => match[1].trim().split('\n').pop() === selector)
        .map((match) => match[2])
        .join('\n')

    it('caps the footer nav to the page measure and centres it', () => {
      const nav = declarationsOf(teachCss(), '.nav')

      expect(nav).toContain('max-width: calc(var(--teach-measure) + 3rem)')
      expect(nav).toMatch(/margin:\s*4rem auto 0/)
    })

    it('offsets an anchor jump past the sticky masthead on the root', () => {
      const root = declarationsOf(teachCss(), 'html')

      expect(root).toContain('scroll-padding-top: calc(var(--teach-mast-h)')
    })

    it('targets no footer wrapper the generated markup never emits', () => {
      expect(teachCss()).not.toContain('.nav-foot')
    })

    it('gives a lone footer card half the measure on the side it points', () => {
      const css = teachCss()

      expect(declarationsOf(css, '.nav > :only-child')).toContain(
        'flex: 0 1 calc(50% - 0.3rem)',
      )
      expect(declarationsOf(css, '.nav > .to-next:only-child')).toContain(
        'margin-left: auto',
      )
    })

    it('sizes every padded full-width box by its border box so none overflows a narrow viewport', () => {
      const css = teachCss()

      for (const selector of ['main', '.nav', '.opt']) {
        expect(declarationsOf(css, selector)).toContain(
          'box-sizing: border-box',
        )
      }
    })

    it('leaves smooth scrolling off, since a jump during reading competes with it', () => {
      expect(teachCss()).not.toContain('scroll-behavior')
    })
  })

  describe('teach course sidebar', () => {
    const teachCss = (): string =>
      buildDesignCss(undefined, { components: TEACH_STYLESHEET_COMPONENTS })

    const declarationsOf = (css: string, selector: string): string =>
      [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .filter((match) => match[1].trim().split('\n').pop() === selector)
        .map((match) => match[2])
        .join('\n')

    it('should lay the sidebar and the content pane out as one flex row', () => {
      const css = teachCss()

      expect(declarationsOf(css, 'body')).toContain('display: flex')
      expect(declarationsOf(css, '.sb')).toContain('position: sticky')
      expect(declarationsOf(css, '.pane')).toContain('flex: 1 1 auto')
    })

    it('should keep the bottom room off the body, which a sticky sidebar can never travel into', () => {
      const body = declarationsOf(teachCss(), 'body')

      expect(body).toMatch(/padding:\s*0;/)
      expect(body).not.toContain('7rem')
    })

    it('should give the pane the bottom room and size it by its border box', () => {
      const pane = declarationsOf(teachCss(), '.pane')

      expect(pane).toContain('padding-bottom: 7rem')
      expect(pane).toContain('box-sizing: border-box')
      expect(pane).toContain('min-height: 100vh')
    })

    it('should report reading position on the masthead edge rather than as its own element', () => {
      expect(declarationsOf(teachCss(), '.bar::after')).toContain(
        'width: var(--read, 0%)',
      )
    })

    it('should retire the segmented progress track', () => {
      const css = teachCss()

      expect(css).not.toContain('.track')
    })

    it('should retire the fixed right-hand outline rail in favor of the folded list', () => {
      const css = teachCss()

      expect(css).not.toContain('.outline')
      expect(declarationsOf(css, '.sb-out a')).toContain('display: block')
    })

    it('should overlay the panel rather than squeeze the lesson below the sidebar breakpoint', () => {
      const css = teachCss()
      const narrow = /@media \(max-width: 1100px\) \{([\s\S]*?)\n\}/.exec(css)

      expect(narrow).not.toBeNull()
      expect(narrow?.[1]).toContain('position: fixed')
      expect(narrow?.[1]).toContain('.sb-scrim')
      expect(narrow?.[1]).toContain('.sb-close')
    })

    it('should hide the overlay-only controls above the breakpoint, where the script still appends them', () => {
      const css = teachCss()

      expect(declarationsOf(css, '.sb-close, .sb-scrim')).toContain(
        'display: none',
      )

      // Scoped to each selector inside the query rather than searched across
      // the whole block, so deleting either rule's own `display` fails here
      // instead of being satisfied by a sibling that happens to declare one.
      const narrow = /@media \(max-width: 1100px\) \{([\s\S]*?)\n\}/.exec(css)
      expect(narrow).not.toBeNull()

      // `declarationsOf` keys on the selector's own line untrimmed, so a rule
      // indented inside a query is invisible to it until the indent is dropped.
      const inQuery = (narrow?.[1] ?? '').replace(/^ {2}/gm, '')
      expect(declarationsOf(inQuery, '.sb-close')).toContain(
        'display: inline-flex',
      )
      expect(declarationsOf(inQuery, '.sb-scrim')).toContain('display: block')
    })

    it('should take a shut panel out of the tab order rather than only out of sight', () => {
      const css = teachCss()

      expect(css).toContain('html.sb-shut .sb { visibility: hidden')
    })

    it('should restate the panel width in the shut narrow state, which the wide rule collapses to zero', () => {
      const css = teachCss()
      const narrow = /@media \(max-width: 1100px\) \{([\s\S]*?)\n\}/.exec(css)

      expect(narrow?.[1]).toContain('html.sb-shut .sb { width: min(')
    })

    it('should drop every transition under a reduced-motion preference', () => {
      const css = teachCss()
      const reduced = [
        ...css.matchAll(
          /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g,
        ),
      ]
        .map((match) => match[1])
        .join('\n')

      expect(reduced).toContain('.sb')
      expect(reduced).toContain('transition: none')
    })
  })

  describe('teach masthead', () => {
    const teachCss = (): string =>
      buildDesignCss(undefined, { components: TEACH_STYLESHEET_COMPONENTS })

    const declarationsOf = (css: string, selector: string): string =>
      [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .filter((match) => match[1].trim().split('\n').pop() === selector)
        .map((match) => match[2])
        .join('\n')

    const phoneRules = (css: string): string =>
      [...css.matchAll(/@media \(max-width: 640px\) \{([\s\S]*?)\n\}/g)]
        .map((match) => match[1])
        .join('\n')
        .replace(/^ +/gm, '')

    it('should set the bar height to 3.5rem', () => {
      expect(declarationsOf(teachCss(), ':root')).toContain(
        '--teach-mast-h: 3.5rem',
      )
    })

    it('should span the window rather than cap the bar row to the reading measure', () => {
      const mast = declarationsOf(teachCss(), '.mast')

      expect(mast).toContain('max-width: none')
      expect(mast).toMatch(/margin:\s*0;/)
      expect(mast).toContain('padding: 0 0.9rem')
      expect(mast).toContain('gap: 0.55rem')
    })

    it('should keep the prototype gaps inside the bar at every width', () => {
      const css = teachCss()

      expect(declarationsOf(css, '.mast-left')).toContain('gap: 0.3rem')
      expect(declarationsOf(css, '.mast-right')).toContain('gap: 0.2rem')
      expect(declarationsOf(css, '.crumb-sep')).toContain('margin: 0 0.1rem')
      expect(phoneRules(css)).not.toMatch(/\.mast(-left)? \{[^}]*(?<!row-)gap:/)
    })

    it('should paint a breadcrumb link neutral rather than in the accent', () => {
      const css = teachCss()

      expect(declarationsOf(css, '.mast a.crumb')).toContain(
        'color: var(--color-text-secondary)',
      )
      expect(declarationsOf(css, '.crumb-item:hover a.crumb')).toContain(
        'color: var(--color-text)',
      )
    })

    it('should draw the label and its caret as one chip that fills on hover and while open', () => {
      const css = teachCss()
      const item = declarationsOf(css, '.crumb-item')

      expect(item).toContain('border-radius: 7px')
      expect(item).toContain('padding: 0.1rem 0.15rem 0.1rem 0.35rem')
      expect(item).toContain('gap: 0')
      expect(item).toContain('cursor: pointer')
      expect(
        declarationsOf(css, '.crumb-item:has(details.jump[open])'),
      ).toContain('background: var(--color-chrome)')
      expect(css).toContain('.crumb-item:has(details.jump):hover,')
    })

    it('should hold the caret visible and muted in every state', () => {
      const css = teachCss()

      expect(css).not.toMatch(/\.caret \{ opacity: 0\.55/)
      expect(css).not.toMatch(/\.jump summary:hover \{[^}]*--color-accent/)
      expect(css).not.toMatch(/\.jump\[open\] summary \{[^}]*--color-accent/)
      expect(declarationsOf(css, '.jump summary .caret')).toContain(
        'color: var(--color-muted)',
      )
    })

    it('should draw the theme control without a border at the fold control size and radius', () => {
      const css = teachCss()
      const theme = declarationsOf(css, '.theme')

      expect(theme).toContain('border: 0')
      expect(theme).toContain('width: 1.75rem')
      expect(theme).toContain('border-radius: 6px')
      expect(theme).not.toContain('99px')
      expect(declarationsOf(css, '.theme:hover')).toContain(
        'background: var(--color-chrome)',
      )
    })

    it('should fill every chrome hover with the chrome token rather than the panel surface', () => {
      const css = teachCss()

      for (const selector of [
        '.sb-fold:hover',
        '.theme:hover',
        '.sb-l:hover',
        '.jump-list a:hover',
        '.sb-ws > summary:hover, .sb-ws[open] > summary',
      ]) {
        expect(declarationsOf(css, selector)).toContain(
          'background: var(--color-chrome)',
        )
      }
    })

    it('should fit the jump menu to its content in the base rule shared by every mount', () => {
      const css = teachCss()
      const row = declarationsOf(css, '.jump-list a')

      expect(css).toContain('min-width: min(11rem, calc(100vw - 2rem))')
      expect(css).not.toContain('21rem, calc')
      expect(row).toContain('padding: 0.38rem 0.55rem')
      expect(row).toContain('font-size: var(--t5)')
      expect(css).not.toContain('.mast .jump-list')
    })

    it('should trim each crumb label to its cap band so the caret centres on the capitals', () => {
      expect(
        declarationsOf(teachCss(), '.crumb-t, .crumb-here, .sb-ws .ws-name'),
      ).toContain('text-box: trim-both cap alphabetic')
    })

    it('should mark the current crumb at the weight the current sidebar row paints', () => {
      expect(declarationsOf(teachCss(), '.crumb-here')).toContain(
        'font-weight: 650',
      )
    })
  })

  it('names no retired teach face in the seeded chrome', () => {
    const css = buildDesignCss(undefined, {
      components: TEACH_STYLESHEET_COMPONENTS,
    })

    expect(css).not.toContain('Nunito')
    expect(css).not.toContain('Cascadia')
  })

  it('declares every alias a hand-authored lesson diagram consumes, not only what a component reads', () => {
    // Shaped like the fill/stroke references in a real lesson diagram SVG
    // (.canon/teach/03-fde-system-design/lessons/0003-deployment-skeleton.html),
    // none of which any component's own `reads` array names.
    const diagramFixture = `
      <rect fill="var(--panel)" stroke="var(--rule)" />
      <text fill="var(--ink)">label</text>
      <text fill="var(--ink-soft)">detail</text>
      <text fill="var(--ink-faint)">footnote</text>
      <rect fill="var(--accent-bg)" stroke="var(--accent)" />
    `
    const requiredNames = [
      ...diagramFixture.matchAll(/var\((--[\w-]+)\)/g),
    ].map((match) => match[1])
    const css = buildDesignCss(undefined, {
      components: TEACH_STYLESHEET_COMPONENTS,
    })
    const undeclared = requiredNames.filter((name) => !css.includes(`${name}:`))

    expect(undeclared).toEqual([])
  })

  it('emits the same color set the record carries', () => {
    const withHex = TOKENS.color.filter(
      (token) => !token.value.startsWith('ANSI'),
    )
    const css = buildDesignCss()

    for (const token of withHex) {
      expect(css).toContain(`--color-${slug(token.role)}: ${token.value};`)
    }
  })

  describe('teach type scale', () => {
    const teachCss = (): string =>
      buildDesignCss(undefined, { components: TEACH_STYLESHEET_COMPONENTS })

    const declarationsOf = (css: string, selector: string): string =>
      [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .filter((match) => match[1].trim().split('\n').pop() === selector)
        .map((match) => match[2])
        .join('\n')

    it.each([
      ['h1', '--t1', '1.1'],
      ['h2', '--t2', '1.3'],
      ['h3', '--t3', '1.55'],
      ['.lede', '--t3', '1.55'],
      ['.assumes, .progress', '--t5', '1.6'],
    ])('should paint %s from %s at leading %s', (selector, step, leading) => {
      const rule = declarationsOf(teachCss(), selector)

      expect(rule).toContain(`font-size: var(${step})`)
      expect(rule).toContain(`line-height: ${leading}`)
    })

    it.each([
      ['body', '--t3'],
      ['.hard-label', '--t3'],
      ['.toc b', '--t3'],
      ['table', '--t4'],
      ['th', '--t5'],
      ['.road-t', '--t5'],
      ['.toc .state', '--t5'],
      ['.toc .ext', '--t4'],
      ['.gloss .empty .clear', '--t4'],
      ['.opt::before', '--t6'],
      ['.opt[data-state="chosen"]::after', '--t6'],
      ['.opt[data-state="right"]::after', '--t6'],
      ['sup.cite', '--t6'],
      ['.nav .lbl', '--t6'],
    ])('should paint %s from %s', (selector, step) => {
      expect(declarationsOf(teachCss(), selector)).toContain(
        `font-size: var(${step})`,
      )
    })

    it('should hold the body at one leading on every width', () => {
      const css = teachCss()

      expect(declarationsOf(css, 'body')).toContain('line-height: 1.55')
      expect(css).not.toContain('body { font-size: 1.0625rem; }')
    })

    it('should keep the glossary group label on its own small step rather than the heading step', () => {
      const rule = declarationsOf(teachCss(), '.gloss-group')

      expect(rule).toContain('font-size: var(--t5)')
    })

    it.each([
      'th',
      '.nav .lbl',
      '.assumes b, .progress b',
      '.opt[data-state="chosen"]::after',
      '.opt[data-state="right"]::after',
      '.gloss-group',
    ])('should set %s in sentence case with no tracking', (selector) => {
      const rule = declarationsOf(teachCss(), selector)

      expect(rule).not.toContain('text-transform: uppercase')
      expect(rule).toContain('letter-spacing: 0')
    })

    it.each([
      ['chosen', 'Your answer'],
      ['right', 'Correct'],
    ])('should write the %s quiz tag in sentence case', (state, text) => {
      const rule = declarationsOf(
        teachCss(),
        `.opt[data-state="${state}"]::after`,
      )

      expect(rule).toContain(`content: "${text}"`)
    })

    describe('listing marks', () => {
      it('should paint the listing ordinal neutral rather than in the accent', () => {
        expect(declarationsOf(teachCss(), '.toc .num')).not.toContain(
          '--color-accent',
        )
      })

      it('should draw no status dot on a listing row', () => {
        const css = teachCss()

        expect(css).not.toContain('.toc .state::before')
        expect(css).not.toMatch(/\.toc \.state\.(done|next)/)
      })

      it('should state the glossary size once, in the live count beside the filter', () => {
        expect(teachCss()).not.toContain('h2 .count')
      })

      it('should set the glossary filter with no border on the page ground', () => {
        const rule = declarationsOf(teachCss(), '.filter')

        expect(rule).toContain('border: 0')
        expect(rule).not.toContain('border-radius')
        expect(rule).not.toContain('width: 100%')
      })
    })

    it('should leave no rem literal font size in the reading rules', () => {
      const literals = [...teachCss().matchAll(/font-size:\s*[\d.]+rem/g)]
        .map((match) => match[0])
        .filter((size) => size !== 'font-size: 0.75rem')

      expect(literals).toEqual(['font-size: 1rem'])
    })

    it.each([
      ['.fb', '--t4', '1.55'],
      ['.gterm', '--t4', '1.55'],
      ['.road-b span', '--t4', '1.55'],
      ['.toc .blurb', '--t4', '1.55'],
      ['ol.succ', '--t4', '1.55'],
      ['pre', '--t5', '1.6'],
      ['footer', '--t5', '1.6'],
      ['ol.refs', '--t5', '1.6'],
    ])(
      'should set %s on %s at the one leading that step carries',
      (selector, step, leading) => {
        const rule = declarationsOf(teachCss(), selector)

        expect(rule).toContain(`font-size: var(${step})`)
        expect(rule).toContain(`line-height: ${leading}`)
      },
    )
  })

  it('emits a @font-face block per default face when asked to embed fonts', () => {
    const css = buildDesignCss(undefined, { embedFonts: true })

    expect(css.match(/@font-face/g)).toHaveLength(3)
    expect(css).toContain("font-family: 'Noto Sans Mono';")
    expect(css).toContain('url(data:font/woff2;base64,')
  })

  it('emits the Geist variable face with its weight range intact', () => {
    const css = buildDesignCss(undefined, { embedFonts: true })

    expect(css).toContain(
      "font-family: 'Geist Variable';\n  font-weight: 100 900;",
    )
  })

  it('emits no @font-face block by default', () => {
    expect(buildDesignCss()).not.toContain('@font-face')
  })

  it('emits two @font-face blocks when asked to embed the hand-drawn faces', () => {
    const css = buildDesignCss(undefined, { embedFonts: HAND_DRAWN_FONT_FACES })

    expect(css.match(/@font-face/g)).toHaveLength(2)
    expect(css).toContain("font-family: 'Virgil';")
    expect(css).toContain("font-family: 'Excalifont';")
  })
})
