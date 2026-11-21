/**
 * The move of a target's installed rules from the flat `.claude/rules/<subdir>/` layout
 * onto `.claude/rules/canon/<subdir>/`. `canon gov sync` walks the wrapper alone, so a
 * flat target reads as unstamped, and `canon gov install` would write a second copy.
 */

import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readdir, rename, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  type DomainHashes,
  hashFile,
  readStamp,
  stampedHashes,
  toStampKey,
  writeStamp,
} from '@/sync/stamp'

/**
 * The one rule the wrapper move renumbered, keyed and valued as `<subdir>/<name>`. A name
 * match cannot find it under a name `governance/rules/` no longer carries.
 */
export const RENUMBERED_RULES: Readonly<Record<string, string>> = {
  'snippets/505-at-references': 'snippets/600-at-references',
}

/**
 * Rule folders the walk skips by name, so the exclusion holds for a folder not yet shipped.
 * `canon/` and `internal/` are migrated destinations, and `project/` is a target's own.
 */
const EXCLUDED_FOLDERS: readonly string[] = ['project', 'canon', 'internal']

/** One flat rule file, before classification. */
export interface FlatRuleFile {
  readonly rel: string
  readonly subdir: string
  readonly name: string
}

function relPath(...segments: readonly string[]): string {
  return segments.join('/')
}

export function flatRulesRoot(target: string): string {
  return join(target, '.claude', 'rules')
}

/**
 * Every rule file sitting directly under a flat rule folder, one level for the folder and
 * one glob below it for `*.md`, since the flat layout mirrors the shipped depth.
 */
export async function walkFlatRules(target: string): Promise<FlatRuleFile[]> {
  const root = flatRulesRoot(target)
  const entries = await readdir(root, { withFileTypes: true }).catch(
    () => undefined,
  )
  if (entries === undefined) return []

  const folders = entries.filter(
    (entry) => entry.isDirectory() && !EXCLUDED_FOLDERS.includes(entry.name),
  )

  const files: FlatRuleFile[] = []
  for (const folder of folders) {
    const glob = new Bun.Glob('*.md')
    for (const name of glob.scanSync({
      cwd: join(root, folder.name),
      onlyFiles: true,
    })) {
      files.push({
        rel: relPath('.claude', 'rules', folder.name, name),
        subdir: folder.name,
        name: name.slice(0, -'.md'.length),
      })
    }
  }

  files.sort((left, right) => left.rel.localeCompare(right.rel))
  return files
}

export type RuleStatus = 'clean' | 'edited'

/**
 * A matching stamp hash is `clean` and any other is `edited`. With no entry, a name the
 * catalog or renumber table recognizes is `clean`, and any other is `unclaimed`, since a
 * mover must not guess who authored a file.
 */
export function classifyRule(
  root: string,
  file: FlatRuleFile,
  hashes: DomainHashes,
  catalog: ReadonlySet<string>,
): RuleStatus | 'unclaimed' {
  const stamped = hashes[toStampKey(file.rel)]
  if (stamped !== undefined) {
    return stamped === hashFile(join(root, file.rel)) ? 'clean' : 'edited'
  }

  const renumberKey = relPath(file.subdir, file.name)
  return catalog.has(file.name) || renumberKey in RENUMBERED_RULES
    ? 'clean'
    : 'unclaimed'
}

/**
 * Where a classified file lands. The renumbered rule reads its destination from the table,
 * and every other file keeps its subdirectory with `canon/` inserted ahead of it.
 */
export function destinationRel(file: FlatRuleFile): string {
  const key = relPath(file.subdir, file.name)
  const [subdir, name] = (RENUMBERED_RULES[key] ?? key).split('/')
  return relPath('.claude', 'rules', 'canon', subdir, `${name}.md`)
}

function sameBytes(left: string, right: string): boolean {
  return readFileSync(left).equals(readFileSync(right))
}

export interface MoveEntry {
  readonly from: string
  readonly to: string
  readonly status: RuleStatus
}

/** A flat file whose destination already holds identical bytes. */
export interface DuplicateEntry {
  readonly path: string
  readonly destination: string
}

/** A flat file whose destination already holds different bytes. Neither side moves. */
export interface CollisionEntry {
  readonly path: string
  readonly destination: string
}

export interface RuleLayoutPlan {
  readonly moves: readonly MoveEntry[]
  readonly duplicates: readonly DuplicateEntry[]
  readonly collisions: readonly CollisionEntry[]
  readonly unclaimed: readonly string[]
}

/**
 * What the move would do, without doing it. A collision is reported by name with neither
 * file touched, and every other planned move proceeds independently.
 */
export function planRuleLayout(
  root: string,
  files: readonly FlatRuleFile[],
  hashes: DomainHashes,
  catalog: ReadonlySet<string>,
): RuleLayoutPlan {
  const moves: MoveEntry[] = []
  const duplicates: DuplicateEntry[] = []
  const collisions: CollisionEntry[] = []
  const unclaimed: string[] = []

  for (const file of files) {
    const status = classifyRule(root, file, hashes, catalog)
    if (status === 'unclaimed') {
      unclaimed.push(file.rel)
      continue
    }

    const destination = destinationRel(file)

    if (existsSync(join(root, destination))) {
      const entry = { path: file.rel, destination }
      if (sameBytes(join(root, file.rel), join(root, destination))) {
        duplicates.push(entry)
      } else {
        collisions.push(entry)
      }
      continue
    }

    moves.push({ from: file.rel, to: destination, status })
  }

  return { moves, duplicates, collisions, unclaimed }
}

/**
 * The stamp's hashes, re-keyed for every entry this run moved and otherwise carried
 * forward only where the file still exists. A catalog-fallback move has no old key and
 * lands unhashed, since hashing it would record what no sync confirmed.
 */
function nextHashes(
  root: string,
  hashes: DomainHashes,
  moved: readonly MoveEntry[],
): DomainHashes {
  const renamed = new Map(
    moved.map((entry) => [toStampKey(entry.from), toStampKey(entry.to)]),
  )
  const next: Record<string, string> = {}

  for (const [key, hash] of Object.entries(hashes)) {
    const movedTo = renamed.get(key)
    if (movedTo !== undefined) {
      next[movedTo] = hash
      continue
    }

    if (existsSync(join(root, key))) next[key] = hash
  }

  return next
}

export interface RuleLayoutResult {
  readonly moved: number
  readonly deleted: number
  readonly failed: readonly string[]
}

/**
 * Writes the plan: every move, then every byte-identical duplicate deleted, then the stamp
 * rewritten. The stamp keeps the recorded hash, so an `edited` file keeps reporting `edited`.
 */
export async function applyRuleLayout(
  root: string,
  plan: RuleLayoutPlan,
  toolkitRoot: string,
): Promise<RuleLayoutResult> {
  let moved = 0
  let deleted = 0
  const failed: string[] = []
  const succeeded: MoveEntry[] = []

  for (const entry of plan.moves) {
    await mkdir(dirname(join(root, entry.to)), { recursive: true })
    const done = await rename(join(root, entry.from), join(root, entry.to))
      .then(() => true)
      .catch(() => false)

    if (done) {
      moved += 1
      succeeded.push(entry)
    } else {
      failed.push(entry.from)
    }
  }

  for (const duplicate of plan.duplicates) {
    const done = await unlink(join(root, duplicate.path))
      .then(() => true)
      .catch(() => false)

    if (done) deleted += 1
    else failed.push(duplicate.path)
  }

  if (succeeded.length > 0 || deleted > 0) {
    const hashes = stampedHashes(readStamp(root), 'governance')
    await writeStamp(
      root,
      { domain: 'governance', toolkitRoot },
      nextHashes(root, hashes, succeeded),
      new Date(),
    )
  }

  return { moved, deleted, failed }
}
