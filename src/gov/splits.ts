import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Held rule basename to the basenames its moved bullets now live in. */
export type Splits = ReadonlyMap<string, readonly string[]>

function splitsPath(root: string): string {
  return join(root, 'governance', 'splits.toml')
}

/**
 * Reads the shipped split ledger. A toolkit without one declares no splits,
 * which leaves every sync silent about partners, the way it was before the
 * ledger existed.
 */
export function loadSplits(root: string): Splits {
  const path = splitsPath(root)
  if (!existsSync(path)) return new Map()

  const parsed = Bun.TOML.parse(readFileSync(path, 'utf8')) as Record<
    string,
    unknown
  >
  const table = parsed.split
  if (typeof table !== 'object' || table === null) return new Map()

  const entries: [string, string[]][] = []
  for (const [held, value] of Object.entries(table)) {
    if (!Array.isArray(value)) continue
    const partners = value.filter(
      (partner): partner is string => typeof partner === 'string',
    )
    if (partners.length > 0) entries.push([held, partners])
  }
  return new Map(entries)
}
