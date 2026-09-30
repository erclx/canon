/** @jsxImportSource ../html */
import { highlight } from '@/teach/highlight'
import type { Element } from '@/teach/html/jsx-runtime'
import { raw } from '@/teach/html/raw'

export interface CodeProps {
  /** A highlight.js language name or alias. Unregistered ones render plain. */
  readonly lang?: string
  readonly text: string
}

/**
 * The one way code reaches a lesson body. The highlighter escapes every source
 * character before wrapping tokens in spans, which is what makes passing its
 * output through `raw` safe.
 */
export function Code({ lang, text }: CodeProps): Element {
  const className = lang === undefined ? 'hljs' : `hljs language-${lang}`
  return (
    <pre>
      <code class={className}>{raw(highlight(text, lang).html)}</code>
    </pre>
  )
}
