import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DESIGN_INSTALL_DIR, DESIGN_PROJECT_SUBDIR } from '@/design/adapter'
import { buildDesignCss } from '@/design/css'
import { isOwnCheckout } from '@/project-root'

/**
 * The stylesheet injected into every frame, so a frame drawn with
 * `var(--color-*)` shows the project's own values. Parsing a `DESIGN.md` into
 * custom properties is left out, since no such mapping exists, and a frame can
 * always link a stylesheet of its own.
 */
export type FrameTokens =
  | { readonly source: 'toolkit'; readonly css: string }
  | {
      readonly source: 'installed'
      readonly css: string
      /** Relative to the root, in the order the stylesheet concatenates them. */
      readonly files: readonly string[]
    }
  | { readonly source: 'none'; readonly css: ''; readonly notice: string }

export interface TokenOptions {
  /** Overrides the checkout test, which reads this package's own name. */
  readonly isOwnCheckout?: boolean
}

const BASE_FILE = 'base.css'

const NONE_NOTICE = `No token stylesheet, so frames render unstyled. Run canon design install to add ${join(DESIGN_INSTALL_DIR, BASE_FILE)}, put overrides under ${join(DESIGN_INSTALL_DIR, DESIGN_PROJECT_SUBDIR)}/, or link a stylesheet from the frame.`

export type TokenKind =
  | 'color'
  | 'spacing'
  | 'radius'
  | 'font-family'
  | 'font-size'
  | 'other'

export interface Token {
  readonly name: string
  readonly value: string
  /** The literal a `var()` value ends at, where the sheet defines it. */
  readonly resolved?: string
}

export interface TokenGroup {
  readonly kind: TokenKind
  readonly tokens: readonly Token[]
}

const KIND_ORDER: readonly TokenKind[] = [
  'color',
  'spacing',
  'radius',
  'font-family',
  'font-size',
  'other',
]

/** By the naming the toolkit's module and most token sheets share. */
function kindOf(name: string): TokenKind {
  if (name.startsWith('--color-')) return 'color'
  if (/^--(space|spacing)-/.test(name)) return 'spacing'
  if (name.startsWith('--radius-')) return 'radius'
  if (/-family$|^--font-family-/.test(name)) return 'font-family'
  if (/-size$|^--font-size-|^--text-/.test(name)) return 'font-size'
  return 'other'
}

const DECLARATION = /(--[A-Za-z0-9_-]+)\s*:\s*([^;}]*)/g

const REFERENCE = /^var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,[^)]*)?\)$/

/**
 * The custom properties a token sheet defines, grouped by kind. A property
 * defined twice keeps its first value, which is the dark theme's in this
 * toolkit's module and the base's in an installed sheet. Empty groups drop.
 */
export function tokenGroups(css: string): TokenGroup[] {
  const values = new Map<string, string>()
  for (const [, name, value] of css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .matchAll(DECLARATION)) {
    if (name && value !== undefined && !values.has(name)) {
      values.set(name, value.trim())
    }
  }

  const resolve = (value: string, seen: Set<string>): string | undefined => {
    const reference = value.match(REFERENCE)?.[1]
    if (!reference) return value
    const next = values.get(reference)
    if (next === undefined || seen.has(reference)) return undefined
    return resolve(next, new Set([...seen, reference]))
  }

  const grouped = new Map<TokenKind, Token[]>()
  for (const [name, value] of values) {
    const resolved = REFERENCE.test(value)
      ? resolve(value, new Set([name]))
      : undefined
    const token =
      resolved === undefined ? { name, value } : { name, value, resolved }
    const kind = kindOf(name)
    grouped.set(kind, [...(grouped.get(kind) ?? []), token])
  }
  return KIND_ORDER.flatMap((kind) => {
    const tokens = grouped.get(kind)
    return tokens ? [{ kind, tokens }] : []
  })
}

/** The installed files in cascade order: the base first, then each override. */
function installedFiles(root: string): string[] {
  const files: string[] = []
  const base = join(DESIGN_INSTALL_DIR, BASE_FILE)
  if (existsSync(join(root, base))) files.push(base)

  const projectDir = join(DESIGN_INSTALL_DIR, DESIGN_PROJECT_SUBDIR)
  if (existsSync(join(root, projectDir))) {
    const overrides = readdirSync(join(root, projectDir))
      .filter((name) => name.endsWith('.css'))
      .sort((a, b) => a.localeCompare(b))
      .map((name) => join(projectDir, name))
    files.push(...overrides)
  }
  return files
}

/**
 * The toolkit's own module where the root is this checkout, else the installed
 * base plus its project overrides, else nothing with a notice naming where
 * tokens would come from.
 */
export function resolveFrameTokens(
  root: string,
  options: TokenOptions = {},
): FrameTokens {
  if (options.isOwnCheckout ?? isOwnCheckout(root)) {
    return { source: 'toolkit', css: buildDesignCss() }
  }

  const files = installedFiles(root)
  if (files.length > 0) {
    const css = files
      .map((file) => `/* ${file} */\n${readFileSync(join(root, file), 'utf8')}`)
      .join('\n')
    return { source: 'installed', css, files }
  }

  return { source: 'none', css: '', notice: NONE_NOTICE }
}
