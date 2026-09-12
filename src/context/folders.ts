import { existsSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { INDEX_FILE, listIndexes } from '@/indexes/walk'
import { RECORD_ROOTS } from '@/record-root'
import { SURFACE_ROOTS } from '@/surface-root'

/**
 * Folder names under a record root audited by default.
 *
 * A named list rather than the index-plus-entry contract read off disk, so a
 * generated tree satisfying that contract is never measured against a rule
 * written for per-domain narrative. This list names the folders
 * `standards/context.md` governs, and `--folder` admits another without an edit
 * here.
 *
 * It doubles as the citation check's scope, since `citationPattern` spells only
 * these names. A folder left off the list is never resolved, so a path into one
 * goes stale silently rather than failing a push.
 */
export const DEFAULT_FOLDERS: readonly string[] = [
  'context',
  'diagrams',
  'wireframes',
]

/**
 * The bases every folder in the default list is looked for under.
 *
 * `diagrams` is a session record and resolves under `RECORD_ROOTS`, while
 * `context` and `wireframes` are tracked and resolve under `SURFACE_ROOTS`, so
 * the split this comment used to describe as hypothetical is real: two
 * folders on this list read from two different root lists. The base array is
 * their union rather than a per-name map, since a name resolving at the wrong
 * root costs one extra `existsSync` and nothing else, where a map states the
 * split a second time next to the one each resolver module already carries.
 *
 * `.claude` is pushed last because both lists name it, and each list's own
 * precedence otherwise survives: `canon` still precedes `.claude` for a
 * `SURFACE_ROOTS` name, and `.canon` still precedes `.claude` for a
 * `RECORD_ROOTS` one. Order between `canon` and `.canon` is unobserved, since
 * no name on this list resolves under both.
 *
 * Adding `canon` here means a target holding a root-level `canon/` folder of
 * its own now resolves it as the toolkit's, since a project writing about a
 * product called canon is a plausible name collision `canResolveAtRoot`'s own
 * project-root gate does not cover. The audit only reports, so the cost is a
 * wrong scope line rather than a wrong edit.
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
   * `.claude/context/claude-plugin` is governed as `context`.
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
 * citation check's scope.
 *
 * A skill or seed pointing into `.claude/wireframes/` is a live instruction for
 * a project that carries the folder and says nothing about one that does not.
 * Checking a path into an absent folder would fail eight shipped references
 * here for the sole reason that this repository has no wireframes.
 *
 * A folder resolved at the project root is measured and stays out of this. The
 * pattern the citation check builds spells the `.claude/` prefix, so admitting
 * a root name there would check `.claude/<name>/` paths the audit never read.
 * Widening the pattern to the root spelling is a separate change, since a bare
 * `docs/x.md` appears in prose that references nothing.
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
 * A named folder contributes its own entries plus those of every nested index
 * folder beneath it, so a domain that outgrew one file and split is audited at
 * the same grain as one that did not. Discovery of the nested folders runs
 * through the shared walker, which is what keeps `.gitignore` and the vendored
 * prune governing this scan as well as index regeneration. That prune is what
 * lets a root folder be walked at all, since a name at the project root sits
 * beside `node_modules` and a build output.
 *
 * The project root is reached only when the caller opts in, so a target holding
 * a root `wireframes/` is not audited against a standard it never adopted by
 * the mere act of running the command. `.claude/` still wins a name carried by
 * both, and the scope line prints the resolved path so a caller reads which
 * base was taken rather than inferring it.
 *
 * Nothing above this asks where a folder came from. A name that resolves at the
 * root is measured by every rule that generalizes and gated out of the rules a
 * single standard carries, which `governsContent` decides from the name.
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
