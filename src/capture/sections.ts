import type { Page } from 'playwright-core'

/**
 * The split, the merge, and the page preparation behind `canon capture
 * --sections`. The thresholds are the ones track 218 measured on Notion,
 * Vercel, Linear, and ElevenLabs, and nothing beyond those four sites tuned
 * them.
 */

/** A block taller than this many viewports splits into its children. */
const SPLIT_VIEWPORTS = 1.6
/** A child shorter than this is decoration rather than a block of its own. */
const MIN_CHILD_HEIGHT = 120
/** A child narrower than this share of the viewport is a column, not a band. */
const MIN_WIDTH_SHARE = 0.6
/** A block shorter than this joins the section above it. */
export const MERGE_BELOW_PX = 400
/** The tallest shot a section takes, in CSS pixels. Taller is cut. */
export const MAX_SECTION_PX = 2400

const SECTION_ATTRIBUTE = 'data-canon-section'
const WHEEL_STEP_PX = 600
const WHEEL_PAUSE_MS = 150
const SETTLE_MS = 800
const NETWORK_IDLE_MS = 5_000

/** One block the split found, in document coordinates and page order. */
export interface Block {
  readonly index: number
  readonly top: number
  readonly height: number
}

/** One or more adjacent blocks shot as one image. */
export interface Section {
  readonly blocks: readonly number[]
  readonly top: number
  readonly height: number
}

/**
 * Loads what a reader would see by the time they reached each part of the
 * page, then hides every fixed and sticky layer so none paints into the middle
 * of a shot. Hiding is how a consent banner leaves, since a click on one
 * decides something on the operator's behalf.
 *
 * Wheeling rather than `scrollTo`, because a lazy loader listening for wheel
 * or for intersection sees each step, and a jump to the bottom skips them.
 */
export async function preparePage(page: Page): Promise<void> {
  await page
    .waitForLoadState('networkidle', { timeout: NETWORK_IDLE_MS })
    .catch(() => undefined)
  const height = await page.evaluate(
    () => document.documentElement.scrollHeight,
  )
  for (let y = 0; y < height; y += WHEEL_STEP_PX) {
    await page.mouse.wheel(0, WHEEL_STEP_PX)
    await page.waitForTimeout(WHEEL_PAUSE_MS)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(SETTLE_MS)
  await page.evaluate(() => {
    for (const element of document.querySelectorAll<HTMLElement>('body *')) {
      const position = getComputedStyle(element).position
      if (position === 'fixed' || position === 'sticky') {
        element.style.setProperty('visibility', 'hidden', 'important')
      }
    }
  })
}

/**
 * Walks down from the root, splitting any block taller than the split
 * threshold into its full-width children, and tags each block it keeps so a
 * later step can find it again. Null when the root selector matched nothing.
 *
 * With no root named, `main` is tried and then `body`, since track 218 found
 * `main` on every site it tried and a page without one still has a body.
 */
export async function splitBlocks(
  page: Page,
  root: string | undefined,
): Promise<Block[] | null> {
  return page.evaluate(
    ({ root, attribute, splitViewports, minChildHeight, minWidthShare }) => {
      const start = root
        ? document.querySelector(root)
        : (document.querySelector('main') ?? document.body)
      if (!start) return null

      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const measure = (element: Element) => {
        const rect = element.getBoundingClientRect()
        return {
          element,
          top: Math.round(rect.top + window.scrollY),
          height: Math.round(rect.height),
          width: Math.round(rect.width),
        }
      }
      type Measured = ReturnType<typeof measure>
      const split = (element: Element): Measured[] => {
        const box = measure(element)
        if (box.height <= viewportHeight * splitViewports) return [box]
        const children = [...element.children]
          .map(measure)
          .filter(
            (child) =>
              child.height >= minChildHeight &&
              child.width >= viewportWidth * minWidthShare,
          )
        if (children.length === 0) return [box]
        return children.flatMap((child) => split(child.element))
      }

      return split(start)
        .filter((box) => box.height > 0)
        .map((box, index) => {
          box.element.setAttribute(attribute, String(index))
          return { index, top: box.top, height: box.height }
        })
    },
    {
      root,
      attribute: SECTION_ATTRIBUTE,
      splitViewports: SPLIT_VIEWPORTS,
      minChildHeight: MIN_CHILD_HEIGHT,
      minWidthShare: MIN_WIDTH_SHARE,
    },
  )
}

/**
 * Joins each block shorter than the merge threshold to the section above it,
 * so a page built of thin bands comes back as the sections a person would
 * name. A short first block has nothing above it and joins the one below.
 *
 * A merge that would carry a section past the shot cap starts a new section
 * instead, so a run of bands under a tall block is not cut off by the cap.
 */
export function mergeBlocks(
  blocks: readonly Block[],
  minHeight: number = MERGE_BELOW_PX,
  maxHeight: number = MAX_SECTION_PX,
): Section[] {
  const sections: Section[] = []
  let leading: Block[] = []
  for (const block of blocks) {
    const last = sections.at(-1)
    if (last === undefined) {
      leading.push(block)
      const span = spanOf(leading)
      if (span.height >= minHeight) {
        sections.push(span)
        leading = []
      }
      continue
    }
    const merged = spanOf([last, block])
    if (block.height < minHeight && merged.height <= maxHeight) {
      sections[sections.length - 1] = {
        ...merged,
        blocks: [...last.blocks, block.index],
      }
    } else {
      sections.push(spanOf([block]))
    }
  }
  if (leading.length) sections.push(spanOf(leading))
  return sections
}

function spanOf(parts: readonly (Block | Section)[]): Section {
  const top = Math.min(...parts.map((part) => part.top))
  const bottom = Math.max(...parts.map((part) => part.top + part.height))
  const blocks = parts.flatMap((part) =>
    'blocks' in part ? part.blocks : [part.index],
  )
  return { blocks, top, height: bottom - top }
}

/** The clip a section's shot takes, measured again after it scrolled in. */
export interface Clip {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * Scrolls a section's first block into view so a reveal-on-view block paints,
 * waits for it to settle, then measures the union of its blocks in document
 * coordinates, cut at the shot cap. Measured after the scroll rather than
 * taken from the split, since content loading above can move it.
 */
export async function revealSection(
  page: Page,
  section: Section,
): Promise<Clip | null> {
  const first = section.blocks[0]
  if (first === undefined) return null
  await page
    .locator(`[${SECTION_ATTRIBUTE}="${first}"]`)
    .scrollIntoViewIfNeeded()
    .catch(() => undefined)
  await page.waitForTimeout(SETTLE_MS)
  return page.evaluate(
    ({ attribute, blocks, cap }) => {
      const rects = blocks
        .map((index) => document.querySelector(`[${attribute}="${index}"]`))
        .filter((element): element is Element => element !== null)
        .map((element) => element.getBoundingClientRect())
      if (!rects.length) return null
      const left = Math.min(...rects.map((rect) => rect.left))
      const right = Math.max(...rects.map((rect) => rect.right))
      const top = Math.min(...rects.map((rect) => rect.top))
      const bottom = Math.max(...rects.map((rect) => rect.bottom))
      const width = Math.round(right - left)
      const height = Math.round(Math.min(bottom - top, cap))
      if (width <= 0 || height <= 0) return null
      return {
        x: Math.max(0, Math.round(left + window.scrollX)),
        y: Math.max(0, Math.round(top + window.scrollY)),
        width,
        height,
      }
    },
    {
      attribute: SECTION_ATTRIBUTE,
      blocks: section.blocks,
      cap: MAX_SECTION_PX,
    },
  )
}
