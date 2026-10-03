import type PptxGenJS from 'pptxgenjs'
import { describe, expect, it } from 'vitest'
import type { DeckConfig } from '@/slides/convert/deck'
import {
  buildMaster,
  type DeckTheme,
  deckTheme,
  masterName,
  type ThemeReading,
} from '@/slides/convert/master'

function deck(overrides: Partial<DeckConfig> = {}): DeckConfig {
  return {
    title: 'Q3 review',
    header: { show: false },
    footer: { show: true, left: 'Q3 review' },
    slideNumbers: true,
    fonts: [],
    ...overrides,
  }
}

function theme(overrides: Partial<DeckTheme> = {}): DeckTheme {
  return {
    background: 'F8FAFC',
    ink: '0F172A',
    muted: '64748B',
    accent: '0F766E',
    face: 'Inter',
    ...overrides,
  }
}

function reading(overrides: Partial<ThemeReading> = {}): ThemeReading {
  return {
    tokens: {
      background: 'F8FAFC',
      text: '0F172A',
      muted: '64748B',
      accent: '0F766E',
    },
    body: { background: 'FFFFFF', color: '111111' },
    fontFamily: '"Inter Variable", system-ui, sans-serif',
    roles: [],
    ...overrides,
  }
}

const BOTH = { header: true, footer: true }

const texts = (master: PptxGenJS.SlideMasterProps): string[] =>
  (master.objects ?? []).flatMap((object) =>
    'text' in object ? [String(object.text.text)] : [],
  )

const images = (master: PptxGenJS.SlideMasterProps) =>
  (master.objects ?? []).flatMap((object) =>
    'image' in object ? [object.image] : [],
  )

describe('deckTheme', () => {
  it('should take each role from its token', () => {
    const { theme: read } = deckTheme(reading())

    expect(read).toMatchObject({
      background: 'F8FAFC',
      ink: '0F172A',
      muted: '64748B',
      accent: '0F766E',
    })
  })

  it('should name the face without quotes or the variable suffix', () => {
    const { theme: read } = deckTheme(reading())

    expect(read.face).toBe('Inter')
  })

  it('should fall back to the body colors when no token is declared', () => {
    const { theme: read } = deckTheme(reading({ tokens: {} }))

    expect(read).toMatchObject({
      background: 'FFFFFF',
      ink: '111111',
      muted: '111111',
      accent: '111111',
    })
  })

  it('should take the body color for a missing role even when text is declared', () => {
    const { theme: read } = deckTheme(
      reading({ tokens: { background: 'F8FAFC', text: '0F172A' } }),
    )

    expect([read.muted, read.accent]).toEqual(['111111', '111111'])
  })

  it('should say which roles fell back', () => {
    const { notices } = deckTheme(
      reading({ tokens: { background: 'F8FAFC', text: '0F172A' } }),
    )

    expect(notices).toEqual([
      'no --color-muted or --color-accent token, so the deck master takes the slide body color for them',
    ])
  })

  it('should say nothing when every role is declared', () => {
    const { notices } = deckTheme(reading())

    expect(notices).toEqual([])
  })
})

describe('masterName', () => {
  it('should name each band combination apart', () => {
    const names = new Set([
      masterName({ header: true, footer: true }),
      masterName({ header: true, footer: false }),
      masterName({ header: false, footer: true }),
      masterName({ header: false, footer: false }),
    ])

    expect(names.size).toBe(4)
  })
})

describe('buildMaster', () => {
  it('should set the background from the theme', () => {
    const master = buildMaster(deck(), theme(), BOTH)

    expect(master.background).toEqual({ color: 'F8FAFC' })
  })

  it('should take the name of its band combination', () => {
    const master = buildMaster(deck(), theme(), BOTH)

    expect(master.title).toBe(masterName(BOTH))
  })

  it('should draw the footer text in the theme face and muted color', () => {
    const master = buildMaster(deck(), theme(), BOTH)
    const footer = (master.objects ?? []).find(
      (object) => 'text' in object && object.text.text === 'Q3 review',
    )

    expect(footer && 'text' in footer && footer.text.options).toMatchObject({
      fontFace: 'Inter',
      color: '64748B',
    })
  })

  it('should draw the header when the deck turns it on', () => {
    const master = buildMaster(
      deck({ header: { show: true, left: 'Acme', center: 'Confidential' } }),
      theme(),
      BOTH,
    )

    expect(texts(master)).toEqual(['Acme', 'Confidential', 'Q3 review'])
  })

  it('should leave the header out when the deck turns it off', () => {
    const master = buildMaster(
      deck({ header: { show: false, left: 'Acme' } }),
      theme(),
      BOTH,
    )

    expect(texts(master)).toEqual(['Q3 review'])
  })

  it('should leave the header out when the band combination drops it', () => {
    const master = buildMaster(
      deck({ header: { show: true, left: 'Acme' } }),
      theme(),
      { header: false, footer: true },
    )

    expect(texts(master)).toEqual(['Q3 review'])
  })

  it('should set the slide number in the accent color', () => {
    const master = buildMaster(deck(), theme(), BOTH)

    expect(master.slideNumber).toMatchObject({
      color: '0F766E',
      align: 'right',
    })
  })

  it('should leave the slide number out when numbers are off', () => {
    const master = buildMaster(deck({ slideNumbers: false }), theme(), BOTH)

    expect(master.slideNumber).toBeUndefined()
  })

  it('should leave the footer and number out of a master without it', () => {
    const master = buildMaster(deck(), theme(), {
      header: false,
      footer: false,
    })

    expect([texts(master), master.slideNumber]).toEqual([[], undefined])
  })

  it('should leave the footer and number out when the deck turns it off', () => {
    const master = buildMaster(
      deck({ footer: { show: false, left: 'Q3 review' } }),
      theme(),
      BOTH,
    )

    expect([texts(master), master.slideNumber]).toEqual([[], undefined])
  })

  it('should skip an empty slot', () => {
    const master = buildMaster(
      deck({ footer: { show: true, left: '' } }),
      theme(),
      BOTH,
    )

    expect(texts(master)).toEqual([])
  })

  it('should place the mark inside the top right box at its own aspect', () => {
    const master = buildMaster(
      deck({ mark: '/deck/mark.png' }),
      theme(),
      BOTH,
      { width: 300, height: 100 },
    )

    expect(images(master)).toEqual([
      expect.objectContaining({ path: '/deck/mark.png', w: 1.2, h: 0.4 }),
    ])
  })

  it('should draw no mark when the deck names none', () => {
    const master = buildMaster(deck(), theme(), BOTH)

    expect(images(master)).toEqual([])
  })
})
