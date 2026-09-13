/** @jsxImportSource ../html */
import type { Child, Element } from '@/teach/html/jsx-runtime'

export interface HeadingProps {
  readonly level: 1 | 2
  readonly children: Child
}

export function Heading({ level, children }: HeadingProps): Element {
  return level === 1 ? <h1>{children}</h1> : <h2>{children}</h2>
}
