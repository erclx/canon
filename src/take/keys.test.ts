import { describe, expect, it } from 'vitest'
import { describeKey, modifierBits, parseKeys } from '@/take/keys'

/**
 * Covers the key vocabulary a take plan may name. Every key has to reach the
 * stepper as a CDP descriptor, so a key with no descriptor refuses at plan
 * read rather than a beat into a take.
 */

describe('parseKeys', () => {
  it('should read the modifiers ahead of the key they hold', () => {
    expect(parseKeys('Control+Shift+K')).toEqual({
      kind: 'parsed',
      chord: { modifiers: ['Control', 'Shift'], key: 'K' },
    })
  })

  it('should read a lone named key', () => {
    expect(parseKeys('Escape')).toEqual({
      kind: 'parsed',
      chord: { modifiers: [], key: 'Escape' },
    })
  })

  it('should read a lone modifier as the key pressed', () => {
    expect(parseKeys('Shift')).toEqual({
      kind: 'parsed',
      chord: { modifiers: [], key: 'Shift' },
    })
  })

  it('should read a plus sign as the key after a modifier', () => {
    expect(parseKeys('Control++')).toEqual({
      kind: 'parsed',
      chord: { modifiers: ['Control'], key: '+' },
    })
  })

  it('should refuse a key it carries no descriptor for', () => {
    expect(parseKeys('Control+Hyper')).toMatchObject({ kind: 'refused' })
  })

  it('should refuse a non-modifier held ahead of the key', () => {
    expect(parseKeys('K+Enter')).toMatchObject({ kind: 'refused' })
  })

  it('should refuse a modifier named twice', () => {
    expect(parseKeys('Shift+Shift+K')).toMatchObject({ kind: 'refused' })
  })

  it('should refuse an empty combination', () => {
    expect(parseKeys('')).toMatchObject({ kind: 'refused' })
  })
})

describe('describeKey', () => {
  it('should give a letter its code, key code, and text', () => {
    expect(describeKey('k')).toEqual({
      key: 'k',
      code: 'KeyK',
      keyCode: 75,
      text: 'k',
      location: 0,
    })
  })

  it('should give a named key its code with no text', () => {
    expect(describeKey('ArrowDown')).toEqual({
      key: 'ArrowDown',
      code: 'ArrowDown',
      keyCode: 40,
      location: 0,
    })
  })

  it('should give Enter the carriage return Chromium types', () => {
    expect(describeKey('Enter')).toMatchObject({ code: 'Enter', text: '\r' })
  })

  it('should place a modifier on the left of the keyboard', () => {
    expect(describeKey('Control')).toEqual({
      key: 'Control',
      code: 'ControlLeft',
      keyCode: 17,
      location: 1,
    })
  })

  it('should give a digit its digit code', () => {
    expect(describeKey('7')).toMatchObject({ code: 'Digit7', keyCode: 55 })
  })

  it('should give punctuation its US layout code', () => {
    expect(describeKey('/')).toMatchObject({ code: 'Slash', keyCode: 191 })
  })

  it('should give nothing for a key outside the vocabulary', () => {
    expect(describeKey('Hyper')).toBeUndefined()
  })
})

describe('modifierBits', () => {
  it('should sum the CDP bit for each held modifier', () => {
    expect(modifierBits(['Alt', 'Control', 'Meta', 'Shift'])).toBe(15)
  })

  it('should read Shift alone as eight', () => {
    expect(modifierBits(['Shift'])).toBe(8)
  })
})
