import { lstat, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isBinary } from '@/binary'
import { scanText } from '@/secrets/scan'

/**
 * The largest single record a push carries, in bytes.
 *
 * A constant rather than a flag. The largest record measured in this
 * repository is a 6.7 MB git pack under a groundwork fixture and GitHub
 * rejects a blob at 100 MB, so this sits well clear of both, and an override
 * is one nobody remembers to pass the first time a backup tarball lands in a
 * record folder.
 */
export const MAX_RECORD_BYTES = 25 * 1024 * 1024

export interface BlockedPath {
  readonly path: string
  readonly cause: 'oversized' | 'credential'
  /** A size or `<label> at line <n>`, never the matched value or a preview of it. */
  readonly detail: string
}

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Every pending path a push must not carry, in the order given.
 *
 * Reads the size off `lstat` first so an oversized file is never opened, and
 * skips anything that is not a regular file, since `add` stages a symlink as
 * its target path rather than the bytes it points at. The credential half is
 * `scanText` unchanged, so the patterns and the `canon-allow-secret` marker
 * answer here exactly as they do in `canon secrets scan`.
 */
export async function guardPayload(
  tree: string,
  paths: readonly string[],
): Promise<BlockedPath[]> {
  const blocked: BlockedPath[] = []

  for (const path of paths) {
    const full = join(tree, path)
    const stats = await lstat(full).catch(() => undefined)
    if (!stats?.isFile()) continue

    if (stats.size > MAX_RECORD_BYTES) {
      blocked.push({
        path,
        cause: 'oversized',
        detail: `${megabytes(stats.size)}, over the ${megabytes(MAX_RECORD_BYTES)} ceiling`,
      })
      continue
    }

    const text = await readFile(full, 'utf8').catch(() => undefined)
    if (text === undefined || isBinary(text)) continue

    const [first] = scanText(path, text)
    if (first) {
      blocked.push({
        path,
        cause: 'credential',
        detail: `${first.label} at line ${first.line}`,
      })
    }
  }

  return blocked
}
