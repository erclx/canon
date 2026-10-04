import { describe, expect, it } from 'vitest'
import { isBinary } from '@/sweep/binary'

describe('isBinary', () => {
  it('should read a NUL byte as binary', () => {
    expect(isBinary(`a${String.fromCharCode(0)}b`)).toBe(true)
  })

  it('should read ordinary source as text', () => {
    expect(isBinary('const a = 1\n')).toBe(false)
  })
})
