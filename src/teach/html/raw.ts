const RAW = Symbol('raw')

/**
 * Markup already rendered, exempt from the escaping every other string
 * receives. `raw` is the only way to produce one, so a lesson has to opt in
 * explicitly rather than an author text string accidentally passing through
 * unescaped.
 */
export interface RawMarkup {
  readonly [RAW]: true
  readonly html: string
}

export function raw(html: string): RawMarkup {
  return { [RAW]: true, html }
}

export function isRaw(value: unknown): value is RawMarkup {
  return typeof value === 'object' && value !== null && RAW in value
}

export function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
