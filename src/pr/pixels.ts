import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

/** How different two colors must be for a pixel to count, where 1 is black against white. Playwright's 0.2 passed a real contrast fix. */
const COLOR_THRESHOLD = 0.1

/** The side of the square the count is taken over, so noise scattered across the image never adds up while a compact change does. */
const WINDOW_SIZE = 16

/** The most differing pixels any window may hold and still read as noise. Measured on Frameboard, noise counted 2 or fewer and real changes 14 or more. */
const MAX_WINDOW_PIXELS = 6

function decode(bytes: Uint8Array): PNG | undefined {
  try {
    return PNG.sync.read(Buffer.from(bytes))
  } catch {
    return undefined
  }
}

/**
 * Whether two PNG captures differ by no more than sub-visual noise. Anti-aliased
 * pixels are counted rather than skipped, since antialias detection reads a
 * changed 1px border as an edge artifact, and the windowed count separates
 * scattered edge noise from a compact change on its own. A pair that does not decode or differs in size reads as changed, so
 * nothing the comparison cannot read is ever folded.
 */
export function isWithinTolerance(base: Uint8Array, head: Uint8Array): boolean {
  const before = decode(base)
  const after = decode(head)
  if (before === undefined || after === undefined) return false
  if (before.width !== after.width || before.height !== after.height) {
    return false
  }
  const count = pixelmatch(
    before.data,
    after.data,
    null,
    before.width,
    before.height,
    { threshold: COLOR_THRESHOLD, includeAA: true, windowSize: WINDOW_SIZE },
  )
  return count <= MAX_WINDOW_PIXELS
}
