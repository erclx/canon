/**
 * The move of a target's installed rules from the flat `.claude/rules/<subdir>/`
 * layout onto `.claude/rules/canon/<subdir>/`.
 *
 * `#1446` gave this repository's own installed tree a `canon/` wrapper and no
 * way for an already-synced target to follow. `canon gov sync` narrowed its
 * walk to that wrapper the same release, so a target still on the flat layout
 * reads back as unstamped rather than as needing this move, and `canon gov
 * install` writes a second copy beside the stale one rather than detecting it.
 * This module is the mover neither of those verbs is.
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
 * The one rule `#1446` renumbered, keyed and valued as `<subdir>/<name>` so a
 * future renumber that also changes subdirectory is representable without a
 * second field. A name match cannot find this rule under its old name, since
 * that name no longer exists in `governance/rules/`, so the table carries the
 * one case a lookup cannot.
 */
export const RENUMBERED_RULES: Readonly<Record<string, string>> = {
  'snippets/505-at-references': 'snippets/600-at-references',
}

/**
 * Rule folders the walk skips by name rather than by content, so the
 * exclusion holds even for a folder the toolkit has not shipped yet.
 * `canon/` and `internal/` are already-migrated destinations, and
 * `project/` is a target's own rules, which this verb never touches.
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
 * Every rule file sitting directly under a flat rule folder. One level for
 * the folder and one glob below it for `*.md`, since `governance/rules/` never
 * nests a rule deeper than its folder, and the flat layout this verb migrates
 * off of mirrors that depth.
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
 * Where a stamp entry exists, an exact hash match is `clean` and any other
 * value is `edited`. Where none exists, a name recognized by the current
 * catalog or the renumber table is read as `clean` too, since nothing on
 * this path suggests an edit, only that a hash cannot confirm one. A name
 * neither source recognizes is `unclaimed`, on the reasoning
 * `misplacedOrphan` in `src/sync/engine.ts` already states for why a mover
 * must not guess who authored a file.
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
 * Where a classified file lands. The renumbered rule reads its destination
 * from the table instead of its own current name, and every other file keeps
 * its current subdirectory with `canon/` inserted ahead of it, rather than
 * recomputing one from the toolkit's current tree, since a subdirectory
 * reconciliation independent of this move is an ordinary sync concern.
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
 * What the move would do, without doing it.
 *
 * A collision is reported by name with neither file touched, and every other
 * planned move proceeds independently rather than the whole run refusing, per
 * the concurrency standard's rule for partial failure in a batched operation.
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
 * The stamp's hashes, re-keyed for every entry this run actually moved and
 * otherwise carried forward only where the file they name still exists. A
 * key surviving neither test is dropped, so the stamp does not accumulate
 * entries for rules that no longer exist.
 *
 * A file that moved on the catalog or renumber-table fallback carries no old
 * key to re-key, since `classifyRule` never required a stamp entry to call it
 * `clean`, so it lands under `canon/` still absent from the map. Hashing it
 * here to fill the gap would record an assumption the stamp never verified as
 * though a sync had confirmed it. That is no regression: the same file was
 * outside the walked root and invisible to `canon gov sync` before this move,
 * so it goes from unattributed to unattributed rather than from attributed to
 * not.
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
 * Writes the plan: every move, then every byte-identical duplicate deleted,
 * then the stamp rewritten from whichever moves actually landed.
 *
 * The stamp keeps the hash the file was recorded with rather than re-hashing
 * current content, which is what keeps an `edited` file reporting `edited` on
 * the next `canon gov sync` instead of silently reading `stale` and losing
 * its own signal that it carries a local change.
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
