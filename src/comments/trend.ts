import { $ } from 'bun'
import { gitEnv } from '@/git/env'
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
 * Picks evenly spaced commits from `commits`, always keeping the newest.
 *
 * Sample selection matters more than sample size here. The reading the
 * comment-discipline track needed came from four points spanning six months,
 * so spacing across the window is what the arm optimizes for rather than
 * density of coverage.
 */
export function spaceEvenly(
  commits: readonly Commit[],
  points: number,
): Commit[] {
  if (commits.length <= points) return [...commits]
  if (points <= 1) return [commits[commits.length - 1]]

  const picked: Commit[] = []
  const step = (commits.length - 1) / (points - 1)

  for (let index = 0; index < points; index++) {
    picked.push(commits[Math.round(index * step)])
  }

  return picked
}

/**
 * Reads every scannable blob at `rev` without checking anything out.
 *
 * `ls-tree` names the blobs and `cat-file --batch` streams their contents in
 * one process, so a six-point trend costs six subprocesses rather than one per
 * file per commit. Contents arrive as bytes, so the batch stream is walked by
 * byte offset rather than split as text.
 */
export async function readRevision(
  root: string,
  rev: string,
  languages: readonly Language[] = LANGUAGES,
): Promise<SourceFile[]> {
  const listed = await $`git -C ${root} ls-tree -r -z ${rev}`
    .env(gitEnv())
    .quiet()
    .nothrow()
  if (listed.exitCode !== 0) return []

  const wanted: { oid: string; path: string }[] = []

  for (const entry of listed.text().split('\0')) {
    if (!entry) continue
    const [meta, path] = entry.split('\t')
    if (!path) continue

    const [, type, oid] = meta.split(/\s+/)
    if (type !== 'blob') continue
    if (isPruned(path)) continue

    const language = languageFor(path)
    if (!language || !languages.includes(language)) continue

    wanted.push({ oid, path })
  }

  if (wanted.length === 0) return []

  const stdin = Buffer.from(`${wanted.map(({ oid }) => oid).join('\n')}\n`)
  const batch = await $`git -C ${root} cat-file --batch < ${stdin}`
    .env(gitEnv())
    .quiet()
    .nothrow()

  if (batch.exitCode !== 0) return []

  return parseBatch(Buffer.from(batch.arrayBuffer()), wanted)
}

/**
 * Walks `git cat-file --batch` output, which frames each object as
 * `<oid> SP <type> SP <size> LF <contents> LF`. The size header is the only
 * safe way to find the next record, since contents may hold anything.
 */
function parseBatch(
  buffer: Buffer,
  wanted: readonly { oid: string; path: string }[],
): SourceFile[] {
  const files: SourceFile[] = []
  let offset = 0

  for (const { path } of wanted) {
    const headerEnd = buffer.indexOf(0x0a, offset)
    if (headerEnd === -1) break

    const header = buffer.toString('utf8', offset, headerEnd)
    const size = Number(header.split(' ')[2])
    if (!Number.isFinite(size)) break

    const start = headerEnd + 1
    files.push({ path, text: buffer.toString('utf8', start, start + size) })
    offset = start + size + 1
  }

  return files
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
