/** @jsxImportSource preact */
import type { JSX } from 'preact'

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
}: FieldProps): JSX.Element {
  return (
    <div class={fieldClass(isWide)}>
      <span class="glyph" aria-hidden="true" title={label}>
        {glyph}
      </span>
      <input
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
