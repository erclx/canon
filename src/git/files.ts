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
 * The far side of a branch range: the merge base against the ref a caller
 * named, or against the first trunk this repository carries.
 *
 * A named ref names the far side rather than the comparison point, so it
 * resolves through the merge base exactly as the trunk below does. Reading it
 * literally is what let a trunk moving under an open branch report every path
 * merged in between as one the branch had written. A caller naming an ancestor
 * still gets that commit back, since the merge base of `HEAD` and an ancestor
 * is the ancestor.
 *
 * A named ref that produces no merge base refuses rather than falling back,
 * since measuring the trunk range instead would answer a question nobody
 * asked. That covers a ref resolving to nothing and a ref sharing no history
 * with `HEAD` alike, which no caller can separate.
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
 * tree, plus untracked files git does not ignore.
 *
 * The working tree rather than `HEAD` on purpose. A check that runs before the
 * branch is committed has to see the surface a session just added, and reading
 * `HEAD` there returns a set the working tree has already moved past. Since the
 * range is a superset of `base..HEAD`, a caller running after the commits still
 * gets the whole branch.
 *
 * Returns undefined when git cannot answer, for the reason
 * `listRepositoryFiles` states: an empty list reads as a clean branch.
 */
export async function listChangedFiles(
  root: string,
  base: string,
): Promise<string[] | undefined> {
  const changed = await git(root, ['diff', '--name-only', base])
  const untracked = await git(root, [
    'ls-files',
    '--others',
    '--exclude-standard',
  ])
  if (changed === undefined || untracked === undefined) return undefined

  const paths = [...changed.split('\n'), ...untracked.split('\n')]
  return [...new Set(paths.filter(Boolean))].sort()
}

/** A file's old and new path across a git-detected rename. */
export interface RenamePair {
  readonly from: string
  readonly to: string
}

/**
 * Every rename `base..working tree` carries, read through the same similarity
 * detection `git diff -M` applies by default (50%).
 *
 * A move heavy enough on rewritten content to fall under that floor reports
 * as a plain delete and add rather than a rename, which is not a defect this
 * reads around: the diff genuinely does not carry the file a claim citing the
 * old path describes.
 *
 * Returns undefined when git cannot answer, matching `listChangedFiles`.
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
 * Added, non-comment lines from a unified diff hunk touching `.gitignore`.
 *
 * Shared between a local `git diff` and a patch string GitHub returns inline
 * for the same file, so the two evidence sources read one pattern the same
 * way.
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
 * Lists the files under `root`: tracked, plus untracked files git does not
 * ignore. The untracked half is what keeps a file added on this branch in scope
 * rather than one push later.
 *
 * Returns undefined when git cannot answer, which every caller reports rather
 * than smoothing into an empty list. An empty list passes each of its zero
 * files, so a degraded git would otherwise be indistinguishable from a clean
 * tree in the output.
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
  if (!tracked || !untracked) return undefined

  return [...new Set([...tracked, ...untracked])].sort()
}
