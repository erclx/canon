/** @jsxImportSource preact */
import type { JSX } from 'preact'
import { useLayoutEffect, useRef, useState } from 'preact/hooks'
import {
  ColorInputs,
  currentOpacity,
} from '@/canvas/client/inspector/color-inputs'
import {
  composeColor,
  type ParsedColor,
  readHex,
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

/**
 * The accessible name of the row control that last wrote a value, so it takes
 * focus back each time the frame reloads. A saved edit remounts the inspector,
 * once for the edit and again when the file watcher reports the write, and each
 * remount replaces the control that held focus and drops it to the page. It
 * holds until focus lands anywhere else.
 */
let refocus: string | undefined

function swatchLabel(label: string): string {
  return `${label} picker`
}

function eyedropperLabel(label: string): string {
  return `${label} eyedropper`
}

if (typeof document !== 'undefined') {
  document.addEventListener('focusin', (event) => {
    if (refocus === undefined) return
    const target = event.target
    const name =
      target instanceof Element ? target.getAttribute('aria-label') : null
    if (name !== refocus) refocus = undefined
  })
}

/** The screen sampler, where the browser ships one. */
function eyeDropper(): (new () => EyeDropperSampler) | undefined {
  return typeof window === 'undefined' ? undefined : window.EyeDropper
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
  const root = useRef<HTMLDivElement>(null)
  const swatch = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const picked = color?.kind === 'token' ? tokens.indexOf(color.name) : -1
  const [active, setActive] = useState(Math.max(0, picked))
  const isNone = color?.kind === 'none'

  /*
   * Focus moves in the commit rather than after paint, so a key typed straight
   * after the one that opened the picker reaches the list, not the swatch.
   */
  useLayoutEffect(() => {
    if (!isOpen) return
    const target =
      list.current ??
      dialog.current?.querySelector<HTMLInputElement>('input') ??
      null
    target?.focus()
  }, [isOpen])

  useLayoutEffect(() => {
    if (refocus === undefined) return
    root.current
      ?.querySelector<HTMLElement>(`[aria-label="${refocus}"]`)
      ?.focus()
  }, [label])

  const close = () => {
    setOpen(false)
    swatch.current?.focus()
  }

  /* Writes from inside the picker, whose swatch keeps focus across the reload. */
  const commitFromPicker = (value: string) => {
    close()
    refocus = swatchLabel(label)
    onCommit(value)
  }

  const Sampler = eyeDropper()
  const sample = async (sampler: new () => EyeDropperSampler) => {
    let picked: string
    try {
      picked = (await new sampler().open()).sRGBHex
    } catch {
      /* The operator dismissed the sampler, which writes nothing. */
      return
    }
    const hex = readHex(picked)
    if (!hex) return
    refocus = eyedropperLabel(label)
    onCommit(
      composeColor({
        kind: 'hex',
        hex: hex.hex,
        opacity: currentOpacity(color),
      }),
    )
  }

  const pick = (name: string) => {
    if (color?.kind === 'token' && color.name === name) {
      close()
      return
    }
    commitFromPicker(
      composeColor({ kind: 'token', name, opacity: currentOpacity(color) }),
    )
  }

  const id = `color-${label.replace(/\W+/g, '-')}`

  return (
    <div
      ref={root}
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
            aria-label={swatchLabel(label)}
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
        {Sampler ? (
          <button
            class="color-icon"
            type="button"
            aria-label={eyedropperLabel(label)}
            title="Pick a color from the screen"
            disabled={isBusy}
            onClick={() => void sample(Sampler)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10.5 2.5a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2L12 7l.5.5-1 1-4-4 1-1L9 4zM7.5 5.5l3 3-5 5H2.5v-3z" />
            </svg>
          </button>
        ) : null}
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
              onCommit={commitFromPicker}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
