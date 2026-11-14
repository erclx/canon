import type { Page } from 'playwright-core'
import type { Finding } from '@/driver/steps'

/**
 * Reads SVG label geometry off the rendered page, in two probes that differ by
 * what they compare a label against.
 *
 * Everything is measured in the browser after `document.fonts.ready`, never
 * computed from the markup, because a generated page is routinely authored
 * against one font and rendered in another, which moves every label.
 *
 * `clientWidth` is not the reading. Comparing it to `scrollWidth` flags every
 * label whose string is wider than its element box whether or not anything is
 * cut, which is why both probes compare geometry against other geometry.
 */

/**
 * Trims the slack a text rect carries above and below the glyphs. Vertical
 * only: a text rect is loose top and bottom and tight to the glyphs left and
 * right, and a one-pixel horizontal inset was enough to pass a label overrunning
 * a panel border by three tenths of a unit. Insetting the vertical band alone
 * stayed free of false positives across 41 strokes.
 */
const VERTICAL_INSET_PX = 2

/**
 * How far two labels overlap before it counts. An SVG text rect is the full
 * font box rather than the ink, so two properly spaced lines touch by a pixel
 * and a zero threshold reports every one of them.
 */
const COLLISION_PX = 2

/** Sampling interval along a stroke, in device pixels. */
const STROKE_SAMPLE_PX = 2

/** Bounds the sampling of one stroke, so a long path cannot stall the pass. */
const MAX_STROKE_SAMPLES = 600

export async function probeDiagramGeometry(page: Page): Promise<Finding[]> {
  const rows = await page.evaluate(
    async ([inset, collision]: [number, number]) => {
      await document.fonts.ready

      const describe = (element: Element): string => {
        const owner = element.closest('svg')
        const label = (element.textContent ?? '').trim().slice(0, 40)
        const id = owner?.id ? `svg#${owner.id}` : 'svg'
        return label ? `${id} text "${label}"` : `${id} text`
      }

      const insetRect = (element: Element) => {
        const rect = element.getBoundingClientRect()
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top + inset,
          bottom: rect.bottom - inset,
        }
      }

      const overlap = (
        a: { left: number; right: number; top: number; bottom: number },
        b: { left: number; right: number; top: number; bottom: number },
      ) => ({
        x: Math.min(a.right, b.right) - Math.max(a.left, b.left),
        y: Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top),
      })

      const found: { selector: string; detail: string; measured: string }[] = []

      for (const root of Array.from(document.querySelectorAll('svg'))) {
        const painted = Array.from(root.querySelectorAll('*'))
        const labels = Array.from(root.querySelectorAll('text'))
        const frame = root.getBoundingClientRect()

        for (const label of labels) {
          const rect = insetRect(label)
          if (rect.right <= rect.left || rect.bottom <= rect.top) continue

          if (
            rect.left < frame.left - collision ||
            rect.right > frame.right + collision ||
            rect.top < frame.top - collision ||
            rect.bottom > frame.bottom + collision
          ) {
            found.push({
              selector: describe(label),
              detail: 'is painted outside its own frame',
              measured: `label spans ${Math.round(rect.left)}..${Math.round(rect.right)} horizontally and ${Math.round(rect.top)}..${Math.round(rect.bottom)} vertically, against a frame of ${Math.round(frame.left)}..${Math.round(frame.right)} and ${Math.round(frame.top)}..${Math.round(frame.bottom)}, vertical inset ${inset}px`,
            })
          }

          const order = painted.indexOf(label)
          for (const shape of painted) {
            if (shape === label) continue
            if (shape.tagName.toLowerCase() === 'text') continue
            if (getComputedStyle(shape).fill === 'none') continue
            if (!shape.getBoundingClientRect) continue

            const box = shape.getBoundingClientRect()
            if (box.width === 0 || box.height === 0) continue

            const hit = overlap(rect, {
              left: box.left,
              right: box.right,
              top: box.top,
              bottom: box.bottom,
            })
            if (hit.x <= collision || hit.y <= collision) continue

            const after = painted.indexOf(shape) > order
            found.push({
              selector: describe(label),
              detail: after
                ? `is covered by a filled ${shape.tagName.toLowerCase()} painted after it`
                : `sits over a filled ${shape.tagName.toLowerCase()} with no plate behind the glyphs`,
              measured: `${Math.round(hit.x)}x${Math.round(hit.y)}px of overlap, vertical inset ${inset}px`,
            })
          }
        }

        for (let first = 0; first < labels.length; first += 1) {
          for (let second = first + 1; second < labels.length; second += 1) {
            const a = labels[first]
            const b = labels[second]
            if (!a || !b) continue

            const hit = overlap(insetRect(a), insetRect(b))
            if (hit.x <= collision || hit.y <= collision) continue

            found.push({
              selector: describe(a),
              detail: `collides with ${describe(b)}`,
              measured: `${Math.round(hit.x)}x${Math.round(hit.y)}px of overlap, past the ${collision}px threshold, vertical inset ${inset}px`,
            })
          }
        }
      }

      return found
    },
    [VERTICAL_INSET_PX, COLLISION_PX] as [number, number],
  )

  return rows.map((row) => ({ probe: 'diagram-geometry' as const, ...row }))
}

/**
 * Reports a stroke crossing a label, sampled along the stroke's own geometry.
 *
 * A bounding box cannot answer this. Filtering to filled shapes drops every
 * `line` and every `fill="none"` panel border, and a diagonal connector's box
 * covers most of the diagram while the stroke touches almost none of it.
 *
 * Both paint orders are findings. A stroke drawn after the label crosses the
 * glyphs out, and one drawn before it shows through them, since SVG text
 * carries no background plate of its own.
 */
export async function probeDiagramStrokes(page: Page): Promise<Finding[]> {
  const rows = await page.evaluate(
    async ([inset, interval, maxSamples]: [number, number, number]) => {
      await document.fonts.ready

      const describe = (element: Element): string => {
        const owner = element.closest('svg')
        const label = (element.textContent ?? '').trim().slice(0, 40)
        const id = owner?.id ? `svg#${owner.id}` : 'svg'
        return label ? `${id} text "${label}"` : `${id} text`
      }

      const insetRect = (element: Element) => {
        const rect = element.getBoundingClientRect()
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top + inset,
          bottom: rect.bottom - inset,
        }
      }

      const found: { selector: string; detail: string; measured: string }[] = []

      for (const root of Array.from(document.querySelectorAll('svg'))) {
        const painted = Array.from(root.querySelectorAll('*'))
        const labels = Array.from(root.querySelectorAll('text'))
        if (labels.length === 0) continue

        for (const shape of painted) {
          if (!(shape instanceof SVGGeometryElement)) continue
          if (getComputedStyle(shape).stroke === 'none') continue

          // Read off the shape, since `getPointAtLength` answers in the shape's own user
          // space and a generated diagram nests most shapes under a transformed `g`.
          const matrix = shape.getScreenCTM()
          if (!matrix) continue

          let length = 0
          try {
            length = shape.getTotalLength()
          } catch {
            continue
          }
          if (length === 0) continue

          const samples = Math.min(
            maxSamples,
            Math.max(2, Math.ceil(length / interval)),
          )
          const order = painted.indexOf(shape)
          const crossed = new Map<Element, number>()

          for (let step = 0; step <= samples; step += 1) {
            const point = shape.getPointAtLength((length * step) / samples)
            const screen = new DOMPoint(point.x, point.y).matrixTransform(
              matrix,
            )

            for (const label of labels) {
              const rect = insetRect(label)
              if (rect.bottom <= rect.top) continue
              if (screen.x < rect.left || screen.x > rect.right) continue
              if (screen.y < rect.top || screen.y > rect.bottom) continue
              crossed.set(label, (crossed.get(label) ?? 0) + 1)
            }
          }

          for (const [label, hits] of crossed) {
            const after = order > painted.indexOf(label)
            found.push({
              selector: describe(label),
              detail: after
                ? `is crossed out by a ${shape.tagName.toLowerCase()} stroked after it`
                : `is painted over a ${shape.tagName.toLowerCase()} stroke that shows through the glyphs`,
              measured: `${hits} of ${samples + 1} points sampled along the stroke land inside the label, vertical inset ${inset}px`,
            })
          }
        }
      }

      return found
    },
    [VERTICAL_INSET_PX, STROKE_SAMPLE_PX, MAX_STROKE_SAMPLES] as [
      number,
      number,
      number,
    ],
  )

  return rows.map((row) => ({ probe: 'diagram-strokes' as const, ...row }))
}
