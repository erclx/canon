/** @jsxImportSource preact */
import type { JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import {
  composeColor,
  type ParsedColor,
  readHex,
  readOpacity,
} from '@/canvas/client/inspector/values'

interface ColorFieldProps {
  /** The full word, which names the hex input for assistive technology. */
  readonly label: string
  /** What the element holds, or undefined for a form the picker cannot read. */
  readonly color: ParsedColor | undefined
  /** The value as written, shown when `color` is undefined. */
  readonly text: string
  /** The color the browser paints, which fills the swatch. */
  readonly painted: string
  /** The color tokens in the order the token sheet sorts them. */
  readonly tokens: readonly string[]
  /** The color a token paints in the frame, read when the picker opens. */
  readonly paint: (name: string) => string
  readonly isRaw: boolean
  readonly isBusy: boolean
  readonly onCommit: (value: string) => void
}

function shownHex(color: ParsedColor | undefined, text: string): string {
  if (!color) return text
  if (color.kind === 'none') return ''
  return color.kind === 'token' ? color.name : color.hex
}

function shownOpacity(color: ParsedColor | undefined): string {
  return color && color.kind !== 'none' ? String(color.opacity) : ''
}

function currentOpacity(color: ParsedColor | undefined): number {
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

interface ColorInputsProps {
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
function ColorInputs({
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
          color?.kind === 'token'
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

/**
 * One color property: a swatch opening the picker, the hex, and the opacity.
 * The picker lists the project's color tokens ahead of any raw value, since a
 * token keeps following the theme and a literal does not.
 */
export function ColorField({
  label,
  color,
  text,
  painted,
  tokens,
  paint,
  isRaw,
  isBusy,
  onCommit,
}: ColorFieldProps): JSX.Element {
  const [isOpen, setOpen] = useState(false)
  const swatch = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const picked = color?.kind === 'token' ? tokens.indexOf(color.name) : -1
  const [active, setActive] = useState(Math.max(0, picked))
  const isNone = color?.kind === 'none'

  useEffect(() => {
    if (!isOpen) return
    const target =
      list.current ??
      dialog.current?.querySelector<HTMLInputElement>('input') ??
      null
    target?.focus()
  }, [isOpen])

  const close = () => {
    setOpen(false)
    swatch.current?.focus()
  }

  const pick = (name: string) => {
    close()
    if (color?.kind === 'token' && color.name === name) return
    onCommit(
      composeColor({ kind: 'token', name, opacity: currentOpacity(color) }),
    )
  }

  const id = `color-${label.replace(/\W+/g, '-')}`

  return (
    <div
      class="color-field is-wide"
      onFocusOut={(event) => {
        const next = event.relatedTarget
        if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
          setOpen(false)
        }
      }}
    >
      <div class="fill-row">
        <div class="glyph-field">
          <button
            ref={swatch}
            class={isNone ? 'swatch is-none' : 'swatch'}
            type="button"
            aria-label={`${label} picker`}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            title={label}
            disabled={isBusy}
            onClick={() => {
              setActive(Math.max(0, picked))
              setOpen(!isOpen)
            }}
          >
            <span
              class="swatch-paint"
              style={isNone ? undefined : { '--paint': painted }}
            />
          </button>
          <ColorInputs
            hexLabel={label}
            opacityLabel={`${label} opacity`}
            color={color}
            text={text}
            isBusy={isBusy}
            onCommit={onCommit}
          />
        </div>
        {isRaw ? (
          <span
            class="raw"
            title="Set as a raw value, so it will not follow the theme. Pick a token to fix it"
          >
            raw
          </span>
        ) : null}
      </div>
      {isOpen ? (
        <div
          ref={dialog}
          class="color-picker"
          role="dialog"
          aria-label={`${label} colors`}
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            /* A blur would commit what was typed, so put it back first. */
            if (event.target instanceof HTMLInputElement) {
              event.target.value = event.target.defaultValue
            }
            close()
          }}
        >
          {tokens.length > 0 ? (
            <ul
              ref={list}
              class="token-list"
              role="listbox"
              aria-label="Tokens"
              tabIndex={0}
              aria-activedescendant={`${id}-${active}`}
              onKeyDown={(event) => {
                const last = tokens.length - 1
                const moves: Record<string, number> = {
                  ArrowDown: Math.min(last, active + 1),
                  ArrowUp: Math.max(0, active - 1),
                  Home: 0,
                  End: last,
                }
                if (event.key in moves) {
                  event.preventDefault()
                  setActive(moves[event.key] ?? active)
                } else if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  const name = tokens[active]
                  if (name) pick(name)
                }
              }}
            >
              {tokens.map((name, index) => (
                <li
                  key={name}
                  id={`${id}-${index}`}
                  class={
                    index === active ? 'token-option is-active' : 'token-option'
                  }
                  role="option"
                  aria-selected={index === picked}
                  title={name}
                  onClick={() => pick(name)}
                >
                  <span
                    class="swatch-paint"
                    aria-hidden="true"
                    style={{ '--paint': paint(name) }}
                  />
                  <span class="token-name">{name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p class="empty">
              No color tokens resolve. Add them to the token sheet
            </p>
          )}
          <div class="glyph-field">
            <span class="glyph" aria-hidden="true">
              #
            </span>
            <ColorInputs
              hexLabel="hex"
              opacityLabel="opacity"
              color={color}
              text={text}
              isBusy={isBusy}
              onCommit={(value) => {
                close()
                onCommit(value)
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
