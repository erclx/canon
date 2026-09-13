import { escape, isRaw, raw, type RawMarkup } from './raw'

export type Child =
  | string
  | number
  | boolean
  | null
  | undefined
  | RawMarkup
  | readonly Child[]

export interface Props {
  readonly children?: Child
  readonly [key: string]: unknown
}

/**
 * What a component returns and what `jsx` produces: markup already rendered,
 * carrying the same brand `raw` gives an author's own escape hatch. One brand
 * for both is what lets a parent's `{children}` compose a child's output
 * without escaping it a second time, since a plain string cannot say whether
 * it is author text or already-rendered markup.
 */
export type Element = RawMarkup

export type Component<P extends Props = Props> = (props: P) => Element

export const Fragment = Symbol('Fragment')

const ARIA_PREFIX = 'aria-'

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
])

function renderChild(child: Child): string {
  if (child === null || child === undefined || typeof child === 'boolean') {
    return ''
  }
  if (typeof child === 'number') return String(child)
  if (typeof child === 'string') return escape(child)
  if (isRaw(child)) return child.html
  return child.map(renderChild).join('')
}

/**
 * ARIA takes the literal word for a boolean, where HTML boolean attributes
 * take presence or absence. Spike 1's first draft rendered a bare
 * `aria-disabled` for `true` and dropped `aria-disabled={false}` entirely,
 * silently removing state a screen reader reads.
 */
function renderAttribute(key: string, value: unknown): string {
  if (key.startsWith(ARIA_PREFIX) && typeof value === 'boolean') {
    return ` ${key}="${value}"`
  }
  if (value === undefined || value === null || value === false) return ''
  if (value === true) return ` ${key}`
  if (isRaw(value)) return ` ${key}="${escape(value.html)}"`
  return ` ${key}="${escape(String(value))}"`
}

function renderAttributes(props: Props): string {
  return Object.entries(props)
    .filter(([key]) => key !== 'children')
    .map(([key, value]) => renderAttribute(key, value))
    .join('')
}

export function jsx(
  type: string | Component | typeof Fragment,
  props: Props,
): Element {
  if (type === Fragment) return raw(renderChild(props.children ?? null))
  if (typeof type === 'function') return type(props)

  const attrs = renderAttributes(props)
  if (VOID_ELEMENTS.has(type)) return raw(`<${type}${attrs}>`)

  return raw(
    `<${type}${attrs}>${renderChild(props.children ?? null)}</${type}>`,
  )
}

export const jsxs = jsx

/** Unwraps a rendered element to the plain string a file writes to disk. */
export function render(element: Element): string {
  return element.html
}

export namespace JSX {
  export type Element = RawMarkup

  export interface ElementChildrenAttribute {
    children: Record<string, never>
  }

  export interface IntrinsicElements {
    [name: string]: Props
  }
}
