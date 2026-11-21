import type { Page } from 'playwright-core'
import type { Finding } from '@/driver/steps'

/**
 * Measures every `<details>` twice, shut and open, and judges only the open
 * reading, since a closed one reports a nonsense box but skipping it hides a
 * dropdown that overflows only while open. Discovery is automatic, not selector-driven.
 */

/** The smallest a control may be before a finger cannot reliably hit it. */
const MIN_TAP_PX = 24

/** Ignores a sub-pixel overhang, which is a rounding artifact rather than a defect. */
const OVERFLOW_TOLERANCE_PX = 1

export async function probeDetails(page: Page): Promise<Finding[]> {
  const rows = await page.evaluate(
    ([minTap, tolerance]: [number, number]) => {
      const describe = (element: Element): string => {
        const tag = element.tagName.toLowerCase()
        if (element.id) return `${tag}#${element.id}`
        const className = element.getAttribute('class')?.trim().split(/\s+/)[0]
        return className ? `${tag}.${className}` : tag
      }

      const box = (element: Element) => {
        const rect = element.getBoundingClientRect()
        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
        }
      }

      const found: {
        selector: string
        detail: string
        measured: string
      }[] = []

      const width = document.documentElement.clientWidth

      for (const element of Array.from(document.querySelectorAll('details'))) {
        if (!(element instanceof HTMLDetailsElement)) continue

        // Named for the state it was in, since a step may have clicked the menu open.
        const wasOpen = element.open
        const entry = box(element)
        const entryState = wasOpen ? 'already open' : 'shut'
        element.open = true

        const rows = Array.from(
          element.querySelectorAll('a[href], button, [role="menuitem"], li'),
        )

        // The panel is routinely out of flow, so every part is measured for the worst overhang.
        let worst: { part: Element; off: number; left: number } | undefined
        for (const part of [element, ...element.querySelectorAll('*')]) {
          const partBox = box(part)
          if (partBox.width === 0 && partBox.height === 0) continue
          const off = Math.max(partBox.right - width, -partBox.left)
          if (off <= tolerance) continue
          if (worst && off <= worst.off) continue
          worst = { part, off, left: partBox.left }
        }

        if (worst) {
          found.push({
            selector: describe(worst.part),
            detail: `sits ${Math.round(worst.off)}px outside the viewport once ${describe(element)} is open`,
            measured: `open at left ${Math.round(worst.left)} in a ${width}px viewport, against an ${entryState} ${describe(element)} box of ${Math.round(entry.width)}x${Math.round(entry.height)} that measures nothing about where the panel lands`,
          })
        }

        for (const row of rows) {
          const item = box(row)
          if (item.width === 0 && item.height === 0) continue
          if (item.width >= minTap && item.height >= minTap) continue
          found.push({
            selector: `${describe(element)} ${describe(row)}`,
            detail: `is ${Math.round(item.width)}x${Math.round(item.height)} once open, under the ${minTap}px minimum`,
            measured: `read in the open state, since the ${entryState} box of ${Math.round(entry.width)}x${Math.round(entry.height)} reports every row inside it wrong`,
          })
        }

        // Restored because the probe runs between the caller's steps, and no later step asked for an open menu.
        element.open = wasOpen
      }

      return found
    },
    [MIN_TAP_PX, OVERFLOW_TOLERANCE_PX] as [number, number],
  )

  return rows.map((row) => ({ probe: 'details' as const, ...row }))
}
