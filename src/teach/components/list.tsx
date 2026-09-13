/** @jsxImportSource ../html */
import type { Child, Element } from '@/teach/html/jsx-runtime'

export interface ListProps {
  readonly ordered?: boolean
  readonly items: readonly Child[]
}

/**
 * Composes an item per entry rather than taking pre-built `<li>` children, so
 * every list in a lesson escapes the same way regardless of what the caller
 * hands in.
 */
export function List({ ordered, items }: ListProps): Element {
  const rendered = items.map((item) => <li>{item}</li>)
  return ordered ? <ol>{rendered}</ol> : <ul>{rendered}</ul>
}
