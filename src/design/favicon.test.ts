import { describe, expect, it } from 'vitest'

import {
  FAVICON_COLORS,
  faviconLink,
  renderFavicon,
  renderMark,
} from './favicon'

const PAGE_ACCENTS = ['#c76b5f', '#ad4a4b']

const buildMark = (): string => `<!-- authoring note -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 110">
  <path fill="currentColor" d="M10 10h10v10z"/>
  <rect class="pip" fill="#c2380e" x="1" y="1" width="2" height="2"/>
</svg>`

/** The style block with the light branch cut away, being what applies with no preference. */
const defaultRules = (svg: string): string =>
  svg.slice(svg.indexOf('<style>'), svg.indexOf('@media'))

const lightRules = (svg: string): string =>
  svg.slice(svg.indexOf('@media'), svg.indexOf('</style>'))

describe('renderFavicon', () => {
  it('should take the dark tile, c, and pip where no color scheme applies', () => {
    const rules = defaultRules(renderFavicon(buildMark(), FAVICON_COLORS))

    expect(rules).toContain('.tile { fill: #1b1a18;')
    expect(rules).toContain('.c { fill: #d9d7d4; }')
    expect(rules).toContain('.pip { fill: #ff6b42; }')
  })

  it('should take the light tile, its edge, c, and pip under a light preference', () => {
    const svg = renderFavicon(buildMark(), FAVICON_COLORS)

    expect(svg).toContain('@media (prefers-color-scheme: light)')
    const rules = lightRules(svg)
    expect(rules).toContain('.tile { fill: #fbfaf8; stroke: #dcdad6; }')
    expect(rules).toContain('.c { fill: #2c2c29; }')
    expect(rules).toContain('.pip { fill: #c2380e; }')
  })

  it('should carry neither page accent', () => {
    const svg = renderFavicon(buildMark(), FAVICON_COLORS)

    for (const accent of PAGE_ACCENTS) expect(svg).not.toContain(accent)
  })

  it('should center the mark on a tile wider than its view', () => {
    const svg = renderFavicon(buildMark(), FAVICON_COLORS)

    expect(svg).toContain('viewBox="-20.62 -20.62 151.25 151.25"')
  })

  it('should drop the authoring comment and the currentColor fills', () => {
    const svg = renderFavicon(buildMark(), FAVICON_COLORS)

    expect(svg).not.toContain('authoring note')
    expect(svg).not.toContain('currentColor')
  })

  it('should refuse a mark with no viewBox', () => {
    expect(() =>
      renderFavicon('<svg><path d="M0 0"/></svg>', FAVICON_COLORS),
    ).toThrow(/viewBox/)
  })
})

describe('renderMark', () => {
  it('should fill the c and the pip with the colors given', () => {
    const svg = renderMark(buildMark(), { c: '#1f2328', pip: '#ff6b42' })

    expect(svg).toContain('<path fill="#1f2328"')
    expect(svg).toContain('<rect class="pip" fill="#ff6b42"')
    expect(svg).not.toContain('currentColor')
    expect(svg).not.toContain('authoring note')
  })

  it('should refuse a mark with no filled pip', () => {
    expect(() =>
      renderMark('<svg><path fill="currentColor" d="M0 0"/></svg>', {
        c: '#000000',
        pip: '#ffffff',
      }),
    ).toThrow(/pip/)
  })
})

describe('faviconLink', () => {
  it('should carry the rendered SVG as a data URI that decodes back to it', () => {
    const svg = renderFavicon(buildMark(), FAVICON_COLORS)

    const href = /^<link rel="icon" href="data:image\/svg\+xml,([^"]+)">$/.exec(
      faviconLink(svg),
    )?.[1]

    expect(decodeURIComponent(href ?? '')).toBe(svg)
  })

  it('should leave no character that ends the attribute or starts a fragment', () => {
    const link = faviconLink(renderFavicon(buildMark(), FAVICON_COLORS))

    expect(link.slice(link.indexOf(',') + 1, -2)).not.toMatch(/[#"<>\s]/)
  })
})
