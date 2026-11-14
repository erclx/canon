/**
 * Resolves the viewport sweep a run is driven at.
 *
 * A defect can be a function of how much scroll remains rather than of the
 * markup, so a single height can report clean over a live defect. Every other
 * probe measures a page, and this one decides how many pages there are.
 *
 * It refuses rather than defaulting, which is the whole of its contract. The
 * heights that separate a passing render from a failing one belong to the
 * layout being driven, and no sample is broad enough to ship as a default.
 */

export interface Viewport {
  readonly width: number
  readonly height: number
}

/** What the caller wrote under `viewport`, before anything is trusted about it. */
export interface ViewportSpec {
  readonly width?: unknown
  readonly heights?: unknown
}

export type ViewportRefusal = 'no-viewport' | 'no-width' | 'no-heights'

export type ViewportRead =
  | { readonly kind: 'resolved'; readonly viewports: readonly Viewport[] }
  | {
      readonly kind: 'refused'
      readonly reason: ViewportRefusal
      readonly detail: string
    }

function refused(reason: ViewportRefusal, detail: string): ViewportRead {
  return { kind: 'refused', reason, detail }
}

export function resolveViewports(spec: ViewportSpec | undefined): ViewportRead {
  if (spec === undefined || typeof spec !== 'object' || spec === null) {
    return refused(
      'no-viewport',
      'the run declares no viewport, and the heights a defect hides at are a property of the layout rather than of this command',
    )
  }

  if (typeof spec.width !== 'number' || spec.width <= 0) {
    return refused(
      'no-width',
      'viewport.width is not a positive number, so no render has a width to wrap at',
    )
  }

  if (!Array.isArray(spec.heights) || spec.heights.length === 0) {
    return refused(
      'no-heights',
      'viewport.heights names no height. Name every height the layout should hold at, since one height reports clean over a defect that is a function of remaining scroll.',
    )
  }

  const viewports: Viewport[] = []
  for (const height of spec.heights) {
    if (typeof height !== 'number' || height <= 0) {
      return refused(
        'no-heights',
        `viewport.heights carries ${String(height)}, which is not a positive number`,
      )
    }
    viewports.push({ width: spec.width, height })
  }

  return { kind: 'resolved', viewports }
}

/** How a viewport is named on a finding, so two sweeps read apart in one report. */
export function describeViewport(viewport: Viewport): string {
  return `${viewport.width}x${viewport.height}`
}
