/**
 * The canvas key layer: one map from a key event to a surface action, which
 * the surface and every loaded frame document call. It sees only what the
 * surface forwards, so a key typed into a panel field never reaches it.
 */

export type SurfaceAction =
  | 'tool-move'
  | 'tool-pan'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-fit'
  | 'pan-hold'
  | 'pan-release'

/** The fields of a `KeyboardEvent` the map reads, so a test needs no DOM. */
export interface KeyInput {
  readonly type: string
  readonly key: string
  readonly code: string
  readonly shiftKey: boolean
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly altKey: boolean
}

const PLAIN_KEYS: Readonly<Record<string, SurfaceAction | undefined>> = {
  v: 'tool-move',
  h: 'tool-pan',
  '=': 'zoom-in',
  '+': 'zoom-in',
  '-': 'zoom-out',
  ' ': 'pan-hold',
}

/**
 * Cmd, Ctrl, and Alt combinations are the browser's or the system's, so any
 * of them held on a press returns nothing. Space coming up releases whatever
 * is held with it, or a modifier pressed mid-pan would leave the pan stuck.
 * Shift and the 1 key fits by `code`, since the character Shift gives on that
 * key differs by layout.
 */
export function surfaceAction(event: KeyInput): SurfaceAction | undefined {
  if (event.type === 'keyup') {
    return event.key === ' ' ? 'pan-release' : undefined
  }
  if (event.type !== 'keydown') return undefined
  if (event.ctrlKey || event.metaKey || event.altKey) return undefined
  if (event.shiftKey) {
    if (event.code === 'Digit1') return 'zoom-fit'
    return event.key === '+' ? 'zoom-in' : undefined
  }
  return PLAIN_KEYS[event.key.toLowerCase()]
}
