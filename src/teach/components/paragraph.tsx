/** @jsxImportSource ../html */
import type { Child, Element } from '@/teach/html/jsx-runtime'

export interface ParagraphProps {
  /** The lesson's dek, read back by `extractLessonMeta` in `@/teach/nav`. */
  readonly lede?: boolean
  readonly children: Child
}

export function Paragraph({ lede, children }: ParagraphProps): Element {
  return lede ? <p class="lede">{children}</p> : <p>{children}</p>
}
