import { describe, expect, it } from 'vitest'
import { planSwipe, touchPath } from '@/browser/swipe'

describe('touchPath', () => {
  it('should move the finger up in 20 px steps for a positive dy', () => {
    expect(touchPath(700, 100)).toEqual([680, 660, 640, 620, 600])
  })

  it('should move the finger down for a negative dy', () => {
    expect(touchPath(200, -60)).toEqual([220, 240, 260])
  })

  it('should land the last move exactly on y - dy when dy is off the step', () => {
    expect(touchPath(700, 50)).toEqual([680, 660, 650])
  })

  it('should make one move for a dy shorter than a step', () => {
    expect(touchPath(700, 5)).toEqual([695])
  })
})

describe('planSwipe', () => {
  it('should plan a run-code function dispatching the touch path', () => {
    const plan = planSwipe(['195', '700', '100'])

    expect(plan.kind).toBe('planned')
    if (plan.kind !== 'planned') return
    expect(plan.code).toMatch(/^async \(page\) =>/)
    expect(plan.code).toContain('Input.dispatchTouchEvent')
    expect(plan.code).toContain('[680,660,640,620,600]')
  })

  it.each([
    ['a missing argument', ['195', '700']],
    ['an extra argument', ['195', '700', '580', '1']],
    ['a non-number', ['195', 'down', '580']],
    ['a blank word', ['195', ' ', '580']],
    ['a dy of 0', ['195', '700', '0']],
    ['a start off the page', ['-1', '700', '580']],
  ])('should refuse %s', (_name, words) => {
    expect(planSwipe(words).kind).toBe('refused')
  })
})
