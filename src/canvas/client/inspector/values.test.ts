import { describe, expect, it } from 'vitest'
import {
  clampScrub,
  composeColor,
  declarationValue,
  displayValue,
  firstFamily,
  isNoFill,
  lineHeightValue,
  opacityToCss,
  parseColor,
  readHex,
  readOpacity,
  sharedRadius,
  scrubStep,
  textAlignOf,
  toCssValue,
  tokenOf,
  type WrittenColor,
} from '@/canvas/client/inspector/values'

describe('displayValue', () => {
  it('should round a px length to a whole number', () => {
    expect(displayValue('width', '240.891px')).toBe('241')
  })

  it('should keep one decimal for a px length under 10', () => {
    expect(displayValue('padding', '7.25px')).toBe('7.3')
  })

  it('should drop a trailing zero decimal', () => {
    expect(displayValue('font-size', '8.0px')).toBe('8')
  })

  it('should round each length of a shorthand', () => {
    expect(displayValue('padding', '8px 16.4px')).toBe('8 16')
  })

  it('should leave a length in another unit as written', () => {
    expect(displayValue('width', '50%')).toBe('50%')
  })

  it('should read auto as a word', () => {
    expect(displayValue('width', 'auto')).toBe('Auto')
  })

  it('should read normal as a word', () => {
    expect(displayValue('font-weight', 'normal')).toBe('Normal')
  })

  it('should read a normal gap as empty', () => {
    expect(displayValue('gap', 'normal')).toBe('')
  })

  it('should read an empty computed gap as empty', () => {
    expect(displayValue('gap', '')).toBe('')
  })

  it('should read a transparent background as no fill', () => {
    expect(displayValue('background-color', 'rgba(0, 0, 0, 0)')).toBe('')
  })

  it('should read a full inline width as Fill', () => {
    expect(displayValue('width', '100%')).toBe('Fill')
  })

  it('should read a fit-content height as Fit', () => {
    expect(displayValue('height', 'fit-content')).toBe('Fit')
  })

  it('should read an opacity as a percent', () => {
    expect(displayValue('opacity', '0.5')).toBe('50%')
  })

  it('should read a full opacity as 100 percent', () => {
    expect(displayValue('opacity', '1')).toBe('100%')
  })

  it('should leave a color as written', () => {
    expect(displayValue('color', 'rgb(255, 0, 0)')).toBe('rgb(255, 0, 0)')
  })
})

describe('isNoFill', () => {
  it('should read a fully transparent color as no fill', () => {
    expect(isNoFill('rgba(0, 0, 0, 0)')).toBe(true)
  })

  it('should read the transparent keyword as no fill', () => {
    expect(isNoFill('Transparent')).toBe(true)
  })

  it('should read an opaque color as a fill', () => {
    expect(isNoFill('rgb(0, 0, 0)')).toBe(false)
  })
})

describe('toCssValue', () => {
  it('should add px to a bare number for a length', () => {
    expect(toCssValue('width', '300')).toBe('300px')
  })

  it('should add px to each bare number of a shorthand', () => {
    expect(toCssValue('padding', '8 16')).toBe('8px 16px')
  })

  it('should leave a bare number without a unit for a weight', () => {
    expect(toCssValue('font-weight', '600')).toBe('600')
  })

  it('should lower a word back to its keyword', () => {
    expect(toCssValue('width', 'Auto')).toBe('auto')
  })

  it('should leave a value with its own unit as typed', () => {
    expect(toCssValue('width', '2rem')).toBe('2rem')
  })

  it('should write Fill as a full length', () => {
    expect(toCssValue('width', 'Fill')).toBe('100%')
  })

  it('should write Fit as fit-content', () => {
    expect(toCssValue('height', 'Fit')).toBe('fit-content')
  })

  it('should add px to a bare number for a corner radius', () => {
    expect(toCssValue('border-top-left-radius', '6')).toBe('6px')
  })
})

describe('opacityToCss', () => {
  it('should write a percent as a fraction', () => {
    expect(opacityToCss('50')).toBe('0.5')
  })

  it('should take a percent typed with its sign', () => {
    expect(opacityToCss('25%')).toBe('0.25')
  })

  it('should refuse a percent above 100', () => {
    expect(opacityToCss('150')).toBeUndefined()
  })

  it('should refuse a percent below 0', () => {
    expect(opacityToCss('-5')).toBeUndefined()
  })
})

describe('sharedRadius', () => {
  it('should read four equal corners as one radius', () => {
    expect(sharedRadius(['8px', '8px', '8px', '8px'])).toBe('8px')
  })

  it('should read corners that differ as no shared radius', () => {
    expect(sharedRadius(['8px', '0px', '8px', '8px'])).toBeUndefined()
  })
})

describe('clampScrub', () => {
  it('should hold a length at zero', () => {
    expect(clampScrub('width', -20)).toBe(0)
  })

  it('should hold a weight at one', () => {
    expect(clampScrub('font-weight', -5)).toBe(1)
  })

  it('should hold a weight at a thousand', () => {
    expect(clampScrub('font-weight', 1200)).toBe(1000)
  })

  it('should leave a value inside its range as it is', () => {
    expect(clampScrub('padding', 12)).toBe(12)
  })
})

describe('scrubStep', () => {
  it('should move one unit a pixel', () => {
    expect(scrubStep(false)).toBe(1)
  })

  it('should move ten units a pixel with Shift', () => {
    expect(scrubStep(true)).toBe(10)
  })
})

describe('parseColor', () => {
  it('should read rgb() as hex at full opacity', () => {
    expect(parseColor('rgb(255, 0, 128)')).toEqual({
      kind: 'hex',
      hex: 'ff0080',
      opacity: 100,
    })
  })

  it('should read the alpha of rgba() as an opacity percent', () => {
    expect(parseColor('rgba(0, 0, 0, 0.5)')).toEqual({
      kind: 'hex',
      hex: '000000',
      opacity: 50,
    })
  })

  it('should read the space-separated rgb() form', () => {
    expect(parseColor('rgb(16 32 48 / 25%)')).toEqual({
      kind: 'hex',
      hex: '102030',
      opacity: 25,
    })
  })

  it('should read a fully transparent rgba() as no fill', () => {
    expect(parseColor('rgba(0, 0, 0, 0)')).toEqual({ kind: 'none' })
  })

  it('should clamp an alpha typed on a 0 to 255 scale to full opacity', () => {
    expect(parseColor('rgba(0, 0, 0, 255)')).toEqual({
      kind: 'hex',
      hex: '000000',
      opacity: 100,
    })
  })

  it('should read an eight digit hex as hex and opacity', () => {
    expect(parseColor('#ff008080')).toEqual({
      kind: 'hex',
      hex: 'ff0080',
      opacity: 50,
    })
  })

  it('should read var() as a token at full opacity', () => {
    expect(parseColor('var(--color-accent)')).toEqual({
      kind: 'token',
      name: '--color-accent',
      opacity: 100,
    })
  })

  it('should read the color-mix form as a token and its percent', () => {
    expect(
      parseColor('color-mix(in srgb, var(--color-accent) 60%, transparent)'),
    ).toEqual({ kind: 'token', name: '--color-accent', opacity: 60 })
  })

  it('should read a hex at zero opacity as no fill', () => {
    expect(parseColor('#ff880000')).toEqual({ kind: 'none' })
  })

  it('should read the srgb color() form a mix computes to', () => {
    expect(parseColor('color(srgb 1 0.5 0 / 0.6)')).toEqual({
      kind: 'hex',
      hex: 'ff8000',
      opacity: 60,
    })
  })

  it('should leave a named color unread', () => {
    expect(parseColor('blue')).toBeUndefined()
  })
})

describe('readHex', () => {
  it('should accept a hex with a leading #', () => {
    expect(readHex('#C76B5F')).toEqual({ hex: 'c76b5f' })
  })

  it('should expand three digits', () => {
    expect(readHex('f80')).toEqual({ hex: 'ff8800' })
  })

  it('should split eight digits into hex and opacity', () => {
    expect(readHex('ff880080')).toEqual({ hex: 'ff8800', opacity: 50 })
  })

  it('should refuse a value that is not hex', () => {
    expect(readHex('blue')).toBeUndefined()
  })
})

describe('readOpacity', () => {
  it('should read a percent with or without its sign', () => {
    expect([readOpacity('60'), readOpacity('60%')]).toEqual([60, 60])
  })

  it('should refuse a percent above 100', () => {
    expect(readOpacity('101')).toBeUndefined()
  })

  it('should refuse a percent below 0', () => {
    expect(readOpacity('-1')).toBeUndefined()
  })
})

describe('composeColor', () => {
  it('should write a token at full opacity as var()', () => {
    expect(
      composeColor({ kind: 'token', name: '--color-accent', opacity: 100 }),
    ).toBe('var(--color-accent)')
  })

  it('should write a token below full opacity as color-mix()', () => {
    expect(
      composeColor({ kind: 'token', name: '--color-accent', opacity: 60 }),
    ).toBe('color-mix(in srgb, var(--color-accent) 60%, transparent)')
  })

  it('should write a hex at full opacity as six digits', () => {
    expect(composeColor({ kind: 'hex', hex: 'ff8800', opacity: 100 })).toBe(
      '#ff8800',
    )
  })

  it('should write a hex below full opacity as eight digits', () => {
    expect(composeColor({ kind: 'hex', hex: 'ff8800', opacity: 50 })).toBe(
      '#ff880080',
    )
  })

  it('should read back every form it writes', () => {
    const written: readonly WrittenColor[] = [
      { kind: 'token', name: '--color-accent', opacity: 100 },
      { kind: 'token', name: '--color-accent', opacity: 60 },
      { kind: 'hex', hex: 'ff8800', opacity: 100 },
      { kind: 'hex', hex: 'ff8800', opacity: 50 },
    ]

    expect(written.map((color) => parseColor(composeColor(color)))).toEqual(
      written,
    )
  })
})

describe('firstFamily', () => {
  it('should read the first family of a quoted stack without its quotes', () => {
    expect(firstFamily('"Geist Variable", Geist, sans-serif')).toBe(
      'Geist Variable',
    )
  })

  it('should read a single unquoted family as written', () => {
    expect(firstFamily('serif')).toBe('serif')
  })

  it('should leave a token reference whole', () => {
    expect(firstFamily('var(--type-body-family)')).toBe(
      'var(--type-body-family)',
    )
  })
})

describe('lineHeightValue', () => {
  it('should round a unitless line height to two decimals', () => {
    expect(lineHeightValue('1.4567', '16px')).toBe('1.46')
  })

  it('should read normal as Auto', () => {
    expect(lineHeightValue('normal', '16px')).toBe('Auto')
  })

  it('should read a pixel line height as its ratio to the font size', () => {
    expect(lineHeightValue('24px', '16px')).toBe('1.5')
  })

  it('should leave a line height in another unit as written', () => {
    expect(lineHeightValue('1.5em', '16px')).toBe('1.5em')
  })
})

describe('letter spacing', () => {
  it('should round an em letter spacing to three decimals', () => {
    expect(displayValue('letter-spacing', '-0.0126em')).toBe('-0.013em')
  })

  it('should read normal as empty', () => {
    expect(displayValue('letter-spacing', 'normal')).toBe('')
  })

  it('should read a pixel letter spacing as a bare number', () => {
    expect(displayValue('letter-spacing', '-0.48px')).toBe('-0.5')
  })

  it('should write a bare negative number as pixels', () => {
    expect(toCssValue('letter-spacing', '-1')).toBe('-1px')
  })

  it('should leave a negative scrub unclamped', () => {
    expect(clampScrub('letter-spacing', -2)).toBe(-2)
  })
})

describe('line height writes', () => {
  it('should write Auto as normal', () => {
    expect(toCssValue('line-height', 'Auto')).toBe('normal')
  })

  it('should leave a bare number unitless', () => {
    expect(toCssValue('line-height', '1.5')).toBe('1.5')
  })

  it('should hold a scrubbed line height at zero', () => {
    expect(clampScrub('line-height', -1)).toBe(0)
  })
})

describe('textAlignOf', () => {
  it('should read start as left in left-to-right text', () => {
    expect(textAlignOf('start', 'ltr')).toBe('left')
  })

  it('should read end as right in left-to-right text', () => {
    expect(textAlignOf('end', 'ltr')).toBe('right')
  })

  it('should read start as right in right-to-left text', () => {
    expect(textAlignOf('start', 'rtl')).toBe('right')
  })

  it('should leave a named side as it is', () => {
    expect(textAlignOf('center', 'rtl')).toBe('center')
  })
})

describe('declarationValue', () => {
  it('should strip a pasted property name and trailing semicolon', () => {
    expect(
      declarationValue('font-family', 'font-family: Inter, sans-serif;'),
    ).toBe('Inter, sans-serif')
  })

  it('should leave a bare value as typed', () => {
    expect(declarationValue('font-family', '"Geist Variable"')).toBe(
      '"Geist Variable"',
    )
  })
})

describe('tokenOf', () => {
  it('should read the token a bare reference names', () => {
    expect(tokenOf('var(--type-body-size)')).toBe('--type-body-size')
  })

  it('should read a literal as naming no token', () => {
    expect(tokenOf('16px')).toBeUndefined()
  })
})
