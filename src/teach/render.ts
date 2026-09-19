import { Heading } from '@/teach/components/heading'
import { List } from '@/teach/components/list'
import { Paragraph } from '@/teach/components/paragraph'
import { render } from '@/teach/html/jsx-runtime'
import type { TeachRefused } from '@/teach/workspace'

export type LessonBlock =
  | { readonly type: 'heading'; readonly level: 1 | 2; readonly text: string }
  | {
      readonly type: 'paragraph'
      readonly text: string
      readonly lede?: boolean
    }
  | {
      readonly type: 'list'
      readonly items: readonly string[]
      readonly ordered?: boolean
    }
  | { readonly type: 'raw'; readonly html: string }

export interface RenderRendered {
  readonly ok: true
  readonly html: string
}

export type RenderOutcome = RenderRendered | TeachRefused

const BLOCK_TYPES = ['heading', 'paragraph', 'list', 'raw'] as const

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

function renderBlock(
  block: unknown,
  index: number,
): { readonly html: string } | TeachRefused {
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
      return {
        html: render(Paragraph({ lede: fields.lede, children: fields.text })),
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
 */
export function renderLessonBody(blocks: readonly unknown[]): RenderOutcome {
  const rendered: string[] = []

  for (const [index, block] of blocks.entries()) {
    const result = renderBlock(block, index)
    if ('ok' in result) return result
    rendered.push(result.html)
  }

  return { ok: true, html: rendered.join('\n') }
}
