/** @jsxImportSource preact */
import type { JSX } from 'preact'
import { useLayoutEffect, useRef, useState } from 'preact/hooks'
import type { ScrubSession } from '@/canvas/client/inspector/field'
import { ColorInputs } from '@/canvas/client/inspector/color-inputs'
import {
  type Hsv,
  hexToRgb,
  hslToRgb,
  hsvToRgb,
  lchToRgb,
  type Rgb,
  rgbToHex,
  rgbToHsl,
  rgbToHsv,
  rgbToLch,
} from '@/canvas/client/inspector/color-space'
import {
  composeColor,
  type ParsedColor,
  parseColor,
} from '@/canvas/client/inspector/values'

/**
 * What the picker edits. It holds HSV rather than the hex, so a grey keeps the
 * hue the operator set instead of re-deriving 0 from the hex on every render.
 */
interface PickerState {
  readonly hsv: Hsv
  readonly alpha: number
  /** Set while the value is a token, which only the alpha keeps. */
  readonly token: string | undefined
}

interface Opened {
  readonly state: PickerState
  /** The inline value the picker opened on, empty where none stood. */
  readonly inline: string
  /** The color the browser painted then, which fills Previous. */
  readonly paint: string
}

/**
 * The picker whose last write reloaded the frame. A saved edit remounts the
 * inspector, so the picker reopens from this rather than from the hex, keeping
 * the hue, what Previous restores, and the control that held focus.
 */
interface Held {
  /** The frame, element, and property the picker edits. */
  readonly owner: string
  readonly state: PickerState
  readonly opened: Opened
  readonly hasCommitted: boolean
  readonly focus: string | undefined
}

let held: Held | undefined

/** Whether the picker of that owner reopens after a reload. */
export function isPickerHeld(owner: string): boolean {
  return held?.owner === owner
}

/** Drops the held picker, once it closes. */
export function releasePicker(): void {
  held = undefined
}

function initialState(
  color: ParsedColor | undefined,
  painted: string,
): PickerState {
  const paint = parseColor(painted)
  const base =
    color?.kind === 'hex' ? color : paint?.kind === 'hex' ? paint : undefined
  return {
    hsv: base ? rgbToHsv(hexToRgb(base.hex)) : { h: 0, s: 0, v: 100 },
    alpha: color && color.kind !== 'none' ? color.opacity : 100,
    token: color?.kind === 'token' ? color.name : undefined,
  }
}

function hexOf(state: PickerState): string {
  return rgbToHex(hsvToRgb(state.hsv))
}

function valueOf(state: PickerState): string {
  return composeColor(
    state.token
      ? { kind: 'token', name: state.token, opacity: state.alpha }
      : { kind: 'hex', hex: hexOf(state), opacity: state.alpha },
  )
}

function parsedOf(state: PickerState): ParsedColor {
  return state.token
    ? { kind: 'token', name: state.token, opacity: state.alpha }
    : { kind: 'hex', hex: hexOf(state), opacity: state.alpha }
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

function nameOf(target: EventTarget | null): string | undefined {
  return target instanceof Element
    ? (target.getAttribute('aria-label') ?? undefined)
    : undefined
}

interface Channel {
  /** The letter drawn under the input. */
  readonly letter: string
  /** The full word, which names the input. */
  readonly name: string
}

interface NumberRowProps {
  readonly space: string
  readonly channels: readonly [Channel, Channel, Channel]
  readonly values: readonly [number, number, number]
  readonly onCommit: (values: readonly [number, number, number]) => void
}

/**
 * Three numbers for one space. Each commits on change, reading its two
 * neighbours as they stand, and a value that is not a number puts all three
 * back.
 */
function NumberRow({
  space,
  channels,
  values,
  onCommit,
}: NumberRowProps): JSX.Element {
  const row = useRef<HTMLDivElement>(null)
  const shown = values.map((value) => String(Math.round(value)))
  const label = (channel: Channel) =>
    space === 'RGB' ? channel.name : `${space} ${channel.name}`
  return (
    <div ref={row} class="picker-row">
      {channels.map((channel, index) => (
        <label key={channel.letter} class="picker-channel">
          <input
            class="picker-number"
            type="text"
            inputMode="decimal"
            aria-label={label(channel)}
            defaultValue={shown[index]}
            spellcheck={false}
            onFocus={(event) => event.currentTarget.select()}
            onChange={() => {
              const inputs = [
                ...(row.current?.querySelectorAll('input') ?? []),
              ].map((input) => Number(input.value.trim()))
              const [first, second, third] = inputs
              if (
                first === undefined ||
                second === undefined ||
                third === undefined ||
                inputs.some((value) => !Number.isFinite(value))
              ) {
                row.current?.querySelectorAll('input').forEach((input, at) => {
                  input.value = shown[at] ?? ''
                })
                return
              }
              onCommit([first, second, third])
            }}
          />
          <span class="picker-letter" aria-hidden="true">
            {channel.letter}
          </span>
        </label>
      ))}
    </div>
  )
}

const LCH_CHANNELS = [
  { letter: 'L', name: 'lightness' },
  { letter: 'C', name: 'chroma' },
  { letter: 'H', name: 'hue' },
] as const

const HSL_CHANNELS = [
  { letter: 'H', name: 'hue' },
  { letter: 'S', name: 'saturation' },
  { letter: 'L', name: 'lightness' },
] as const

const RGB_CHANNELS = [
  { letter: 'R', name: 'red' },
  { letter: 'G', name: 'green' },
  { letter: 'B', name: 'blue' },
] as const

interface ColorPickerProps {
  /** The frame, element, and property, which a reload keeps. */
  readonly owner: string
  readonly color: ParsedColor | undefined
  readonly text: string
  /** The element's own inline value, which Previous writes back. */
  readonly inline: string
  readonly painted: string
  /** Opens a preview session at press, or undefined where none can preview. */
  readonly begin: (() => ScrubSession) | undefined
  readonly onCommit: (value: string) => void
}

interface Pending {
  readonly session: ScrubSession
  /** The value when the session opened, which a release equal to it restores. */
  readonly from: string
}

/**
 * The full picker: a saturation and brightness area, vertical alpha and hue
 * sliders, Previous and New, numeric LCH, HSL, and RGB rows, and the hex. The
 * area and the sliders preview into the frame and write once on release, while
 * a numeric row writes on change. Any change but the alpha writes a hex, since
 * a token's color cannot change from here without editing the token.
 */
export function ColorPicker({
  owner,
  color,
  text,
  inline,
  painted,
  begin,
  onCommit,
}: ColorPickerProps): JSX.Element {
  const resumed = held?.owner === owner ? held : undefined
  const [opened] = useState<Opened>(
    () =>
      resumed?.opened ?? {
        state: initialState(color, painted),
        inline,
        paint: painted,
      },
  )
  const [state, setState] = useState<PickerState>(
    () => resumed?.state ?? opened.state,
  )
  const latest = useRef(state)
  const hasCommitted = useRef(resumed?.hasCommitted ?? false)
  const pending = useRef<Pending | null>(null)
  const dragging = useRef<number | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    /*
     * The field shows the popover in its own effect, which runs after this
     * one, and an element still hidden takes no focus.
     */
    const popover = root.current?.closest<HTMLElement>('[popover]')
    if (
      popover &&
      typeof popover.showPopover === 'function' &&
      !popover.matches(':popover-open')
    ) {
      popover.showPopover()
    }
    const focus = resumed?.focus
    const target = focus
      ? root.current?.querySelector<HTMLElement>(`[aria-label="${focus}"]`)
      : undefined
    ;(target ?? area.current)?.focus()
  }, [])

  const hold = (next: PickerState, focus: string | undefined) => {
    held = {
      owner,
      state: next,
      opened,
      hasCommitted: hasCommitted.current,
      focus,
    }
  }

  const show = (next: PickerState) => {
    latest.current = next
    setState(next)
  }

  const start = (): Pending => {
    if (pending.current) return pending.current
    pending.current = {
      session: begin?.() ?? {
        preview: () => undefined,
        restore: () => undefined,
        commit: onCommit,
      },
      from: valueOf(latest.current),
    }
    return pending.current
  }

  /* Moves the color during a drag or a key step, previewing and posting nothing. */
  const move = (next: PickerState) => {
    const session = start().session
    show(next)
    session.preview(valueOf(next))
  }

  /* Ends the session: writes once when the value moved, else puts it back. */
  const settle = (focus = nameOf(document.activeElement)) => {
    const open = pending.current
    if (!open) return
    pending.current = null
    const value = valueOf(latest.current)
    if (value === open.from) {
      open.session.restore()
      return
    }
    hasCommitted.current = true
    hold(latest.current, focus)
    open.session.commit(value)
  }

  const cancel = () => {
    dragging.current = null
    const open = pending.current
    pending.current = null
    open?.session.restore()
  }

  /* Writes at once, for a row or the hex, which carry no preview. */
  const write = (next: PickerState, value = valueOf(next)) => {
    cancel()
    show(next)
    if (value === valueOf(state)) return
    hasCommitted.current = true
    hold(next, nameOf(document.activeElement))
    onCommit(value)
  }

  const fromRgb = (rgb: Rgb, hue = latest.current.hsv.h): PickerState => ({
    ...latest.current,
    hsv: rgbToHsv(rgb, hue),
    token: undefined,
  })

  const moveTo = (event: PointerEvent) => {
    const box = area.current?.getBoundingClientRect()
    if (!box || box.width === 0 || box.height === 0) return
    move({
      ...latest.current,
      hsv: {
        h: latest.current.hsv.h,
        s: clamp(((event.clientX - box.left) / box.width) * 100, 0, 100),
        v: clamp(100 - ((event.clientY - box.top) / box.height) * 100, 0, 100),
      },
      token: undefined,
    })
  }

  const restorePrevious = () => {
    cancel()
    show(opened.state)
    if (!hasCommitted.current) return
    hasCommitted.current = false
    hold(opened.state, 'previous color')
    onCommit(opened.inline)
  }

  const rgb = hsvToRgb(state.hsv)
  const hsl = rgbToHsl(rgb, state.hsv.h)
  const lch = rgbToLch(rgb, state.hsv.h)
  const hex = hexOf(state)
  const current = parsedOf(state)
  const saturation = Math.round(state.hsv.s)
  const brightness = Math.round(state.hsv.v)

  return (
    <div
      ref={root}
      class="picker"
      style={{
        '--picker-hue': `hsl(${state.hsv.h} 100% 50%)`,
        '--picker-solid': `#${hex}`,
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') cancel()
      }}
    >
      <div
        ref={area}
        class="picker-area"
        role="slider"
        tabIndex={0}
        aria-label="saturation and brightness"
        aria-roledescription="2D slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={saturation}
        aria-valuetext={`Saturation ${saturation}%, brightness ${brightness}%`}
        onPointerDown={(event) => {
          event.preventDefault()
          area.current?.focus()
          try {
            area.current?.setPointerCapture(event.pointerId)
          } catch {
            /* A pointer the browser no longer tracks ends on cancel instead. */
          }
          dragging.current = event.pointerId
          moveTo(event)
        }}
        onPointerMove={(event) => {
          if (dragging.current === event.pointerId) moveTo(event)
        }}
        onPointerUp={(event) => {
          if (dragging.current !== event.pointerId) return
          dragging.current = null
          settle()
        }}
        onPointerCancel={cancel}
        onBlur={(event) => settle(nameOf(event.relatedTarget))}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 10 : 1
          const { s, v } = latest.current.hsv
          const moves: Record<string, Partial<Hsv>> = {
            ArrowLeft: { s: clamp(s - step, 0, 100) },
            ArrowRight: { s: clamp(s + step, 0, 100) },
            ArrowUp: { v: clamp(v + step, 0, 100) },
            ArrowDown: { v: clamp(v - step, 0, 100) },
          }
          const change = moves[event.key]
          if (change) {
            event.preventDefault()
            move({
              ...latest.current,
              hsv: { ...latest.current.hsv, ...change },
              token: undefined,
            })
          } else if (event.key === 'Enter') {
            event.preventDefault()
            settle()
          }
        }}
      >
        <span
          class="picker-thumb"
          aria-hidden="true"
          style={{ left: `${state.hsv.s}%`, top: `${100 - state.hsv.v}%` }}
        />
      </div>
      <input
        class="picker-slider picker-alpha"
        type="range"
        min={0}
        max={100}
        step={1}
        aria-label="alpha"
        aria-orientation="vertical"
        value={state.alpha}
        onInput={(event) =>
          move({
            ...latest.current,
            alpha: Number(event.currentTarget.value),
          })
        }
        onChange={() => settle()}
        onBlur={(event) => settle(nameOf(event.relatedTarget))}
      />
      <input
        class="picker-slider picker-hue"
        type="range"
        min={0}
        max={360}
        step={1}
        aria-label="hue"
        aria-orientation="vertical"
        value={Math.round(state.hsv.h)}
        onInput={(event) =>
          move({
            ...latest.current,
            hsv: {
              ...latest.current.hsv,
              h: Number(event.currentTarget.value),
            },
            token: undefined,
          })
        }
        onChange={() => settle()}
        onBlur={(event) => settle(nameOf(event.relatedTarget))}
      />
      <div class="picker-side">
        <div class="picker-compare">
          <button
            class="picker-previous"
            type="button"
            aria-label="previous color"
            title="Restore the color the picker opened on"
            style={{ '--paint': opened.paint }}
            onClick={restorePrevious}
          />
          <span
            class="picker-new"
            aria-hidden="true"
            style={{ '--paint': `#${hex}${alphaHex(state.alpha)}` }}
          />
        </div>
        <div class="picker-compare-labels" aria-hidden="true">
          <span>Previous</span>
          <span>New</span>
        </div>
        {/* Keyed by what each row shows, so a drag refreshes its inputs. */}
        <NumberRow
          key={`lch ${rowKey([lch.l, lch.c, lch.h])}`}
          space="LCH"
          channels={LCH_CHANNELS}
          values={[lch.l, lch.c, lch.h]}
          onCommit={([l, c, h]) => write(fromRgb(lchToRgb({ l, c, h }).rgb))}
        />
        <NumberRow
          key={`hsl ${rowKey([hsl.h, hsl.s, hsl.l])}`}
          space="HSL"
          channels={HSL_CHANNELS}
          values={[hsl.h, hsl.s, hsl.l]}
          onCommit={([h, s, l]) =>
            write(
              fromRgb(
                hslToRgb({ h, s: clamp(s, 0, 100), l: clamp(l, 0, 100) }),
                h,
              ),
            )
          }
        />
        <NumberRow
          key={`rgb ${rowKey([rgb.r, rgb.g, rgb.b])}`}
          space="RGB"
          channels={RGB_CHANNELS}
          values={[rgb.r, rgb.g, rgb.b]}
          onCommit={([r, g, b]) => write(fromRgb({ r, g, b }))}
        />
        <div class="glyph-field" key={valueOf(state)}>
          <span class="glyph" aria-hidden="true">
            #
          </span>
          <ColorInputs
            hexLabel="hex"
            opacityLabel="opacity"
            color={current}
            text={text}
            isBusy={false}
            onCommit={(typed) => {
              const parsed = parseColor(typed)
              if (parsed?.kind === 'hex') {
                write(
                  {
                    ...fromRgb(hexToRgb(parsed.hex)),
                    alpha: parsed.opacity,
                  },
                  typed,
                )
              } else if (parsed?.kind === 'token') {
                write(
                  {
                    ...latest.current,
                    token: parsed.name,
                    alpha: parsed.opacity,
                  },
                  typed,
                )
              } else {
                cancel()
                onCommit(typed)
              }
            }}
          />
        </div>
      </div>
    </div>
  )
}

function rowKey(values: readonly number[]): string {
  return values.map((value) => Math.round(value)).join(' ')
}

function alphaHex(alpha: number): string {
  return alpha >= 100
    ? ''
    : Math.round((alpha / 100) * 255)
        .toString(16)
        .padStart(2, '0')
}
