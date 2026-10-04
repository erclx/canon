import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { sep } from 'node:path'
import { execaSync } from 'execa'
import { gitEnv } from '@/git/env'

/** Blob SHA to the newest commit whose post-image for that path held it. */
export type PathHistory = ReadonlyMap<string, string>

/** Source path relative to the toolkit root, to that path's known blobs. */
export type HistoryIndex = ReadonlyMap<string, PathHistory>

const EMPTY_BLOB = '0000000000000000000000000000000000000000'

/**
 * Git's own object name for a file's contents: sha1 over `blob <len>\0` and the
 * bytes. Computed here rather than shelled out to `git hash-object`, which would
 * cost a process per file inside the attribution pass.
 *
 * A repository normalizing line endings on checkout stores a blob the working
 * tree never holds, so this returns a name that matches no historical version.
 * The caller treats an unmatched file as unattributed, which is the safe label.
 */
export function gitBlobHash(content: Buffer): string {
  const header = Buffer.from(`blob ${content.length}\0`, 'utf8')
  return createHash('sha1').update(header).update(content).digest('hex')
}

/**
 * Reads `--raw` log output into blob-to-commit maps, one per path.
 *
 * Reverse-chronological input means the first commit naming a blob is the
 * newest that produced it, so an existing key is never overwritten. Content
 * reverted and restored therefore reports the recent commit rather than the
 * original, which is the one an operator can act on.
 */
export function parseRawLog(output: string): HistoryIndex {
  const index = new Map<string, Map<string, string>>()
  let commit = ''

  for (const line of output.split('\n')) {
    if (line === '') continue

    if (!line.startsWith(':')) {
      commit = line.trim()
      continue
    }

    const [meta, path] = line.split('\t')
    if (path === undefined || commit === '') continue

    const blob = meta.trim().split(/\s+/)[3]
    if (blob === undefined || blob === EMPTY_BLOB) continue

    const blobs = index.get(path) ?? new Map<string, string>()
    if (!blobs.has(blob)) blobs.set(blob, commit)
    index.set(path, blobs)
  }

  return index
}

/**
 * Every historical version of the given toolkit-relative paths, or `undefined`
 * when this toolkit has no history to read. A package installed from the
 * registry ships source without `.git`, so absence is an ordinary state rather
 * than a failure, and the caller degrades to the unattributed path.
 *
 * Renames are disabled so a raw line always carries exactly one path. Detection
 * would emit a two-path form that the parser would read as an unknown blob.
 */
export function readHistoryIndex(
  toolkitRoot: string,
  paths: readonly string[],
): HistoryIndex | undefined {
  if (paths.length === 0) return new Map()

  const result = execaSync(
    'git',
    [
      '-C',
      toolkitRoot,
      'log',
      '--all',
      '--raw',
      '--no-renames',
      '--no-abbrev',
      '--relative',
      '--format=%H',
      '--',
      ...paths.map(toRepoPath),
    ],
    { reject: false, env: gitEnv(), extendEnv: false },
  )

  return result.exitCode === 0 ? parseRawLog(result.stdout) : undefined
}

/**
 * Git prints and accepts posix separators on every platform, so a Windows
 * caller's `relative()` output has to be converted before it can match a path
 * the log emitted.
 */
export function toRepoPath(path: string): string {
  return path.split(sep).join('/')
}

/**
 * The commit whose version of `sourceRel` matches what sits at `installedPath`.
 * A match proves the file is untouched since it was installed, so the toolkit is
 * what moved. No match means the content matches nothing this toolkit ever
 * published, which is a local edit and stays unattributed.
 */
export function findInstalledOrigin(
  index: HistoryIndex,
  sourceRel: string,
  installedPath: string,
): string | undefined {
  const blobs = index.get(toRepoPath(sourceRel))
  if (blobs === undefined) return undefined

  return blobs.get(gitBlobHash(readFileSync(installedPath)))
}
