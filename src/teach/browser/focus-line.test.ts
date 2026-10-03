import { describe, expect, it } from 'vitest'
import { focusLine } from '@/teach/browser/focus-line'

describe('focusLine', () => {
  it('should reach the very bottom of the viewport at max scroll', () => {
    for (const innerHeight of [400, 600, 900, 1200, 2000]) {
      expect(focusLine(1000, 1000, innerHeight)).toBe(innerHeight)
    }
  })

  it('should reach a heading with under 120px of trailing content across several viewport heights', () => {
    for (const innerHeight of [400, 600, 900, 1200, 2000]) {
      const max = 3000
      const trailing = 40
      const lastHeadingTopAtRest = max + innerHeight - trailing

      let reached = false
      for (let scrollY = 0; scrollY <= max; scrollY += 5) {
        const top = lastHeadingTopAtRest - scrollY
        if (top <= focusLine(scrollY, max, innerHeight)) {
          reached = true
          break
        }
      }

      expect(reached).toBe(true)
    }
  })

  it('should stay at innerHeight when the page does not scroll', () => {
    expect(focusLine(0, 0, 800)).toBe(800)
  })
})
