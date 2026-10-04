import { $ } from 'bun'
import { readFile, mkdir, rename, rmdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { gitEnv } from '@/git/env'
import type { RenamePlan, RenameSource } from '@/migrate/plan'
import { FROM_ROOT as OLD_ROOT, type RecordsPlan } from '@/migrate/records'

/**
 * A file whose bytes carry a NUL is read as binary and its content is left
 * alone, which lets the path still move. Reporting the empty string rather
 * than a flag keeps the planner pure: an unchanged content rewrite is already
 * how it expresses "path only", so binary needs no branch of its own there.
 */
export async function readSources(
  root: string,
  paths: readonly string[],
): Promise<RenameSource[]> {
  const sources: RenameSource[] = []

  for (const path of paths) {
    const bytes = await readFile(join(root, path)).catch(() => undefined)
    if (bytes === undefined) continue

    const binary = bytes.includes(0)
    sources.push({ path, text: binary ? '' : bytes.toString('utf8') })
  }

  return sources
}

export interface ApplyResult {
  readonly written: number
  readonly moved: number
  readonly failed: readonly string[]
}

/**
 * Writes the records move: the citations first, then the folders.
 *
 * The order is the reverse of `applyRename`'s reasoning and lands in the same
 * place. Every folder here is untracked, so a failed move leaves the records
 * where they were and the rewritten citations point at a root nothing has
 * reached yet, which reads as pending. Moving first and failing the rewrite
 * strands the records at a root nothing points at, which reads as lost.
 *
 * A plain rename rather than `git mv`, since none of these paths is tracked and
 * git has no history to carry. The destination root is created once; a rename
 * across filesystems is not handled, because both paths sit inside one project.
 *
 * The folder loop stops on the first failure rather than carrying on. Each move
 * that lands makes the tree more split, and a split tree is what `pushRecords`
 * refuses on, so continuing turns one unmovable folder into a longer list of
 * folders to put back by hand. Stopping does not undo what already moved,
 * which is why the refusal on the push side exists as well.
 */
export async function applyRecordsMove(
  root: string,
  plan: RecordsPlan,
): Promise<ApplyResult> {
  let written = 0
  let moved = 0
  const failed: string[] = []

  for (const entry of plan.entries) {
    // A rejected write leaves the tree half-rewritten with nothing said, since
    // this runs inside a commander action that would unwind past the report.
    // Reads still resolve through the root fallback, so the recorded failure is
    // what a caller needs rather than a stop.
    const done = await writeFile(join(root, entry.path), entry.text)
      .then(() => true)
      .catch(() => false)

    if (done) written += 1
    else failed.push(entry.path)
  }

  for (const move of plan.moves) {
    await mkdir(dirname(join(root, move.to)), { recursive: true })
    const done = await rename(join(root, move.from), join(root, move.to))
      .then(() => true)
      .catch(() => false)

    if (!done) {
      failed.push(move.from)
      break
    }

    moved += 1
  }

  // The old root survives the moves as an empty directory when it held records
  // and nothing else. `rmdir` refuses a directory that still holds anything, so
  // a project keeping its rules, skills, and settings there is untouched and the
  // refusal is ignored rather than reported.
  if (moved > 0) {
    await rmdir(join(root, OLD_ROOT)).catch(() => undefined)
  }

  return { written, moved, failed }
}

/**
 * Writes the plan. Content lands first and the move follows, so a failed move
 * leaves the rewrite on a path that still exists rather than stranding content
 * at a destination nothing points at yet.
 *
 * `git mv` rather than a filesystem rename, so the history follows the file and
 * a reviewer reading the pull request sees a rename instead of a delete beside
 * an add.
 */
export async function applyRename(
  root: string,
  plan: RenamePlan,
): Promise<ApplyResult> {
  let written = 0
  let moved = 0
  const failed: string[] = []

  for (const entry of plan.entries) {
    if (entry.text !== undefined) {
      await writeFile(join(root, entry.path), entry.text)
      written += 1
    }

    if (entry.movesTo === undefined) continue

    await mkdir(dirname(join(root, entry.movesTo)), { recursive: true })
    const result = await $`git -C ${root} mv ${entry.path} ${entry.movesTo}`
      .env(gitEnv())
      .quiet()
      .nothrow()

    if (result.exitCode === 0) moved += 1
    else failed.push(entry.path)
  }

  await pruneEmptyParents(
    root,
    plan.entries
      .filter((entry) => entry.movesTo !== undefined)
      .map((entry) => dirname(entry.path)),
  )

  return { written, moved, failed }
}

/**
 * Removes the directories a move emptied.
 *
 * Git tracks files rather than directories, so moving the last file out of one
 * leaves the directory on disk with nothing in it and nothing in the diff to
 * say so. A renamed skill folder that keeps its old shell beside the new one
 * reads to a person, and to a plugin loader walking the tree, as though the
 * rename only half happened.
 *
 * `rmdir` refuses a directory that still holds anything, which is the guard:
 * a folder with an untracked file in it stays, and the refusal is ignored
 * rather than reported because it means the folder was not empty to begin
 * with.
 */
async function pruneEmptyParents(
  root: string,
  directories: readonly string[],
): Promise<void> {
  const deepestFirst = [...new Set(directories)].sort(
    (left, right) => right.length - left.length,
  )

  for (const directory of deepestFirst) {
    let current = directory

    while (current !== '.' && !current.startsWith('..')) {
      const removed = await rmdir(join(root, current))
        .then(() => true)
        .catch(() => false)
      if (!removed) break

      current = relative(root, join(root, current, '..'))
    }
  }
}
