import { existsSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'

/**
 * What belongs to the deck rather than to one slide, read from `deck.json`
 * beside the slides. A slide overrides a band through attributes on its own
 * `<body>`, which `walk.ts` reads.
 */

export const DECK_FILE = 'deck.json'

export const BAND_SLOTS = ['left', 'center', 'right'] as const
export type BandSlot = (typeof BAND_SLOTS)[number]

export interface Band {
  readonly show: boolean
  readonly left?: string
  readonly center?: string
  readonly right?: string
}

export interface DeckConfig {
  readonly title: string
  readonly header: Band
  readonly footer: Band
  /** Drawn at the right of the footer, so they show only where it does. */
  readonly slideNumbers: boolean
  /** Absolute, resolved against the deck folder. */
  readonly mark?: string
}

export type DeckRead =
  | { readonly status: 'read'; readonly deck: DeckConfig }
  | {
      readonly status: 'refused'
      readonly field: string
      readonly message: string
    }

const DECK_FIELDS = new Set([
  'title',
  'header',
  'footer',
  'slideNumbers',
  'mark',
])
const BAND_FIELDS = new Set<string>(['show', ...BAND_SLOTS])

class FieldError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message)
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function rejectUnknown(
  record: Record<string, unknown>,
  known: ReadonlySet<string>,
  prefix: string,
): void {
  const unknown = Object.keys(record).find((key) => !known.has(key))
  if (unknown !== undefined) {
    throw new FieldError(
      `${prefix}${unknown}`,
      `unknown field ${prefix}${unknown}`,
    )
  }
}

function stringField(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') {
    throw new FieldError(field, `${field} must be a string`)
  }
  return value
}

function booleanField(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') {
    throw new FieldError(field, `${field} must be true or false`)
  }
  return value
}

/**
 * A declared band merges over its default, so `{ "center": "x" }` keeps the
 * footer's title on the left. Declaring any text turns a band on unless it
 * also says `show: false`.
 */
function band(value: unknown, field: string, fallback: Band): Band {
  if (value === undefined) return fallback
  if (!isRecord(value)) {
    throw new FieldError(field, `${field} must be an object`)
  }
  rejectUnknown(value, BAND_FIELDS, `${field}.`)
  const slots: { -readonly [slot in BandSlot]?: string } = {}
  for (const slot of BAND_SLOTS) {
    const text = stringField(value[slot], `${field}.${slot}`)
    if (text !== undefined) slots[slot] = text
  }
  const show =
    booleanField(value.show, `${field}.show`) ??
    (Object.keys(slots).length > 0 || fallback.show)
  return { ...fallback, ...slots, show }
}

function parse(raw: unknown, folder: string): DeckConfig {
  if (!isRecord(raw)) {
    throw new FieldError(DECK_FILE, `${DECK_FILE} must hold an object`)
  }
  rejectUnknown(raw, DECK_FIELDS, '')
  const title = stringField(raw.title, 'title') ?? basename(folder)
  const header = band(raw.header, 'header', { show: false })
  const footer = band(raw.footer, 'footer', { show: true, left: title })
  const slideNumbers = booleanField(raw.slideNumbers, 'slideNumbers') ?? true
  if (slideNumbers && footer.right !== undefined) {
    throw new FieldError(
      'footer.right',
      'footer.right is where slide numbers sit. Set slideNumbers to false to use it',
    )
  }
  const markPath = stringField(raw.mark, 'mark')
  let mark: string | undefined
  if (markPath !== undefined) {
    mark = join(folder, markPath)
    if (!existsSync(mark) || !statSync(mark).isFile()) {
      throw new FieldError('mark', `mark ${mark} does not exist`)
    }
  }
  return { title, header, footer, slideNumbers, mark }
}

export function readDeck(folder: string): DeckRead {
  const path = join(folder, DECK_FILE)
  let raw: unknown = {}
  if (existsSync(path)) {
    try {
      raw = JSON.parse(readFileSync(path, 'utf8'))
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      return {
        status: 'refused',
        field: DECK_FILE,
        message: `${path}: not valid JSON (${reason})`,
      }
    }
  }
  try {
    return { status: 'read', deck: parse(raw, folder) }
  } catch (error) {
    if (!(error instanceof FieldError)) throw error
    return {
      status: 'refused',
      field: error.field,
      message: `${path}: ${error.message}`,
    }
  }
}
