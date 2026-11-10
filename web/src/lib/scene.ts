/**
 * Pacing for the sections that play a scene in a product window. Each new
 * play takes a generation, and a wait reports false once a later play has
 * superseded it, so a click mid-scene cancels the scene it interrupts.
 *
 * A wait also stands still while the reader holds the window by pointer or
 * focus, so a looping window never moves under the person reading it.
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

/** Reports whether a pointer is over `node` or focus sits inside it. */
export function holdOn(node: Element | null): () => boolean {
  if (!node) return () => false
  let pointer = false
  let focus = false
  node.addEventListener('pointerenter', () => (pointer = true))
  node.addEventListener('pointerleave', () => (pointer = false))
  node.addEventListener('focusin', () => (focus = true))
  node.addEventListener('focusout', (event) => {
    const next = (event as FocusEvent).relatedTarget
    focus = next instanceof Node && node.contains(next)
  })
  return () => pointer || focus
}

export const reducedMotion = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches

export const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
