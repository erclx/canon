import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  countElements,
  type ElementAddress,
  isRawText,
  resolveAddress,
  sourceElements,
} from '@/canvas/address'
import {
  type ContentRefusal,
  canvasDir,
  contentHash,
  readPage,
  readSelection,
  TEMP_SUFFIX,
  withFileLock,
  writeSelection,
} from '@/canvas/content'

/**
 * The basic set an operator edits by hand. Each is a CSS property written into
 * the element's inline style, except `text`, which replaces its text.
 */
export const STYLE_PROPERTIES = [
  'color',
  'background-color',
  'font-size',
  'font-weight',
  'font-family',
  'line-height',
  'letter-spacing',
  'text-align',
  'width',
  'height',
  'padding',
  'gap',
  'display',
  'flex-direction',
  'justify-content',
  'align-items',
  'flex-wrap',
  'opacity',
  'border-radius',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
] as const

export type StyleProperty = (typeof STYLE_PROPERTIES)[number]

/**
 * The longhands a shorthand write drops, so a later longhand in the attribute
 * does not keep overriding the value just set. A longhand write leaves its
 * shorthand alone, since the longhand comes later and already wins.
 */
const SHORTHAND_LONGHANDS: Readonly<
  Partial<Record<StyleProperty, readonly string[]>>
> = {
  'border-radius': [
    'border-top-left-radius',
    'border-top-right-radius',
    'border-bottom-right-radius',
    'border-bottom-left-radius',
  ],
  padding: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
}

export type EditProperty = StyleProperty | 'text'

export interface EditChange {
  readonly property: string
  /** Empty drops a style property, and sets an element's text to nothing. */
  readonly value: string
}

export type EditRefusal = ContentRefusal | 'invalid-edit' | 'not-text-only'

export interface EditRefused {
  readonly ok: false
  readonly reason: EditRefusal
  readonly detail: string
}

export type AppliedEdit = { readonly ok: true; readonly html: string }

export type FrameEdit =
  | {
      readonly ok: true
      readonly page: string
      readonly frame: string
      readonly file: string
      /** The file's hash after the edit, which the next edit is made from. */
      readonly hash: string
    }
  | EditRefused

const MAX_VALUE_LENGTH = 200

/** Anything that would end the declaration and start another. */
const DECLARATION_BREAK = /[;{}<>\n\r]/

const BOM = '﻿'

function refuse(reason: EditRefusal, detail: string): EditRefused {
  return { ok: false, reason, detail }
}

function isStyleProperty(property: string): property is StyleProperty {
  return (STYLE_PROPERTIES as readonly string[]).includes(property)
}

export function isEditProperty(property: string): property is EditProperty {
  return property === 'text' || isStyleProperty(property)
}

function checkChange(change: EditChange): EditRefused | undefined {
  if (!isEditProperty(change.property)) {
    return refuse(
      'invalid-edit',
      `${change.property} is not editable here. Edit one of text, ${STYLE_PROPERTIES.join(', ')}`,
    )
  }
  if (change.value.length > MAX_VALUE_LENGTH) {
    return refuse(
      'invalid-edit',
      `the value runs past ${MAX_VALUE_LENGTH} characters`,
    )
  }
  if (change.property !== 'text' && DECLARATION_BREAK.test(change.value)) {
    return refuse(
      'invalid-edit',
      `${change.property} takes one value, with no ; { } < > or line break`,
    )
  }
  return undefined
}

const CHARACTER_REFERENCE = /&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/iy

/**
 * Splits a style attribute at each semicolon outside parentheses and quotes,
 * keeping every segment's own spacing so an untouched one is written back as
 * it was. The rewriter hands the attribute over undecoded and writes a quote
 * back as `&quot;`, so a character reference's own semicolon never splits.
 */
function declarations(style: string): string[] {
  const segments: string[] = []
  let depth = 0
  let quote: string | undefined
  let start = 0
  for (let at = 0; at < style.length; at += 1) {
    const char = style[at]
    CHARACTER_REFERENCE.lastIndex = at
    if (char === '&' && CHARACTER_REFERENCE.test(style)) {
      at = CHARACTER_REFERENCE.lastIndex - 1
    } else if (quote) {
      if (char === quote) quote = undefined
    } else if (char === '"' || char === "'") quote = char
    else if (char === '(') depth += 1
    else if (char === ')') depth = Math.max(0, depth - 1)
    else if (char === ';' && depth === 0) {
      segments.push(style.slice(start, at))
      start = at + 1
    }
  }
  segments.push(style.slice(start))
  return segments
}

function propertyOf(segment: string): string {
  return segment.split(':', 1)[0]?.trim().toLowerCase() ?? ''
}

/**
 * Sets one property in a style attribute, or drops it on an empty value. The
 * first declaration of it is replaced in place and any later one dropped, so
 * nothing further in the attribute overrides the edit. A shorthand also drops
 * its longhands. Undefined means no style is left.
 */
export function setDeclaration(
  style: string,
  property: StyleProperty,
  value: string,
): string | undefined {
  const longhands = SHORTHAND_LONGHANDS[property] ?? []
  const segments = declarations(style).filter(
    (segment) => !longhands.includes(propertyOf(segment)),
  )
  const matches = segments.filter((segment) => propertyOf(segment) === property)
  const declaration = `${property}: ${value.trim()}`

  let next: string[]
  if (value.trim() === '') {
    next = segments.filter((segment) => propertyOf(segment) !== property)
  } else if (matches.length > 0) {
    let isReplaced = false
    next = segments.flatMap((segment) => {
      if (propertyOf(segment) !== property) return [segment]
      if (isReplaced) return []
      isReplaced = true
      const lead = segment.match(/^\s*/)?.[0] ?? ''
      return [`${lead}${declaration}`]
    })
  } else {
    const kept = segments
      .join(';')
      .replace(/^[\s;]+/, '')
      .replace(/[\s;]*$/, '')
    return kept === '' ? declaration : `${kept}; ${declaration}`
  }

  if (next.every((segment) => segment.trim() === '')) return undefined
  return next.join(';').replace(/^[\s;]+/, '')
}

/**
 * Whether the element at an index holds text alone, so replacing its text
 * flattens no nested markup. An element closed only by implication stays open
 * to the end and reads as holding everything after it, which refuses.
 */
function holdsTextAlone(html: string, index: number): boolean {
  let isOpen = false
  let hasChild = false
  countElements(new HTMLRewriter(), (_element, at) => {
    if (isOpen) hasChild = true
    if (at !== index) return undefined
    isOpen = true
    return () => {
      isOpen = false
    }
  }).transform(html)
  return !hasChild
}

/**
 * Applies one change to the element the address names and leaves every other
 * byte of the file as it was. The address is checked against the file first,
 * the same way a pick is.
 */
export function applyEdit(
  source: string,
  address: ElementAddress,
  change: EditChange,
): AppliedEdit | EditRefused {
  const invalid = checkChange(change)
  if (invalid) return invalid

  /* The rewriter drops a leading byte order mark, so it is put back after. */
  const bom = source.startsWith(BOM) ? BOM : ''
  const html = source.slice(bom.length)

  const check = resolveAddress(html, address)
  if (!check.ok) return refuse(check.reason, check.detail)

  const { property, value } = change
  if (property === 'text') {
    if (isRawText(address.tag) || !holdsTextAlone(html, address.index)) {
      return refuse(
        'not-text-only',
        `<${address.tag}> holds other elements or raw content, so its text is not edited as one string`,
      )
    }
  }

  let voidRefused = false
  const rewritten = countElements(new HTMLRewriter(), (element, at) => {
    if (at !== address.index) return undefined
    if (property === 'text') {
      if (!element.canHaveContent || element.selfClosing) {
        voidRefused = true
        return undefined
      }
      element.setInnerContent(value, { html: false })
      return undefined
    }
    if (!isStyleProperty(property)) return undefined
    const style = setDeclaration(
      element.getAttribute('style') ?? '',
      property,
      value,
    )
    if (style === undefined) element.removeAttribute('style')
    else element.setAttribute('style', style)
    return undefined
  }).transform(html)

  if (voidRefused) {
    return refuse('not-text-only', `<${address.tag}> cannot hold text`)
  }
  return { ok: true, html: `${bom}${rewritten}` }
}

/**
 * Edits one element of a frame file under the file's lock. An address carrying
 * a hash the file no longer has is refused rather than applied at an index the
 * change may have shifted. A selection that was fresh before the edit is
 * restamped after it, since the edit moves no element.
 */
export function editFrame(
  root: string,
  page: string,
  frame: string,
  address: ElementAddress,
  change: EditChange,
): FrameEdit {
  const invalid = checkChange(change)
  if (invalid) return invalid

  const onPage = readPage(root, page)
  if (!onPage) return refuse('no-page', `page ${page} does not exist`)
  const found = onPage.frames.find((candidate) => candidate.name === frame)
  if (!found) {
    return refuse('no-frame', `frame ${frame} does not exist on ${page}`)
  }

  const path = join(canvasDir(root), page, found.file)
  return withFileLock(path, (): FrameEdit => {
    const bytes = readFileSync(path)
    if (address.hash !== undefined && address.hash !== contentHash(bytes)) {
      return refuse(
        'stale-address',
        `${page}/${frame} changed after this edit was made, so nothing was written`,
      )
    }
    const before = readSelection(root)
    const isSelectionFresh =
      before?.page === page &&
      before.frame === frame &&
      before.element !== undefined &&
      !before.element.stale

    const applied = applyEdit(bytes.toString('utf8'), address, change)
    if (!applied.ok) return applied

    const temp = `${path}.${process.pid}${TEMP_SUFFIX}`
    writeFileSync(temp, applied.html)
    renameSync(temp, path)

    if (isSelectionFresh && before.element) {
      writeSelection(root, {
        page,
        frame,
        element: {
          index: before.element.index,
          tag: before.element.tag,
          count: sourceElements(applied.html).length,
        },
      })
    }
    return {
      ok: true,
      page,
      frame,
      file: found.file,
      hash: contentHash(applied.html),
    }
  })
}

/**
 * Edits the element at an index of the file as it stands, for a caller that
 * holds no served frame to take an address from. The address it builds
 * carries the hash it read, so a write landing between the read and the lock
 * still refuses.
 */
export function editFrameAtIndex(
  root: string,
  page: string,
  frame: string,
  index: number,
  change: EditChange,
): FrameEdit {
  const onPage = readPage(root, page)
  if (!onPage) return refuse('no-page', `page ${page} does not exist`)
  const found = onPage.frames.find((candidate) => candidate.name === frame)
  if (!found) {
    return refuse('no-frame', `frame ${frame} does not exist on ${page}`)
  }

  const bytes = readFileSync(join(canvasDir(root), page, found.file))
  const elements = sourceElements(bytes.toString('utf8'))
  const element = Number.isInteger(index) ? elements[index] : undefined
  if (!element) {
    return refuse(
      'invalid-address',
      `${page}/${frame} holds elements 0 to ${elements.length - 1}, so ${index} names none`,
    )
  }
  return editFrame(
    root,
    page,
    frame,
    {
      index,
      tag: element.tag,
      count: elements.length,
      hash: contentHash(bytes),
    },
    change,
  )
}
