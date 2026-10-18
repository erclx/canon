import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { AuditedFolder } from '@/context/folders'

/** Where a project declares the code roots its context entries must cover. */
export const CONTEXT_CONFIG_REL = join('canon', 'config', 'context.toml')

/** The root assumed when a project declares none and carries the folder. */
export const DEFAULT_ROOT = 'src'

/**
 * The roots a project asked the coverage check to measure.
 *
 * `none` says the project carries no declaration and no `src/`, which reports
 * and never gates so a seed tree audited at its own root keeps passing.
 * `opted-out` is an explicit `roots = []`. `invalid` is a declaration that
 * exists and cannot be used, which gates rather than falling back to `src`,
 * since a project that wrote one meant it.
 */
export type RootDeclaration =
  | { readonly kind: 'roots'; readonly patterns: readonly string[] }
  | { readonly kind: 'opted-out' }
  | { readonly kind: 'none' }
  | { readonly kind: 'invalid'; readonly reason: string }

export interface DoubleClaim {
  readonly folder: string
  readonly rels: readonly string[]
}

export interface CoverageFinding {
  /** Folders under a declared root that no entry's Layout names. */
  readonly unnamed: readonly string[]
  /** Folders taking a Layout H3 in more than one entry. */
  readonly doubled: readonly DoubleClaim[]
  /** Declared roots or globs that matched no folder on disk. */
  readonly missingRoots: readonly string[]
}

export type CoverageReport =
  | {
      readonly kind: 'measured'
      readonly roots: readonly string[]
      readonly findings: CoverageFinding
    }
  | { readonly kind: 'opted-out' }
  | { readonly kind: 'no-root' }
  | { readonly kind: 'invalid'; readonly reason: string }

/** Reads the declaration, falling back to `src` when that folder exists. */
export function readRoots(root: string): RootDeclaration {
  const path = join(root, CONTEXT_CONFIG_REL)

  if (existsSync(path)) {
    let parsed: Record<string, unknown>
    try {
      parsed = Bun.TOML.parse(readFileSync(path, 'utf8')) as Record<
        string,
        unknown
      >
    } catch {
      return {
        kind: 'invalid',
        reason: `${CONTEXT_CONFIG_REL} is not valid TOML`,
      }
    }

    const declared = parsed.roots
    if (
      !Array.isArray(declared) ||
      !declared.every((entry) => typeof entry === 'string' && entry !== '')
    ) {
      return {
        kind: 'invalid',
        reason: `${CONTEXT_CONFIG_REL} needs roots as a list of folder or glob strings`,
      }
    }

    return declared.length === 0
      ? { kind: 'opted-out' }
      : { kind: 'roots', patterns: declared as string[] }
  }

  return isDirectory(join(root, DEFAULT_ROOT))
    ? { kind: 'roots', patterns: [DEFAULT_ROOT] }
    : { kind: 'none' }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/** Expands each pattern to the folders it matches, relative to `root`. */
function expandRoots(root: string, patterns: readonly string[]) {
  const roots: string[] = []
  const missing: string[] = []

  for (const pattern of patterns) {
    const matched = [
      ...new Bun.Glob(pattern).scanSync({ cwd: root, onlyFiles: false }),
    ]
      .map((path) => path.replace(/\/$/, ''))
      .filter((path) => isDirectory(join(root, path)))
      .sort()

    if (matched.length === 0) missing.push(pattern)
    roots.push(...matched)
  }

  return { roots: [...new Set(roots)], missing }
}

/** Lists folders directly under a root, skipping hidden ones and `node_modules`. */
function listFolders(root: string, rel: string): string[] {
  return readdirSync(join(root, rel), { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        entry.name !== 'node_modules',
    )
    .map((entry) => `${rel}/${entry.name}`)
    .sort()
}

function layoutSection(source: string): string {
  const lines = source.split('\n')
  const start = lines.findIndex((line) => /^##\s+Layout\s*$/.test(line))
  if (start === -1) return ''

  const end = lines.findIndex(
    (line, index) => index > start && /^##\s/.test(line),
  )
  return lines.slice(start + 1, end === -1 ? undefined : end).join('\n')
}

function backtickedPaths(text: string): string[] {
  return [...text.matchAll(/`([^`\s]+)`/g)].map((match) =>
    match[1].replace(/\/$/, ''),
  )
}

/**
 * Measures the folders under the declared roots against the Layout sections.
 *
 * A folder is named when any Layout text cites it in backticks, a bullet
 * included, and claimed when it is an H3 title. Only the H3 counts toward
 * uniqueness, since a bullet legitimately cites another domain's folder and a
 * grep cannot tell a citation from a claim.
 */
export function measureCoverage(
  root: string,
  declaration: RootDeclaration,
  folders: readonly AuditedFolder[],
): CoverageReport {
  if (declaration.kind === 'opted-out') return { kind: 'opted-out' }
  if (declaration.kind === 'none') return { kind: 'no-root' }
  if (declaration.kind === 'invalid') {
    return { kind: 'invalid', reason: declaration.reason }
  }

  const named = new Set<string>()
  const claims = new Map<string, Set<string>>()

  for (const folder of folders) {
    for (const entry of folder.entries) {
      const rel = relative(root, entry)
      const layout = layoutSection(readFileSync(entry, 'utf8'))

      for (const path of backtickedPaths(layout)) named.add(path)

      for (const line of layout.split('\n')) {
        const heading = line.match(/^###\s+`([^`\s]+)`\s*$/)
        if (!heading) continue
        const path = heading[1].replace(/\/$/, '')
        claims.set(path, (claims.get(path) ?? new Set()).add(rel))
      }
    }
  }

  const { roots, missing } = expandRoots(root, declaration.patterns)
  const onDisk = roots.flatMap((rel) => listFolders(root, rel))

  return {
    kind: 'measured',
    roots,
    findings: {
      unnamed: onDisk.filter((path) => !named.has(path)),
      doubled: onDisk
        .filter((path) => (claims.get(path)?.size ?? 0) > 1)
        .map((folder) => ({
          folder,
          rels: [...(claims.get(folder) ?? [])].sort(),
        })),
      missingRoots: missing,
    },
  }
}

/** Whether the report holds a finding that should fail a widened gate. */
export function hasCoverageFindings(report: CoverageReport): boolean {
  if (report.kind === 'invalid') return true
  if (report.kind !== 'measured') return false
  const { unnamed, doubled, missingRoots } = report.findings
  return unnamed.length > 0 || doubled.length > 0 || missingRoots.length > 0
}
