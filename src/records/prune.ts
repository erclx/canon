import { existsSync, type Dirent } from 'node:fs'
import { readdir, rm, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { RECORD_LAYOUT_MOVES } from '@/migrate/record-layout'
import { PROMOTED_FOLDERS } from '@/migrate/scratch-evidence'
import { RECORD_ROOTS, recordDir, SCRATCH } from '@/record-root'
import { day, newestMtime } from '@/records/size'

const DAY_MS = 24 * 60 * 60 * 1000

/** The default age a unit must clear before it is offered, in days. */
export const DEFAULT_OLDER_THAN_DAYS = 14

/**
 * Reserved subfolders under scratch. The scratch standard bars a session slug
 * from taking one of these five names, so a top-level entry carrying one is
 * always the reserved folder rather than an ordinary candidate.
 */
const RESERVED = ['runs', 'hooks', 'handoff', 'pr', 'render'] as const

/**
 * Pre-split names `#1695` moved into a reserved subfolder, still sitting at
 * the scratch root on a tree the rename never touched. Reading them as
 * ordinary slugs would offer an unread handoff or the live poll baseline for
 * deletion, the one thing a wrong delete here loses for good.
 */
const LEGACY_MOVES: ReadonlyMap<string, string> = new Map([
  ['memory-routing', 'handoff/memory-routing'],
  ['teach-promotion', 'handoff/teach-promotion'],
  ['ui-checklist', 'handoff/ui-checklist'],
  ['pr-poll', 'pr/poll'],
])

/**
 * Scratch-root names a different migration moves out of scratch for good,
 * derived from that migration's own table rather than duplicated in a second
 * hand-kept list. `RECORD_LAYOUT_MOVES` names `memory-archive`, the
 * retired-entry archive `603-memory` says never to delete, and `PROMOTED_FOLDERS`
 * names an evidence folder a durable record cites by name. A project that has
 * not run either migration still carries these at the scratch root, where an
 * ordinary slug's own age test would eventually offer them.
 */
function migratedScratchNames(): ReadonlyMap<string, string> {
  const names = new Map<string, string>()

  for (const move of RECORD_LAYOUT_MOVES) {
    if (move.from[0] === SCRATCH && move.from.length >= 2) {
      names.set(move.from[1], 'canon migrate record-layout')
    }
  }

  for (const folder of PROMOTED_FOLDERS) {
    names.set(folder, 'canon migrate scratch-evidence')
  }

  return names
}

const MIGRATED_SCRATCH_NAMES = migratedScratchNames()

export interface PruneUnit {
  /** Relative to the project root, at the scratch spelling the project carries. */
  readonly path: string
  readonly files: number
  readonly bytes: number
  /** `YYYY-MM-DD` of the most recently modified file, absent when the unit holds none. */
  readonly newest?: string
}

export interface PruneSkip {
  readonly path: string
  readonly reason: string
}

export interface PruneFailure {
  readonly path: string
  readonly message: string
}

export interface PruneReport {
  readonly ok: true
  readonly root: string
  readonly olderThan: number
  readonly candidates: readonly PruneUnit[]
  readonly kept: readonly PruneUnit[]
  readonly skipped: readonly PruneSkip[]
  readonly deleted: readonly string[]
  readonly failed: readonly PruneFailure[]
}

export const PRUNE_REFUSALS = ['no-folder'] as const

export type PruneRefusal = (typeof PRUNE_REFUSALS)[number]

export interface PruneRefused {
  readonly ok: false
  readonly reason: PruneRefusal
  readonly message: string
}

export type PruneOutcome = PruneReport | PruneRefused

/** A unit still carrying the filesystem paths a write deletes, ahead of the public shape. */
interface RawUnit {
  readonly path: string
  readonly files: number
  readonly bytes: number
  readonly newestMs?: number
  readonly targets: readonly string[]
}

function describeFailure(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

function toPublic(unit: RawUnit): PruneUnit {
  return {
    path: unit.path,
    files: unit.files,
    bytes: unit.bytes,
    newest: unit.newestMs === undefined ? undefined : day(unit.newestMs),
  }
}

/** A unit with no files, empty subfolders included, is offered whatever its age. */
function isPrunable(unit: RawUnit, thresholdMs: number, now: number): boolean {
  if (unit.files === 0) return true
  return unit.newestMs !== undefined && now - unit.newestMs > thresholdMs
}

async function listDir(dir: string): Promise<Dirent[]> {
  return readdir(dir, { withFileTypes: true }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return []
      throw error
    },
  )
}

async function statFile(
  path: string,
): Promise<{ bytes: number; newest: number } | undefined> {
  try {
    const info = await stat(path)
    return { bytes: info.size, newest: info.mtimeMs }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

async function unitFromFolder(
  displayPath: string,
  absPath: string,
): Promise<RawUnit> {
  const info = await newestMtime(absPath)
  return {
    path: displayPath,
    files: info?.files ?? 0,
    bytes: info?.bytes ?? 0,
    newestMs: info?.newest,
    targets: [absPath],
  }
}

async function unitFromFile(
  displayPath: string,
  absPath: string,
): Promise<RawUnit | undefined> {
  const info = await statFile(absPath)
  if (!info) return undefined

  return {
    path: displayPath,
    files: 1,
    bytes: info.bytes,
    newestMs: info.newest,
    targets: [absPath],
  }
}

/** One unit spanning several files, for `pr/review/`'s per-pull-request grouping. */
async function groupedUnit(
  displayPath: string,
  files: readonly string[],
): Promise<RawUnit> {
  const infos = await Promise.all(files.map((path) => statFile(path)))

  let bytes = 0
  let newestMs: number | undefined
  let count = 0

  for (const info of infos) {
    if (!info) continue
    count += 1
    bytes += info.bytes
    newestMs =
      newestMs === undefined ? info.newest : Math.max(newestMs, info.newest)
  }

  return { path: displayPath, files: count, bytes, newestMs, targets: files }
}

/**
 * `pr/review/` groups by pull request rather than reporting as one folder
 * unit, per the prune-tmp plan's Question 3: a review pass leaves one body
 * file per pass, and a folder holding thousands of them would otherwise
 * report as a single row with no way to prune the finished pulls apart from
 * one still open.
 */
async function reviewUnits(
  displayPath: string,
  reviewDir: string,
): Promise<RawUnit[]> {
  const files = await listDir(reviewDir)
  const groups = new Map<string, string[]>()

  for (const file of files) {
    if (!file.isFile()) continue
    const match = /^body-(\d+)-/.exec(file.name)
    const key = match ? match[1] : 'other'
    const list = groups.get(key) ?? []
    list.push(join(reviewDir, file.name))
    groups.set(key, list)
  }

  return Promise.all(
    Array.from(groups.entries(), ([number, paths]) =>
      groupedUnit(`${displayPath}/${number}`, paths),
    ),
  )
}

async function oneHookUnits(
  displayPath: string,
  hookDir: string,
): Promise<RawUnit[]> {
  const markers = await listDir(hookDir)
  const units = await Promise.all(
    markers
      .filter((marker) => marker.isFile())
      .map((marker) =>
        unitFromFile(
          `${displayPath}/${marker.name}`,
          join(hookDir, marker.name),
        ),
      ),
  )

  return units.filter((unit): unit is RawUnit => unit !== undefined)
}

async function hookUnits(
  displayPath: string,
  hooksDir: string,
): Promise<RawUnit[]> {
  const hooks = await listDir(hooksDir)
  const perHook = await Promise.all(
    hooks
      .filter((hook) => hook.isDirectory())
      .map((hook) =>
        oneHookUnits(`${displayPath}/${hook.name}`, join(hooksDir, hook.name)),
      ),
  )

  return perHook.flat()
}

async function onePrSub(
  displayPath: string,
  subDir: string,
  name: string,
): Promise<{ units: RawUnit[]; skipped: PruneSkip[] }> {
  if (name === 'poll') {
    return {
      units: [],
      skipped: [
        { path: displayPath, reason: 'a live poll baseline, never offered' },
      ],
    }
  }

  if (name === 'review') {
    return { units: await reviewUnits(displayPath, subDir), skipped: [] }
  }

  return { units: [await unitFromFolder(displayPath, subDir)], skipped: [] }
}

async function prUnits(
  displayPath: string,
  prDir: string,
): Promise<{
  units: RawUnit[]
  skipped: PruneSkip[]
}> {
  const subs = await listDir(prDir)
  const results = await Promise.all(
    subs
      .filter((sub) => sub.isDirectory())
      .map((sub) =>
        onePrSub(`${displayPath}/${sub.name}`, join(prDir, sub.name), sub.name),
      ),
  )

  return {
    units: results.flatMap((result) => result.units),
    skipped: results.flatMap((result) => result.skipped),
  }
}

async function reservedUnits(
  name: (typeof RESERVED)[number],
  displayPath: string,
  absPath: string,
): Promise<{ units: RawUnit[]; skipped: PruneSkip[] }> {
  if (name === 'handoff') {
    return {
      units: [],
      skipped: [
        {
          path: displayPath,
          reason:
            'a reader deletes a handoff itself, so it is never offered here',
        },
      ],
    }
  }

  if (name === 'hooks') {
    return { units: await hookUnits(displayPath, absPath), skipped: [] }
  }

  if (name === 'pr') {
    return prUnits(displayPath, absPath)
  }

  // 'runs' and 'render': every direct subfolder is one unit.
  const subs = await listDir(absPath)
  const units = await Promise.all(
    subs
      .filter((sub) => sub.isDirectory())
      .map((sub) =>
        unitFromFolder(`${displayPath}/${sub.name}`, join(absPath, sub.name)),
      ),
  )
  return { units, skipped: [] }
}

async function processEntry(
  scratchDisplay: string,
  scratchDir: string,
  name: string,
): Promise<{ units: RawUnit[]; skipped: PruneSkip[] }> {
  const abs = join(scratchDir, name)
  const displayPath = `${scratchDisplay}/${name}`

  const legacyTarget = LEGACY_MOVES.get(name)
  if (legacyTarget !== undefined) {
    return {
      units: [],
      skipped: [
        {
          path: displayPath,
          reason: `moved to ${scratchDisplay}/${legacyTarget}, move or clear it by hand`,
        },
      ],
    }
  }

  const migrationVerb = MIGRATED_SCRATCH_NAMES.get(name)
  if (migrationVerb !== undefined) {
    return {
      units: [],
      skipped: [
        {
          path: displayPath,
          reason: `moves out under a different migration, run ${migrationVerb} to clear it`,
        },
      ],
    }
  }

  if ((RESERVED as readonly string[]).includes(name)) {
    return reservedUnits(name as (typeof RESERVED)[number], displayPath, abs)
  }

  return { units: [await unitFromFolder(displayPath, abs)], skipped: [] }
}

/**
 * Every top-level entry is independent, per the concurrency standard's rule
 * against running independent async work sequentially, so a scratch folder
 * carrying dozens of slugs is walked concurrently rather than one at a time.
 */
async function collectUnits(
  scratchDisplay: string,
  scratchDir: string,
): Promise<{ units: RawUnit[]; skipped: PruneSkip[] }> {
  const entries = await listDir(scratchDir)
  const results = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => processEntry(scratchDisplay, scratchDir, entry.name)),
  )

  return {
    units: results.flatMap((result) => result.units),
    skipped: results.flatMap((result) => result.skipped),
  }
}

async function deleteUnits(
  units: readonly RawUnit[],
): Promise<{ deleted: string[]; failed: PruneFailure[] }> {
  const settled = await Promise.allSettled(
    units.map(async (unit) => {
      await Promise.all(
        unit.targets.map((target) =>
          rm(target, { recursive: true, force: true }),
        ),
      )
      return unit.path
    }),
  )

  const deleted: string[] = []
  const failed: PruneFailure[] = []

  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      deleted.push(result.value)
    } else {
      failed.push({
        path: units[index].path,
        message: describeFailure(result.reason),
      })
    }
  })

  return { deleted, failed }
}

/**
 * Reports scratch nobody has touched inside the age window, and deletes it
 * only when asked.
 *
 * Reads mtime the way `sizeRecords` does, so a machine restored by `canon
 * records pull` reads every file as new and fails safe by offering nothing.
 */
export async function pruneScratch(
  root: string,
  olderThanDays: number,
  write: boolean,
  now: number = Date.now(),
): Promise<PruneOutcome> {
  if (!RECORD_ROOTS.some((name) => existsSync(join(root, name)))) {
    return {
      ok: false,
      reason: 'no-folder',
      message: `No ${RECORD_ROOTS.join(' or ')} directory at ${root}, so there is no scratch folder to prune.`,
    }
  }

  const scratchDir = recordDir(root, SCRATCH)
  const scratchDisplay = relative(root, scratchDir)

  const { units, skipped } = await collectUnits(scratchDisplay, scratchDir)

  const thresholdMs = olderThanDays * DAY_MS
  const prunable = units.filter((unit) => isPrunable(unit, thresholdMs, now))
  const fresh = units.filter((unit) => !isPrunable(unit, thresholdMs, now))

  const { deleted, failed } = write
    ? await deleteUnits(prunable)
    : { deleted: [], failed: [] }

  return {
    ok: true,
    root,
    olderThan: olderThanDays,
    candidates: prunable.map(toPublic),
    kept: fresh.map(toPublic),
    skipped,
    deleted,
    failed,
  }
}
