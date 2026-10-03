/** @jsxImportSource preact */
import type { JSX } from 'preact'
import { tokens } from '@/canvas/client/state'
import type { Token, TokenKind } from '@/canvas/tokens'

const KIND_LABEL: Record<TokenKind, string> = {
  color: 'Color',
  spacing: 'Spacing',
  radius: 'Radius',
  'font-family': 'Font family',
  'font-size': 'Font size',
  other: 'Other',
}

/**
 * A swatch paints the value in the chrome's document, where the frame's own
 * custom properties are not defined, so a value still naming one shows none.
 */
function Swatch({ token }: { readonly token: Token }): JSX.Element | null {
  const paint = token.resolved ?? token.value
  if (paint.includes('var(')) return null
  return (
    <span class="swatch" aria-hidden="true" style={{ background: paint }} />
  )
}

/** Read-only: the frames' tokens are edited in their stylesheet, not here. */
export function ThemePanel(): JSX.Element {
  const groups = tokens.value?.groups ?? []
  return (
    <section aria-label="Theme">
      {groups.length === 0 ? (
        <p class="empty">
          No tokens resolve for this project, so there is nothing to list.{' '}
          {tokens.value?.notice ?? ''}
        </p>
      ) : (
        groups.map((group) => (
          <div key={group.kind}>
            <h2 class="section-label">{KIND_LABEL[group.kind]}</h2>
            <ul class="tokens" aria-label={`${KIND_LABEL[group.kind]} tokens`}>
              {group.tokens.map((token) => (
                <li key={token.name} class="token" title={token.value}>
                  {group.kind === 'color' ? <Swatch token={token} /> : null}
                  <span class="row-label">{token.name}</span>
                  <span class="row-meta token-value">{token.value}</span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}
