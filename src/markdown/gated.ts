import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { listRepositoryFiles } from '@/git/files'
import type { DensityKind } from '@/markdown/density'
import { referenceShapeGates } from '@/markdown/gate'
import {
  type ReferenceShapeKind,
  referenceShapeFindings,
} from '@/markdown/reference-shape'
import { bodyLines } from '@/markdown/scan'
import {
  densityGates,
  GATED_PATHS,
  GATED_SCOPE_ROOTS,
  scopedDensityFindings,
} from '@/markdown/scope'
import { isOwnCheckout } from '@/roots/project'

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
  // A listed prefix is a `startsWith` match against repository paths, so either
  // shape below matches no file and would gate nothing while reading as clean.
  if (prefix.includes('//')) {
    return `${prefix} carries a doubled slash, so it matches no file`
  }
  const path = join(root, prefix.replace(/\/$/, ''))
  const isFile = existsSync(path) && !statSync(path).isDirectory()
  if (prefix.endsWith('/')) {
    return isFile
      ? `${prefix} names a file, so drop the trailing slash`
      : undefined
  }
  if (isFile) return undefined
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
  writeGatedList(root, [...current, prefix])
  return 'appended'
}

/** Written by hand rather than serialized, so the list keeps its one-entry-per-line form. */
function writeGatedList(root: string, prefixes: readonly string[]): void {
  const path = join(root, GATED_CONFIG_REL)
  const mode = existsSync(path) ? statSync(path).mode : undefined
  const lines = prefixes.map((each) => `  ${JSON.stringify(each)},`)

  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `[markdown]\ngated = [\n${lines.join('\n')}\n]\n`)
  if (mode !== undefined) chmodSync(path, mode)
}

/** The prefixes a root gates under, and whether a bullet run gates unlisted. */
export interface GatedList {
  readonly prefixes: readonly string[]
  readonly alwaysGated: boolean
}

export type GatedResolution =
  | {
      readonly kind: 'resolved'
      readonly source: 'canon' | 'config' | 'absent'
      readonly list: GatedList
    }
  | { readonly kind: 'malformed'; readonly message: string }

/**
 * The list a root gates under: `GATED_PATHS` in canon's own checkout, which
 * tracks its rewrite progress, and the target's config everywhere else.
 */
export function resolveGatedList(
  root: string,
  own: boolean = isOwnCheckout(root),
): GatedResolution {
  if (own) {
    return {
      kind: 'resolved',
      source: 'canon',
      list: { prefixes: GATED_PATHS, alwaysGated: true },
    }
  }

  const config = readGatedConfig(root)
  if (config.kind === 'malformed') return config
  return {
    kind: 'resolved',
    source: config.kind === 'absent' ? 'absent' : 'config',
    list: {
      prefixes: config.kind === 'listed' ? config.prefixes : [],
      alwaysGated: false,
    },
  }
}

export interface BlockingFinding {
  readonly path: string
  readonly kind: DensityKind | ReferenceShapeKind
  readonly line: number
}

/**
 * Every density and reference shape finding that would gate once `prefix` is
 * listed, read from the files the audit reads. An absent folder carries none.
 * Undefined when the tree cannot be listed, since an empty answer there would
 * gate a corpus nobody measured.
 */
export async function findingsUnder(
  root: string,
  prefix: string,
): Promise<BlockingFinding[] | undefined> {
  const listed = await listRepositoryFiles(root)
  if (!listed) return undefined

  const under = listed.filter(
    (rel) => rel.endsWith('.md') && rel.startsWith(prefix),
  )
  const found = await Promise.all(
    under.map(async (rel) => {
      const source = await readFile(join(root, rel), 'utf8')
      const density = scopedDensityFindings(rel, bodyLines(source)).filter(
        (finding) => densityGates(rel, finding.kind, [prefix], false),
      )
      const shape = referenceShapeGates(rel, [prefix])
        ? referenceShapeFindings(source)
        : []
      return [...density, ...shape].map((finding) => ({
        path: rel,
        kind: finding.kind,
        line: finding.line,
      }))
    }),
  )

  return found.flat()
}

export type ScopeRootsResult =
  | { readonly kind: 'exists' }
  | { readonly kind: 'unavailable' }
  | {
      readonly kind: 'gated'
      readonly gated: readonly string[]
      readonly left: readonly { prefix: string; findings: number }[]
    }

/**
 * Gates each of `GATED_SCOPE_ROOTS` that carries no finding, for a new
 * project. A root with one is left out and named, since gating it would fail
 * the first push on prose a scaffolder wrote. An existing config is a list
 * someone chose, so it is never touched.
 */
export async function gateScopeRoots(root: string): Promise<ScopeRootsResult> {
  if (existsSync(join(root, GATED_CONFIG_REL))) return { kind: 'exists' }

  const gated: string[] = []
  const left: { prefix: string; findings: number }[] = []

  for (const prefix of GATED_SCOPE_ROOTS) {
    const findings = await findingsUnder(root, prefix)
    if (!findings) return { kind: 'unavailable' }
    if (findings.length === 0) gated.push(prefix)
    else left.push({ prefix, findings: findings.length })
  }

  writeGatedList(root, gated)
  return { kind: 'gated', gated, left }
}
