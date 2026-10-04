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
  | 'undo'
  | 'redo'
  | 'panels-toggle'

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
 * Undo and redo are the one exception to the browser owning a modifier: Ctrl
 * or Cmd with Z, with Shift to redo, and Ctrl with Y. Any other Cmd, Ctrl, or
 * Alt combination is the browser's or the system's, so it returns nothing.
 */
function historyAction(event: KeyInput): SurfaceAction | undefined {
  if (event.altKey) return undefined
  const key = event.key.toLowerCase()
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo'
  if (key === 'y' && event.ctrlKey && !event.shiftKey) return 'redo'
  return undefined
}

/**
 * Space coming up releases whatever is held with it, or a modifier pressed
 * mid-pan would leave the pan stuck. Shift and the 1 key fits, and the
 * backslash key toggles the panels, by `code`, since the character each
 * gives differs by layout.
 */
export function surfaceAction(event: KeyInput): SurfaceAction | undefined {
  if (event.type === 'keyup') {
    return event.key === ' ' ? 'pan-release' : undefined
  }
  if (event.type !== 'keydown') return undefined
  if (event.ctrlKey || event.metaKey) return historyAction(event)
  if (event.altKey) return undefined
  if (event.shiftKey) {
    if (event.code === 'Digit1') return 'zoom-fit'
    return event.key === '+' ? 'zoom-in' : undefined
  }
  if (event.code === 'Backslash') return 'panels-toggle'
  return PLAIN_KEYS[event.key.toLowerCase()]
}
