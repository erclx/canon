/**
 * The colors an inline SVG inherited from the page it was drawn in. Inside a
 * slide nothing supplies `color` or a custom property, so a vector handed over
 * as written renders every `currentColor` and `var(--*)` paint as black.
 */
export interface SvgColors {
  /** The element's computed `color`, which is what `currentColor` reads. */
  readonly color: string
  /** Every custom property the element computed, keyed with its leading `--`. */
  readonly vars: Readonly<Record<string, string>>
}

const NAMESPACE = 'http://www.w3.org/2000/svg'

/**
 * Rewrites the paints that depend on the page into the values the browser
 * computed for them. A custom property the page never set takes its own
 * fallback where it carries one, and stays as written otherwise, since the
 * browser drew that paint as invalid too.
 */
export function resolveSvgColors(markup: string, colors: SvgColors): string {
  const withVars = markup.replace(
    /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g,
    (match, name: string, fallback: string | undefined) =>
      colors.vars[name] ?? fallback?.trim() ?? match,
  )
  const withColor = withVars.replace(/\bcurrentColor\b/gi, colors.color)
  return withNamespace(withColor)
}

/**
 * An SVG serialized out of an HTML document carries no namespace, and a
 * standalone file without one is not read as SVG at all.
 */
function withNamespace(markup: string): string {
  if (/^<svg\b[^>]*\sxmlns=/.test(markup)) return markup
  return markup.replace(/^<svg\b/, `<svg xmlns="${NAMESPACE}"`)
}
