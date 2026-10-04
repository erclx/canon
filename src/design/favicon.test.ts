import { describe, expect, it } from 'vitest'

import { FAVICON_COLORS, faviconLink, renderFavicon } from './favicon'

const PAGE_ACCENTS = ['#c76b5f', '#ad4a4b']

const buildMark = (): string => `<!-- authoring note -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 10 80 80">
  <path fill="currentColor" d="M10 10h10v10z"/>
  <rect fill="currentColor" x="1" y="1" width="2" height="2"/>
</svg>`

describe('renderFavicon', () => {
  it('carries the favicon colors and neither page accent', () => {
    const svg = renderFavicon(buildMark(), FAVICON_COLORS)

    expect(svg).toContain('#c42938')
    expect(svg).toContain('#e54e40')
    for (const accent of PAGE_ACCENTS) expect(svg).not.toContain(accent)
  })

  it('takes the dark value inside the dark color-scheme branch', () => {
    const svg = renderFavicon(buildMark(), FAVICON_COLORS)

    expect(svg).toMatch(
      /prefers-color-scheme: dark\) \{ path, rect \{ fill: #e54e40; \} \}/,
    )
  })

  it('drops the authoring comment and the currentColor fills', () => {
    const svg = renderFavicon(buildMark(), FAVICON_COLORS)

    expect(svg).not.toContain('authoring note')
    expect(svg).not.toContain('currentColor')
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
