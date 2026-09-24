/** @jsxImportSource ../html */
import type { Child, Element } from '@/teach/html/jsx-runtime'

export interface ParagraphProps {
  /** The lesson's dek, read back by `extractLessonMeta` in `@/teach/nav`. */
  readonly lede?: boolean
  /** Reference numbers, each linking to the `Refs` item carrying that id. */
  readonly cites?: readonly number[]
  readonly children: Child
}

export function Paragraph({ lede, cites, children }: ParagraphProps): Element {
  const markers = (cites ?? []).map((cite) => (
    <sup class="cite">
      <a href={`#r${cite}`}>{cite}</a>
    </sup>
  ))
  return lede ? (
    <p class="lede">
      {children}
      {markers}
    </p>
  ) : (
    <p>
      {children}
      {markers}
    </p>
  )
}
