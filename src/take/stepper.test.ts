import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { withinCap } from '@/take/stepper'

/**
 * Covers the capped race both stepper waits share. A cap timer that outlives
 * the race keeps the process alive until it fires, so `canon take` exits late
 * by the cap, which these tests count rather than time.
 */

describe('withinCap', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should resolve the work and leave no timer behind when the work wins', async () => {
    const result = await withinCap(Promise.resolve('ok'), 15_000)

    expect(result).toBe('ok')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('should resolve empty when the cap fires first', async () => {
    const pending = withinCap(new Promise<string>(() => {}), 2000)

    await vi.advanceTimersByTimeAsync(2000)

    expect(await pending).toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('should rethrow a rejection and leave no timer behind', async () => {
    await expect(
      withinCap(Promise.reject(new Error('navigation failed')), 15_000),
    ).rejects.toThrow('navigation failed')

    expect(vi.getTimerCount()).toBe(0)
  })
})
