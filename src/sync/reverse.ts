import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { execaSync } from 'execa'
import { gitEnv } from '@/git-env'
import {
  findInstalledOrigin,
  type HistoryIndex,
  readHistoryIndex,
  toRepoPath,
} from '@/sync/history'

const CLAUDE_DIR = '.claude'

/**
 * A `CLAUDE.md` past this many lines has more in it than the always-load tier
 * is for. The figure is the checkpoint `standards/context.md` sets for
 * a context entry, raised because `CLAUDE.md` legitimately carries more than
 * one domain. It gates a proposal rather than a failure, so being approximate
 * costs a line an operator can ignore.
 */
const CLAUDE_MD_LINES = 250

/**
 * Who put an unclaimed folder in the target. A dropped folder and one the
 * project wrote are the same bytes at the same path, so this is traced from the
 * toolkit's own history and never guessed from the filesystem.
 *
 * `unattributed` is a verdict in its own right rather than a soft `dropped`.
 * The toolkit shipped a path of that name and the content matches no version it
 * ever published, which is exactly what history proving nothing looks like. An
 * operator can act on a labelled unknown and cannot act on a guess.
 */
export type Attribution = 'dropped' | 'project' | 'unattributed'

/**
 * A folder the target holds at a root the toolkit has stopped shipping.
 * Carries no source and queues no change, because only the user can decide what
 * happens to content the toolkit no longer claims.
 */
export interface UnclaimedFolder {
  readonly rel: string
  readonly files: number
  readonly attribution: Attribution
  /** Toolkit revision whose version of a file here the target still holds. */
  readonly since?: string
}

/**
 * A proposal-only skill with a live case in this target. The skills propose and
 * never execute, so the report names one rather than queueing a change.
 */
export interface MigrationCandidate {
  readonly skill: string
  /** What was measured, so the proposal is checkable before it is run. */
  readonly reason: string
}

export interface ReverseReport {
  readonly unclaimed: readonly UnclaimedFolder[]
  readonly migrations: readonly MigrationCandidate[]
  /** Set when the walk needed history to run and this toolkit has none. */
  readonly historyUnavailable: boolean
}

const EMPTY_REVERSE: ReverseReport = {
  unclaimed: [],
  migrations: [],
  historyUnavailable: false,
}

/**
 * Asks the question every other detection surface asks backwards: what does the
 * target hold that no live catalog claims. The forward direction enumerates
 * toolkit-owned keys and tests the target against them, so a folder the toolkit
 * deleted appears in no section at all.
 *
 * Scoped to roots the toolkit itself has dropped rather than to the whole tree.
 * Walking the tree reports every project folder as unclaimed, which is true and
 * useless, and the question here is only what the toolkit put there and then
 * stopped claiming.
 *
 * Reports beside `superseded`, `unmigrated`, and `newSkills` rather than
 * absorbing them. Each of those answers a narrower version of the same question
 * and none is wrong today, so folding them in would change what two shipped
 * sections print in the same change that introduces a third.
 */
export function buildReverseReport(
  toolkitRoot: string,
  target: string,
): ReverseReport {
  const roots = readDroppedRoots(toolkitRoot)
  const migrations = detectMigrations(target)

  if (roots === undefined) {
    return { unclaimed: [], migrations, historyUnavailable: true }
  }

  const unclaimed: UnclaimedFolder[] = []

  for (const root of roots) {
    for (const rel of [root, join(CLAUDE_DIR, root)]) {
      const files = listFiles(join(target, rel))
      if (files.length === 0) continue

      unclaimed.push(attributeFolder(toolkitRoot, target, rel, root, files))
    }
  }

  return { unclaimed, migrations, historyUnavailable: false }
}

export function emptyReverseReport(): ReverseReport {
  return EMPTY_REVERSE
}

/**
 * Top-level toolkit paths that history records a deletion under and that no
 * longer exist in the working tree. Both halves are load-bearing: a path with
 * deletions that still exists is a live root the forward direction already
 * covers, and a path that never lost a file was never dropped.
 *
 * Read as one log over the whole repository rather than per candidate, since
 * the candidate set is what the call produces. A root-level file is skipped
 * because this walk matches target folders, and a deleted `README.md` names no
 * folder to look for.
 */
function readDroppedRoots(toolkitRoot: string): readonly string[] | undefined {
  const result = execaSync(
    'git',
    [
      '-C',
      toolkitRoot,
      'log',
      '--all',
      '--diff-filter=D',
      '--name-only',
      '--format=',
    ],
    { reject: false, env: gitEnv(), extendEnv: false },
  )

  if (result.exitCode !== 0) return undefined

  const roots = new Set<string>()

  for (const line of result.stdout.split('\n')) {
    const trimmed = line.trim()
    const boundary = trimmed.indexOf('/')
    if (boundary <= 0) continue

    roots.add(trimmed.slice(0, boundary))
  }

  return [...roots]
    .filter((root) => !existsSync(join(toolkitRoot, root)))
    .sort()
}

/**
 * Splits a found folder three ways against the toolkit's history of the root it
 * sits at. Content matching a published version proves the toolkit put the file
 * there. Names the toolkit shipped with content it never published proves only
 * that the two collided, which is the unattributed case. No name overlap at all
 * is a folder the project owns that happens to share a retired name.
 *
 * Only files whose relative path the toolkit once held are hashed, so a project
 * folder colliding on name costs the walk no reads. The cost is that a file the
 * toolkit shipped and the target renamed goes unmatched, the same limit
 * `countToolkitOwned` carries for the forward direction.
 */
function attributeFolder(
  toolkitRoot: string,
  target: string,
  rel: string,
  root: string,
  files: readonly string[],
): UnclaimedFolder {
  const index = readHistoryIndex(toolkitRoot, [root])

  if (index === undefined) {
    return { rel, files: files.length, attribution: 'unattributed' }
  }

  let covered = false

  for (const file of files) {
    const sourceRel = toRepoPath(join(root, file))
    if (!covers(index, sourceRel)) continue

    covered = true
    const since = findInstalledOrigin(index, sourceRel, join(target, rel, file))

    if (since !== undefined) {
      return { rel, files: files.length, attribution: 'dropped', since }
    }
  }

  return {
    rel,
    files: files.length,
    attribution: covered ? 'unattributed' : 'project',
  }
}

function covers(index: HistoryIndex, sourceRel: string): boolean {
  return index.get(sourceRel) !== undefined
}

/**
 * Live cases for the two proposal-only skills no other report field names.
 * Without this, both are documented and unreachable.
 *
 * Both tests read what the skill itself acts on, so a proposal the report makes
 * is one the skill has work to do for. A context tier that already holds files
 * settles the `docs/` split, whether or not the toolkit is what made it.
 */
export function detectMigrations(target: string): MigrationCandidate[] {
  const found: MigrationCandidate[] = []
  const claudeMd = join(target, 'CLAUDE.md')

  if (existsSync(claudeMd)) {
    const lines = countLines(readFileSync(claudeMd, 'utf8'))
    if (lines > CLAUDE_MD_LINES) {
      found.push({
        skill: 'migration-claude-md',
        reason: `CLAUDE.md carries ${lines} lines, past the ${CLAUDE_MD_LINES} the three-tier split is for`,
      })
    }
  }

  const docs = listFiles(join(target, 'docs')).filter(isMarkdown).length
  const context = listFiles(join(target, CLAUDE_DIR, 'context')).length

  if (docs > 0 && context === 0) {
    found.push({
      skill: 'migration-context',
      reason: `${docs} markdown files under docs/ with no canon/context/ tier`,
    })
  }

  return found
}

function isMarkdown(rel: string): boolean {
  return rel.endsWith('.md')
}

/**
 * Lines as `wc -l` counts them, so the figure in the reason matches what an
 * operator gets from the shell. Splitting alone overstates a file ending in a
 * newline by one, and the reason states a measurement rather than a rank.
 */
function countLines(content: string): number {
  const parts = content.split('\n')
  return parts.at(-1) === '' ? parts.length - 1 : parts.length
}

/**
 * Every file under a directory, dotfiles included. A dropped root can hold any
 * extension, so this does not filter to markdown the way the domain walk does.
 */
function listFiles(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return []

  return [
    ...new Bun.Glob('**/*').scanSync({ cwd: dir, onlyFiles: true, dot: true }),
  ].sort()
}
