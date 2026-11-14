import { existsSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { INDEX_FILE, listIndexes } from '@/indexes/walk'
import { RECORD_ROOTS } from '@/roots/record'
import { SURFACE_ROOTS } from '@/roots/surface'

/**
 * Folder names under a record root audited by default.
 *
 * A named list rather than a contract read off disk, so a generated tree is
 * never measured against a rule written for per-domain narrative, and
 * `--folder` admits another. It doubles as the citation check's scope, since
 * `citationPattern` spells only these names, so a path into a folder left off
 * goes stale silently.
 */
export const DEFAULT_FOLDERS: readonly string[] = ['context', 'diagrams']

/**
 * The bases every folder in the default list is looked for under.
 *
 * `diagrams` resolves under `RECORD_ROOTS` and `context` under `SURFACE_ROOTS`,
 * so the bases are their union rather than a per-name map, since a wrong root
 * costs one `existsSync`. `.claude` goes last, keeping each list's precedence.
 * A target holding its own root `canon/` folder resolves it as the toolkit's,
 * which costs only a wrong scope line, since the audit only reports.
 */
const CLAUDE_BASES: readonly string[] = [
  ...new Set(
    [...SURFACE_ROOTS, ...RECORD_ROOTS].filter((root) => root !== '.claude'),
  ),
  '.claude',
]

/** The project root, reached only by a name the caller asked for. */
const ROOT_BASE = '.'

export interface AuditedFolder {
  /**
   * The requested folder name this was resolved under, which is what says
   * which standard governs the entries. A nested split folder carries the name
   * of the folder it sits beneath rather than its own, so
   * `canon/context/<domain>` is governed as `context`.
   */
  readonly name: string
  /**
   * The base the name resolved under, which is what says whether the folder is
   * in the citation check's scope.
   */
  readonly base: string
  /** Repo-relative folder path, used verbatim in every report line. */
  readonly rel: string
  readonly indexPath: string
  /** Absolute paths of the folder's own entries, excluding its `index.md`. */
  readonly entries: readonly string[]
  /**
   * Whether this is a sub-area a domain split into rather than the folder
   * named under `.claude/`.
   *
   * The entries of a split folder describe one domain between them, so a rule
   * about what a domain declares is answered by the folder. The entries of the
   * named folder are one domain each, and a rule answered by a sibling there
   * would let one entry stand in for domains it says nothing about.
   */
  readonly nested: boolean
}

/**
 * Names the requested record-root folders that actually exist, which is the
 * citation check's scope, since a pointer into an optional folder is no fault
 * in a project that lacks it.
 *
 * A folder resolved at the project root stays out, since the citation pattern
 * spells the `.claude/` prefix and widening it would match prose that
 * references nothing.
 */
export function presentNames(folders: readonly AuditedFolder[]): string[] {
  return [
    ...new Set(
      folders
        .filter((folder) => CLAUDE_BASES.includes(folder.base))
        .map((folder) => folder.name),
    ),
  ]
}

async function readEntries(dir: string): Promise<string[]> {
  const paths: string[] = []

  for await (const name of new Bun.Glob('*.md').scan({
    cwd: dir,
    onlyFiles: true,
    dot: true,
  })) {
    if (name === INDEX_FILE) continue
    paths.push(resolve(dir, name))
  }

  return paths.sort()
}

export interface FolderResolution {
  /** Every folder that resolved, with the nested splits beneath each. */
  readonly folders: readonly AuditedFolder[]
  /**
   * Requested names that resolved under no base, reported rather than dropped.
   * Which absences are worth saying out loud is the caller's judgment: a
   * default folder a project does not carry is ordinary, and a name passed by
   * hand that resolves nowhere is a typo that would otherwise read as a pass.
   */
  readonly missing: readonly string[]
}

export interface ResolveOptions {
  /**
   * Whether a name may resolve at the project root when `.claude/` does not
   * carry it. False for the default list, which names three folders a project
   * is expected to hold under `.claude/` and nowhere else.
   */
  readonly canResolveAtRoot?: boolean
}

function locate(
  root: string,
  name: string,
  bases: readonly string[],
): { readonly dir: string; readonly base: string } | undefined {
  for (const base of bases) {
    const dir = resolve(root, base, name)
    if (existsSync(`${dir}/${INDEX_FILE}`)) return { dir, base }
  }

  return undefined
}

/**
 * Resolves the folders to audit under `root`.
 *
 * A named folder contributes its entries plus every nested index folder, so a
 * split domain is audited at the same grain. Discovery runs through the shared
 * walker, so `.gitignore` and the vendored prune govern it too. The project
 * root is reached only on opt-in, so a target's own same-named folder is not
 * audited unasked, and `.claude/` wins a name both carry. The scope line
 * prints the resolved path, and `governsContent` gates root folders out of
 * single-standard rules.
 */
export async function resolveFolders(
  root: string,
  names: readonly string[] = DEFAULT_FOLDERS,
  { canResolveAtRoot = false }: ResolveOptions = {},
): Promise<FolderResolution> {
  const bases = canResolveAtRoot ? [...CLAUDE_BASES, ROOT_BASE] : CLAUDE_BASES
  const folders: AuditedFolder[] = []
  const missing: string[] = []

  for (const name of names) {
    const found = locate(root, name, bases)
    if (!found) {
      missing.push(name)
      continue
    }

    const dirs = [found.dir, ...(await listIndexes(found.dir)).map(dirname)]

    for (const each of [...new Set(dirs)].sort()) {
      folders.push({
        name,
        base: found.base,
        rel: relative(root, each),
        indexPath: `${each}/${INDEX_FILE}`,
        entries: await readEntries(each),
        nested: each !== found.dir,
      })
    }
  }

  return { folders, missing }
}
