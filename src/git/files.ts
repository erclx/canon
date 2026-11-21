import { $ } from 'bun'
import { baseCandidates, isMergeBase } from '@/git/base'
import { gitEnv } from '@/git/env'

/** Runs git under `root` with the resolution variables a hook exports stripped. */
async function git(
  root: string,
  args: readonly string[],
): Promise<string | undefined> {
  const result = await $`git -C ${root} ${args}`.env(gitEnv()).quiet().nothrow()
  return result.exitCode === 0 ? result.text().trimEnd() : undefined
}

/**
 * The far side of a branch range: the merge base against the ref a caller named,
 * or against the first trunk this repository carries. A named ref with no merge
 * base refuses rather than falling back to the trunk range.
 */
export async function resolveBaseRef(
  root: string,
  ref?: string,
): Promise<string | undefined> {
  for (const candidate of baseCandidates(ref)) {
    const merged = await git(root, ['merge-base', 'HEAD', candidate])
    if (isMergeBase(merged)) return merged
  }

  return undefined
}

/**
 * Every path a branch has touched since `base`: the diff against the working
 * tree, plus untracked files git does not ignore. Returns undefined when git
 * cannot answer, since an empty list reads as a clean branch.
 */
export async function listChangedFiles(
  root: string,
  base: string,
): Promise<string[] | undefined> {
  // NUL-separated, since newline output C-quotes a path holding a quote or non-ASCII character.
  const changed = await git(root, ['diff', '--name-only', '-z', base])
  const untracked = await git(root, [
    'ls-files',
    '-z',
    '--others',
    '--exclude-standard',
  ])
  if (changed === undefined || untracked === undefined) return undefined

  const paths = [...changed.split('\0'), ...untracked.split('\0')]
  return [...new Set(paths.filter(Boolean))].sort()
}

/** A file's old and new path across a git-detected rename. */
export interface RenamePair {
  readonly from: string
  readonly to: string
}

/**
 * Every rename `base..working tree` carries, read through the similarity
 * detection `git diff -M` applies by default (50%). A move under that floor
 * reports as a delete and add. Returns undefined when git cannot answer.
 */
export async function listRenames(
  root: string,
  base: string,
): Promise<RenamePair[] | undefined> {
  const output = await git(root, ['diff', '--name-status', '-M', base])
  if (output === undefined) return undefined

  const renames: RenamePair[] = []
  for (const line of output.split('\n')) {
    if (line === '') continue
    const [status, from, to] = line.split('\t')
    if (status === undefined || !status.startsWith('R')) continue
    if (from === undefined || to === undefined) continue
    renames.push({ from, to })
  }
  return renames
}

/**
 * Added, non-comment lines from a unified diff hunk touching `.gitignore`. Shared
 * between a local `git diff` and a patch GitHub returns inline.
 */
export function parseIgnoreAdditions(diffText: string): string[] {
  const patterns: string[] = []
  for (const line of diffText.split('\n')) {
    if (!line.startsWith('+') || line.startsWith('+++')) continue
    const pattern = line.slice(1).trim()
    if (pattern === '' || pattern.startsWith('#')) continue
    patterns.push(pattern)
  }
  return patterns
}

/**
 * Every pattern a branch added to `.gitignore` since `base`.
 *
 * `-U0` keeps the hunk to changed lines alone, which is all a claim needs.
 *
 * Returns undefined when git cannot answer, matching `listChangedFiles`.
 */
export async function listIgnoreAdditions(
  root: string,
  base: string,
): Promise<string[] | undefined> {
  const output = await git(root, ['diff', '-U0', base, '--', '.gitignore'])
  if (output === undefined) return undefined
  return parseIgnoreAdditions(output)
}

/**
 * Lists the files under `root`: tracked, plus untracked files git does not ignore.
 * Returns undefined when git cannot answer, since an empty list passes each of
 * its zero files and would read as a clean tree.
 */
export async function listRepositoryFiles(
  root: string,
): Promise<string[] | undefined> {
  const run = async (args: string[]): Promise<string[] | undefined> => {
    const result = await $`git -C ${root} ${args}`
      .env(gitEnv())
      .quiet()
      .nothrow()
    if (result.exitCode !== 0) return undefined
    return result.text().split('\n').filter(Boolean)
  }

  const tracked = await run(['ls-files'])
  const untracked = await run(['ls-files', '--others', '--exclude-standard'])
  const deleted = await run(['ls-files', '--deleted'])
  if (!tracked || !untracked || !deleted) return undefined

  const gone = new Set(deleted)
  const present = tracked.filter((path) => !gone.has(path))
  return [...new Set([...present, ...untracked])].sort()
}

/**
 * A file as `ref` holds it, or undefined where the ref holds no such path or
 * git cannot answer. A path absent at the ref and a failed read are the same
 * answer for a caller asking what the copy before this branch said.
 */
export async function readFileAtRef(
  root: string,
  ref: string,
  rel: string,
): Promise<string | undefined> {
  return git(root, ['show', `${ref}:${rel}`])
}

/** Every path under `prefix` that `ref` holds, or undefined where git cannot answer. */
export async function listFilesAtRef(
  root: string,
  ref: string,
  prefix: string,
): Promise<string[] | undefined> {
  const listed = await git(root, [
    'ls-tree',
    '-r',
    '--name-only',
    ref,
    '--',
    prefix,
  ])
  return listed === undefined ? undefined : listed.split('\n').filter(Boolean)
}
