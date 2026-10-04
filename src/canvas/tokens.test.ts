import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveFrameTokens, tokenGroups } from '@/canvas/tokens'
import { primaryFontFamily } from '@/capture/sources'
import { buildDesignCss } from '@/design/css'

let ROOT = ''

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-canvas-tokens-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

function seedDesign(file: string, css: string): void {
  const path = join(ROOT, '.claude', 'design', file)
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, css)
}

function faceFamilies(css: string): string[] {
  return [...css.matchAll(/@font-face\s*{[^}]*font-family:\s*'([^']+)'/g)].map(
    (match) => match[1] ?? '',
  )
}

describe('tokenGroups', () => {
  it('should group custom properties by kind in the order the sheet states them', () => {
    const css = `:root {
      --color-text: #111;
      --space-sm: 0.5rem;
      --color-accent: #c76b5f;
      --radius-pill: 999px;
      --type-body-family: Geist, sans-serif;
      --type-body-size: 0.9375rem;
    }`

    expect(tokenGroups(css)).toEqual([
      {
        kind: 'color',
        tokens: [
          { name: '--color-text', value: '#111' },
          { name: '--color-accent', value: '#c76b5f' },
        ],
      },
      { kind: 'spacing', tokens: [{ name: '--space-sm', value: '0.5rem' }] },
      { kind: 'radius', tokens: [{ name: '--radius-pill', value: '999px' }] },
      {
        kind: 'font-family',
        tokens: [{ name: '--type-body-family', value: 'Geist, sans-serif' }],
      },
      {
        kind: 'font-size',
        tokens: [{ name: '--type-body-size', value: '0.9375rem' }],
      },
    ])
  })

  it('should put a property no group claims under other', () => {
    expect(tokenGroups(':root { --t0: 3rem; }')).toEqual([
      { kind: 'other', tokens: [{ name: '--t0', value: '3rem' }] },
    ])
  })

  it('should keep the first value a property is given', () => {
    const css =
      ':root { --color-text: #111; } [data-theme="light"] { --color-text: #eee; }'

    expect(tokenGroups(css)[0]?.tokens).toEqual([
      { name: '--color-text', value: '#111' },
    ])
  })

  it('should resolve a token defined through another so a swatch can show it', () => {
    const css = ':root { --color-base: #222; --color-text: var(--color-base); }'

    expect(tokenGroups(css)[0]?.tokens[1]).toEqual({
      name: '--color-text',
      value: 'var(--color-base)',
      resolved: '#222',
    })
  })

  it('should read past comments', () => {
    expect(
      tokenGroups('/* --color-fake: red; */ :root { --color-real: blue; }'),
    ).toEqual([
      { kind: 'color', tokens: [{ name: '--color-real', value: 'blue' }] },
    ])
  })
})

describe('resolveFrameTokens', () => {
  it('should take the toolkit token module in the toolkit checkout', () => {
    seedDesign('base.css', ':root { --color-text: red; }')

    const tokens = resolveFrameTokens(ROOT, { isOwnCheckout: true })

    expect(tokens).toEqual({
      source: 'toolkit',
      css: buildDesignCss(undefined, { embedFonts: true }),
    })
  })

  it('should carry a font face for each family the toolkit type tokens name', () => {
    const { css } = resolveFrameTokens(ROOT, { isOwnCheckout: true })

    const named = tokenGroups(css)
      .filter((group) => group.kind === 'font-family')
      .flatMap((group) => group.tokens)
      .map((token) => primaryFontFamily(token.value))
    expect(named.length).toBeGreaterThan(0)
    expect(faceFamilies(css)).toEqual(expect.arrayContaining(named))
  })

  it('should carry a toolkit face for each family an installed base names', () => {
    seedDesign(
      'base.css',
      ":root { --type-body-family: Geist Variable, sans-serif; --figure-hand: 'Virgil', cursive; }",
    )

    const { css } = resolveFrameTokens(ROOT, { isOwnCheckout: false })

    expect(faceFamilies(css)).toEqual(['Geist Variable', 'Virgil'])
  })

  it('should embed no toolkit face an installed sheet does not name', () => {
    seedDesign('base.css', ':root { --type-body-family: Geist, sans-serif; }')

    const { css } = resolveFrameTokens(ROOT, { isOwnCheckout: false })

    expect(css).not.toContain('@font-face')
  })

  it('should let a project face replace the toolkit face of the same family', () => {
    seedDesign(
      'base.css',
      ':root { --type-body-family: Geist Variable, sans-serif; }',
    )
    seedDesign('project/fonts/geist.woff2', 'wOF2project')
    seedDesign(
      'project/fonts.css',
      "@font-face { font-family: 'Geist Variable'; src: url('fonts/geist.woff2'); }",
    )

    const { css } = resolveFrameTokens(ROOT, { isOwnCheckout: false })

    expect(faceFamilies(css)).toEqual(['Geist Variable'])
    expect(css).toContain(Buffer.from('wOF2project').toString('base64'))
  })

  it('should report a project face it dropped and still resolve the sheet', () => {
    seedDesign(
      'project/fonts.css',
      "@font-face { font-family: 'Inter'; src: url('../../../x.woff2'); } :root { --x: 1; }",
    )

    const tokens = resolveFrameTokens(ROOT, { isOwnCheckout: false })

    expect(tokens).toMatchObject({
      source: 'installed',
      dropped: [
        {
          sheet: '.claude/design/project/fonts.css',
          file: '../../../x.woff2',
          reason: 'outside-folder',
        },
      ],
    })
    expect(tokens.css).toContain('--x: 1;')
  })

  it('should take the installed base followed by the project overrides', () => {
    seedDesign('base.css', '/* base */')
    seedDesign('project/b.css', '/* b */')
    seedDesign('project/a.css', '/* a */')

    const tokens = resolveFrameTokens(ROOT, { isOwnCheckout: false })

    expect(tokens).toMatchObject({
      source: 'installed',
      files: [
        '.claude/design/base.css',
        '.claude/design/project/a.css',
        '.claude/design/project/b.css',
      ],
    })
    expect(tokens.css.indexOf('/* base */')).toBeLessThan(
      tokens.css.indexOf('/* a */'),
    )
    expect(tokens.css.indexOf('/* a */')).toBeLessThan(
      tokens.css.indexOf('/* b */'),
    )
  })

  it('should take project overrides alone when no base is installed', () => {
    seedDesign('project/a.css', '/* a */')

    const tokens = resolveFrameTokens(ROOT, { isOwnCheckout: false })

    expect(tokens).toMatchObject({
      source: 'installed',
      files: ['.claude/design/project/a.css'],
    })
  })

  it('should resolve to none with a notice when nothing is installed', () => {
    const tokens = resolveFrameTokens(ROOT, { isOwnCheckout: false })

    expect(tokens).toMatchObject({
      source: 'none',
      css: '',
      notice: expect.stringContaining('.claude/design/base.css'),
    })
  })
})
