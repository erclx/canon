import type PptxGenJS from 'pptxgenjs'
import { resolveSvgColors, type SvgColors } from '@/slides/convert/svg'

/**
 * The contract between the walk, which runs inside the laid-out page, and the
 * mapping below, which runs here. Every record is plain data, since it crosses
 * `page.evaluate`. Lengths are CSS pixels and colors are already normalized by
 * the browser, so nothing on this side parses a color the page computed a second time.
 */

export interface Rgba {
  /** Six hex digits, no leading `#`, the form pptxgenjs takes. */
  readonly hex: string
  readonly alpha: number
}

export interface Rect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface Edges {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

export interface ShadowRecord {
  readonly x: number
  readonly y: number
  readonly blur: number
  readonly color: Rgba
  readonly inset: boolean
}

/** Computed values of the properties no rule here maps, read as written. */
export interface RawStyle {
  readonly backgroundImage: string
  readonly transform: string
  readonly filter: string
  readonly clipPath: string
  readonly mask: string
  readonly mixBlendMode: string
  readonly backdropFilter: string
}

export interface BoxStyle {
  readonly background: Rgba
  readonly borderWidth: Edges
  /** The top edge's color and style, read as the whole border's. */
  readonly borderColor: Rgba
  readonly borderStyle: string
  /** The top-left radius, read as every corner's. */
  readonly radius: number
  readonly padding: Edges
  readonly shadows: readonly ShadowRecord[]
  readonly raw: RawStyle
}

export interface TextRun {
  readonly text: string
  readonly color: Rgba
  readonly fontSize: number
  readonly fontWeight: number
  readonly italic: boolean
  readonly underline: boolean
  readonly fontFamily: string
  /** Zero where the computed value is `normal`. */
  readonly letterSpacing: number
  readonly href?: string
  /** Set on the run a `<br>` precedes. */
  readonly breakBefore?: boolean
}

export interface ListMarker {
  /** The computed `list-style-type`, such as `disc` or `decimal`. */
  readonly style: string
  /** One for a top-level item. */
  readonly depth: number
  /** The item's position in its list, counted from one. */
  readonly ordinal: number
}

export interface TextContent {
  readonly runs: readonly TextRun[]
  readonly align: string
  readonly lineHeight: number
  readonly fontSize: number
}

export interface TableCellRecord extends TextContent {
  readonly box: Rect
  readonly colspan: number
  readonly rowspan: number
  readonly style: BoxStyle
  readonly verticalAlign: string
}

interface RecordBase {
  readonly id: number
  readonly parent: number | null
  readonly selector: string
  /** The layout box before any transform, in page coordinates. */
  readonly box: Rect
  /** What the element covers on screen, which a screenshot of it spans. */
  readonly bounds: Rect
  readonly style: BoxStyle
  /** The element's rendered text, which a picture standing in for it carries. */
  readonly text: string
}

export type ElementRecord =
  | (RecordBase & { readonly kind: 'box' })
  | (RecordBase & {
      readonly kind: 'text'
      readonly content: TextContent
      readonly list?: ListMarker
    })
  | (RecordBase & {
      readonly kind: 'image'
      readonly src: string
      readonly alt: string
    })
  | (RecordBase & {
      readonly kind: 'svg'
      readonly markup: string
      readonly colors: SvgColors
      readonly alt: string
    })
  | (RecordBase & {
      readonly kind: 'table'
      readonly rows: readonly (readonly TableCellRecord[])[]
    })

const PX_PER_INCH = 96
const PT_PER_PX = 0.75

const inches = (px: number): number => px / PX_PER_INCH
const points = (px: number): number => px * PT_PER_PX

function position(box: Rect): PptxGenJS.PositionProps {
  return {
    x: inches(box.x),
    y: inches(box.y),
    w: inches(box.w),
    h: inches(box.h),
  }
}

/**
 * The CSS this converter has no shape for. An element computing any of them
 * becomes one picture of itself rather than a shape that drops the effect.
 */
export const UNMAPPED_PROPERTIES = [
  'background-image',
  'transform',
  'filter',
  'clip-path',
  'mask',
  'mix-blend-mode',
  'backdrop-filter',
  'box-shadow',
] as const

export type UnmappedProperty = (typeof UNMAPPED_PROPERTIES)[number]

/**
 * A computed transform is a matrix, and only rotation survives into a shape.
 * Translation is already in the box the browser reported, so it maps too.
 * Anything scaling or skewing returns `undefined`.
 */
export function rotationOf(transform: string): number | undefined {
  if (transform === 'none') return 0
  const match = /^matrix\(([^)]+)\)$/.exec(transform)
  if (!match?.[1]) return undefined
  const [a = 0, b = 0, c = 0, d = 0] = match[1].split(',').map(Number)
  const isRotation =
    Math.abs(a - d) < 1e-3 &&
    Math.abs(b + c) < 1e-3 &&
    Math.abs(a * a + b * b - 1) < 1e-3
  if (!isRotation) return undefined
  const degrees = (Math.atan2(b, a) * 180) / Math.PI
  return Math.round(((degrees % 360) + 360) % 360)
}

/** Every unmapped property the record computes, in the order listed above. */
export function unmappedProperties(record: ElementRecord): UnmappedProperty[] {
  const { raw, shadows } = record.style
  const found: Record<UnmappedProperty, boolean> = {
    'background-image': raw.backgroundImage !== 'none',
    transform: rotationOf(raw.transform) === undefined,
    filter: raw.filter !== 'none',
    'clip-path': raw.clipPath !== 'none',
    mask: raw.mask !== 'none',
    'mix-blend-mode': raw.mixBlendMode !== 'normal',
    'backdrop-filter': raw.backdropFilter !== 'none',
    'box-shadow': shadows.length > 1,
  }
  return UNMAPPED_PROPERTIES.filter((property) => found[property])
}

function transparency(color: Rgba): number | undefined {
  return color.alpha < 1 ? Math.round((1 - color.alpha) * 100) : undefined
}

function fill(style: BoxStyle): PptxGenJS.ShapeFillProps | undefined {
  if (style.background.alpha === 0) return undefined
  return {
    color: style.background.hex,
    transparency: transparency(style.background),
  }
}

function hasBorder(style: BoxStyle): boolean {
  return (
    style.borderWidth.top > 0 &&
    style.borderStyle !== 'none' &&
    style.borderColor.alpha > 0
  )
}

function line(style: BoxStyle): PptxGenJS.ShapeLineProps | undefined {
  if (!hasBorder(style)) return undefined
  return {
    color: style.borderColor.hex,
    width: points(style.borderWidth.top),
    dashType: style.borderStyle === 'dashed' ? 'dash' : 'solid',
    transparency: transparency(style.borderColor),
  }
}

/**
 * The first shadow only, since a second one is unmapped and sends the element
 * to a picture before this runs. PowerPoint measures the direction clockwise
 * from the right, which is the same sense as a CSS offset with y pointing down.
 */
export function shadowOf(style: BoxStyle): PptxGenJS.ShadowProps | undefined {
  const [shadow] = style.shadows
  if (!shadow || shadow.color.alpha === 0) return undefined
  const angle = (Math.atan2(shadow.y, shadow.x) * 180) / Math.PI
  return {
    type: shadow.inset ? 'inner' : 'outer',
    offset: points(Math.hypot(shadow.x, shadow.y)),
    angle: Math.round((angle + 360) % 360),
    blur: points(shadow.blur),
    color: shadow.color.hex,
    opacity: shadow.color.alpha,
  }
}

function geometry(style: BoxStyle): {
  shape: PptxGenJS.SHAPE_NAME
  rectRadius?: number
} {
  if (style.radius <= 0) return { shape: 'rect' }
  return { shape: 'roundRect', rectRadius: inches(style.radius) }
}

/**
 * The first family the page asked for, which is the name PowerPoint looks up.
 * A variable face installs under its plain family name.
 */
export function fontFace(fontFamily: string): string {
  const first = fontFamily.split(',')[0] ?? ''
  return first
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/ Variable$/, '')
}

/** A link refused rather than written, with the reason the report prints. */
export interface RefusedLink {
  readonly selector: string
  readonly href: string
  readonly reason: string
}

export interface LinkContext {
  readonly slideCount: number
}

type LinkResult =
  | { readonly kind: 'link'; readonly hyperlink: PptxGenJS.HyperlinkProps }
  | { readonly kind: 'refused'; readonly reason: string }

/**
 * `#slide-N` jumps to a slide in this deck and an absolute URL opens outside
 * it. A slide number past the deck's end, or a target in neither form, is
 * refused rather than written as a link that goes nowhere.
 */
export function linkOf(href: string, context: LinkContext): LinkResult {
  const slide = /^#slide-(\d+)$/.exec(href)
  if (slide?.[1]) {
    const number = Number(slide[1])
    if (number >= 1 && number <= context.slideCount) {
      return { kind: 'link', hyperlink: { slide: number } }
    }
    return {
      kind: 'refused',
      reason: `slide ${number} is past the deck's ${context.slideCount}`,
    }
  }
  if (/^(https?:|mailto:)/i.test(href)) {
    return { kind: 'link', hyperlink: { url: href } }
  }
  return {
    kind: 'refused',
    reason: 'not a #slide-N anchor or an absolute URL',
  }
}

function runProps(
  run: TextRun,
  context: LinkContext,
  selector: string,
  refused: RefusedLink[],
): PptxGenJS.TextProps {
  const options: PptxGenJS.TextPropsOptions = {
    color: run.color.hex,
    fontSize: points(run.fontSize),
    fontFace: fontFace(run.fontFamily),
    bold: run.fontWeight >= 600,
    italic: run.italic,
  }
  if (run.underline) options.underline = { style: 'sng' }
  if (run.letterSpacing !== 0) options.charSpacing = points(run.letterSpacing)
  if (run.breakBefore) options.softBreakBefore = true
  if (run.href) {
    const link = linkOf(run.href, context)
    if (link.kind === 'link') options.hyperlink = link.hyperlink
    else refused.push({ selector, href: run.href, reason: link.reason })
  }
  return { text: run.text, options }
}

const ALIGN: Readonly<Record<string, PptxGenJS.HAlign>> = {
  left: 'left',
  start: 'left',
  center: 'center',
  right: 'right',
  end: 'right',
  justify: 'justify',
}

const MARKERS: Readonly<Record<string, string>> = {
  disc: '2022',
  circle: '25E6',
  square: '25AA',
}

/** The glyph a browser draws at each depth when the list names no style. */
const DEPTH_MARKERS = ['2022', '25E6', '25AA'] as const

/**
 * An outside marker sits left of the item's box, so the text box widens left
 * by the gap and the bullet indent takes it back. One em is the gap Chromium
 * leaves for a disc and for a one-digit number alike.
 */
function bulletOf(
  list: ListMarker,
  fontSize: number,
): { bullet: PptxGenJS.TextPropsOptions['bullet']; gap: number } {
  const gap = fontSize
  const indent = points(gap)
  if (list.style === 'decimal') {
    return {
      bullet: {
        type: 'number',
        numberType: 'arabicPeriod',
        numberStartAt: list.ordinal,
        indent,
      },
      gap,
    }
  }
  const characterCode =
    MARKERS[list.style] ??
    DEPTH_MARKERS[Math.min(list.depth, DEPTH_MARKERS.length) - 1] ??
    DEPTH_MARKERS[0]
  return { bullet: { characterCode, indent }, gap }
}

/**
 * PowerPoint sets an exact line spacing with the whole leading above the first
 * line, where the browser splits it above and below. Lifting the text by half
 * the leading puts the first baseline where the browser drew it.
 */
export function halfLeading(content: TextContent): number {
  return Math.max(0, (content.lineHeight - content.fontSize) / 2)
}

/** A shape, a picture, or a table, in the order the slide stacks them. */
export type DrawOp =
  | {
      readonly kind: 'shape'
      readonly shape: PptxGenJS.SHAPE_NAME
      readonly options: PptxGenJS.ShapeProps
    }
  | {
      readonly kind: 'text'
      readonly runs: PptxGenJS.TextProps[]
      readonly options: PptxGenJS.TextPropsOptions
    }
  | {
      readonly kind: 'image'
      readonly src: string
      readonly options: PptxGenJS.ImageProps
      /** Corner radius in inches, which pptxgenjs cannot write on a picture. */
      readonly radius: number
      /** The border, drawn as an unfilled shape over the picture. */
      readonly frame?: PptxGenJS.ShapeProps
    }
  | {
      readonly kind: 'svg'
      readonly id: number
      readonly markup: string
      readonly options: PptxGenJS.ImageProps
    }
  | {
      readonly kind: 'table'
      readonly rows: PptxGenJS.TableRow[]
      readonly options: PptxGenJS.TableProps
    }
  | {
      readonly kind: 'fallback'
      readonly id: number
      readonly options: PptxGenJS.ImageProps
    }

export interface Fallback {
  readonly id: number
  readonly selector: string
  readonly properties: readonly UnmappedProperty[]
}

export interface SlidePlan {
  readonly ops: readonly DrawOp[]
  readonly fallbacks: readonly Fallback[]
  readonly refusedLinks: readonly RefusedLink[]
}

function boxOp(record: ElementRecord): DrawOp | undefined {
  const { style } = record
  const shapeFill = fill(style)
  const shapeLine = line(style)
  const shadow = shadowOf(style)
  if (!shapeFill && !shapeLine && !shadow) return undefined
  const { shape, rectRadius } = geometry(style)
  return {
    kind: 'shape',
    shape,
    options: {
      ...position(record.box),
      fill: shapeFill ?? { type: 'none' },
      line: shapeLine ?? { type: 'none' },
      rectRadius,
      shadow,
      rotate: rotationOf(style.raw.transform) || undefined,
    },
  }
}

/**
 * The inset carries the padding and the border width together, since the text
 * box spans the border box and the line is drawn on its edge. pptxgenjs reads a
 * text margin as left, right, bottom, top, in points.
 */
function textOp(
  record: Extract<ElementRecord, { kind: 'text' }>,
  context: LinkContext,
  refused: RefusedLink[],
): DrawOp {
  const { style, content, list } = record
  const runs = content.runs.map((run) =>
    runProps(run, context, record.selector, refused),
  )
  const lift = halfLeading(content)
  const inset = {
    top: style.padding.top + style.borderWidth.top - lift,
    right: style.padding.right + style.borderWidth.right,
    bottom: style.padding.bottom + style.borderWidth.bottom,
    left: style.padding.left + style.borderWidth.left,
  }
  const bullet = list ? bulletOf(list, content.fontSize) : undefined
  const gap = bullet?.gap ?? 0
  const box = {
    x: record.box.x - gap,
    y: record.box.y + Math.min(0, inset.top),
    w: record.box.w + gap,
    h: record.box.h,
  }
  const { shape, rectRadius } = geometry(style)
  return {
    kind: 'text',
    runs,
    options: {
      ...position(box),
      shape,
      rectRadius,
      fill: fill(style),
      line: line(style),
      shadow: shadowOf(style),
      margin: [
        points(inset.left),
        points(inset.right),
        points(inset.bottom),
        points(Math.max(0, inset.top)),
      ],
      valign: 'top',
      align: ALIGN[content.align] ?? 'left',
      lineSpacing: points(content.lineHeight),
      bullet: bullet?.bullet,
      rotate: rotationOf(style.raw.transform) || undefined,
      fit: 'none',
    },
  }
}

function imageOp(record: Extract<ElementRecord, { kind: 'image' }>): DrawOp {
  const { style } = record
  const frameLine = line(style)
  const { rectRadius } = geometry(style)
  return {
    kind: 'image',
    src: record.src,
    radius: rectRadius ?? 0,
    options: {
      ...position(record.box),
      altText: record.alt,
      shadow: shadowOf(style),
      rotate: rotationOf(style.raw.transform) || undefined,
    },
    frame: frameLine
      ? {
          ...position(record.box),
          fill: { type: 'none' },
          line: frameLine,
          rectRadius,
        }
      : undefined,
  }
}

function svgOp(record: Extract<ElementRecord, { kind: 'svg' }>): DrawOp {
  return {
    kind: 'svg',
    id: record.id,
    markup: resolveSvgColors(record.markup, record.colors),
    options: { ...position(record.box), altText: record.alt || record.text },
  }
}

/**
 * Columns and rows are the distinct cell edges the browser laid out, so a
 * spanning cell lands on the boundaries its neighbors share. pptxgenjs reads a
 * row as the cells that start in it, which is the order the walk emits.
 */
function tableOp(
  record: Extract<ElementRecord, { kind: 'table' }>,
  context: LinkContext,
  refused: RefusedLink[],
): DrawOp {
  const cells = record.rows.flat()
  const edges = (values: number[]): number[] =>
    [...new Set(values.map((value) => Math.round(value)))].sort((a, b) => a - b)
  const columns = edges(
    cells.flatMap((cell) => [cell.box.x, cell.box.x + cell.box.w]),
  )
  const rowEdges = edges(
    cells.flatMap((cell) => [cell.box.y, cell.box.y + cell.box.h]),
  )
  const spans = (list: number[]): number[] =>
    list.slice(1).map((edge, index) => inches(edge - (list[index] ?? edge)))

  const rows = record.rows.map((row) =>
    row.map((cell): PptxGenJS.TableCell => {
      const border = (width: number): PptxGenJS.BorderProps =>
        width > 0 && cell.style.borderStyle !== 'none'
          ? {
              type: 'solid',
              pt: points(width),
              color: cell.style.borderColor.hex,
            }
          : { type: 'none' }
      const cellFill = fill(cell.style)
      return {
        text: cell.runs.map((run) =>
          runProps(run, context, record.selector, refused),
        ),
        options: {
          colspan: cell.colspan > 1 ? cell.colspan : undefined,
          rowspan: cell.rowspan > 1 ? cell.rowspan : undefined,
          fill: cellFill,
          align: ALIGN[cell.align] ?? 'left',
          valign:
            cell.verticalAlign === 'top'
              ? 'top'
              : cell.verticalAlign === 'bottom'
                ? 'bottom'
                : 'middle',
          margin: [
            inches(cell.style.padding.top),
            inches(cell.style.padding.right),
            inches(cell.style.padding.bottom),
            inches(cell.style.padding.left),
          ],
          border: [
            border(cell.style.borderWidth.top),
            border(cell.style.borderWidth.right),
            border(cell.style.borderWidth.bottom),
            border(cell.style.borderWidth.left),
          ],
        },
      }
    }),
  )
  const first = columns[0] ?? record.box.x
  const top = rowEdges[0] ?? record.box.y
  return {
    kind: 'table',
    rows,
    options: {
      x: inches(first),
      y: inches(top),
      w: inches((columns.at(-1) ?? first) - first),
      colW: spans(columns),
      rowH: spans(rowEdges),
    },
  }
}

/**
 * Maps one slide's records in document order. A fallback element drops every
 * record beneath it, since its picture already shows them, while its parent and
 * siblings stay native.
 */
export function planSlide(
  records: readonly ElementRecord[],
  context: LinkContext,
): SlidePlan {
  const ops: DrawOp[] = []
  const fallbacks: Fallback[] = []
  const refusedLinks: RefusedLink[] = []
  const dropped = new Set<number>()

  for (const record of records) {
    if (record.parent !== null && dropped.has(record.parent)) {
      dropped.add(record.id)
      continue
    }
    const properties = unmappedProperties(record)
    if (properties.length > 0) {
      dropped.add(record.id)
      fallbacks.push({ id: record.id, selector: record.selector, properties })
      ops.push({
        kind: 'fallback',
        id: record.id,
        options: { ...position(record.bounds), altText: record.text },
      })
      continue
    }
    const op =
      record.kind === 'box'
        ? boxOp(record)
        : record.kind === 'text'
          ? textOp(record, context, refusedLinks)
          : record.kind === 'image'
            ? imageOp(record)
            : record.kind === 'svg'
              ? svgOp(record)
              : tableOp(record, context, refusedLinks)
    if (op) ops.push(op)
  }

  return { ops, fallbacks, refusedLinks }
}
