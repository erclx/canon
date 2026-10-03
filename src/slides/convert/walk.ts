import type {
  BoxStyle,
  ElementRecord,
  Rect,
  Rgba,
  ShadowRecord,
  TableCellRecord,
  TextContent,
  TextRun,
} from '@/slides/convert/shapes'

/** What one laid-out slide hands back across `page.evaluate`. */
export interface WalkedSlide {
  readonly background: Rgba
  readonly records: ElementRecord[]
}

/** Set on every walked element, so a screenshot finds the one a record names. */
export const ID_ATTRIBUTE = 'data-canon-id'

/**
 * Runs inside the laid-out page and returns one record per drawable element in
 * document order. Playwright serializes this function to source, so every
 * helper it calls is declared inside its own body: a reference to anything at
 * module scope typechecks and then throws in the page.
 *
 * Text gathers along the inline flow. A block holding text takes every run its
 * inline descendants carry, so `<strong>` inside `<p>` is one shape with two
 * runs, while a block-level child is walked on its own. Images, SVGs, and
 * tables consume their whole subtree.
 *
 * Each walked element is tagged with `idAttribute` set to its record id.
 */
export function walkSlide(idAttribute: string): WalkedSlide {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const context = canvas.getContext('2d', { willReadFrequently: true })

  const rgba = (value: string): Rgba => {
    if (!context || !value || value === 'transparent') {
      return { hex: '000000', alpha: 0 }
    }
    context.clearRect(0, 0, 1, 1)
    context.fillStyle = '#000000'
    context.fillStyle = value
    context.fillRect(0, 0, 1, 1)
    const [r = 0, g = 0, b = 0, a = 0] = context.getImageData(0, 0, 1, 1).data
    const hex = [r, g, b]
      .map((channel) => channel.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
    return { hex, alpha: Math.round((a / 255) * 100) / 100 }
  }

  const px = (value: string): number => Number.parseFloat(value) || 0

  const splitTopLevel = (value: string): string[] => {
    const parts: string[] = []
    let depth = 0
    let current = ''
    for (const char of value) {
      if (char === '(') depth += 1
      if (char === ')') depth -= 1
      if (char === ',' && depth === 0) {
        parts.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    if (current.trim()) parts.push(current.trim())
    return parts
  }

  const shadows = (value: string): ShadowRecord[] => {
    if (!value || value === 'none') return []
    return splitTopLevel(value).map((part) => {
      const colorMatch = /[a-z-]+\([^)]*\)|#[0-9a-f]+/i.exec(part)
      const rest = colorMatch ? part.replace(colorMatch[0], ' ') : part
      const [x = 0, y = 0, blur = 0] = (rest.match(/-?[\d.]+px/g) ?? []).map(px)
      return {
        x,
        y,
        blur,
        color: rgba(colorMatch?.[0] ?? 'rgb(0, 0, 0)'),
        inset: /\binset\b/.test(rest),
      }
    })
  }

  const rectOf = (domRect: DOMRect): Rect => ({
    x: domRect.left,
    y: domRect.top,
    w: domRect.width,
    h: domRect.height,
  })

  const boxStyle = (element: Element, bounds: Rect): BoxStyle => {
    const style = getComputedStyle(element)
    const radius = style.borderTopLeftRadius.endsWith('%')
      ? (px(style.borderTopLeftRadius) / 100) * Math.min(bounds.w, bounds.h)
      : px(style.borderTopLeftRadius)
    return {
      background: rgba(style.backgroundColor),
      borderWidth: {
        top: px(style.borderTopWidth),
        right: px(style.borderRightWidth),
        bottom: px(style.borderBottomWidth),
        left: px(style.borderLeftWidth),
      },
      borderColor: rgba(style.borderTopColor),
      borderStyle: style.borderTopStyle,
      radius,
      padding: {
        top: px(style.paddingTop),
        right: px(style.paddingRight),
        bottom: px(style.paddingBottom),
        left: px(style.paddingLeft),
      },
      shadows: shadows(style.boxShadow),
      raw: {
        backgroundImage: style.backgroundImage,
        transform: style.transform,
        filter: style.filter,
        clipPath: style.clipPath,
        mask: style.maskImage || 'none',
        mixBlendMode: style.mixBlendMode,
        backdropFilter: style.backdropFilter || 'none',
      },
    }
  }

  const describe = (element: Element): string => {
    const tag = element.tagName.toLowerCase()
    if (element.id) return `${tag}#${element.id}`
    const className = element.getAttribute('class')?.trim().split(/\s+/)[0]
    return className ? `${tag}.${className}` : tag
  }

  const isInlineFlow = (element: Element): boolean => {
    const tag = element.tagName.toLowerCase()
    if (tag === 'img' || tag === 'svg' || tag === 'table') return false
    return getComputedStyle(element).display === 'inline'
  }

  const transformText = (text: string, transform: string): string => {
    if (transform === 'uppercase') return text.toUpperCase()
    if (transform === 'lowercase') return text.toLowerCase()
    if (transform === 'capitalize') {
      return text.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
    }
    return text
  }

  /**
   * Collects the runs of `root`'s inline flow, adding every inline element it
   * passed through to `consumed`. `deep` follows block children too, which a
   * table cell needs since it is drawn as one cell however it nests.
   */
  const gatherRuns = (
    root: Element,
    consumed: Set<Element>,
    deep: boolean,
  ): TextRun[] => {
    const runs: TextRun[] = []
    let breakPending = false
    const visit = (node: Node): void => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          const parent = child.parentElement
          if (!parent) continue
          const style = getComputedStyle(parent)
          const text = (child.textContent ?? '').replace(/\s+/g, ' ')
          if (!text.trim() && !runs.length) continue
          if (!text) continue
          const spacing = style.letterSpacing
          const isUnderlined = (inline: Element): boolean => {
            for (let at: Element | null = inline; at; at = at.parentElement) {
              if (
                getComputedStyle(at).textDecorationLine.includes('underline')
              ) {
                return true
              }
              if (at === root) break
            }
            return false
          }
          const highlightOf = (inline: Element): Rgba | undefined => {
            if (inline === root) return undefined
            const ground = rgba(getComputedStyle(inline).backgroundColor)
            return ground.alpha > 0 ? ground : undefined
          }
          runs.push({
            text: transformText(text, style.textTransform),
            color: rgba(style.color),
            fontSize: px(style.fontSize),
            fontWeight: Number(style.fontWeight) || 400,
            italic: style.fontStyle === 'italic',
            underline: isUnderlined(parent),
            fontFamily: style.fontFamily,
            letterSpacing: spacing === 'normal' ? 0 : px(spacing),
            highlight: highlightOf(parent),
            href: parent.closest('a[href]')?.getAttribute('href') ?? undefined,
            breakBefore: breakPending || undefined,
          })
          breakPending = false
        } else if (child instanceof Element) {
          if (child.tagName.toLowerCase() === 'br') {
            breakPending = true
            consumed.add(child)
          } else if (deep || isInlineFlow(child)) {
            consumed.add(child)
            visit(child)
          }
        }
      }
    }
    visit(root)
    return tidyRuns(runs)
  }

  /** Collapses the spaces the browser would, across run boundaries included. */
  const tidyRuns = (runs: TextRun[]): TextRun[] => {
    const tidied: TextRun[] = []
    for (const run of runs) {
      const previous = tidied.at(-1)
      let text = run.text
      if (!previous || run.breakBefore || previous.text.endsWith(' ')) {
        text = text.replace(/^ /, '')
      }
      if (text) tidied.push({ ...run, text })
    }
    const last = tidied.at(-1)
    if (last) tidied[tidied.length - 1] = { ...last, text: last.text.trimEnd() }
    return tidied.filter((run) => run.text.length > 0)
  }

  const textContent = (element: Element, runs: TextRun[]): TextContent => {
    const style = getComputedStyle(element)
    const fontSize = px(style.fontSize)
    return {
      runs,
      align: style.textAlign,
      lineHeight:
        style.lineHeight === 'normal' ? fontSize * 1.2 : px(style.lineHeight),
      fontSize,
    }
  }

  const renderedText = (element: Element): string => {
    const text =
      element instanceof HTMLElement ? element.innerText : element.textContent
    return (text ?? '').replace(/\s+/g, ' ').trim()
  }

  const layoutBox = (element: Element, bounds: Rect): Rect => {
    if (getComputedStyle(element).transform === 'none') return bounds
    if (!(element instanceof HTMLElement)) return bounds
    const w = element.offsetWidth
    const h = element.offsetHeight
    return {
      x: bounds.x + (bounds.w - w) / 2,
      y: bounds.y + (bounds.h - h) / 2,
      w,
      h,
    }
  }

  const records: ElementRecord[] = []
  const ids = new Map<Element, number>()
  const consumed = new Set<Element>()

  const parentId = (element: Element): number | null => {
    let ancestor = element.parentElement
    while (ancestor) {
      const id = ids.get(ancestor)
      if (id !== undefined) return id
      ancestor = ancestor.parentElement
    }
    return null
  }

  const consumeSubtree = (element: Element): void => {
    for (const descendant of Array.from(element.querySelectorAll('*'))) {
      consumed.add(descendant)
    }
  }

  const SKIPPED = new Set(['script', 'style', 'template', 'noscript', 'link'])

  for (const element of Array.from(document.body.querySelectorAll('*'))) {
    if (consumed.has(element)) continue
    const tag = element.tagName.toLowerCase()
    if (SKIPPED.has(tag)) continue
    if (!element.checkVisibility({ visibilityProperty: true })) continue

    const id = records.length + 1
    const bounds = rectOf(element.getBoundingClientRect())
    const base = {
      id,
      parent: parentId(element),
      selector: describe(element),
      box: layoutBox(element, bounds),
      bounds,
      style: boxStyle(element, bounds),
      text: renderedText(element),
    }
    ids.set(element, id)
    element.setAttribute(idAttribute, String(id))

    if (element instanceof HTMLImageElement) {
      records.push({
        ...base,
        kind: 'image',
        src: element.currentSrc || element.src,
        alt: element.alt,
      })
      continue
    }

    if (element instanceof SVGSVGElement) {
      consumeSubtree(element)
      const style = getComputedStyle(element)
      const vars: Record<string, string> = {}
      for (const [, name] of element.outerHTML.matchAll(
        /var\(\s*(--[\w-]+)/g,
      )) {
        if (!name) continue
        const value = style.getPropertyValue(name).trim()
        if (value) vars[name] = value
      }
      records.push({
        ...base,
        kind: 'svg',
        markup: element.outerHTML,
        colors: { color: style.color, vars },
        alt:
          element.getAttribute('aria-label') ??
          element.querySelector('title')?.textContent ??
          '',
      })
      continue
    }

    if (element instanceof HTMLTableElement) {
      consumeSubtree(element)
      const rows = Array.from(element.rows).map((row) =>
        Array.from(row.cells).map((cell): TableCellRecord => {
          const cellBounds = rectOf(cell.getBoundingClientRect())
          return {
            ...textContent(cell, gatherRuns(cell, new Set(), true)),
            box: cellBounds,
            colspan: cell.colSpan,
            rowspan: cell.rowSpan,
            style: boxStyle(cell, cellBounds),
            verticalAlign: getComputedStyle(cell).verticalAlign,
          }
        }),
      )
      records.push({ ...base, kind: 'table', rows })
      continue
    }

    const gathered = new Set<Element>()
    const runs = gatherRuns(element, gathered, false)
    for (const inline of gathered) consumed.add(inline)
    if (runs.length === 0) {
      records.push({ ...base, kind: 'box' })
      continue
    }

    const blockChild = Array.from(element.children).find(
      (child) =>
        !consumed.has(child) &&
        !SKIPPED.has(child.tagName.toLowerCase()) &&
        child.checkVisibility() &&
        !getComputedStyle(child).display.startsWith('inline'),
    )
    const box = blockChild
      ? {
          ...base.box,
          h: Math.max(0, blockChild.getBoundingClientRect().top - base.box.y),
        }
      : base.box

    const style = getComputedStyle(element)
    const isListItem =
      style.display === 'list-item' && style.listStyleType !== 'none'
    const list = isListItem
      ? {
          style: style.listStyleType,
          depth: (() => {
            let depth = 0
            let ancestor = element.parentElement
            while (ancestor) {
              if (ancestor.tagName === 'UL' || ancestor.tagName === 'OL') {
                depth += 1
              }
              ancestor = ancestor.parentElement
            }
            return depth
          })(),
          ordinal:
            (element.parentElement instanceof HTMLOListElement
              ? element.parentElement.start
              : 1) +
            Array.from(element.parentElement?.children ?? [])
              .filter((sibling) => sibling.tagName === 'LI')
              .indexOf(element),
        }
      : undefined

    records.push({
      ...base,
      box,
      kind: 'text',
      content: textContent(element, runs),
      list,
      inlineStyles: Array.from(gathered)
        .filter((inline) => inline.tagName !== 'BR')
        .map((inline) =>
          boxStyle(inline, rectOf(inline.getBoundingClientRect())),
        ),
    })
  }

  const ground = (element: Element): Rgba =>
    rgba(getComputedStyle(element).backgroundColor)
  const bodyGround = ground(document.body)
  const htmlGround = ground(document.documentElement)
  const background =
    bodyGround.alpha > 0
      ? bodyGround
      : htmlGround.alpha > 0
        ? htmlGround
        : { hex: 'FFFFFF', alpha: 1 }

  return { background, records }
}
