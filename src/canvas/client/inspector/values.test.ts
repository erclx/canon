import { describe, expect, it } from 'vitest'
import {
  displayValue,
  isNoFill,
  scrubStep,
  toCssValue,
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
})

describe('scrubStep', () => {
  it('should move one unit a pixel', () => {
    expect(scrubStep(false)).toBe(1)
  })

  it('should move ten units a pixel with Shift', () => {
    expect(scrubStep(true)).toBe(10)
  })
})
