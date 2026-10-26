export interface ThemePair {
  readonly light: string
  readonly dark: string
}

export interface FaviconColors {
  /** The tile the mark sits on, dark wherever no theme applies. */
  readonly tile: ThemePair
  /** The tile's edge, drawn on light alone. */
  readonly edge: string
  /** The c, in the text ink of each theme. */
  readonly c: ThemePair
  /** The pip, in the brand pair rather than the page accent. */
  readonly pip: ThemePair
}

/** The mark's own colors, picked on the board and kept apart from the page accent tokens. */
export const FAVICON_COLORS: FaviconColors = {
  tile: { light: '#fbfaf8', dark: '#1b1a18' },
  edge: '#dcdad6',
  c: { light: '#2c2c29', dark: '#d9d7d4' },
  pip: { light: '#c2380e', dark: '#ff6b42' },
}

/** The mark spans 96 of a 132 tile, with the tile's corner at 28% of its side. */
const MARK_IN_TILE = 96 / 132
const TILE_RADIUS = 0.28
/** About one pixel at a 32 pixel tab icon, drawn inside the tile's bounds. */
const EDGE_WIDTH = 4

/** The source's shapes, with its authoring comment and `currentColor` fills dropped. */
function markShapes(mark: string): string {
  return mark
    .replace(/<!--[\s\S]*?-->/, '')
    .trim()
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '')
    .replaceAll(' fill="currentColor"', '')
    .trim()
}

function markView(mark: string): [number, number, number, number] {
  const view = /viewBox="([^"]+)"/
    .exec(mark)?.[1]
    .trim()
    .split(/[\s,]+/)
  const numbers = view?.map(Number) ?? []
  if (numbers.length !== 4 || numbers.some((n) => !Number.isFinite(n))) {
    throw new Error('the mark carries no viewBox of four numbers')
  }
  return numbers as [number, number, number, number]
}

const round = (n: number): number => Math.round(n * 100) / 100

/**
 * The mark on its tile. Dark is the default branch, since `prefers-color-scheme`
 * follows the OS rather than the browser theme and only the dark tile keeps
 * the c readable on a dark tab bar under a light OS. Every fill is a rule
 * rather than an attribute so the light branch can flip them all.
 */
export function renderFavicon(mark: string, colors: FaviconColors): string {
  const [x, y, width, height] = markView(mark)
  const side = Math.max(width, height) / MARK_IN_TILE
  const left = round(x + width / 2 - side / 2)
  const top = round(y + height / 2 - side / 2)
  const inset = EDGE_WIDTH / 2
  const shapes = markShapes(mark)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${round(side)} ${round(side)}">
  <style>
    .tile { fill: ${colors.tile.dark}; stroke: ${colors.tile.dark}; }
    .c { fill: ${colors.c.dark}; }
    .pip { fill: ${colors.pip.dark}; }
    @media (prefers-color-scheme: light) {
      .tile { fill: ${colors.tile.light}; stroke: ${colors.edge}; }
      .c { fill: ${colors.c.light}; }
      .pip { fill: ${colors.pip.light}; }
    }
  </style>
  <rect class="tile" x="${round(left + inset)}" y="${round(top + inset)}" width="${round(side - EDGE_WIDTH)}" height="${round(side - EDGE_WIDTH)}" rx="${round(side * TILE_RADIUS - inset)}" stroke-width="${EDGE_WIDTH}" />
  <g class="c">
  ${shapes.replace(/\n\s*/g, '\n  ')}
  </g>
</svg>
`
}

/**
 * The bare mark in fixed fills, for a surface that loads it as an image and
 * so has neither a CSS context for `currentColor` nor a theme of its own.
 */
export function renderMark(
  mark: string,
  fills: { readonly c: string; readonly pip: string },
): string {
  const svg = mark.replace(/<!--[\s\S]*?-->/, '').trim()
  const pipFill = /(<[a-z]+ [^>]*class="pip"[^>]*?) fill="[^"]*"/
  if (!pipFill.test(svg)) {
    throw new Error('the mark carries no filled .pip shape')
  }
  const pip = svg.replace(pipFill, `$1 fill="${fills.pip}"`)
  return `${pip.replaceAll('currentColor', fills.c)}\n`
}

/**
 * The `<link rel="icon">` a page carries the rendered favicon in, inlined so a
 * generated page needs no sibling file and no href that varies with its depth.
 */
export function faviconLink(svg: string): string {
  return `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(svg)}">`
}
