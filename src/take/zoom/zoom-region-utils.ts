// Vendored from OpenScreen at ca8104c, MIT. See NOTICE.md beside this file.
// Source: src/components/video-editor/videoPlayback/zoomRegionUtils.ts and the
// two window constants from constants.ts. The zoom-out window and the chained
// pan's duration carry the operator's tuning, and NOTICE.md lists both.

import {
  clamp01,
  cubicBezier,
  easeOutScreenStudio,
} from '@/take/zoom/math-utils'

/** OpenScreen's 1015.05 ms, shortened to 700 ms for a quicker zoom-out. */
export const TRANSITION_WINDOW_MS = 700
/** OpenScreen's zoom-in window, 1.5 times its original 1015.05 ms window. */
export const ZOOM_IN_TRANSITION_WINDOW_MS = 1015.05 * 1.5

export const CHAINED_ZOOM_PAN_GAP_MS = 1500
/** OpenScreen's 1000 ms, shortened to 600 ms. */
export const CONNECTED_ZOOM_PAN_DURATION_MS = 600
export const ZOOM_IN_OVERLAP_MS = 500

export interface ZoomRegion {
  startMs: number
  endMs: number
}

export function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount
}

export function easeConnectedPan(value: number) {
  return cubicBezier(0.1, 0.0, 0.2, 1.0, value)
}

export function computeRegionStrength(region: ZoomRegion, timeMs: number) {
  const zoomInEnd = region.startMs + ZOOM_IN_OVERLAP_MS
  const leadInStart = zoomInEnd - ZOOM_IN_TRANSITION_WINDOW_MS
  const leadOutEnd = region.endMs + TRANSITION_WINDOW_MS

  if (timeMs < leadInStart || timeMs > leadOutEnd) {
    return 0
  }

  if (timeMs < zoomInEnd) {
    const progress = (timeMs - leadInStart) / ZOOM_IN_TRANSITION_WINDOW_MS
    return easeOutScreenStudio(progress)
  }

  if (timeMs <= region.endMs) {
    return 1
  }

  const progress = clamp01((timeMs - region.endMs) / TRANSITION_WINDOW_MS)
  return 1 - easeOutScreenStudio(progress)
}
