/** @jsxImportSource preact */
import type { JSX } from 'preact'
import { Field, type Scrub } from '@/canvas/client/inspector/field'

/** The modes a size takes besides a number, by the name the field shows. */
const MODES = ['Fill', 'Fit'] as const

interface SizeFieldProps {
  readonly label: string
  readonly glyph: string
  /** The value as the panel shows it, a mode name or a number. */
  readonly initial: string
  readonly isBusy: boolean
  /** Takes a typed number or a picked mode name, each as shown. */
  readonly onCommit: (value: string) => void
  readonly scrub?: Scrub
}

/**
 * A size that takes a number or a mode. The chevron is a native select, so
 * its list opens above the panel's clipping and answers the keyboard as the
 * platform does, and typing a number replaces the mode.
 */
export function SizeField({
  label,
  glyph,
  initial,
  isBusy,
  onCommit,
  scrub,
}: SizeFieldProps): JSX.Element {
  const mode = (MODES as readonly string[]).includes(initial) ? initial : ''
  return (
    <Field
      label={label}
      glyph={glyph}
      initial={initial}
      isBusy={isBusy}
      onCommit={onCommit}
      scrub={scrub}
      trailing={
        <span class="size-mode">
          <select
            class="size-mode-select"
            aria-label={`${label} mode`}
            value={mode}
            disabled={isBusy}
            onChange={(event) => {
              const picked = event.currentTarget.value
              if (picked && picked !== mode) onCommit(picked)
            }}
          >
            <option value="" disabled hidden>
              Fixed
            </option>
            {MODES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <svg class="size-mode-chevron" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4.5 6.5 8 10l3.5-3.5" />
          </svg>
        </span>
      }
    />
  )
}
