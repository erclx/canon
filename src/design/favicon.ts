export interface FaviconColors {
  light: string
  dark: string
}

/** The favicon's own fills, chosen for tab size and apart from the page accent tokens. */
export const FAVICON_COLORS: FaviconColors = {
  light: '#c42938',
  dark: '#e54e40',
}

/**
 * The shapes only, with the source's authoring comment dropped. Both fills are
 * replaced by a rule rather than an attribute so one branch can flip both.
 */
export function renderFavicon(mark: string, colors: FaviconColors): string {
  const shapes = mark
    .replace(/<!--[\s\S]*?-->/, '')
    .trim()
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '')
    .replaceAll(' fill="currentColor"', '')
    .trim()

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 10 80 80">
  <style>
    path, rect { fill: ${colors.light}; }
    @media (prefers-color-scheme: dark) { path, rect { fill: ${colors.dark}; } }
  </style>
  ${shapes.replace(/\n\s*/g, '\n  ')}
</svg>
`
}
