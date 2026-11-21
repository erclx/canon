import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import type { AuditedFolder } from '@/context/folders'

const ENTRY_LINK = /^-\s+\[[^\]]*\]\(([^)]+)\)/

export interface FolderDrift {
  readonly rel: string
  /** Entry files present in the folder that the index does not link. */
  readonly unlisted: readonly string[]
  /** Names the index links that resolve to nothing on disk. */
  readonly missing: readonly string[]
}

/** Collects the link targets of an index's catalog bullets. */
export function listedTargets(source: string): string[] {
  const targets: string[] = []

  for (const line of source.split('\n')) {
    const match = line.match(ENTRY_LINK)
    if (match) targets.push(match[1])
  }

  return targets
}

/**
 * Compares one folder's index against its siblings in both directions. An
 * unlisted entry is invisible to a session choosing what to open, and a listed
 * name with no file sends one to a path that opens nothing.
 */
export async function auditFolder(folder: AuditedFolder): Promise<FolderDrift> {
  const dir = dirname(folder.indexPath)
  const source = await readFile(folder.indexPath, 'utf8')
  const targets = listedTargets(source)

  // A sub-catalog is linked as `<name>/index.md`, so only the leading segment is compared.
  const listed = new Set(targets.map((target) => target.split('/')[0]))

  const unlisted = folder.entries
    .map((path) => basename(path))
    .filter((name) => !listed.has(name))

  const missing = targets.filter((target) => !existsSync(resolve(dir, target)))

  return { rel: folder.rel, unlisted, missing }
}

export async function auditIndexes(
  folders: readonly AuditedFolder[],
): Promise<FolderDrift[]> {
  const drift: FolderDrift[] = []

  for (const folder of folders) {
    drift.push(await auditFolder(folder))
  }

  return drift
}
