import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { escapeHtml, pacer } from './scene'

describe('pacer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('should resolve true once the time runs out on the current generation', async () => {
    const pace = pacer()
    const generation = pace.next()

    const waited = pace.wait(200, generation)
    await vi.advanceTimersByTimeAsync(200)

    await expect(waited).resolves.toBe(true)
  })

  it('should resolve false once a later play takes over', async () => {
    const pace = pacer()
    const first = pace.next()

    const waited = pace.wait(200, first)
    pace.next()
    await vi.advanceTimersByTimeAsync(200)

    await expect(waited).resolves.toBe(false)
  })

  it('should stand still while the window is held', async () => {
    let held = true
    const pace = pacer(() => held)
    const generation = pace.next()
    let done = false

    void pace.wait(100, generation).then(() => (done = true))
    await vi.advanceTimersByTimeAsync(500)
    const whileHeld = done
    held = false
    await vi.advanceTimersByTimeAsync(100)

    expect(whileHeld).toBe(false)
    expect(done).toBe(true)
  })
})

describe('escapeHtml', () => {
  it('should escape the characters that open markup', () => {
    expect(escapeHtml('<a> & b')).toBe('&lt;a> &amp; b')
  })
})
