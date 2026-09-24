import { Heading } from '@/teach/components/heading'
import { List } from '@/teach/components/list'
import { Paragraph } from '@/teach/components/paragraph'
import { type Reference, Refs } from '@/teach/components/refs'
import { render } from '@/teach/html/jsx-runtime'
import type { TeachRefused } from '@/teach/workspace'

export type LessonBlock =
  | { readonly type: 'heading'; readonly level: 1 | 2; readonly text: string }
  | {
      readonly type: 'paragraph'
      readonly text: string
      readonly lede?: boolean
      readonly cites?: readonly number[]
    }
  | {
      readonly type: 'list'
      readonly items: readonly string[]
      readonly ordered?: boolean
    }
  | { readonly type: 'refs'; readonly items: readonly Reference[] }
  | { readonly type: 'raw'; readonly html: string }

export interface RenderRendered {
  readonly ok: true
  readonly html: string
}

export type RenderOutcome = RenderRendered | TeachRefused

const BLOCK_TYPES = ['heading', 'paragraph', 'list', 'refs', 'raw'] as const

const LINK_PROTOCOLS = new Set(['http:', 'https:'])

function isBlockType(value: unknown): value is LessonBlock['type'] {
  return (BLOCK_TYPES as readonly string[]).includes(value as string)
}

function badBlock(index: number, message: string): TeachRefused {
  return {
    ok: false,
    reason: 'bad-input',
    message: `Block ${index}: ${message}`,
    detail: [],
  }
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(isString)
}

function isCiteArray(value: unknown): value is readonly number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((cite) => Number.isInteger(cite) && cite > 0)
  )
}

function isLinkUrl(value: string): boolean {
  if (!URL.canParse(value)) return false
  return LINK_PROTOCOLS.has(new URL(value).protocol)
}

function readReference(item: unknown, position: number): Reference | string {
  if (typeof item !== 'object' || item === null) {
    return `reference ${position} is not an object`
  }
  const { title, url, note } = item as Record<string, unknown>
  if (!isString(title) || title === '') {
    return `reference ${position} needs a non-empty string title`
  }
  if (note !== undefined && !isString(note)) {
    return `reference ${position} note must be a string`
  }
  if (url !== undefined && !(isString(url) && isLinkUrl(url))) {
    return `reference ${position} url must be an http or https URL`
  }
  return { title, url, note }
}

interface RenderedBlock {
  readonly html: string
  readonly cites?: readonly number[]
  readonly referenceCount?: number
}

function renderBlock(
  block: unknown,
  index: number,
): RenderedBlock | TeachRefused {
  if (typeof block !== 'object' || block === null || !('type' in block)) {
    return badBlock(index, 'not an object carrying a type')
  }

  const type = (block as { readonly type: unknown }).type

  if (!isBlockType(type)) {
    return badBlock(index, `unrecognized type ${JSON.stringify(type)}`)
  }

  const fields = block as Record<string, unknown>

  switch (type) {
    case 'heading': {
      if (fields.level !== 1 && fields.level !== 2) {
        return badBlock(index, 'heading needs level 1 or 2')
      }
      if (!isString(fields.text)) {
        return badBlock(index, 'heading needs a string text')
      }
      return {
        html: render(Heading({ level: fields.level, children: fields.text })),
      }
    }
    case 'paragraph': {
      if (!isString(fields.text)) {
        return badBlock(index, 'paragraph needs a string text')
      }
      if (fields.lede !== undefined && typeof fields.lede !== 'boolean') {
        return badBlock(index, 'paragraph lede must be a boolean')
      }
      if (fields.cites !== undefined && !isCiteArray(fields.cites)) {
        return badBlock(
          index,
          'paragraph cites must be a non-empty array of positive integers',
        )
      }
      if (fields.lede === true && fields.cites !== undefined) {
        return badBlock(index, 'a lede paragraph cannot carry cites')
      }
      return {
        html: render(
          Paragraph({
            lede: fields.lede,
            cites: fields.cites,
            children: fields.text,
          }),
        ),
        cites: fields.cites,
      }
    }
    case 'list': {
      if (!isStringArray(fields.items)) {
        return badBlock(index, 'list needs an items array of strings')
      }
      if (fields.ordered !== undefined && typeof fields.ordered !== 'boolean') {
        return badBlock(index, 'list ordered must be a boolean')
      }
      return {
        html: render(List({ ordered: fields.ordered, items: fields.items })),
      }
    }
    case 'refs': {
      if (!Array.isArray(fields.items) || fields.items.length === 0) {
        return badBlock(index, 'refs needs a non-empty items array')
      }
      const items: Reference[] = []
      for (const [position, item] of fields.items.entries()) {
        const reference = readReference(item, position + 1)
        if (isString(reference)) return badBlock(index, reference)
        items.push(reference)
      }
      return {
        html: render(Refs({ items })),
        referenceCount: items.length,
      }
    }
    case 'raw': {
      if (!isString(fields.html)) {
        return badBlock(index, 'raw needs a string html')
      }
      return { html: fields.html }
    }
  }
}

/**
 * Renders a lesson body's structural blocks through the same components
 * `lesson.test.tsx` composes as JSX, so a real lesson and the component test
 * share one rendering mechanism. Every block past the first refusal
 * goes unread, matching how a malformed JSON parse refuses the whole call.
 * Citations resolve across blocks once every block has rendered, so a marker
 * with no reference refuses rather than leaving a dead anchor.
 */
export function renderLessonBody(blocks: readonly unknown[]): RenderOutcome {
  const rendered: RenderedBlock[] = []
  let referenceCount = 0

  for (const [index, block] of blocks.entries()) {
    const result = renderBlock(block, index)
    if ('ok' in result) return result
    if (result.referenceCount !== undefined) {
      if (referenceCount > 0) {
        return badBlock(index, 'a lesson carries one refs block')
      }
      referenceCount = result.referenceCount
    }
    rendered.push(result)
  }

  for (const [index, block] of rendered.entries()) {
    const dangling = block.cites?.find((cite) => cite > referenceCount)
    if (dangling !== undefined) {
      return badBlock(index, `cite ${dangling} resolves to no reference`)
    }
  }

  return { ok: true, html: rendered.map((block) => block.html).join('\n') }
}
