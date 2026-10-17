import { describe, expect, it } from 'vitest'
import { isShapeGated } from '@/context/shape-gated'

describe('isShapeGated', () => {
  it('should gate an entry under a listed prefix', () => {
    expect(
      isShapeGated('canon/context/design/render.md', ['canon/context/design/']),
    ).toBe(true)
  })

  it('should leave an entry under no listed prefix ungated', () => {
    expect(
      isShapeGated('canon/context/cli/overview.md', ['canon/context/design/']),
    ).toBe(false)
  })

  it('should gate nothing while the list is empty', () => {
    expect(isShapeGated('canon/context/cli/overview.md', [])).toBe(false)
  })
})
