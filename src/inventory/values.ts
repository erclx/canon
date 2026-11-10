import type { SubjectReading } from '@/inventory/subjects'

/**
 * Reads one computed value family off every rendered element and its
 * `::before` and `::after` boxes, one row per element per distinct value.
 *
 * The five subjects share one body because they share every helper, being the
 * element walk, the pseudo-element read, and the color normalization, and a
 * reader is serialized into the page, so a helper outside this body would
 * throw there. The subject arrives as a key through `page.evaluate`.
 *
 * Normalization matches `scale.ts`, which writes the record's values in the
 * same form, so a listing value and a record value meet as one string. A
 * change to either side's form is a change to both.
 *
 * Computed style shows one state, so a `:hover` value and another
 * breakpoint's `@media` value are never read. A frame per width covers the
 * second, and nothing here covers the first.
 */
export function readValues(args: {
  readonly query: string
  readonly subject: string
}): SubjectReading[] {
  const { subject } = args
  const PSEUDOS = ['::before', '::after'] as const

  const describe = (element: Element): string => {
    const tag = element.tagName.toLowerCase()
    if (element.id) return `${tag}#${element.id}`
    const className = element.getAttribute('class')?.trim().split(/\s+/)[0]
    return className ? `${tag}.${className}` : tag
  }

  const round = (amount: number): number => Math.round(amount * 1000) / 1000

  const color = (raw: string): string | undefined => {
    const match = raw.trim().match(/^rgba?\(([^)]*)\)$/i)
    if (!match) return raw === '' || raw === 'transparent' ? undefined : raw
    const parts = (match[1] ?? '')
      .split(/[\s,/]+/)
      .filter((part) => part !== '')
      .map(Number)
    const [r = 0, g = 0, b = 0, a = 1] = parts
    const alpha = round(a)
    if (alpha === 0) return undefined
    if (alpha >= 1) {
      return `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  const px = (raw: string): string | undefined => {
    const amount = Number.parseFloat(raw)
    if (Number.isNaN(amount) || amount === 0) return undefined
    return raw.endsWith('px') ? `${round(amount)}px` : raw
  }

  // A form control paints its value and placeholder in its own color and size
  // while holding no text node, so it counts as carrying text unless its type
  // draws no text at all.
  const TEXTLESS_INPUTS = [
    'checkbox',
    'radio',
    'range',
    'color',
    'file',
    'image',
    'hidden',
  ]
  const hasOwnText = (element: Element): boolean =>
    (element instanceof HTMLInputElement &&
      !TEXTLESS_INPUTS.includes(element.type)) ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLButtonElement ||
    Array.from(element.childNodes).some(
      (node) =>
        node.nodeType === Node.TEXT_NODE &&
        (node.textContent ?? '').trim() !== '',
    )

  const pseudoHasText = (style: CSSStyleDeclaration): boolean =>
    /^["'].*\S.*["']$/.test(style.content)

  const borderColors = (style: CSSStyleDeclaration): string[] =>
    (['Top', 'Right', 'Bottom', 'Left'] as const)
      .filter(
        (side) =>
          style[`border${side}Style`] !== 'none' &&
          Number.parseFloat(style[`border${side}Width`]) > 0,
      )
      .map((side) => style[`border${side}Color`])

  const read = (
    style: CSSStyleDeclaration,
    text: boolean,
    svg: boolean,
  ): (string | undefined)[] => {
    switch (subject) {
      case 'color': {
        const raw = [style.backgroundColor, ...borderColors(style)]
        if (text) raw.push(style.color)
        if (style.outlineStyle !== 'none') raw.push(style.outlineColor)
        if (svg) raw.push(style.fill, style.stroke)
        return raw.map(color)
      }
      case 'font-size':
        return text ? [px(style.fontSize)] : []
      case 'radius': {
        const corners = [
          style.borderTopLeftRadius,
          style.borderTopRightRadius,
          style.borderBottomRightRadius,
          style.borderBottomLeftRadius,
        ]
        if (corners.every((corner) => Number.parseFloat(corner) === 0)) {
          return []
        }
        return [
          corners.every((corner) => corner === corners[0])
            ? corners[0]
            : corners.join(' '),
        ]
      }
      case 'shadow':
        return style.boxShadow === 'none'
          ? []
          : [
              style.boxShadow.replace(
                /rgba?\([^)]*\)/gi,
                (match) => color(match) ?? match,
              ),
            ]
      case 'duration':
        return [style.transitionDuration, style.animationDuration]
          .flatMap((list) => list.split(','))
          .map((entry) => {
            const value = entry.trim()
            const amount = Number.parseFloat(value)
            const ms = value.endsWith('ms') ? amount : amount * 1000
            return Number.isNaN(ms) || ms === 0
              ? undefined
              : `${Math.round(ms)}ms`
          })
      default:
        return []
    }
  }

  const rows: SubjectReading[] = []
  const push = (selector: string, values: (string | undefined)[]): void => {
    const seen = new Set<string>()
    for (const value of values) {
      if (value === undefined || value === 'none' || seen.has(value)) continue
      seen.add(value)
      rows.push({ selector, treatment: value })
    }
  }

  for (const element of [
    document.body,
    ...document.body.querySelectorAll('*'),
  ]) {
    const style = getComputedStyle(element)
    if (style.display === 'none') continue
    push(
      describe(element),
      read(style, hasOwnText(element), element instanceof SVGElement),
    )

    for (const pseudo of PSEUDOS) {
      const box = getComputedStyle(element, pseudo)
      if (box.content === 'none' || box.content === 'normal') continue
      push(
        `${describe(element)}${pseudo}`,
        read(box, pseudoHasText(box), false),
      )
    }
  }

  return rows
}
