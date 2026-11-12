import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { alignTicks, withinCap } from '@/take/stepper'

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

/**
 * Covers the lift that keeps the frame ticks at or ahead of the page clock at
 * the pause. A transition the page starts after the pause runs on the later of
 * the two, so ticks left behind it film the transition dead for the whole clip.
 */

describe('alignTicks', () => {
  const FRAME_MS = 1000 / 60
  const loadTicks = 100_000
  const loadEventStart = 2000

  it('should keep the ticks when they lead the page clock', () => {
    const pageNow = 6000
    const ticks = loadTicks + (pageNow - loadEventStart) + 700

    expect(alignTicks({ ticks, loadTicks, pageNow, loadEventStart })).toBe(
      ticks,
    )
  })

  it('should lift the ticks a frame past the page clock when they lag it by seconds', () => {
    const pageNow = 9200
    const ticks = loadTicks + (pageNow - loadEventStart) - 4300

    expect(alignTicks({ ticks, loadTicks, pageNow, loadEventStart })).toBe(
      loadTicks + (pageNow - loadEventStart) + FRAME_MS,
    )
  })

  it('should lift the ticks one frame when they tie the page clock', () => {
    const pageNow = 6000
    const ticks = loadTicks + (pageNow - loadEventStart)

    expect(alignTicks({ ticks, loadTicks, pageNow, loadEventStart })).toBe(
      ticks + FRAME_MS,
    )
  })

  it.each([
    ['no navigation entry', undefined],
    ['a load that never started', 0],
    ['a non-numeric reading', Number.NaN],
  ])('should keep the ticks given %s', (_, start) => {
    const ticks = loadTicks + 1000

    expect(
      alignTicks({ ticks, loadTicks, pageNow: 9200, loadEventStart: start }),
    ).toBe(ticks)
  })
})
