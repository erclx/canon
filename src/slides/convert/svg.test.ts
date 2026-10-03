import { describe, expect, it } from 'vitest'
import { resolveSvgColors, type SvgColors } from '@/slides/convert/svg'

const NS = 'xmlns="http://www.w3.org/2000/svg"'

function colors(overrides: Partial<SvgColors> = {}): SvgColors {
  return { color: 'rgb(180, 83, 9)', vars: {}, ...overrides }
}

function svg(body: string): string {
  return `<svg ${NS} viewBox="0 0 10 10">${body}</svg>`
}

describe('resolveSvgColors', () => {
  it('should replace currentColor with the computed color', () => {
    const markup = svg('<path fill="currentColor" d="M0 0h10v10z"/>')

    const resolved = resolveSvgColors(markup, colors())

    expect(resolved).toContain('fill="rgb(180, 83, 9)"')
  })

  it('should replace currentColor whatever its case', () => {
    const markup = svg('<path stroke="currentcolor" d="M0 0h10"/>')

    const resolved = resolveSvgColors(markup, colors())

    expect(resolved).toContain('stroke="rgb(180, 83, 9)"')
  })

  it('should replace a custom property with its computed value', () => {
    const markup = svg('<rect style="fill: var(--color-accent)"/>')

    const resolved = resolveSvgColors(
      markup,
      colors({ vars: { '--color-accent': '#c2410c' } }),
    )

    expect(resolved).toContain('fill: #c2410c')
  })

  it('should take the fallback of a custom property the page never set', () => {
    const markup = svg('<rect fill="var(--missing, #222222)"/>')

    const resolved = resolveSvgColors(markup, colors())

    expect(resolved).toContain('fill="#222222"')
  })

  it('should leave a literal color untouched', () => {
    const markup = svg('<circle fill="#0f766e" r="4"/>')

    const resolved = resolveSvgColors(markup, colors())

    expect(resolved).toContain('fill="#0f766e"')
  })

  it('should add the namespace an inline svg serializes without', () => {
    const markup = '<svg viewBox="0 0 10 10"><rect fill="red"/></svg>'

    const resolved = resolveSvgColors(markup, colors())

    expect(resolved.startsWith(`<svg ${NS} `)).toBe(true)
  })
})
