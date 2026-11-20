/**
 * Paces a scene window. A later play cancels the waits of the one it
 * interrupts, and a wait stands still while the reader holds the window.
 */
export interface Pacer {
  /** Starts a new generation, cancelling every wait the last one holds. */
  next(): number
  /** Resolves true after `ms` of unheld time, or false once `generation` is stale. */
  wait(ms: number, generation: number): Promise<boolean>
}

const STEP = 50

export function pacer(held: () => boolean = () => false): Pacer {
  let current = 0
  return {
    next: () => ++current,
    async wait(ms, generation) {
      let left = ms
      while (left > 0) {
        const slice = Math.min(left, STEP)
        await new Promise((resolve) => setTimeout(resolve, slice))
        if (generation !== current) return false
        if (!held()) left -= slice
      }
      return generation === current
    },
  }
}

/** The part of a button `holdOn` reads, so a test can hand it a plain target. */
interface PauseButton extends EventTarget {
  dataset: DOMStringMap
  setAttribute(name: string, value: string): void
}

/**
 * Holds while a pointer or focus is on `node` or `pause` is pressed. The button
 * sits outside the window, and swaps its label between `data-pause` and `data-play`.
 */
export function holdOn(
  node: Element | null,
  pause?: PauseButton | null,
): () => boolean {
  let paused = false
  pause?.addEventListener('click', () => {
    paused = !paused
    pause.setAttribute('data-paused', String(paused))
    pause.setAttribute(
      'aria-label',
      (paused ? pause.dataset.play : pause.dataset.pause) ?? '',
    )
  })
  if (!node) return () => paused
  let pointer = false
  let focus = false
  node.addEventListener('pointerenter', () => (pointer = true))
  node.addEventListener('pointerleave', () => (pointer = false))
  node.addEventListener('focusin', () => (focus = true))
  node.addEventListener('focusout', (event) => {
    const next = (event as FocusEvent).relatedTarget
    focus = next instanceof Node && node.contains(next)
  })
  return () => paused || pointer || focus
}

export const reducedMotion = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches

/** The part of a section `armEntry` marks, so a test can hand it a plain object. */
interface Stage {
  readonly classList: { add(token: string): void }
}

/**
 * Marks a section `armed`, which its sheet reads to hold the motion's start
 * state, then `in` and `play` once `watch` reports it in view. Under reduced
 * motion it marks nothing, so the sheet's unmarked rules show the end state.
 */
export function armEntry<T extends Stage>(
  node: T,
  reduced: boolean,
  watch: (node: T, enter: () => void) => void,
  play: () => void = () => {},
): boolean {
  if (reduced) return false
  node.classList.add('armed')
  watch(node, () => {
    node.classList.add('in')
    play()
  })
  return true
}

function watchOnce(node: Element, enter: () => void) {
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      enter()
    },
    { threshold: 0.25 },
  )
  observer.observe(node)
}

/** Plays a section's motion once, the first time a quarter of it is in view. */
export const playOnEntry = (node: Element | null, play?: () => void) =>
  node ? armEntry(node, reducedMotion(), watchOnce, play) : false

export const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
