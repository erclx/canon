import { describe, expect, it } from 'vitest'
import { isMarked } from '@/sweep/exempt-marker'

const TOKEN = 'canon-allow-example'

describe('isMarked', () => {
  it('should read a marker naming a reason on the line itself', () => {
    const lines = [`value # ${TOKEN}: the arm pins this on purpose`]

    expect(isMarked(lines, 0, TOKEN)).toBe(true)
  })

  it('should read a marker naming a reason on the line above', () => {
    const lines = [`# ${TOKEN}: the arm pins this on purpose`, 'value']

    expect(isMarked(lines, 1, TOKEN)).toBe(true)
  })

  it('should reject a bare marker naming no reason', () => {
    const lines = [`# ${TOKEN}:`, 'value']

    expect(isMarked(lines, 1, TOKEN)).toBe(false)
  })

  it('should reject a marker two lines above the one it would mute', () => {
    const lines = [`# ${TOKEN}: too far up`, 'spacer', 'value']

    expect(isMarked(lines, 2, TOKEN)).toBe(false)
  })

  it('should match a token carrying a regex metacharacter as a literal', () => {
    const lines = ['value # a.b: a reason']

    expect(isMarked(lines, 0, 'a.b')).toBe(true)
    expect(isMarked(lines, 0, 'axb')).toBe(false)
  })

  it('should not throw on a token that is not a valid pattern on its own', () => {
    const lines = ['value # a(b: a reason']

    expect(isMarked(lines, 0, 'a(b')).toBe(true)
  })
})
