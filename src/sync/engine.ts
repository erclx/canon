import { existsSync, readFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import { copyPreservingMode } from '@/copy'
import { checkoutMismatchWarning } from '@/project-root'
import { findInstalledOrigin, readHistoryIndex } from '@/sync/history'
import {
  type DomainHashes,
  hashFile,
  readStamp,
  type Stamp,
  type StampDomain,
  type StampSource,
  stampedHashes,
  stampedVersion,
  toStampKey,
  writeStamp,
} from '@/sync/stamp'
import { isDirectory } from '@/target'
import {
  intro,
  isNonInteractive,
  logAdd,
  logError,
  logInfo,
  logStep,
  logWarn,
  outro,
  palette,
  select,
} from '@/ui'
import { compareVersions, parseVersion } from '@/version/compare'
import { readInstalled, UNKNOWN_LABEL } from '@/version/installed'

/**
 * One installed file in three path flavours: absolute, relative to the
 * domain's installed root, and relative to the target. Adapters match on
 * `relToRoot` and every log line prints `rel`.
 */
export interface InstalledFile {
  readonly path: string
  readonly relToRoot: string
  readonly rel: string
}

export interface RetiredSurface {
  readonly path: string
  readonly rel: string
  readonly notice: string
}

export type SyncChange =
  | {
      readonly kind: 'copy'
      readonly source: string
      readonly dest: string
      readonly rel: string
    }
  | { readonly kind: 'delete'; readonly dest: string; readonly rel: string }

/**
 * How an installed file compares to its toolkit source, and when it differs,
 * who moved it. `stale` and `customized` need the stamp to tell apart, so
 * `drifted` stays the verdict for a difference no stamp covers.
 *
 * `orphaned`, `retired`, and `stranded` all mean the walk found no source, and
 * they are separate because they need different treatment. A project-authored
 * file is orphaned and stays that way forever. A file under a root the toolkit
 * owns outright is retired, since only the toolkit ever wrote there, and a
 * sync deletes it. A stamped file the toolkit no longer installs to is
 * stranded, which is a relocation waiting on a decision.
 *
 * `renamed` is the fourth sourceless state and the only one that installs.
 * It is a retired file whose rule the adapter declares still ships under a
 * new name, so the sync deletes the old file and copies the rule to the new
 * one.
 *
 * `missing` is the one state the walk cannot produce on its own, since the
 * walk only iterates files that exist. It comes from `collectMissing`
 * instead, an adapter naming an entitled file the target does not hold.
 */
export type EntryState =
  | 'matching'
  | 'stale'
  | 'customized'
  | 'drifted'
  | 'orphaned'
  | 'retired'
  | 'renamed'
  | 'stranded'
  | 'missing'

export interface ScanEntry {
  readonly state: EntryState
  readonly rel: string
  /** Toolkit revision this file's content came from, when history proved it. */
  readonly since?: string
  /**
   * Overrides `report`'s generic text for this entry's state. Two producers
   * write one: `collectMissing`, since a stack name is only known to the
   * adapter that resolved it, and an orphan sitting outside the declared
   * project subfolder, since the generic line names no destination.
   */
  readonly notice?: string
}

export interface SyncPlan {
  readonly entries: readonly ScanEntry[]
  readonly retired: readonly RetiredSurface[]
  readonly changes: readonly SyncChange[]
  /** Set when a file needed history to attribute it and this toolkit has none. */
  readonly historyUnavailable: boolean
}

/**
 * What a headless run does once the plan has changes. Domains whose files the
 * toolkit owns apply them. Domains whose files a project is expected to edit
 * refuse, because an unattended overwrite of a customized file is data loss
 * with no prompt in front of it.
 */
export type NonInteractivePolicy =
  | { readonly kind: 'apply' }
  | {
      readonly kind: 'refuse'
      readonly message: string
      readonly hint: string
    }

/**
 * The two holes every domain sync leaves open: where a destination file's
 * source lives, and what counts as a change beyond a plain content diff.
 * Everything else in a sync is identical across domains,
 * so it lives in the engine.
 *
 * The optional members exist because one adapter needed each of them. Leaving
 * all three unset reproduces the behavior gov already had.
 */
export interface SyncAdapter {
  readonly banner: string
  /** Rendered as `Scanning <label>`. */
  readonly label: string
  readonly missingMessage: string
  /** Noun for the completion count, e.g. `changes`. */
  readonly unit: string
  installedRoot(target: string): string
  locateSource(file: InstalledFile): string | undefined
  /** Surfaces the file walk cannot see, such as a retired doc to delete. */
  collectRetired?(target: string): RetiredSurface[]
  /**
   * Entitled files the walk cannot see because they do not exist yet.
   * Reported as `missing` and queued as no change, since installing one
   * changes what the project is governed by and stays a separate command.
   */
  collectMissing?(target: string): RetiredSurface[]
  /** Dropped from the walk, so neither matching nor orphaned. */
  isExcluded?(file: InstalledFile): boolean
  /** Glob the walk lists. Defaults to `DEFAULT_INSTALL_PATTERN`. */
  readonly installPattern?: string
  /**
   * Top-level folder under `installedRoot` that is project-authored by
   * location rather than by the name inference `locateSource` runs.
   * Checked before `locateSource`, so a file here is orphaned even when its
   * name also matches a toolkit source, and never enters the stamp.
   *
   * Declaring it also gives the report a destination to name when the name
   * inference orphans a file sitting anywhere else.
   */
  readonly projectSubdir?: string
  /**
   * Every file under `installedRoot` is the toolkit's, so a walked file with
   * no source is a leftover of a rule the toolkit retired or renamed rather
   * than something a project wrote. Setting it turns that file into a
   * `retired` entry and queues its delete, edited or not, whatever the stamp
   * holds, or a `renamed` one when `locateSuccessor` names where it ships
   * now. Unset, the file stays `orphaned` and untouched.
   */
  readonly ownsInstalledRoot?: boolean
  /**
   * Where a sourceless file's rule ships now, when the toolkit declares it
   * renamed rather than retired. Reached only on a root the adapter owns and
   * never past the newer-install guard. Unset, or returning nothing, leaves
   * the file `retired`.
   */
  locateSuccessor?(
    file: InstalledFile,
    target: string,
  ): { readonly source: string; readonly dest: string } | undefined
  /** Defaults to applying. */
  readonly nonInteractive?: NonInteractivePolicy
  /** Runs on a completed sync, including one with no changes. */
  onComplete?(target: string): Promise<void>
  /** Where this domain's hashes are stamped. Unset domains go unstamped. */
  readonly stamp?: StampSource
}

/**
 * What a domain installs, when it installs something other than markdown.
 * Design ships a stylesheet, and every other domain ships prose.
 */
export const DEFAULT_INSTALL_PATTERN = '**/*.md'

/**
 * Lists installed files matching the domain's pattern, dotfiles included.
 * `Bun.Glob` skips entries beginning with a dot unless `dot` is set, and every
 * domain installs under `.claude/`, so a nested dot-directory would silently
 * drop out of the walk.
 */
export function listInstalled(
  root: string,
  target: string,
  pattern: string = DEFAULT_INSTALL_PATTERN,
): InstalledFile[] {
  if (!existsSync(root)) return []

  return [
    ...new Bun.Glob(pattern).scanSync({
      cwd: root,
      onlyFiles: true,
      dot: true,
    }),
  ]
    .sort()
    .map((relToRoot) => {
      const path = resolve(root, relToRoot)
      return { path, relToRoot, rel: relative(target, path) }
    })
}

/**
 * Classifies every installed file against its source without writing anything.
 * A file with no source is deleted only when the adapter owns its installed
 * root outright, and left alone otherwise, which is what keeps a
 * project-authored file alive across a sync of a root the project shares.
 */
export function planSync(adapter: SyncAdapter, target: string): SyncPlan {
  const entries: ScanEntry[] = []
  const changes: SyncChange[] = []
  const unattributed: UnattributedFile[] = []

  const stamp = readStamp(target)
  const hashes = stampedHashes(stamp, adapter.stamp?.domain)
  const newerInstall = newerInstallingVersion(stamp, adapter.stamp?.domain)
  const walked = new Set<string>()
  const pendingCopies = new Set<string>()

  for (const file of listInstalled(
    adapter.installedRoot(target),
    target,
    adapter.installPattern,
  )) {
    if (adapter.isExcluded?.(file) === true) continue
    walked.add(toStampKey(file.rel))

    if (isProjectAuthored(adapter, file)) {
      entries.push({ state: 'orphaned', rel: file.rel })
      continue
    }

    const source = adapter.locateSource(file)

    if (source === undefined || !existsSync(source)) {
      if (adapter.ownsInstalledRoot !== true) {
        entries.push(misplacedOrphan(adapter, target, file))
        continue
      }

      if (newerInstall !== undefined) {
        entries.push(heldForNewerInstall(file, newerInstall))
        continue
      }

      const successor = adapter.locateSuccessor?.(file, target)
      if (successor === undefined) {
        entries.push({
          state: 'retired',
          rel: file.rel,
          notice: `${file.rel} (no longer shipped by the toolkit, removing)`,
        })
        changes.push({ kind: 'delete', dest: file.path, rel: file.rel })
        continue
      }

      const destRel = relative(target, successor.dest)
      entries.push({
        state: 'renamed',
        rel: file.rel,
        notice: renamedNotice(file, destRel, attribute(hashes, file)),
      })

      // A second predecessor of one successor, or a successor the target
      // already holds, still loses its old file but must not overwrite.
      if (!existsSync(successor.dest) && !pendingCopies.has(successor.dest)) {
        pendingCopies.add(successor.dest)
        changes.push({
          kind: 'copy',
          source: successor.source,
          dest: successor.dest,
          rel: destRel,
        })
      }
      changes.push({ kind: 'delete', dest: file.path, rel: file.rel })
      continue
    }

    if (sameContent(source, file.path)) {
      entries.push({ state: 'matching', rel: file.rel })
      continue
    }

    const state = attribute(hashes, file)
    if (state === 'drifted') {
      unattributed.push({ index: entries.length, source, path: file.path })
    }

    entries.push({ state, rel: file.rel })
    changes.push({
      kind: 'copy',
      source,
      dest: file.path,
      rel: file.rel,
    })
  }

  const historyUnavailable = recoverAttribution(adapter, entries, unattributed)

  entries.push(...strandedByRelocation(target, hashes, walked))

  for (const surface of adapter.collectMissing?.(target) ?? []) {
    entries.push({ state: 'missing', rel: surface.rel, notice: surface.notice })
  }

  const retired = adapter.collectRetired?.(target) ?? []
  for (const surface of retired) {
    changes.push({ kind: 'delete', dest: surface.path, rel: surface.rel })
  }

  return { entries, retired, changes, historyUnavailable }
}

interface UnattributedFile {
  readonly index: number
  readonly source: string
  readonly path: string
}

/**
 * Second pass over the files the stamp could not attribute, which is every file
 * in a target installed before stamping shipped. Matching the installed content
 * against the toolkit's own history recovers the fact a stamp would have held,
 * and a file matching no published version stays unattributed.
 *
 * Runs as one git call for the whole domain rather than one per file, and only
 * when the first pass left something to attribute. Reports whether history was
 * readable at all, so a registry install can say why it fell short instead of
 * reporting every file as a local edit.
 */
function recoverAttribution(
  adapter: SyncAdapter,
  entries: ScanEntry[],
  unattributed: readonly UnattributedFile[],
): boolean {
  const toolkitRoot = adapter.stamp?.toolkitRoot
  if (toolkitRoot === undefined || unattributed.length === 0) return false

  const index = readHistoryIndex(
    toolkitRoot,
    unattributed.map((file) => relative(toolkitRoot, file.source)),
  )

  if (index === undefined) return true

  for (const file of unattributed) {
    const since = findInstalledOrigin(
      index,
      relative(toolkitRoot, file.source),
      file.path,
    )

    if (since === undefined) continue
    entries[file.index] = { ...entries[file.index], state: 'stale', since }
  }

  return false
}

export async function applyChanges(
  changes: readonly SyncChange[],
): Promise<void> {
  logStep('Applying changes')

  for (const change of changes) {
    if (change.kind === 'copy') {
      await copyPreservingMode(change.source, change.dest)
      logAdd(change.rel)
      continue
    }

    await rm(change.dest, { force: true })
    logWarn(`removed ${change.rel}`)
  }
}

export interface SyncRunOptions {
  /** Path the sync refuses to run against, normally the toolkit root. */
  readonly protectedRoot: string
}

/**
 * Runs one domain sync end to end and returns the process exit code. Callers
 * register a command, build an adapter, and hand both to this function.
 */
export async function runDomainSync(
  adapter: SyncAdapter,
  target: string,
  options: SyncRunOptions,
): Promise<number> {
  intro(adapter.banner)

  const mismatch = checkoutMismatchWarning(process.cwd())
  if (mismatch !== undefined) logWarn(mismatch)

  const resolved = resolve(target)

  if (!isDirectory(resolved)) {
    logError(`Target directory not found: ${target}`)
    outro()
    return 1
  }

  if (resolved === options.protectedRoot) {
    logError(
      'Cannot run against toolkit root. Files here are the source of truth.',
    )
    outro()
    return 1
  }

  const plan = planSync(adapter, resolved)
  const { GREEN, GREY, NC } = palette(process.stderr)

  if (
    !existsSync(adapter.installedRoot(resolved)) &&
    plan.retired.length === 0
  ) {
    logWarn(adapter.missingMessage)
    outro()
    return 0
  }

  report(adapter, plan)

  const count = plan.changes.length
  if (count === 0) {
    await adapter.onComplete?.(resolved)
    await recordStamp(adapter, resolved, new Date())
    outro()
    process.stderr.write(`${GREEN}✓ Everything up to date${NC}\n`)
    return 0
  }

  const policy = adapter.nonInteractive ?? { kind: 'apply' }
  if (
    policy.kind === 'refuse' &&
    isNonInteractive() &&
    hasUnattributedDrift(plan)
  ) {
    logWarn(policy.message)
    logInfo(policy.hint)
    outro()
    return 0
  }

  const shouldApply = await select({
    message: `Apply ${count} changes?`,
    options: [
      { value: true, label: 'Apply all' },
      { value: false, label: 'Cancel' },
    ],
    nonInteractiveDefault: true,
  })

  if (!shouldApply) {
    logWarn('Sync cancelled')
    outro()
    return 0
  }

  await applyChanges(plan.changes)
  await adapter.onComplete?.(resolved)
  await recordStamp(adapter, resolved, new Date())

  outro()
  process.stderr.write(
    `${GREEN}✓ Sync complete${NC} ${GREY}(${count} ${adapter.unit})${NC}\n`,
  )
  return 0
}

/**
 * Reports in walk order rather than grouped by state, so a long rule tree
 * reads as a directory listing with drift called out in place.
 */
function report(adapter: SyncAdapter, plan: SyncPlan): void {
  logStep(`Scanning ${adapter.label}`)

  for (const entry of plan.entries) {
    if (entry.state === 'matching') logInfo(entry.rel)
    else if (entry.state === 'drifted') logWarn(entry.rel)
    else if (entry.state === 'stale')
      logWarn(
        entry.since === undefined
          ? `${entry.rel} (toolkit updated)`
          : `${entry.rel} (toolkit updated since ${entry.since.slice(0, 7)})`,
      )
    else if (entry.state === 'customized')
      logWarn(`${entry.rel} (locally customized)`)
    else if (entry.state === 'retired')
      logWarn(entry.notice ?? `${entry.rel} (no longer shipped by the toolkit)`)
    else if (entry.state === 'renamed')
      logWarn(entry.notice ?? `${entry.rel} (renamed by the toolkit)`)
    else if (entry.state === 'stranded')
      logWarn(`${entry.rel} (installed here by an older toolkit, now moved)`)
    else if (entry.state === 'missing')
      logWarn(
        entry.notice ?? `${entry.rel} (listed by the stack, not installed)`,
      )
    else
      logWarn(entry.notice ?? `${entry.rel} (not in toolkit source, skipping)`)
  }

  for (const surface of plan.retired) {
    logWarn(surface.notice)
  }

  if (plan.historyUnavailable) {
    logWarn(
      'Attribution unavailable: this toolkit has no git history to match against.',
    )
  }
}

function sameContent(left: string, right: string): boolean {
  return readFileSync(left).equals(readFileSync(right))
}

/**
 * Splits a difference by cause. Matching the stamp means the file is untouched
 * since install and the toolkit is what moved, so the update is mechanical.
 * Anything else is a local edit, and an uncovered file stays unattributed.
 */
function attribute(hashes: DomainHashes, file: InstalledFile): EntryState {
  const stamped = hashes[toStampKey(file.rel)]
  if (stamped === undefined) return 'drifted'

  return stamped === hashFile(file.path) ? 'stale' : 'customized'
}

/**
 * Stamped paths the walk never reached, because the toolkit installs to a root
 * it no longer uses. Reporting them is what makes a relocation visible instead
 * of silent. They are left alone, and queue no change.
 *
 * A key escaping the target is dropped rather than reported, so a hand-edited
 * stamp cannot make the report name paths outside the project.
 */
function strandedByRelocation(
  target: string,
  hashes: DomainHashes,
  walked: ReadonlySet<string>,
): ScanEntry[] {
  const entries: ScanEntry[] = []

  for (const key of Object.keys(hashes).sort()) {
    if (walked.has(key)) continue

    const path = resolve(target, key)
    if (!isInside(target, path) || !existsSync(path)) continue

    entries.push({ state: 'stranded', rel: relative(target, path) })
  }

  return entries
}

/**
 * `Bun.Glob` reports `relToRoot` with `/` separators regardless of platform,
 * so the declared subfolder is compared against the walk's first segment
 * rather than through a path-aware join.
 */
function isProjectAuthored(adapter: SyncAdapter, file: InstalledFile): boolean {
  if (adapter.projectSubdir === undefined) return false
  return file.relToRoot.split('/')[0] === adapter.projectSubdir
}

/**
 * An orphan the name inference caught rather than the location test. No source
 * name matched, which is what a project-authored file looks like and also what
 * a file the toolkit shipped and later renamed looks like, so the line offers
 * the destination on a condition rather than asserting who wrote the file.
 * Moving a toolkit leftover into the project subfolder would mark it the
 * project's permanently, and only the operator can tell the two apart.
 *
 * The stamp cannot tell them apart either. `recordStamp` skips a file whose
 * source is gone and `writeStamp` replaces the domain's whole `files` map, so
 * a renamed rule's entry survives exactly one sync past the rename, and a
 * target installed before stamping shipped has no entry to read at all.
 *
 * Naming the destination is all this does. Moving the file rewrites a path the
 * project's own rules, skills, and docs may cite, so the sync leaves it where
 * it is.
 *
 * An adapter declaring `ownsInstalledRoot` never reaches this, since owning
 * the root answers the question neither the name nor the stamp can, and its
 * sourceless file is retired instead.
 */
function misplacedOrphan(
  adapter: SyncAdapter,
  target: string,
  file: InstalledFile,
): ScanEntry {
  const subdir = adapter.projectSubdir
  if (subdir === undefined) return { state: 'orphaned', rel: file.rel }

  const belongs = relative(
    target,
    resolve(adapter.installedRoot(target), subdir, file.relToRoot),
  )

  return {
    state: 'orphaned',
    rel: file.rel,
    notice: `${file.rel} (not in toolkit source, skipping. Move it to ${belongs} if the project authored it.)`,
  }
}

/**
 * The release that last wrote this domain, when it is newer than the one
 * running. A binary older than that release cannot tell a rule it retired
 * from one added after it, so it holds every sourceless file rather than
 * deleting rules the newer release installed. An unparseable side holds too,
 * since deleting on a comparison that never ran is the failure this guards.
 * A stamp with no version predates the field and is never newer.
 */
function newerInstallingVersion(
  stamp: Stamp | undefined,
  domain: StampDomain | undefined,
): { readonly stamped: string; readonly running: string } | undefined {
  if (domain === undefined) return undefined

  const stamped = stampedVersion(stamp, domain)
  if (stamped === undefined) return undefined

  const running = readInstalled().version ?? UNKNOWN_LABEL
  const parsedStamped = parseVersion(stamped)
  const parsedRunning = parseVersion(running)

  if (
    parsedStamped !== undefined &&
    parsedRunning !== undefined &&
    compareVersions(parsedStamped, parsedRunning) <= 0
  ) {
    return undefined
  }

  return { stamped, running }
}

/**
 * The new name gets the toolkit's source rather than the old file's content,
 * so a local edit is dropped the way a retire drops one. With no stamp the
 * edit cannot be proven either way, so the line hedges rather than asserts.
 */
function renamedNotice(
  file: InstalledFile,
  destRel: string,
  state: EntryState,
): string {
  const base = `${file.rel} (renamed to ${destRel} by the toolkit, moving`
  if (state === 'customized') return `${base}. Local edits were not carried.)`
  if (state === 'drifted') return `${base}. Any local edits were not carried.)`
  return `${base})`
}

function heldForNewerInstall(
  file: InstalledFile,
  versions: { readonly stamped: string; readonly running: string },
): ScanEntry {
  return {
    state: 'orphaned',
    rel: file.rel,
    notice: `${file.rel} (installed by canon ${versions.stamped}, newer than this ${versions.running}. Upgrade canon to sync it.)`,
  }
}

function isInside(target: string, path: string): boolean {
  const rel = relative(target, path)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

/**
 * Drift a refusing domain must not touch unattended. A file proven to match
 * what was installed carries no local edit to lose, so it does not count.
 */
function hasUnattributedDrift(plan: SyncPlan): boolean {
  return plan.entries.some(
    (entry) => entry.state === 'customized' || entry.state === 'drifted',
  )
}

/**
 * Records what the toolkit placed, after the copies land, so a partial apply
 * that throws leaves the previous stamp rather than a claim the target does not
 * meet. A file with no source stays out, whether it is project-authored or a
 * retired leftover a declined sync did not delete, and so does one orphaned by
 * location.
 *
 * Reads the installed tree rather than the caller's file list, so a partial
 * install still stamps the domain's whole installed set.
 */
export async function recordStamp(
  adapter: SyncAdapter,
  target: string,
  now: Date,
): Promise<void> {
  const stampSource = adapter.stamp
  if (stampSource === undefined) return

  const hashes: Record<string, string> = {}

  for (const file of listInstalled(
    adapter.installedRoot(target),
    target,
    adapter.installPattern,
  )) {
    if (adapter.isExcluded?.(file) === true) continue
    if (isProjectAuthored(adapter, file)) continue

    const source = adapter.locateSource(file)
    if (source === undefined || !existsSync(source)) continue

    hashes[toStampKey(file.rel)] = hashFile(file.path)
  }

  await writeStamp(target, stampSource, hashes, now)
}
