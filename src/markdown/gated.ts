import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'

/** Where a target keeps the prefixes its density findings gate under. */
export const GATED_CONFIG_REL = join('canon', 'config', 'markdown.toml')

/**
 * An absent file is today's target default and gates nothing. A malformed one
 * refuses rather than reading as empty, since an empty list would silently
 * drop every gate a project had turned on.
 */
export type GatedConfig =
  | { readonly kind: 'absent' }
  | { readonly kind: 'listed'; readonly prefixes: readonly string[] }
  | { readonly kind: 'malformed'; readonly message: string }

export function readGatedConfig(root: string): GatedConfig {
  const path = join(root, GATED_CONFIG_REL)
  if (!existsSync(path)) return { kind: 'absent' }

  let parsed: Record<string, unknown>
  try {
    parsed = Bun.TOML.parse(readFileSync(path, 'utf8')) as Record<
      string,
      unknown
    >
  } catch (error) {
    return {
      kind: 'malformed',
      message: `${GATED_CONFIG_REL} is not valid TOML: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  const table = parsed.markdown
  if (table === undefined) return { kind: 'listed', prefixes: [] }
  if (typeof table !== 'object' || table === null || Array.isArray(table)) {
    return {
      kind: 'malformed',
      message: `${GATED_CONFIG_REL}: [markdown] is not a table`,
    }
  }

  const gated = (table as Record<string, unknown>).gated
  if (gated === undefined) return { kind: 'listed', prefixes: [] }
  if (
    !Array.isArray(gated) ||
    !gated.every((each): each is string => typeof each === 'string')
  ) {
    return {
      kind: 'malformed',
      message: `${GATED_CONFIG_REL}: markdown.gated is not a list of strings`,
    }
  }

  return { kind: 'listed', prefixes: gated }
}

/**
 * Whether `prefix` can be listed. A folder ends in a slash, since a bare
 * `docs` would also gate `docs-old/`. A path without one has to name an
 * existing file, which is how a requirement gates by its own path.
 */
export function prefixShapeError(
  root: string,
  prefix: string,
): string | undefined {
  if (prefix === '' || prefix.startsWith('/') || prefix.includes('..')) {
    return `${prefix || '(empty)'} is not a repository-relative path`
  }
  if (prefix.endsWith('/')) return undefined
  if (
    existsSync(join(root, prefix)) &&
    !statSync(join(root, prefix)).isDirectory()
  )
    return undefined
  return `${prefix} names no file. End a folder prefix with a slash.`
}

/**
 * Appends `prefix` to the target's list, creating the file when absent. A
 * prefix already listed writes nothing. Preserves an existing file's mode.
 */
export function appendGatedPrefix(
  root: string,
  current: readonly string[],
  prefix: string,
): 'appended' | 'present' {
  if (current.includes(prefix)) return 'present'

  const path = join(root, GATED_CONFIG_REL)
  const mode = existsSync(path) ? statSync(path).mode : undefined
  const lines = [...current, prefix].map((each) => `  ${JSON.stringify(each)},`)

  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `[markdown]\ngated = [\n${lines.join('\n')}\n]\n`)
  if (mode !== undefined) chmodSync(path, mode)

  return 'appended'
}
