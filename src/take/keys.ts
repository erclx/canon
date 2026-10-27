/**
 * The keys a take plan may press, named as Playwright names them so the
 * screencast passes a combination straight to `page.keyboard`, and each one's
 * CDP descriptor so the stepper can send the same press as raw key events.
 * A key outside this vocabulary refuses at plan read, since the stepper has no
 * descriptor to send for it.
 */

export const MODIFIERS = ['Alt', 'Control', 'Meta', 'Shift'] as const

export type Modifier = (typeof MODIFIERS)[number]

/** A combination: the modifiers held, in order, around one key. */
export interface Chord {
  readonly modifiers: readonly Modifier[]
  readonly key: string
}

/** The fields `Input.dispatchKeyEvent` needs to press one key. */
export interface KeyDescriptor {
  readonly key: string
  readonly code: string
  readonly keyCode: number
  /** What the key types, absent for a key that types nothing. */
  readonly text?: string
  /** 1 for a modifier, which sits on the left of the keyboard. */
  readonly location: number
}

/** CDP's modifier bit field: "Alt=1, Ctrl=2, Meta/Command=4, Shift=8". */
const MODIFIER_BITS: Record<Modifier, number> = {
  Alt: 1,
  Control: 2,
  Meta: 4,
  Shift: 8,
}

const MODIFIER_KEY_CODES: Record<Modifier, number> = {
  Alt: 18,
  Control: 17,
  Meta: 91,
  Shift: 16,
}

const NAMED: Record<string, { code?: string; keyCode: number; text?: string }> =
  {
    Enter: { keyCode: 13, text: '\r' },
    Tab: { keyCode: 9 },
    Escape: { keyCode: 27 },
    Backspace: { keyCode: 8 },
    Delete: { keyCode: 46 },
    Insert: { keyCode: 45 },
    Space: { keyCode: 32, text: ' ' },
    Home: { keyCode: 36 },
    End: { keyCode: 35 },
    PageUp: { keyCode: 33 },
    PageDown: { keyCode: 34 },
    ArrowLeft: { keyCode: 37 },
    ArrowUp: { keyCode: 38 },
    ArrowRight: { keyCode: 39 },
    ArrowDown: { keyCode: 40 },
    ...Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [`F${i + 1}`, { keyCode: 112 + i }]),
    ),
  }

/** The US layout's punctuation, each with its shifted twin on the same key. */
const PUNCTUATION: readonly (readonly [string, string, string, number])[] = [
  ['`', '~', 'Backquote', 192],
  ['-', '_', 'Minus', 189],
  ['=', '+', 'Equal', 187],
  ['[', '{', 'BracketLeft', 219],
  [']', '}', 'BracketRight', 221],
  ['\\', '|', 'Backslash', 220],
  [';', ':', 'Semicolon', 186],
  ["'", '"', 'Quote', 222],
  [',', '<', 'Comma', 188],
  ['.', '>', 'Period', 190],
  ['/', '?', 'Slash', 191],
]

const SHIFTED_DIGITS = ')!@#$%^&*('

export function describeKey(key: string): KeyDescriptor | undefined {
  if (isModifier(key)) {
    return {
      key,
      code: `${key}Left`,
      keyCode: MODIFIER_KEY_CODES[key],
      location: 1,
    }
  }
  const named = NAMED[key]
  if (named) {
    return {
      key: key === 'Space' ? ' ' : key,
      code: named.code ?? key,
      keyCode: named.keyCode,
      ...(named.text ? { text: named.text } : {}),
      location: 0,
    }
  }
  if (key.length !== 1) return undefined

  if (/^[a-z]$/i.test(key)) {
    const upper = key.toUpperCase()
    return printable(key, `Key${upper}`, upper.charCodeAt(0))
  }
  if (/^[0-9]$/.test(key)) {
    return printable(key, `Digit${key}`, key.charCodeAt(0))
  }
  const shiftedDigit = SHIFTED_DIGITS.indexOf(key)
  if (shiftedDigit >= 0) {
    return printable(key, `Digit${shiftedDigit}`, 48 + shiftedDigit)
  }
  if (key === ' ') return printable(key, 'Space', 32)
  const row = PUNCTUATION.find(
    ([plain, shifted]) => key === plain || key === shifted,
  )
  return row ? printable(key, row[2], row[3]) : undefined
}

export type KeysRead =
  | { readonly kind: 'parsed'; readonly chord: Chord }
  | { readonly kind: 'refused'; readonly detail: string }

/**
 * Reads a combination such as `Control+K`, the modifiers first and the key
 * last. A trailing `+` after a separator is the plus key itself.
 */
export function parseKeys(keys: string): KeysRead {
  const parts =
    keys === '+'
      ? ['+']
      : keys.endsWith('++')
        ? [...keys.slice(0, -2).split('+'), '+']
        : keys.split('+')
  const key = parts.at(-1) ?? ''
  const held = parts.slice(0, -1)

  if (!key) return { kind: 'refused', detail: `${keys || 'it'} names no key` }
  const modifiers: Modifier[] = []
  for (const name of held) {
    if (!isModifier(name)) {
      return {
        kind: 'refused',
        detail: `${keys} holds ${name || 'nothing'}, which is not ${MODIFIERS.join(', ')}`,
      }
    }
    if (modifiers.includes(name)) {
      return { kind: 'refused', detail: `${keys} holds ${name} twice` }
    }
    modifiers.push(name)
  }
  if (!describeKey(key)) {
    return {
      kind: 'refused',
      detail: `${keys} presses ${key}, which is not a modifier, one character, or a named key`,
    }
  }
  return { kind: 'parsed', chord: { modifiers, key } }
}

export function modifierBits(modifiers: readonly Modifier[]): number {
  return modifiers.reduce((bits, name) => bits | MODIFIER_BITS[name], 0)
}

export function isModifier(name: unknown): name is Modifier {
  return MODIFIERS.includes(name as Modifier)
}

function printable(key: string, code: string, keyCode: number): KeyDescriptor {
  return { key, code, keyCode, text: key, location: 0 }
}
