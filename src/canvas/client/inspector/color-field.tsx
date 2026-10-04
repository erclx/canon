/** @jsxImportSource preact */
import type { JSX } from 'preact'
import { useLayoutEffect, useRef, useState } from 'preact/hooks'
import type { ScrubSession } from '@/canvas/client/inspector/field'
import {
  ColorInputs,
  currentOpacity,
} from '@/canvas/client/inspector/color-inputs'
import {
  ColorPicker,
  isPickerHeld,
  releasePicker,
} from '@/canvas/client/inspector/color-picker'
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
  /** The element's own inline value, empty where none stands. */
  readonly inline: string
  /** The color the browser paints, which fills the swatch. */
  readonly painted: string
  /** The color tokens in the order the token sheet sorts them. */
  readonly tokens: readonly string[]
  /** The color a token paints in the frame, read when the list opens. */
  readonly paint: (name: string) => string
  /** The frame, element, and property, so a reload reopens the right picker. */
  readonly owner: string
  readonly isRaw: boolean
  readonly isBusy: boolean
  /** Opens a session previewing into the frame, where the element takes one. */
  readonly preview?: () => ScrubSession
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

function tokensLabel(label: string): string {
  return `${label} tokens`
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

type Open = 'picker' | 'tokens' | undefined

const GAP = 8

/**
 * The left edge of the scrolling panel holding the row, so a popover clears
 * the panel's padding rather than overlapping it. The row's own edge stands in
 * where no ancestor scrolls.
 */
function panelLeft(row: HTMLElement): number {
  for (let node = row.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY
    if (overflow === 'auto' || overflow === 'scroll') {
      return node.getBoundingClientRect().left
    }
  }
  return row.getBoundingClientRect().left
}

/**
 * Places a popover beside the row, to the left of the panel, and holds it
 * inside the window. The panel scrolls and clips, so the popover sits in the
 * top layer where the browser has one and at fixed coordinates either way.
 */
function place(popover: HTMLElement, row: HTMLElement): void {
  if (
    typeof popover.showPopover === 'function' &&
    !popover.matches(':popover-open')
  ) {
    popover.showPopover()
  }
  const box = popover.getBoundingClientRect()
  const anchor = row.getBoundingClientRect()
  const width = document.documentElement.clientWidth || window.innerWidth
  const height = document.documentElement.clientHeight || window.innerHeight
  const before = panelLeft(row) - GAP - box.width
  const left =
    before >= GAP
      ? before
      : Math.max(GAP, Math.min(anchor.right + GAP, width - box.width - GAP))
  const top = Math.max(GAP, Math.min(anchor.top, height - box.height - GAP))
  popover.style.left = `${left}px`
  popover.style.top = `${top}px`
}

/**
 * One color property: a swatch opening the picker, the hex, the opacity, a
 * tokens icon opening the project's color tokens, and an eyedropper where the
 * browser has one. A token keeps following the theme and a literal does not,
 * so the tokens sit one press from the row.
 */
export function ColorField({
  label,
  color,
  text,
  inline,
  painted,
  tokens,
  paint,
  owner,
  isRaw,
  isBusy,
  preview,
  onCommit,
}: ColorFieldProps): JSX.Element {
  const [open, setOpen] = useState<Open>(() =>
    isPickerHeld(owner) ? 'picker' : undefined,
  )
  const root = useRef<HTMLDivElement>(null)
  const row = useRef<HTMLDivElement>(null)
  const swatch = useRef<HTMLButtonElement>(null)
  const tokenButton = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const picked = color?.kind === 'token' ? tokens.indexOf(color.name) : -1
  const [active, setActive] = useState(Math.max(0, picked))
  const isNone = color?.kind === 'none'

  /*
   * Focus moves in the commit rather than after paint, so a key typed straight
   * after the one that opened the list reaches it, not the button.
   */
  useLayoutEffect(() => {
    if (!open || !dialog.current || !row.current) return
    place(dialog.current, row.current)
    if (open === 'tokens') (list.current ?? dialog.current).focus()
  }, [open])

  useLayoutEffect(() => {
    if (refocus === undefined) return
    root.current
      ?.querySelector<HTMLElement>(`[aria-label="${refocus}"]`)
      ?.focus()
  }, [label])

  const close = () => {
    const trigger = open === 'tokens' ? tokenButton : swatch
    releasePicker()
    setOpen(undefined)
    trigger.current?.focus()
  }

  const toggle = (next: Exclude<Open, undefined>) => {
    releasePicker()
    setActive(Math.max(0, picked))
    setOpen(open === next ? undefined : next)
  }

  const pick = (name: string) => {
    if (color?.kind === 'token' && color.name === name) {
      close()
      return
    }
    close()
    refocus = tokensLabel(label)
    onCommit(
      composeColor({ kind: 'token', name, opacity: currentOpacity(color) }),
    )
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

  const id = `color-${label.replace(/\W+/g, '-')}`

  return (
    <div
      ref={root}
      class="color-field is-wide"
      onFocusOut={(event) => {
        const field = event.currentTarget
        /*
         * Read once focus has settled. A reload removes the field while it
         * holds focus, and a picker held across that reload must stay open.
         */
        setTimeout(() => {
          if (!field.isConnected) return
          if (field.contains(document.activeElement)) return
          releasePicker()
          setOpen(undefined)
        }, 0)
      }}
    >
      <div ref={row} class="fill-row">
        <div class="glyph-field">
          <button
            ref={swatch}
            class={isNone ? 'swatch is-none' : 'swatch'}
            type="button"
            aria-label={swatchLabel(label)}
            aria-haspopup="dialog"
            aria-expanded={open === 'picker'}
            title={label}
            disabled={isBusy}
            onClick={() => toggle('picker')}
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
        <button
          ref={tokenButton}
          class="color-icon"
          type="button"
          aria-label={tokensLabel(label)}
          aria-haspopup="dialog"
          aria-expanded={open === 'tokens'}
          title="Pick a color token"
          disabled={isBusy}
          onClick={() => toggle('tokens')}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="5" cy="5" r="2.25" />
            <circle cx="11" cy="5" r="2.25" />
            <circle cx="5" cy="11" r="2.25" />
            <circle cx="11" cy="11" r="2.25" />
          </svg>
        </button>
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
      {open ? (
        <div
          ref={dialog}
          class={
            open === 'picker' ? 'color-popover' : 'color-popover is-tokens'
          }
          popover="manual"
          role="dialog"
          aria-label={
            open === 'picker' ? `${label} color` : `${label} token list`
          }
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
          {open === 'picker' ? (
            <ColorPicker
              owner={owner}
              color={color}
              text={text}
              inline={inline}
              painted={painted}
              begin={preview}
              isBusy={isBusy}
              onCommit={onCommit}
            />
          ) : tokens.length > 0 ? (
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
        </div>
      ) : null}
    </div>
  )
}
