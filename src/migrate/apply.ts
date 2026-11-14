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
 * Every folder here is untracked, so a failed move after the rewrite reads as
 * pending, where the reverse order would strand records nothing points at. A
 * plain rename rather than `git mv`, since nothing here is tracked, and both
 * paths sit inside one project. The folder loop stops on the first failure,
 * since each landed move splits the tree further and `pushRecords` refuses a
 * split tree. Stopping undoes nothing, which is why the push side refuses too.
 */
export async function applyRecordsMove(
  root: string,
  plan: RecordsPlan,
): Promise<ApplyResult> {
  let written = 0
  let moved = 0
  const failed: string[] = []

  for (const entry of plan.entries) {
    // A rejected write is recorded rather than thrown, since this runs inside a
    // commander action that would unwind past the report.
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

  // An emptied old root is removed. `rmdir` refuses one still holding anything,
  // so a project keeping its rules there is untouched and the refusal ignored.
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
 * Git tracks files rather than directories, so moving the last file out leaves
 * an empty directory the diff never shows, which reads to a person and a
 * plugin loader as a half-done rename. `rmdir` refuses a directory still
 * holding anything, so a folder with an untracked file stays, and the refusal
 * is ignored since that folder was never empty.
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
