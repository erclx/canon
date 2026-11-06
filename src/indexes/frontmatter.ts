const FRONTMATTER = /^---\n([\s\S]*?)\n---/

export interface Frontmatter {
  readonly raw: string
  readonly fields: Readonly<Record<string, unknown>>
}

/**
 * Splits a leading `---` block off a markdown source.
 *
 * `raw` keeps the delimiters so an index can be rewritten with its own
 * frontmatter untouched, including comments and key order that a parse and
 * re-emit would lose.
 *
 * A block that will not parse reads as absent rather than throwing, so one
 * malformed file reports through the path a caller already takes for a
 * missing block instead of ending the caller's whole run.
 */
export function parseFrontmatter(source: string): Frontmatter | undefined {
  const reading = readFrontmatterSource(source)
  return reading.kind === 'parsed' ? reading.frontmatter : undefined
}

export type FrontmatterReading =
  | { readonly kind: 'absent' }
  | { readonly kind: 'invalid'; readonly message: string }
  | { readonly kind: 'parsed'; readonly frontmatter: Frontmatter }

/**
 * Tells a source with no block from one whose block failed to parse, which
 * `parseFrontmatter` folds into one undefined. A block that parses to a list
 * or a scalar reads as invalid, since no field can be read off it.
 */
export function readFrontmatterSource(source: string): FrontmatterReading {
  const match = source.match(FRONTMATTER)
  if (!match) return { kind: 'absent' }

  let parsed: unknown
  try {
    parsed = Bun.YAML.parse(match[1])
  } catch (error) {
    return {
      kind: 'invalid',
      message: error instanceof Error ? error.message : String(error),
    }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { kind: 'invalid', message: 'frontmatter is not a mapping' }
  }

  return {
    kind: 'parsed',
    frontmatter: {
      raw: match[0],
      fields: parsed as Record<string, unknown>,
    },
  }
}

export function readField(
  frontmatter: Frontmatter | undefined,
  key: string,
): string | undefined {
  const value = frontmatter?.fields[key]
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return undefined
}

export async function readFrontmatter(
  path: string,
): Promise<Frontmatter | undefined> {
  return parseFrontmatter(await Bun.file(path).text())
}
