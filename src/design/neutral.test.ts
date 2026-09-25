import { describe, expect, it } from 'vitest'
import { failing } from '@/design/contrast'
import { buildDesignCss } from '@/design/css'
import { NEUTRAL_TOKENS } from '@/design/neutral'
import { TOKENS } from '@/design/tokens'

const STATE_ROLES = new Set(['success', 'light-success'])

function renderedColors(): [string, string][] {
  const css = buildDesignCss(NEUTRAL_TOKENS)
  return [...css.matchAll(/--color-([a-z-]+): (#[0-9a-fA-F]{6});/g)].map(
    (match) => [match[1], match[2]],
  )
}

function isAchromatic(hex: string): boolean {
  const channels = [1, 3, 5].map((start) => hex.slice(start, start + 2))
  return new Set(channels).size === 1
}

describe('the neutral install base', () => {
  it('renders every non-state color role with equal red, green, and blue', () => {
    const tinted = renderedColors().filter(
      ([role, hex]) => !STATE_ROLES.has(role) && !isAchromatic(hex),
    )

    expect(tinted).toEqual([])
  })

  it('clears AA on every role against every ground it declares', () => {
    expect(
      failing(NEUTRAL_TOKENS.color).map(
        (reading) => `${reading.role} on ${reading.ground}`,
      ),
    ).toEqual([])
  })

  it('declares the same color roles as the toolkit palette, in order', () => {
    expect(NEUTRAL_TOKENS.color.map((token) => token.role)).toEqual(
      TOKENS.color.map((token) => token.role),
    )
  })
})
