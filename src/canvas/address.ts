/**
 * The element address: a frame plus the element's index in document order.
 * The shell counts it over the frame's parsed DOM and the server counts it over
 * the file through `HTMLRewriter`, so the two have to count the same elements.
 * This module imports nothing, which keeps it bundling into the shell, and the
 * server half reaches `HTMLRewriter` as a Bun global only when called.
 */

/** Marks the token stylesheet the server injects, which the file never holds. */
export const TOKENS_ATTRIBUTE = 'data-canvas-tokens'

/** On that same element, the hash of the file the frame was served from. */
export const HASH_ATTRIBUTE = 'data-canvas-hash'

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
  /**
   * The served file's hash, so the server can refuse a pick made against a
   * version of the frame the file has since moved past.
   */
  readonly hash?: string
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
  const address = {
    index,
    tag: element.tagName.toLowerCase(),
    count: all.length,
  }
  const hash = doc
    .querySelector(`[${TOKENS_ATTRIBUTE}]`)
    ?.getAttribute(HASH_ATTRIBUTE)
  return hash ? { ...address, hash } : address
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
 * Called on each element the address counts, with its index. What it returns
 * runs at the element's end tag, since a second `onEndTag` on one element
 * replaces the first rather than adding to it.
 */
export type ElementVisitor = (
  element: HTMLRewriterTypes.Element,
  index: number,
) => (() => void) | undefined

/**
 * Registers the one counting rule both the reader and the edit writer follow,
 * so an index means the same element to each.
 */
export function countElements(
  rewriter: HTMLRewriter,
  visit: ElementVisitor,
): HTMLRewriter {
  let count = 0
  /* A template's content is a fragment `querySelectorAll` never reaches. */
  let templateDepth = 0

  return rewriter.on('*', {
    element(element) {
      const tag = element.tagName.toLowerCase()
      if (templateDepth > 0) {
        if (tag === 'template') {
          templateDepth += 1
          element.onEndTag(() => {
            templateDepth -= 1
          })
        }
        return
      }
      const end = visit(element, count)
      count += 1
      if (!element.canHaveContent || element.selfClosing) return
      const isTemplate = tag === 'template'
      if (isTemplate) templateDepth += 1
      element.onEndTag(() => {
        if (isTemplate) templateDepth -= 1
        end?.()
      })
    },
  })
}

/** Whether an element's content is raw text rather than parsed markup. */
export function isRawText(tag: string): boolean {
  return RAW_TEXT.has(tag)
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

  countElements(new HTMLRewriter(), (element, index) => {
    const tag = element.tagName.toLowerCase()
    /* A tag boundary separates words the way a rendered block would. */
    appendText(' ')
    elements.push({
      tag,
      classes: (element.getAttribute('class') ?? '')
        .split(/\s+/)
        .filter(Boolean),
      text: '',
    })
    if (!element.canHaveContent || element.selfClosing) return undefined
    const isRaw = isRawText(tag)
    open.push(index)
    if (isRaw) rawDepth += 1
    return () => {
      const at = open.lastIndexOf(index)
      if (at !== -1) open.splice(at, 1)
      if (isRaw) rawDepth -= 1
      appendText(' ')
    }
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
