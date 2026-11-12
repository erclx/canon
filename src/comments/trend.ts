import { $ } from 'bun'
import { gitEnv } from '@/git/env'
import { readBlobsAt, spaceEvenly } from '@/git/revision'
import {
  countFiles,
  isPruned,
  type Language,
  LANGUAGES,
  type LanguageCount,
  languageFor,
  type ScanOptions,
  type SourceFile,
} from '@/comments/scan'

export interface TrendPoint {
  readonly rev: string
  readonly date: string
  readonly languages: readonly LanguageCount[]
}

export const DEFAULT_POINTS = 6

interface Commit {
  readonly rev: string
  readonly date: string
}

function parseCommits(text: string): Commit[] {
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [rev, date] = line.split('\t')
      return { rev, date }
    })
}

/**
 * Lists the commits from `since` to HEAD, oldest first and inclusive of
 * `since` itself.
 *
 * A `since..HEAD` range excludes its own boundary, which drops the reading the
 * caller is measuring against. The whole point of a trend is the before, so
 * the boundary commit is prepended rather than left to the range operator.
 *
 * `--first-parent` keeps a merged branch's own commits out of the sample, so
 * evenly spaced points land on the trunk rather than clustering inside
 * whichever feature happened to carry the most commits.
 */
export async function listCommits(
  root: string,
  since: string,
): Promise<Commit[]> {
  const boundary =
    await $`git -C ${root} log -1 --format=%H%x09%ad --date=short ${since}`
      .env(gitEnv())
      .quiet()
      .nothrow()

  if (boundary.exitCode !== 0) return []

  const range =
    await $`git -C ${root} log --first-parent --reverse --format=%H%x09%ad --date=short ${`${since}..HEAD`}`
      .env(gitEnv())
      .quiet()
      .nothrow()

  const commits = parseCommits(boundary.text())
  if (range.exitCode === 0) commits.push(...parseCommits(range.text()))

  return commits
}

/**
 * Reads every scannable blob at `rev` without checking anything out, keeping
 * the paths whose language the scan reads.
 */
export async function readRevision(
  root: string,
  rev: string,
  languages: readonly Language[] = LANGUAGES,
): Promise<SourceFile[]> {
  const entries = await readBlobsAt(root, rev, (path) => {
    if (isPruned(path)) return false
    const language = languageFor(path)
    return language !== undefined && languages.includes(language)
  })

  return entries.flatMap(({ path, text }) =>
    text === undefined ? [] : [{ path, text }],
  )
}

/** Counts one revision's tree, reusing the same pass the snapshot arm runs. */
export async function scanRevision(
  root: string,
  rev: string,
  opts: ScanOptions = {},
): Promise<LanguageCount[]> {
  const files = await readRevision(root, rev, opts.languages ?? LANGUAGES)
  return countFiles(files, opts)
}

export interface TrendOptions extends ScanOptions {
  readonly since: string
  readonly points?: number
}

/** Recomputes the series from git rather than reading a stored ledger. */
export async function trend(
  root: string,
  opts: TrendOptions,
): Promise<TrendPoint[]> {
  const commits = await listCommits(root, opts.since)
  const sampled = spaceEvenly(commits, opts.points ?? DEFAULT_POINTS)

  // Each point is an independent pair of git reads, and the sample is bounded
  // by `points`, so the whole series costs one revision's wall clock.
  return Promise.all(
    sampled.map(async ({ rev, date }) => ({
      rev,
      date,
      languages: await scanRevision(root, rev, opts),
    })),
  )
}
