const RAW_FRONTMATTER = /^---\n([\s\S]*?)\n---/
const THEMES_BLOCK = /^themes:[ \t]*\n((?:[ \t]+-[^\n]*\n?|[ \t]*\n)+)/m
const LIST_ITEM = /^[ \t]*-[ \t]+(.*?)[ \t]*$/
const DECLARATION = /^\s*(--[A-Za-z0-9_-]+)\s*:/

/**
 * One custom property declaration and the preludes enclosing it, outermost
 * first. Each level holds the alternatives of its selector list, normalized so
 * a record and a stylesheet compare equal.
 */
export interface ScannedDeclaration {
  readonly property: string
  readonly chain: readonly (readonly string[])[]
}

/**
 * Reads the `themes:` list off the raw frontmatter block, for the reason
 * `readReviewed` in `@/records/stale-canonical` gives. Each entry is the
 * stylesheet prelude that opens the theme, such as `:root` or
 * `@media (prefers-color-scheme: dark)`. A record declaring none reads as an
 * empty list.
 */
export function readThemes(source: string): string[] {
  const block = RAW_FRONTMATTER.exec(source.replaceAll('\r\n', '\n'))?.[1]
  const list = block ? THEMES_BLOCK.exec(`${block}\n`)?.[1] : undefined
  if (list === undefined) return []

  return list
    .split('\n')
    .map((line) => LIST_ITEM.exec(line)?.[1])
    .filter((item): item is string => item !== undefined && item !== '')
    .map((item) => item.replace(/^(['"])(.*)\1$/, '$2').trim())
}

/**
 * Collapses the differences a hand-written prelude carries: runs of
 * whitespace, the quote style around an attribute value, and spacing inside
 * an at-rule condition.
 */
export function normalizePrelude(prelude: string): string {
  const flat = prelude.replace(/\s+/g, ' ').trim()
  if (flat.startsWith('@')) return flat.replace(/\s*:\s*/g, ': ')
  return flat
    .replace(
      /\[\s*([^\]=\s]+)\s*=\s*["']?([^"'\]]*?)["']?\s*\]/g,
      (_, name: string, value: string) => `[${name}=${value}]`,
    )
    .replace(/\s*([>+~])\s*/g, ' $1 ')
    .replace(/\s+/g, ' ')
}

/** Splits a selector list at its top-level commas, and leaves an at-rule whole. */
function members(prelude: string): string[] {
  if (prelude.trimStart().startsWith('@')) return [normalizePrelude(prelude)]

  const out: string[] = []
  let depth = 0
  let start = 0
  for (let index = 0; index < prelude.length; index += 1) {
    const char = prelude[index]
    if (char === '(' || char === '[') depth += 1
    else if (char === ')' || char === ']') depth -= 1
    else if (char === ',' && depth === 0) {
      out.push(prelude.slice(start, index))
      start = index + 1
    }
  }
  out.push(prelude.slice(start))
  return out.map(normalizePrelude).filter((member) => member !== '')
}

/**
 * Walks a stylesheet and returns every custom property declaration with the
 * block chain around it.
 */
export function scanDeclarations(css: string): ScannedDeclaration[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const found: ScannedDeclaration[] = []
  const stack: (readonly string[])[] = []
  let buffer = ''

  const flush = (): void => {
    const property = DECLARATION.exec(buffer)?.[1]
    if (property !== undefined) found.push({ property, chain: [...stack] })
    buffer = ''
  }

  for (const char of source) {
    if (char === '{') {
      stack.push(members(buffer))
      buffer = ''
    } else if (char === '}') {
      flush()
      stack.pop()
    } else if (char === ';') {
      flush()
    } else {
      buffer += char
    }
  }
  flush()

  return found
}

export interface ThemeResult {
  readonly selector: string
  /** False when no block in the stylesheet opens this theme. */
  readonly matched: boolean
  /** Properties the record names that the theme's blocks do not declare. */
  readonly missing: readonly string[]
}

/**
 * Checks each declared theme for the properties given. A declaration counts
 * for the outermost enclosing prelude that is a declared theme, so a `:root`
 * inside a declared media query belongs to the query and never to the light
 * `:root` as well, and `:root` never matches `:root[data-theme='dark']` by
 * containment.
 */
export function checkThemes(
  themes: readonly string[],
  declarations: readonly ScannedDeclaration[],
  properties: readonly string[],
): ThemeResult[] {
  const declared = new Set(themes.map(normalizePrelude))
  const owned = new Map<string, Set<string>>()

  for (const { property, chain } of declarations) {
    const owner = chain.flat().find((prelude) => declared.has(prelude))
    if (owner === undefined) continue
    const set = owned.get(owner) ?? new Set<string>()
    set.add(property)
    owned.set(owner, set)
  }

  return themes.map((selector) => {
    const theme = owned.get(normalizePrelude(selector))
    return {
      selector,
      matched: theme !== undefined,
      missing:
        theme === undefined
          ? []
          : properties.filter((property) => !theme.has(property)),
    }
  })
}
