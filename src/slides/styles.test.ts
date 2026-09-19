import { describe, expect, it } from 'vitest'
import { bareHex, colorValue, TOKENS } from '@/design/tokens'
import { buildTheme, FONTS, TYPE } from '@/slides/styles'

const firstFamily = (role: string): string | undefined =>
  TOKENS.typography
    .find((token) => token.role === role)
    ?.family.split(',')[0]
    ?.trim()
    .replace(/ Variable$/, '')

describe('buildTheme', () => {
  it('reads the dark ground from the design module', () => {
    const theme = buildTheme('dark')

    expect(theme.background).toBe(bareHex(colorValue('background') ?? ''))
  })

  it('reads the light accent from the design module', () => {
    const theme = buildTheme('light')

    expect(theme.accent).toBe(bareHex(colorValue('light-accent') ?? ''))
  })
})

describe('FONTS', () => {
  it('takes the heading face from the display role', () => {
    expect(FONTS.heading).toBe(firstFamily('display'))
  })

  it('takes the body face from the body role', () => {
    expect(FONTS.body).toBe(firstFamily('body'))
  })

  it('names the face without the variable suffix', () => {
    expect(FONTS.heading).toBe('Geist')
  })
})

describe('TYPE', () => {
  it('stays a deck-owned point scale rather than the screen pixel steps', () => {
    expect(TYPE.body).toBe(16)
  })
})
