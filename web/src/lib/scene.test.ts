import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { armEntry, escapeHtml, holdOn, pacer } from './scene'

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

describe('holdOn with a pause button', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  const pauseButton = () =>
    Object.assign(new EventTarget(), {
      dataset: { pause: 'Pause the animation', play: 'Play the animation' },
      attributes: {} as Record<string, string>,
      setAttribute(name: string, value: string) {
        this.attributes[name] = value
      },
    })

  it('should hold a pacer while paused and resume once played again', async () => {
    const button = pauseButton()
    const pace = pacer(holdOn(new EventTarget() as Element, button))
    const generation = pace.next()
    let done = false

    button.dispatchEvent(new Event('click'))
    void pace.wait(100, generation).then(() => (done = true))
    await vi.advanceTimersByTimeAsync(500)
    const whilePaused = done
    button.dispatchEvent(new Event('click'))
    await vi.advanceTimersByTimeAsync(100)

    expect(whilePaused).toBe(false)
    expect(done).toBe(true)
  })

  it('should stay paused after the pointer enters and leaves the window', () => {
    const win = new EventTarget() as Element
    const button = pauseButton()
    const held = holdOn(win, button)

    button.dispatchEvent(new Event('click'))
    win.dispatchEvent(new Event('pointerenter'))
    win.dispatchEvent(new Event('pointerleave'))

    expect(held()).toBe(true)
  })

  it('should name the action the button takes next', () => {
    const button = pauseButton()
    holdOn(new EventTarget() as Element, button)

    button.dispatchEvent(new Event('click'))

    expect(button.attributes['aria-label']).toBe('Play the animation')
    expect(button.attributes['data-paused']).toBe('true')
  })
})

describe('armEntry', () => {
  const stage = () => {
    const classes = new Set<string>()
    return { classes, classList: { add: (name: string) => classes.add(name) } }
  }

  it('should arm the section and play once it comes into view', () => {
    const node = stage()
    let enter = () => {}
    const play = vi.fn()

    const armed = armEntry(node, false, (_, onEnter) => (enter = onEnter), play)
    const before = [...node.classes]
    enter()

    expect(armed).toBe(true)
    expect(before).toEqual(['armed'])
    expect([...node.classes]).toEqual(['armed', 'in'])
    expect(play).toHaveBeenCalledOnce()
  })

  it('should leave the section at its end state under reduced motion', () => {
    const node = stage()
    const watch = vi.fn()
    const play = vi.fn()

    const armed = armEntry(node, true, watch, play)

    expect(armed).toBe(false)
    expect([...node.classes]).toEqual([])
    expect(watch).not.toHaveBeenCalled()
    expect(play).not.toHaveBeenCalled()
  })
})

describe('escapeHtml', () => {
  it('should escape the characters that open markup', () => {
    expect(escapeHtml('<a> & b')).toBe('&lt;a> &amp; b')
  })
})
