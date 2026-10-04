/** @jsxImportSource preact */
import type { JSX } from 'preact'
import {
  composeColor,
  type ParsedColor,
  readHex,
  readOpacity,
} from '@/canvas/client/inspector/values'

function shownHex(color: ParsedColor | undefined, text: string): string {
  if (!color) return text
  if (color.kind === 'none') return ''
  return color.kind === 'token' ? color.name : color.hex
}

function shownOpacity(color: ParsedColor | undefined): string {
  return color && color.kind !== 'none' ? String(color.opacity) : ''
}

export function currentOpacity(color: ParsedColor | undefined): number {
  return color && color.kind !== 'none' ? color.opacity : 100
}

/**
 * What a typed hex writes. A token name typed whole picks the token, and any
 * other text goes through as written, which the panel then marks raw.
 */
function fromTyped(typed: string, opacity: number): string {
  const hex = readHex(typed)
  if (hex) {
    return composeColor({
      kind: 'hex',
      hex: hex.hex,
      opacity: hex.opacity ?? opacity,
    })
  }
  if (/^--[\w-]+$/.test(typed)) {
    return composeColor({ kind: 'token', name: typed, opacity })
  }
  return typed
}

export interface ColorInputsProps {
  readonly hexLabel: string
  readonly opacityLabel: string
  readonly color: ParsedColor | undefined
  readonly text: string
  readonly isBusy: boolean
  readonly onCommit: (value: string) => void
}

/**
 * The hex and the opacity. Each commits on change and posts nothing when the
 * value is what it started at, or an opacity outside 0 to 100.
 */
export function ColorInputs({
  hexLabel,
  opacityLabel,
  color,
  text,
  isBusy,
  onCommit,
}: ColorInputsProps): JSX.Element {
  const hex = shownHex(color, text)
  const opacity = shownOpacity(color)
  return (
    <>
      <input
        class={
          color === undefined
            ? 'glyph-field-input is-text'
            : color.kind === 'token'
              ? 'glyph-field-input is-token'
              : 'glyph-field-input'
        }
        type="text"
        aria-label={hexLabel}
        title={hex}
        defaultValue={hex}
        placeholder="None"
        disabled={isBusy}
        spellcheck={false}
        onChange={(event) => {
          const typed = event.currentTarget.value.trim()
          if (typed === '' || typed === hex) return
          onCommit(fromTyped(typed, currentOpacity(color)))
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') event.currentTarget.value = hex
        }}
      />
      <input
        class="color-opacity"
        type="text"
        inputMode="numeric"
        aria-label={opacityLabel}
        defaultValue={opacity}
        disabled={isBusy || !color || color.kind === 'none'}
        spellcheck={false}
        onChange={(event) => {
          const percent = readOpacity(event.currentTarget.value)
          if (
            percent === undefined ||
            !color ||
            color.kind === 'none' ||
            percent === color.opacity
          ) {
            event.currentTarget.value = opacity
            return
          }
          onCommit(composeColor({ ...color, opacity: percent }))
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') event.currentTarget.value = opacity
        }}
      />
      {opacity ? (
        <span class="color-percent" aria-hidden="true">
          %
        </span>
      ) : null}
    </>
  )
}
