import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { execaSync } from 'execa'
import { gitEnv } from '@/git/env'
import {
  findInstalledOrigin,
  type HistoryIndex,
  readHistoryIndex,
  toRepoPath,
} from '@/sync/history'

const CLAUDE_DIR = '.claude'

/**
 * Who put an unclaimed folder in the target, traced from the toolkit's own history and never guessed
 * from the filesystem. `unattributed` is a verdict in its own right: the toolkit shipped that name
 * and the content matches no published version.
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

export interface ReverseReport {
  readonly unclaimed: readonly UnclaimedFolder[]
  /** Set when the walk needed history to run and this toolkit has none. */
  readonly historyUnavailable: boolean
}

const EMPTY_REVERSE: ReverseReport = {
  unclaimed: [],
  historyUnavailable: false,
}

/**
 * Asks backwards what the target holds that no live catalog claims, since a forward scan never sees a
 * folder the toolkit deleted. Scoped to roots the toolkit has dropped, since the whole tree would
 * report every project folder as unclaimed.
 */
export function buildReverseReport(
  toolkitRoot: string,
  target: string,
): ReverseReport {
  const roots = readDroppedRoots(toolkitRoot)

  if (roots === undefined) {
    return { unclaimed: [], historyUnavailable: true }
  }

  const unclaimed: UnclaimedFolder[] = []

  for (const root of roots) {
    for (const rel of [root, join(CLAUDE_DIR, root)]) {
      const files = listFiles(join(target, rel))
      if (files.length === 0) continue

      unclaimed.push(attributeFolder(toolkitRoot, target, rel, root, files))
    }
  }

  return { unclaimed, historyUnavailable: false }
}

export function emptyReverseReport(): ReverseReport {
  return EMPTY_REVERSE
}

/**
 * Top-level toolkit paths that history records a deletion under and that no longer exist in the
 * working tree. Read as one log over the whole repository, and a root-level file is skipped, since
 * this walk matches target folders.
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
 * Splits a found folder three ways against the toolkit's history of the root it sits at: content
 * matching a published version proves the toolkit put it there, a shipped name with unpublished
 * content is `unattributed`, and no name overlap is the project's own. A renamed file goes unmatched.
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
 * Every file under a directory, dotfiles included. A dropped root can hold any
 * extension, so this does not filter to markdown the way the domain walk does.
 */
function listFiles(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return []

  return [
    ...new Bun.Glob('**/*').scanSync({ cwd: dir, onlyFiles: true, dot: true }),
  ].sort()
}
