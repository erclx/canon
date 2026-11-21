import { $ } from 'bun'
import { readFile, mkdir, rename, rmdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { gitEnv } from '@/git/env'
import type { RenamePlan, RenameSource } from '@/migrate/plan'
import { FROM_ROOT as OLD_ROOT, type RecordsPlan } from '@/migrate/records'

/**
 * A file whose bytes carry a NUL is read as binary, its content left alone so the path
 * still moves. It reports the empty string, which keeps the planner pure.
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
 * Writes the records move: the citations first, then the folders, so a failed move
 * reads as pending. The folder loop stops on the first failure, and `pushRecords`
 * refuses a split tree.
 */
export async function applyRecordsMove(
  root: string,
  plan: RecordsPlan,
): Promise<ApplyResult> {
  let written = 0
  let moved = 0
  const failed: string[] = []

  for (const entry of plan.entries) {
    // A rejected write is recorded rather than thrown, since a commander action would unwind past the report.
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

  // An emptied old root is removed, and `rmdir` refuses one still holding anything.
  if (moved > 0) {
    await rmdir(join(root, OLD_ROOT)).catch(() => undefined)
  }

  return { written, moved, failed }
}

/**
 * Writes the plan. Content lands first, so a failed move leaves the rewrite on a path
 * that still exists. `git mv` rather than a rename, so history follows the file.
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
 * Removes the directories a move emptied, which git's diff never shows and which
 * read as a half-done rename. `rmdir` refuses a directory still holding anything.
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
