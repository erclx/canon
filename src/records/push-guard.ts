import { lstat, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isBinary } from '@/sweep/binary'
import { scanText } from '@/secrets/scan'

/**
 * The largest single record a push carries, in bytes. A constant rather than a flag, sitting
 * well clear of GitHub's 100 MB blob limit, since an override is one nobody remembers to pass.
 */
export const MAX_RECORD_BYTES = 25 * 1024 * 1024

export interface BlockedPath {
  readonly path: string
  readonly cause: 'credential'
  /** `<label> at line <n>`, never the matched value or a preview of it. */
  readonly detail: string
}

export interface SkippedPath {
  readonly path: string
  readonly bytes: number
}

/** Kept apart, since a credential refuses the push and an oversized file only stays behind. */
export interface PayloadVerdict {
  readonly credentials: readonly BlockedPath[]
  readonly oversized: readonly SkippedPath[]
}

/**
 * Every pending path a push must not carry, in the order given. An oversized file is never opened, and a non-regular file is skipped. The credential half is
 * `scanText` unchanged, so the patterns and the `canon-allow-secret` marker
 * answer here exactly as they do in `canon secrets scan`.
 */
export async function guardPayload(
  tree: string,
  paths: readonly string[],
): Promise<PayloadVerdict> {
  const credentials: BlockedPath[] = []
  const oversized: SkippedPath[] = []

  for (const path of paths) {
    const full = join(tree, path)
    const stats = await lstat(full).catch(() => undefined)
    if (!stats?.isFile()) continue

    if (stats.size > MAX_RECORD_BYTES) {
      oversized.push({ path, bytes: stats.size })
      continue
    }

    const text = await readFile(full, 'utf8').catch(() => undefined)
    if (text === undefined || isBinary(text)) continue

    const [first] = scanText(path, text)
    if (first) {
      credentials.push({
        path,
        cause: 'credential',
        detail: `${first.label} at line ${first.line}`,
      })
    }
  }

  return { credentials, oversized }
}
