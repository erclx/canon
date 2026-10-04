/** @jsxImportSource preact */
import type { JSX } from 'preact'
import { Field, type Scrub } from '@/canvas/client/inspector/field'

/** The menu entry that hands the value back to the field for typing. */
const RAW = ''

interface TokenSelectProps {
  readonly label: string
  readonly glyph: string
  /** The value as the panel shows it, a token's name where one stands. */
  readonly initial: string
  /** One token group's names, in the order the token sheet sorts them. */
  readonly tokens: readonly string[]
  /** The token the element names, where it names one. */
  readonly token?: string
  readonly isRaw: boolean
  readonly isBusy: boolean
  readonly isWide?: boolean
  readonly placeholder?: string
  /** Takes a typed value as typed. */
  readonly onCommit: (value: string) => void
  /** Takes the name of a token picked from the menu or typed whole. */
  readonly onPick: (name: string) => void
  readonly scrub?: Scrub
}

/**
 * A value that takes a token or a typed literal. The menu lists the group's
 * tokens first and a raw value last, which returns focus to the field, so a
 * token is one pick away and a literal is still one keystroke. A group with no
 * tokens leaves the field alone, with no menu and no raw marker.
 */
export function TokenSelect({
  label,
  glyph,
  initial,
  tokens,
  token,
  isRaw,
  isBusy,
  isWide,
  placeholder,
  onCommit,
  onPick,
  scrub,
}: TokenSelectProps): JSX.Element {
  const hasTokens = tokens.length > 0
  return (
    <Field
      label={label}
      glyph={glyph}
      initial={initial}
      isBusy={isBusy}
      isWide={isWide}
      placeholder={placeholder}
      onCommit={(typed) => {
        if (tokens.includes(typed)) onPick(typed)
        else onCommit(typed)
      }}
      scrub={scrub}
      trailing={
        hasTokens ? (
          <>
            {isRaw ? (
              <span
                class="raw"
                title="Set as a raw value, so it will not follow the theme. Pick a token to fix it"
              >
                raw
              </span>
            ) : null}
            <span class="size-mode">
              <select
                class="size-mode-select"
                aria-label={`${label} tokens`}
                value={token ?? RAW}
                disabled={isBusy}
                onChange={(event) => {
                  const picked = event.currentTarget.value
                  if (picked === RAW) {
                    event.currentTarget
                      .closest('.glyph-field')
                      ?.querySelector<HTMLInputElement>('.glyph-field-input')
                      ?.focus()
                  } else if (picked !== token) onPick(picked)
                }}
              >
                {tokens.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                <option value={RAW}>Raw value</option>
              </select>
              <svg
                class="size-mode-chevron"
                viewBox="0 0 16 16"
                aria-hidden="true"
              >
                <path d="M4.5 6.5 8 10l3.5-3.5" />
              </svg>
            </span>
          </>
        ) : null
      }
    />
  )
}
