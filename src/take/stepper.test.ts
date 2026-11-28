import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  StepperStalled,
  ackLimit,
  alignTicks,
  retryScale,
  stepThen,
  withinCap,
} from '@/take/stepper'

describe('StepperStalled', () => {
  it.each(['settle', 'setup', 'recording'] as const)(
    'should carry the %s phase and keep the frame stepping text',
    (phase) => {
      const stall = new StepperStalled(0, 2000, phase)

      expect(stall.phase).toBe(phase)
      expect(stall.wait).toBe('frame')
      expect(stall.message).toBe(
        `frame 0 took over 2 s in ${phase} under frame stepping`,
      )
    },
  )

  it('should name the input rather than the frame when an acknowledgement stalled', () => {
    const stall = new StepperStalled(107, 8000, 'recording', 'input')

    expect(stall.message).toBe(
      'the input after frame 107 took over 8 s to acknowledge in recording under frame stepping',
    )
  })
})

describe('retryScale', () => {
  it('should retry a stall in recording at scale 2 at scale 1', () => {
    expect(retryScale('recording', 2)).toBe(1)
  })

  it.each([
    ['settle', 2],
    ['setup', 2],
    ['settle', 1],
    ['setup', 1],
    ['recording', 1],
  ] as const)(
    'should send a stall in %s at scale %i to the screencast',
    (phase, scale) => {
      expect(retryScale(phase, scale)).toBeUndefined()
    },
  )
})

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
 * Covers the wait a recorded input makes on its acknowledgement after its
 * frame. The page acknowledges an input only once its handler returns, so a
 * handler that blocks after the frame holds the take unless the wait is timed.
 */

describe('stepThen', () => {
  const frameDone = () => Promise.resolve()

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  const bound = (frames: number) => ({
    stallMs: 2000,
    lastFrame: () => frames,
  })

  it('should stall in recording at the frame count when the acknowledgement never comes', async () => {
    const outcome = stepThen(new Promise(() => {}), frameDone, bound(3))
      .then(() => undefined)
      .catch((error: unknown) => error)

    await vi.advanceTimersByTimeAsync(2000)

    const stall = await outcome
    expect(stall).toBeInstanceOf(StepperStalled)
    expect(stall).toMatchObject({ frame: 3, phase: 'recording', wait: 'input' })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('should resolve and leave no timer behind when the acknowledgement comes inside the limit', async () => {
    let acknowledge = () => {}
    const sent = new Promise<void>((done) => {
      acknowledge = done
    })
    const outcome = stepThen(sent, frameDone, bound(0))

    await vi.advanceTimersByTimeAsync(1999)
    acknowledge()

    await expect(outcome).resolves.toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('should rethrow a frame stall and swallow the acknowledgement rejected after it', async () => {
    let reject: (error: Error) => void = () => {}
    const sent = new Promise<void>((_, fail) => {
      reject = fail
    })
    const frameStalled = () =>
      Promise.reject(new StepperStalled(5, 2000, 'recording'))

    await expect(stepThen(sent, frameStalled, bound(5))).rejects.toThrow(
      'frame 5 took over 2 s in recording',
    )
    reject(new Error('the shell closed its connection'))
    await vi.advanceTimersByTimeAsync(0)

    expect(vi.getTimerCount()).toBe(0)
  })
})

/**
 * Covers how long each pointer input's acknowledgement may take. A move that
 * misses its frame waits for Chromium's next flush, measured at 2.5 s steps up
 * to 5011 ms under load, while a press, a release, and a wheel came within 31 ms.
 */

describe('ackLimit', () => {
  const at = { x: 10, y: 20 }

  it('should give a move room for two flushes past the slowest one measured', () => {
    expect(ackLimit({ type: 'move', ...at }, 2000)).toBeGreaterThanOrEqual(
      5011 + 2 * 2500,
    )
  })

  it('should never give a move less than the stall limit', () => {
    expect(ackLimit({ type: 'move', ...at }, 60_000)).toBe(60_000)
  })

  it.each([
    ['a press', { type: 'down', ...at, clickCount: 1 }],
    ['a release', { type: 'up', ...at, clickCount: 1 }],
    ['a wheel', { type: 'wheel', ...at, dy: 120 }],
  ] as const)('should hold %s to the stall limit', (_, input) => {
    expect(ackLimit(input, 2000)).toBe(2000)
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
