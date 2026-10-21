import { describe, expect, it } from 'vitest'
import { contrastRatio, failing, luminance, readings } from '@/design/contrast'
import { TOKENS } from '@/design/tokens'

describe('luminance', () => {
  it('reads black at zero and white at one', () => {
    expect(luminance('#000000')).toBe(0)
    expect(luminance('#ffffff')).toBeCloseTo(1, 10)
  })

  it('refuses a value no ratio applies to', () => {
    expect(() => luminance('ANSI 32')).toThrow(/six-digit hex/)
  })
})

describe('contrastRatio', () => {
  it('reads the extremes at 21 to 1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 10)
  })

  it('reads the same pair either way round', () => {
    expect(contrastRatio('#726B62', '#FAF7F2')).toBeCloseTo(
      contrastRatio('#FAF7F2', '#726B62'),
      10,
    )
  })

  it('reproduces the readings the census took of the values it replaced', () => {
    expect(contrastRatio('#7A736A', '#FAF7F2')).toBeCloseTo(4.38, 2)
    expect(contrastRatio('#7A736A', '#F4EFE6')).toBeCloseTo(4.09, 2)
    expect(contrastRatio('#C8602E', '#1A1815')).toBeCloseTo(4.36, 2)
    expect(contrastRatio('#C8602E', '#23201C')).toBeCloseTo(3.99, 2)
  })
})

describe('readings', () => {
  it('measures every role that names a ground', () => {
    const measured = readings()
    const roles = TOKENS.color.filter((token) => token.grounds?.length)

    expect(measured).toHaveLength(
      roles.reduce((sum, token) => sum + (token.grounds?.length ?? 0), 0),
    )
  })

  it('leaves a ground and an ANSI role unmeasured', () => {
    const roles = new Set(readings().map((reading) => reading.role))

    expect(roles.has('background')).toBe(false)
    expect(roles.has('warning')).toBe(false)
    expect(roles.has('error')).toBe(false)
  })

  it('measures success, which holds a hex a surface renders', () => {
    const measured = readings().filter((reading) => reading.role === 'success')

    expect(measured.map((reading) => reading.ground)).toEqual(['background'])
  })

  it('refuses a ground the record does not declare', () => {
    expect(() =>
      readings([
        { role: 'text', intent: 'copy', value: '#ffffff', grounds: ['void'] },
      ]),
    ).toThrow(/unknown ground/)
  })
})

describe('the shipped palette', () => {
  /**
   * The outcome this row was opened on. It asserts over the record rather than
   * over a fixed list, so a role added later is measured without a second edit
   * here and a role whose ground moves is re-measured against the new one.
   */
  it('clears AA on every role against every ground it declares', () => {
    expect(
      failing().map((reading) => `${reading.role} on ${reading.ground}`),
    ).toEqual([])
  })
})
