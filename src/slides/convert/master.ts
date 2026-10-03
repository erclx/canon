import type PptxGenJS from 'pptxgenjs'
import {
  BAND_SLOTS,
  type Band,
  type BandSlot,
  type DeckConfig,
} from '@/slides/convert/deck'
import { fontFace } from '@/slides/convert/shapes'

/**
 * The deck's master, built from the project's own tokens as the page computed
 * them rather than from the toolkit's design module. A slide that hides or
 * overrides a band takes a master without that band, so editing the footer
 * once in PowerPoint reaches every slide still on the master's own.
 */

export interface DeckTheme {
  readonly background: string
  readonly ink: string
  readonly muted: string
  readonly accent: string
  readonly face: string
}

/** What the first slide computed, read in the page by `readTheme`. */
export interface ThemeReading {
  /** Each role's `--color-*` value as hex, absent where none is declared. */
  readonly tokens: {
    readonly background?: string
    readonly text?: string
    readonly muted?: string
    readonly accent?: string
  }
  readonly body: { readonly background: string; readonly color: string }
  readonly fontFamily: string
  /** Every declared `--color-*` property in sheet order, for chart series. */
  readonly roles: readonly { readonly name: string; readonly hex: string }[]
}

export interface MasterBands {
  readonly header: boolean
  readonly footer: boolean
}

/** Intrinsic pixel size, which sets the mark's aspect inside its box. */
export interface MarkSize {
  readonly width: number
  readonly height: number
}

const SLIDE_W = 13.333
const MARGIN = 0.5
const BAND_H = 0.4
const HEADER_Y = 0.2
const FOOTER_Y = 7.5 - 0.2 - BAND_H
const SLOT_W = (SLIDE_W - 2 * MARGIN) / 3
const NUMBER_W = 1
const MARK_BOX = { w: 1.2, h: BAND_H }
const BAND_PT = 10

/**
 * A missing role falls back to what the slide's body computed, never to the
 * toolkit's palette, which would put Canon's colors on another project's deck.
 */
export function deckTheme(reading: ThemeReading): {
  readonly theme: DeckTheme
  readonly notices: readonly string[]
} {
  const { tokens, body } = reading
  const missing = (
    [
      ['background', tokens.background],
      ['text', tokens.text],
      ['muted', tokens.muted],
      ['accent', tokens.accent],
    ] as const
  )
    .filter(([, value]) => value === undefined)
    .map(([role]) => `--color-${role}`)
  const ink = tokens.text ?? body.color
  return {
    theme: {
      background: tokens.background ?? body.background,
      ink,
      muted: tokens.muted ?? ink,
      accent: tokens.accent ?? ink,
      face: fontFace(reading.fontFamily),
    },
    notices:
      missing.length === 0
        ? []
        : [
            `no ${missing.join(' or ')} token, so the deck master takes the slide body ${missing.length === 1 ? 'color for it' : 'color for them'}`,
          ],
  }
}

export function masterName(bands: MasterBands): string {
  const parts = [bands.header && 'header', bands.footer && 'footer'].filter(
    Boolean,
  )
  return parts.length === 0 ? 'canon-bare' : `canon-${parts.join('-')}`
}

const SLOT_ALIGN: Record<BandSlot, PptxGenJS.HAlign> = {
  left: 'left',
  center: 'center',
  right: 'right',
}

/**
 * One text object per filled slot. The master draws these for a band it
 * carries, and a slide overriding a band draws its own through the same call.
 */
export function bandTexts(
  band: Omit<Band, 'show'>,
  kind: 'header' | 'footer',
  theme: DeckTheme,
  options: { readonly hasMark?: boolean } = {},
): { readonly text: string; readonly options: PptxGenJS.TextPropsOptions }[] {
  return BAND_SLOTS.flatMap((slot, index) => {
    const text = band[slot]
    if (!text) return []
    const isMarkSlot = kind === 'header' && slot === 'right' && options.hasMark
    return [
      {
        text,
        options: {
          x: MARGIN + index * SLOT_W,
          y: kind === 'header' ? HEADER_Y : FOOTER_Y,
          w: SLOT_W - (isMarkSlot ? MARK_BOX.w + 0.1 : 0),
          h: BAND_H,
          margin: 0,
          align: SLOT_ALIGN[slot],
          valign: 'middle',
          fontFace: theme.face,
          fontSize: BAND_PT,
          color: kind === 'header' ? theme.ink : theme.muted,
        },
      },
    ]
  })
}

/** The right of the footer, which `deck.json` keeps free while numbers show. */
export function slideNumberProps(theme: DeckTheme): PptxGenJS.SlideNumberProps {
  return {
    x: SLIDE_W - MARGIN - NUMBER_W,
    y: FOOTER_Y,
    w: NUMBER_W,
    h: BAND_H,
    margin: 0,
    align: 'right',
    valign: 'middle',
    fontFace: theme.face,
    fontSize: BAND_PT,
    color: theme.accent,
  }
}

function markImage(path: string, size: MarkSize): PptxGenJS.ImageProps {
  const scale = Math.min(MARK_BOX.w / size.width, MARK_BOX.h / size.height)
  const w = Math.round(size.width * scale * 1000) / 1000
  const h = Math.round(size.height * scale * 1000) / 1000
  return { path, x: SLIDE_W - MARGIN - w, y: HEADER_Y, w, h }
}

export function buildMaster(
  deck: DeckConfig,
  theme: DeckTheme,
  bands: MasterBands,
  markSize: MarkSize = { width: 1, height: 1 },
): PptxGenJS.SlideMasterProps {
  const hasHeader = bands.header && deck.header.show
  const hasFooter = bands.footer && deck.footer.show
  const hasMark = deck.mark !== undefined
  const objects: NonNullable<PptxGenJS.SlideMasterProps['objects']> = [
    ...(deck.mark ? [{ image: markImage(deck.mark, markSize) }] : []),
    ...(hasHeader
      ? bandTexts(deck.header, 'header', theme, { hasMark }).map((text) => ({
          text,
        }))
      : []),
    ...(hasFooter
      ? bandTexts(deck.footer, 'footer', theme).map((text) => ({ text }))
      : []),
  ]
  return {
    title: masterName(bands),
    background: { color: theme.background },
    objects,
    ...(hasFooter && deck.slideNumbers
      ? { slideNumber: slideNumberProps(theme) }
      : {}),
  }
}
