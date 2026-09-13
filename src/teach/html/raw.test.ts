import { describe, expect, it } from 'vitest'
import { escape, isRaw, raw } from './raw'

describe('raw', () => {
  it('should mark its output as raw', () => {
    expect(isRaw(raw('<b>hi</b>'))).toBe(true)
  })

  it('should not mark a plain string as raw', () => {
    expect(isRaw('<b>hi</b>')).toBe(false)
  })

  it('should carry the html unchanged', () => {
    expect(raw('<b>hi</b>').html).toBe('<b>hi</b>')
  })
})

describe('escape', () => {
  it('should escape an ampersand', () => {
    expect(escape('rollback & retry')).toBe('rollback &amp; retry')
  })

  it('should escape angle brackets and quotes', () => {
    expect(escape('<a href="x">')).toBe('&lt;a href=&quot;x&quot;&gt;')
  })
})
