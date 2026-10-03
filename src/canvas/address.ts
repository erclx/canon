/**
 * The element address: a frame plus the element's index in document order.
 * The shell counts it over the frame's parsed DOM and the server counts it over
 * the file through `HTMLRewriter`, so the two have to count the same elements.
 * This module imports nothing, which keeps it bundling into the shell, and the
 * server half reaches `HTMLRewriter` as a Bun global only when called.
 */

/** Marks the token stylesheet the server injects, which the file never holds. */
export const TOKENS_ATTRIBUTE = 'data-canvas-tokens'

const EXCERPT_LENGTH = 80

/** Elements whose content is raw text, which a browser never parses as markup. */
const RAW_TEXT = new Set(['script', 'style', 'template', 'textarea', 'title'])

export interface ElementAddress {
  readonly index: number
  readonly tag: string
  /**
   * Every element the shell counted. A browser implies elements the file never
   * states, such as a `tbody` or the document wrapper, and each one shifts the
   * count, so a total that differs from the server's is what exposes it.
   */
  readonly count: number
}

export interface SourceElement {
  readonly tag: string
  readonly classes: readonly string[]
  readonly text: string
}

export type AddressCheck =
  | { readonly ok: true; readonly element: SourceElement }
  | {
      readonly ok: false
      readonly reason: 'address-mismatch'
      readonly detail: string
    }

export function excerpt(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, EXCERPT_LENGTH)
}

export function documentElements(doc: Document): Element[] {
  return [...doc.querySelectorAll('*')].filter(
    (element) => !element.hasAttribute(TOKENS_ATTRIBUTE),
  )
}

export function addressOf(
  doc: Document,
  element: Element,
): ElementAddress | undefined {
  const all = documentElements(doc)
  const index = all.indexOf(element)
  if (index === -1) return undefined
  return { index, tag: element.tagName.toLowerCase(), count: all.length }
}

/** The element an address names, or nothing once the tag there differs. */
export function elementAt(
  doc: Document,
  address: Pick<ElementAddress, 'index' | 'tag'>,
): Element | undefined {
  const element = documentElements(doc)[address.index]
  return element?.tagName.toLowerCase() === address.tag ? element : undefined
}

interface Collected {
  readonly tag: string
  readonly classes: readonly string[]
  text: string
}

/**
 * Every element the file states, in document order. Text is gathered into
 * each open element, which an element closed only by implication keeps open to
 * the end, so its excerpt can run past where a browser would end it.
 */
export function sourceElements(html: string): SourceElement[] {
  const elements: Collected[] = []
  const open: number[] = []
  let rawDepth = 0

  const appendText = (text: string) => {
    for (const index of open) {
      const element = elements[index]
      if (element && element.text.length < EXCERPT_LENGTH * 4) {
        element.text += text
      }
    }
  }

  new HTMLRewriter()
    .on('*', {
      element(element) {
        const tag = element.tagName.toLowerCase()
        const index = elements.length
        /* A tag boundary separates words the way a rendered block would. */
        appendText(' ')
        elements.push({
          tag,
          classes: (element.getAttribute('class') ?? '')
            .split(/\s+/)
            .filter(Boolean),
          text: '',
        })
        if (!element.canHaveContent || element.selfClosing) return
        const isRaw = RAW_TEXT.has(tag)
        open.push(index)
        if (isRaw) rawDepth += 1
        element.onEndTag(() => {
          const at = open.lastIndexOf(index)
          if (at !== -1) open.splice(at, 1)
          if (isRaw) rawDepth -= 1
          appendText(' ')
        })
      },
    })
    .onDocument({
      text(chunk) {
        if (rawDepth === 0) appendText(chunk.text)
      },
    })
    .transform(html)

  return elements.map(({ tag, classes, text }) => ({
    tag,
    classes,
    text: excerpt(text),
  }))
}

/**
 * Finds the element the shell addressed in the file, and refuses when the two
 * counts disagree rather than naming whatever sits at that index on disk.
 */
export function resolveAddress(
  html: string,
  address: ElementAddress,
): AddressCheck {
  const elements = sourceElements(html)
  const element = elements[address.index]
  if (elements.length !== address.count || element?.tag !== address.tag) {
    return {
      ok: false,
      reason: 'address-mismatch',
      detail: `the browser counted ${address.count} elements and the file states ${elements.length}, so element ${address.index} cannot be matched`,
    }
  }
  return { ok: true, element }
}
