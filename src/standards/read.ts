import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { stripFrontmatter } from '@/markdown/frontmatter'
import { PROJECT_ROOT } from '@/project-root'

export const INDEX_FILE = 'index.md'

/** The folder a repository authors standards in, toolkit or project alike. */
export function standardsSourceDir(root: string): string {
  return join(root, 'standards')
}

/**
 * Spells the package root in a report where every other root spells a
 * project-relative path. The `source` field promises a path inside the project
 * and a package copy is the one source that promise cannot cover, so the
 * spelling has to be one nothing will join to a project root.
 */
const PACKAGE_LABEL = '<canon>'

export interface StandardRoot {
  /** Absolute directory to search. */
  readonly dir: string
  /** How a report spells a copy found under this root. */
  readonly label: string
}

export interface ResolvedStandard {
  readonly path: string
  /** The label of the root that won, joined to the filename. */
  readonly source: string
}

/**
 * The roots a standard resolves against. No toolkit standard installs into a
 * project any more, so `.claude/standards/` is gone from the list, no repository
 * generates one, and a target
 * carries neither entry below: the package corpus is the only root that
 * answers there, which is what leaves no precedence to reason about.
 *
 * The authoring root stays ahead of the package corpus for the repository that
 * writes standards, where an edit in progress has to win over the copy
 * `package.json` shipped. A project that authors standards of its own is the
 * same case under the same folder.
 */
export function standardRoots(root: string): StandardRoot[] {
  return [
    { dir: standardsSourceDir(root), label: 'standards' },
    {
      dir: standardsSourceDir(PROJECT_ROOT),
      label: join(PACKAGE_LABEL, 'standards'),
    },
  ]
}

function filename(name: string): string {
  return name.endsWith('.md') ? name : `${name}.md`
}

/** Resolves a standard by name, with or without the extension. */
export function resolveStandard(
  root: string,
  name: string,
): ResolvedStandard | undefined {
  const file = filename(name)

  for (const { dir, label } of standardRoots(root)) {
    const path = join(dir, file)
    if (existsSync(path)) return { path, source: join(label, file) }
  }

  return undefined
}

/**
 * Names every standard a resolve could reach, deduplicated across the roots and
 * sorted. Shown when a name misses, so it doubles as the answer to what the
 * caller should have typed.
 */
export function listStandards(root: string): string[] {
  const names = new Set<string>()

  for (const { dir } of standardRoots(root)) {
    if (!existsSync(dir)) continue

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile()) continue
      if (!entry.name.endsWith('.md')) continue
      if (entry.name === INDEX_FILE) continue

      names.add(basename(entry.name, '.md'))
    }
  }

  return [...names].sort()
}

/**
 * Pairs each listed name with the copy a resolve would read, so a catalog shows
 * what `canon standards <name>` prints rather than every file a root holds.
 */
export function resolveAllStandards(
  root: string,
): Array<ResolvedStandard & { readonly name: string }> {
  return listStandards(root).flatMap((name) => {
    const resolved = resolveStandard(root, name)
    return resolved ? [{ name, ...resolved }] : []
  })
}

export function readStandard(standard: ResolvedStandard): string {
  return stripFrontmatter(readFileSync(standard.path, 'utf8'))
}
