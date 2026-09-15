/**
 * How a folder under `.canon/evidence/` is numbered, shared by the two
 * migrations that land folders there.
 *
 * A folder takes `<nn>-<slug>` in the order folders first appeared, and a new
 * one continues past the highest ordinal already present. No record folder is
 * tracked in git, so file modification times are the only history a target
 * holds to order by.
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { extractOrdinal } from '@/intake/folder'

const ORDINAL_WIDTH = 2

/**
 * When a folder first appeared, read as the oldest modification time of any
 * file under it. A folder holding no file falls back to its own.
 */
export function firstAppearance(dir: string): number {
  let oldest = Number.POSITIVE_INFINITY

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    const time = entry.isDirectory()
      ? firstAppearance(path)
      : statSync(path).mtimeMs
    oldest = Math.min(oldest, time)
  }

  return Number.isFinite(oldest) ? oldest : statSync(dir).mtimeMs
}

/** The folder names directly inside `dir`, sorted, or none when it is absent. */
export function folderNames(dir: string): string[] {
  if (!existsSync(dir)) return []

  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

/** A folder name with any leading ordinal removed. */
export function slugOf(name: string): string {
  const ordinal = extractOrdinal(name)
  return ordinal === '' ? name : name.slice(ordinal.length + 1)
}

/** The ordinal a new folder takes after every name already present. */
export function nextOrdinal(existing: readonly string[]): number {
  return (
    existing
      .map((name) => Number(extractOrdinal(name) || 0))
      .reduce((carry, ordinal) => Math.max(carry, ordinal), 0) + 1
  )
}

/** The folder name an ordinal and a slug make together. */
export function numberedName(ordinal: number, slug: string): string {
  return `${String(ordinal).padStart(ORDINAL_WIDTH, '0')}-${slug}`
}

/**
 * Orders candidate folders by first appearance, breaking an exact tie on the
 * name so two runs over one tree number it the same way.
 */
export function byFirstAppearance<T extends { name: string; dir: string }>(
  folders: readonly T[],
): T[] {
  return folders
    .map((folder) => ({ folder, appeared: firstAppearance(folder.dir) }))
    .sort(
      (a, b) =>
        a.appeared - b.appeared || a.folder.name.localeCompare(b.folder.name),
    )
    .map(({ folder }) => folder)
}
