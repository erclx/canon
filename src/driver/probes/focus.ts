import type { Page } from 'playwright-core'
import { enterKeyboardModality } from '@/browser/engine'
import type { Finding } from '@/driver/steps'

/**
 * Reports every element that takes focus and changes nothing a person can see.
 * `enterKeyboardModality` presses Tab first, since `:focus-visible` does not match
 * a scripted `.focus()` in pointer modality. The reader is serialized to source, so every helper is declared inside it.
 */

/** The elements a keyboard reaches without the page authoring a tab order. */
const FOCUSABLE =
  'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])'

/** What a ring is allowed to move, read at rest and again under focus. */
const PROPERTIES = [
  'outlineStyle',
  'outlineWidth',
  'outlineColor',
  'outlineOffset',
  'boxShadow',
  'borderColor',
  'backgroundColor',
  'color',
  'textDecorationLine',
] as const

export async function probeFocus(page: Page): Promise<Finding[]> {
  await enterKeyboardModality(page)

  const rows = await page.evaluate(
    ([query, properties]: [string, readonly string[]]) => {
      const describe = (element: Element): string => {
        const tag = element.tagName.toLowerCase()
        if (element.id) return `${tag}#${element.id}`
        const className = element.getAttribute('class')?.trim().split(/\s+/)[0]
        return className ? `${tag}.${className}` : tag
      }

      const snapshot = (element: Element): string[] => {
        const computed = getComputedStyle(element)
        return properties.map(
          (property) => computed[property as 'color'] as string,
        )
      }

      // The modality press left one element focused, so every element starts and ends this pass blurred.
      const entry = document.activeElement
      if (entry instanceof HTMLElement) entry.blur()

      const found: { selector: string; visible: boolean; detail: string }[] = []

      for (const element of Array.from(document.querySelectorAll(query))) {
        if (!(element instanceof HTMLElement)) continue
        // Tested by painted box, since `offsetParent` is null for a `fixed` element on screen.
        if (element.getClientRects().length === 0) continue
        if (getComputedStyle(element).visibility === 'hidden') continue

        const rest = snapshot(element)
        element.focus()
        // An element the browser refuses to focus is skipped, since a disabled control has no ring by design.
        if (document.activeElement !== element) {
          element.blur()
          continue
        }

        const focused = snapshot(element)
        // An outline resolving to `none` paints nothing, so a width, color, or offset moving under it is invisible.
        const blind =
          focused[properties.indexOf('outlineStyle')] === 'none'
            ? (property: string) => property.startsWith('outline')
            : () => false
        const moved = properties.filter(
          (property, index) =>
            rest[index] !== focused[index] && !blind(property),
        )
        element.blur()

        found.push({
          selector: describe(element),
          visible: moved.length > 0,
          detail: moved.join(', '),
        })
      }

      return found
    },
    [FOCUSABLE, PROPERTIES] as [string, readonly string[]],
  )

  return rows
    .filter((row) => !row.visible)
    .map((row) => ({
      probe: 'focus' as const,
      selector: row.selector,
      detail: 'takes keyboard focus and changes nothing visible',
      measured: `no movement across ${PROPERTIES.length} properties under :focus-visible`,
    }))
}
