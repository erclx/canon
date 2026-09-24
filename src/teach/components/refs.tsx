/** @jsxImportSource ../html */
import type { Element } from '@/teach/html/jsx-runtime'

export interface Reference {
  readonly title: string
  readonly url?: string
  readonly note?: string
}

export interface RefsProps {
  readonly items: readonly Reference[]
}

/**
 * Numbers each item from 1 so its `id` matches the `#r<n>` a cited
 * `Paragraph` links to. The caller has already checked every `url` parses as
 * http or https, since attribute escaping does not stop a `javascript:` href.
 */
export function Refs({ items }: RefsProps): Element {
  const rendered = items.map(({ title, url, note }, index) => (
    <li id={`r${index + 1}`}>
      <cite>{title}</cite>
      {note === undefined ? null : `. ${note}`}
      {url === undefined ? null : [' ', <a href={url}>{new URL(url).host}</a>]}
    </li>
  ))
  return <ol class="refs">{rendered}</ol>
}
