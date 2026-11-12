import { $ } from 'bun'
import { gitEnv } from '@/git/env'

/** A tree entry at a past revision, as `git ls-tree` reports it. */
export interface RevisionEntry {
  readonly path: string
  /** The octal mode, such as `100644`, `120000` for a symlink, or `160000` for a submodule. */
  readonly mode: string
  /**
   * The blob's contents. Absent for a submodule, whose entry is a commit
   * rather than a blob and has no contents in this repository.
   */
  readonly text?: string
}

/** The mode git gives a symlink entry, whose blob holds the link target. */
export const SYMLINK_MODE = '120000'

/**
 * Reads every entry at `rev` whose path `keep` accepts, without checking
 * anything out.
 *
 * `ls-tree` names the entries and `cat-file --batch` streams the blob
 * contents in one process, so a sampled series costs two subprocesses per
 * point rather than one per file. Contents arrive as bytes, so the batch
 * stream is walked by byte offset rather than split as text.
 *
 * Returns an empty list when git cannot read the revision.
 */
export async function readBlobsAt(
  root: string,
  rev: string,
  keep: (path: string) => boolean,
): Promise<RevisionEntry[]> {
  const listed = await $`git -C ${root} ls-tree -r -z ${rev}`
    .env(gitEnv())
    .quiet()
    .nothrow()
  if (listed.exitCode !== 0) return []

  const blobs: { oid: string; path: string; mode: string }[] = []
  const others: RevisionEntry[] = []

  for (const entry of listed.text().split('\0')) {
    if (!entry) continue
    const [meta, path] = entry.split('\t')
    if (!path) continue
    if (!keep(path)) continue

    const [mode, type, oid] = meta.split(/\s+/)
    if (type === 'blob') blobs.push({ oid, path, mode })
    else others.push({ path, mode })
  }

  if (blobs.length === 0) return others

  const stdin = Buffer.from(`${blobs.map(({ oid }) => oid).join('\n')}\n`)
  const batch = await $`git -C ${root} cat-file --batch < ${stdin}`
    .env(gitEnv())
    .quiet()
    .nothrow()

  if (batch.exitCode !== 0) return []

  return [...parseBatch(Buffer.from(batch.arrayBuffer()), blobs), ...others]
}

/**
 * Walks `git cat-file --batch` output, which frames each object as
 * `<oid> SP <type> SP <size> LF <contents> LF`. The size header is the only
 * safe way to find the next record, since contents may hold anything.
 */
export function parseBatch(
  buffer: Buffer,
  wanted: readonly { path: string; mode: string }[],
): RevisionEntry[] {
  const entries: RevisionEntry[] = []
  let offset = 0

  for (const { path, mode } of wanted) {
    const headerEnd = buffer.indexOf(0x0a, offset)
    if (headerEnd === -1) break

    const header = buffer.toString('utf8', offset, headerEnd)
    const size = Number(header.split(' ')[2])
    if (!Number.isFinite(size)) break

    const start = headerEnd + 1
    entries.push({
      path,
      mode,
      text: buffer.toString('utf8', start, start + size),
    })
    offset = start + size + 1
  }

  return entries
}

/**
 * Picks evenly spaced items from `items`, always keeping the newest.
 *
 * Sample selection matters more than sample size here. The reading the
 * comment-discipline track needed came from four points spanning six months,
 * so spacing across the window is what a sampled series optimizes for rather
 * than density of coverage.
 */
export function spaceEvenly<T>(items: readonly T[], points: number): T[] {
  if (items.length <= points) return [...items]
  if (points <= 1) return [items[items.length - 1]]

  const picked: T[] = []
  const step = (items.length - 1) / (points - 1)

  for (let index = 0; index < points; index++) {
    picked.push(items[Math.round(index * step)])
  }

  return picked
}
