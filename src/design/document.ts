import type {
  BorderToken,
  ColorToken,
  DesignTokens,
  SpaceToken,
  TypeToken,
} from '@/design/tokens'
import { TOKENS } from '@/design/tokens'

/**
 * Renders `canon/DESIGN.md` from the token source.
 *
 * The document is the view and `@/design/tokens` is the fact, which is the one
 * thing that changed when this record stopped being a transcript of two other
 * surfaces. A reader opening the document reads what the surfaces render,
 * because both come from the same module.
 *
 * Tables are emitted the way Prettier serializes them, padded to the widest
 * cell in each column, so the formatting stage and this writer agree and the
 * file has one shape rather than two writers fighting over it.
 */

/** The tag a cell carries when no rendering surface exercises its value yet. */
const VERIFY = ' ? verify'

const MIN_COLUMN = 3

export function formatTable(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const widths = headers.map((header, column) =>
    Math.max(
      MIN_COLUMN,
      header.length,
      ...rows.map((row) => (row[column] ?? '').length),
    ),
  )

  const line = (cells: readonly string[]): string =>
    `| ${cells.map((cell, column) => cell.padEnd(widths[column])).join(' | ')} |`

  return [
    line(headers),
    `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`,
    ...rows.map(line),
  ].join('\n')
}

function tag(value: string, tagged: boolean | undefined): string {
  return tagged === true ? `${value}${VERIFY}` : value
}

function colorRows(tokens: readonly ColorToken[]): string[][] {
  return tokens.map((token) => [
    token.role,
    token.intent,
    tag(token.value, token.verify),
  ])
}

function typeRows(tokens: readonly TypeToken[]): string[][] {
  return tokens.map((token) => {
    const tagged = new Set(token.verify ?? [])
    return [
      token.role,
      tag(token.family, tagged.has('family')),
      tag(token.weight, tagged.has('weight')),
      tag(token.size, tagged.has('size')),
      tag(token.lineHeight, tagged.has('lineHeight')),
    ]
  })
}

function spaceRows(tokens: readonly SpaceToken[]): string[][] {
  return tokens.map((token) => [token.step, token.multiplier, token.value])
}

function borderRows(tokens: readonly BorderToken[]): string[][] {
  return tokens.map((token) => {
    const tagged = new Set(token.verify ?? [])
    return [
      token.role,
      tag(token.radius, tagged.has('radius')),
      tag(token.width, tagged.has('width')),
      token.when,
    ]
  })
}

function section(heading: string, ...blocks: string[]): string {
  return [`## ${heading}`, ...blocks.filter((block) => block !== '')].join(
    '\n\n',
  )
}

export function renderDesignDocument(tokens: DesignTokens = TOKENS): string {
  const body = [
    '# Design',
    '',
    'Authoring guidance: `standards/design.md`.',
    '',
    tokens.preamble,
    '',
    section('Personality', tokens.personality),
    '',
    section(
      'Color',
      tokens.colorNote,
      formatTable(['Role', 'Intent', 'Value'], colorRows(tokens.color)),
    ),
    '',
    section(
      'Typography',
      tokens.typographyNote,
      formatTable(
        ['Role', 'Family', 'Weight', 'Size', 'Line height'],
        typeRows(tokens.typography),
      ),
    ),
    '',
    section(
      'Spacing',
      tokens.spacingNote,
      formatTable(['Step', 'Multiplier', 'Value'], spaceRows(tokens.spacing)),
    ),
    '',
    section(
      'Borders',
      tokens.bordersNote,
      formatTable(
        ['Role', 'Radius', 'Width', 'When used'],
        borderRows(tokens.borders),
      ),
    ),
    '',
    section('Motion', tokens.motion),
    '',
    section('Iconography', tokens.iconography),
  ]

  return `${body.join('\n')}\n`
}
