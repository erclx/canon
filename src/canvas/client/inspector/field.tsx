/** @jsxImportSource preact */
import type { JSX } from 'preact'
import { useRef } from 'preact/hooks'
import { scrubStep } from '@/canvas/client/inspector/values'

/**
 * One drag of a number field's glyph. Each call takes the value as the field
 * shows it. Only `commit` writes, so a drag posts one edit at most.
 */
export interface ScrubSession {
  readonly preview: (value: string) => void
  readonly restore: () => void
  readonly commit: (value: string) => void
}

/**
 * Opens a session at press, so what `restore` returns to is read before any
 * preview, however often the panel renders during the drag.
 */
export interface Scrub {
  readonly begin: () => ScrubSession
}

interface FieldProps {
  /** The full word, which names the input for assistive technology. */
  readonly label: string
  /** The short mark drawn inside the field, hidden from assistive technology. */
  readonly glyph: string
  readonly initial: string
  readonly isBusy: boolean
  readonly isWide?: boolean
  readonly placeholder?: string
  readonly onCommit: (value: string) => void
  /** Makes the glyph a drag handle. Typing stays the keyboard path. */
  readonly scrub?: Scrub
}

const NUMBER = /^-?\d*\.?\d+$/

interface Drag {
  readonly pointerId: number
  readonly start: string
  readonly session: ScrubSession
  lastX: number
  value: number
}

function fieldClass(isWide: boolean | undefined, modifier?: string): string {
  return ['glyph-field', isWide ? 'is-wide' : '', modifier ?? '']
    .filter(Boolean)
    .join(' ')
}

/**
 * Commits on change, which a text input fires on Enter or on leaving it, and
 * sends nothing when the value is what it started at. Escape puts it back.
 */
export function Field({
  label,
  glyph,
  initial,
  isBusy,
  isWide,
  placeholder,
  onCommit,
  scrub,
}: FieldProps): JSX.Element {
  const input = useRef<HTMLInputElement>(null)
  const handle = useRef<HTMLSpanElement>(null)
  const drag = useRef<Drag | null>(null)

  const end = (pointerId: number): Drag | undefined => {
    const held = drag.current
    if (!held || held.pointerId !== pointerId) return undefined
    drag.current = null
    return held
  }

  const handlers = scrub
    ? {
        onPointerDown: (event: PointerEvent) => {
          const field = input.current
          const start = field?.value.trim() ?? ''
          if (isBusy || !NUMBER.test(start)) return
          event.preventDefault()
          /*
           * Capture keeps the release coming here when the pointer leaves the
           * glyph, the panel, or crosses into a frame's own document.
           */
          try {
            handle.current?.setPointerCapture(event.pointerId)
          } catch {
            /* A pointer the browser no longer tracks ends on cancel instead. */
          }
          drag.current = {
            pointerId: event.pointerId,
            start,
            session: scrub.begin(),
            lastX: event.clientX,
            value: Number(start),
          }
        },
        onPointerMove: (event: PointerEvent) => {
          const held = drag.current
          if (!held || held.pointerId !== event.pointerId) return
          const moved = event.clientX - held.lastX
          held.lastX = event.clientX
          held.value =
            Math.round((held.value + moved * scrubStep(event.shiftKey)) * 10) /
            10
          const shown = String(held.value)
          if (input.current) input.current.value = shown
          held.session.preview(shown)
        },
        onPointerUp: (event: PointerEvent) => {
          const held = end(event.pointerId)
          if (!held) return
          const shown = String(held.value)
          if (shown === held.start) held.session.restore()
          else held.session.commit(shown)
        },
        onPointerCancel: (event: PointerEvent) => {
          const held = end(event.pointerId)
          if (!held) return
          if (input.current) input.current.value = held.start
          held.session.restore()
        },
      }
    : {}

  return (
    <div class={fieldClass(isWide)}>
      <span
        ref={handle}
        class={scrub ? 'glyph is-scrub' : 'glyph'}
        aria-hidden="true"
        title={label}
        {...handlers}
      >
        {glyph}
      </span>
      <input
        ref={input}
        class="glyph-field-input"
        type="text"
        aria-label={label}
        title={initial}
        defaultValue={initial}
        placeholder={placeholder}
        disabled={isBusy}
        spellcheck={false}
        onChange={(event) => {
          const value = event.currentTarget.value.trim()
          if (value !== initial.trim()) onCommit(value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') event.currentTarget.value = initial
        }}
      />
    </div>
  )
}

interface ReadOnlyFieldProps {
  readonly label: string
  readonly glyph: string
  readonly value: string
  readonly isWide?: boolean
}

/** A value the panel shows and nothing here writes, drawn like a field. */
export function ReadOnlyField({
  label,
  glyph,
  value,
  isWide,
}: ReadOnlyFieldProps): JSX.Element {
  return (
    <div class={fieldClass(isWide, 'is-readonly')}>
      <span class="glyph" aria-hidden="true" title={label}>
        {glyph}
      </span>
      <output class="glyph-field-input" aria-label={label} title={value}>
        {value}
      </output>
    </div>
  )
}
