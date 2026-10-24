import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, sep } from 'node:path'
import { execa } from 'execa'
import { resolveExisting } from '@/roots/legacy'
import { formatWritten } from '@/sync/format'
import { recordTarget } from '@/targets/registry'
import { compareVersions, parseVersion } from '@/version/compare'
import { readInstalled } from '@/version/installed'

/**
 * Domains the stamp can record. Governance attributes file by file through
 * the sync engine. Tooling runs its own inject and manifest machinery, so it
 * records the stack chain it resolved, and hashes only the configs a target
 * matched, which is what lets a later write tell a stale copy from an edit.
 *
 * A stamp written before the standards or snippets install channel closed
 * still carries a `standards` or `snippets` record, and one written before the
 * design install retired carries a `design` record. `isStamp` ignores the key,
 * `readStamp` drops it from what it returns, and `sortDomains` drops it from
 * the file on the next write, so the target loses a domain nothing can refresh
 * rather than losing the whole file.
 */
export const STAMP_DOMAINS = ['governance', 'tooling'] as const

export type StampDomain = (typeof STAMP_DOMAINS)[number]

/** What a domain needs to stamp itself: its key, and the clone to date it against. */
export interface StampSource {
  readonly domain: StampDomain
  readonly toolkitRoot: string
}

/** Target-relative posix path to content hash, for one domain. */
export type DomainHashes = Readonly<Record<string, string>>

export const DISPOSITIONS = ['declined', 'customized'] as const

export type Disposition = (typeof DISPOSITIONS)[number]

/**
 * What a project decided about one golden file. `base` is the golden hash a
 * customized file was taken from, so a later scan can tell the copy moved.
 */
export interface DispositionEntry {
  readonly disposition: Disposition
  readonly base?: string
  readonly reason?: string
}

/** Golden posix path to the project's decision about it, for one domain. */
export type DomainDispositions = Readonly<Record<string, DispositionEntry>>

/**
 * One domain's record. The anchor sits here rather than at the top level
 * because domains sync independently, and a shared anchor would let a gov sync
 * advance the revision standards measures its upstream range from.
 */
export interface DomainStamp {
  /** Toolkit revision this domain last synced from. Absent outside a git clone. */
  readonly commit?: string
  /**
   * Newest canon release that has written this domain. A sync deletes an
   * installed file its toolkit does not ship, and a binary older than the one
   * that installed the file cannot tell a retired file from one added after
   * its own release, so this is what it reads before deleting anything.
   * Absent on a stamp written before the field existed.
   */
  readonly version?: string
  readonly syncedAt: string
  readonly files: DomainHashes
  /**
   * Stack names the install resolved. Tooling records the full ancestor chain,
   * nearest stack first, because a stack that extends another cannot be
   * reinstalled from its leaf alone, and a `--skip` run installs fewer layers
   * than the leaf's own chain would reproduce. Governance records the single
   * stack `canon gov install` was given, since `resolveRules` walks its
   * ancestors internally and a reader needs only the leaf to ask it again.
   */
  readonly chain?: readonly string[]
  /**
   * Golden files the project declined or customized. Validated apart from the
   * record, so a malformed map reads as empty rather than failing the stamp
   * and costing every other domain its record.
   */
  readonly dispositions?: DomainDispositions
}

export interface Stamp {
  /** Domains actually stamped in this target, so an unstamped one is legible. */
  readonly covers: readonly StampDomain[]
  readonly domains: Readonly<Partial<Record<StampDomain, DomainStamp>>>
}

/**
 * Where a stamp is written today, `canon/config/config.json`. Named
 * `stampPath` rather than `surfaceStampPath` because the write side has only
 * one current path, unlike the read side's fallback chain below.
 */
export function stampPath(target: string): string {
  return join(target, 'canon', 'config', 'config.json')
}

/**
 * Where the stamp wrote before this move, `.claude/canon/config.json`. Kept
 * for the same reason as the two spellings below: a target stamped under it
 * still carries its config here, and `readStamp` falls back to it.
 */
export function claudeCanonStampPath(target: string): string {
  return join(target, '.claude', 'canon', 'config.json')
}

/**
 * Where `106115ba` moved the stamp from. No migration shipped with that move,
 * so a target stamped before it still carries its config here, and `readStamp`
 * falls back to this path when the current one is absent.
 *
 * The old tool name is deliberate and this path never renames. It names what a
 * target already has on disk, so rewriting it to the current spelling would
 * point the fallback at a file that has never existed anywhere.
 */
export function legacyStampPath(target: string): string {
  // canon-keep-retired
  return join(target, '.claude', 'aitk.json')
}

/**
 * The stamp folder under the retired tool name, which is where every target
 * stamped between `106115ba` and the rename carries its config. Retired for
 * the same reason as the path above and kept readable on the same terms.
 */
export function retiredNameStampPath(target: string): string {
  // canon-keep-retired
  return join(target, '.claude', 'aitk', 'config.json')
}

/**
 * Every spelling a stamp has been written under, current first. The order is
 * the read order, so a target carrying more than one resolves to the newest.
 *
 * The fallback carries no end date. It costs three path reads on a command
 * that already touches the filesystem, and dropping any of them later is a
 * second breaking change aimed at exactly the targets that were slowest to
 * migrate the first time.
 */
export function stampPaths(target: string): readonly [string, ...string[]] {
  return [
    stampPath(target),
    claudeCanonStampPath(target),
    retiredNameStampPath(target),
    legacyStampPath(target),
  ]
}

/**
 * Whether `readStamp` would resolve to a retired path, so a caller can report
 * that a target's config still sits at one. False when no path exists, since
 * there is nothing to migrate off of.
 */
export function isLegacyStamped(target: string): boolean {
  if (
    existsSync(stampPath(target)) ||
    existsSync(claudeCanonStampPath(target))
  ) {
    return false
  }
  return (
    existsSync(retiredNameStampPath(target)) ||
    existsSync(legacyStampPath(target))
  )
}

export function hashContent(content: Buffer | string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`
}

export function hashFile(path: string): string {
  return hashContent(readFileSync(path))
}

/**
 * Keys are stored posix-style so a stamp written on one platform still
 * resolves on another.
 */
export function toStampKey(rel: string): string {
  return rel.split(sep).join('/')
}

/**
 * A missing or corrupt stamp reads as absent rather than failing, which is what
 * keeps every unstamped target on the existing unattributed path.
 *
 * Falls back to the retired path only when the current one does not exist,
 * read only: nothing here migrates a target's config as a side effect of a
 * report. The check is existence rather than a successful parse, so a
 * corrupt current stamp reads as absent rather than silently serving the
 * retired one beside it. `isLegacyStamped` tests the same existence check,
 * which is what keeps the two agreeing on which path a corrupt current file
 * was read from.
 */
export function readStamp(target: string): Stamp | undefined {
  return readStampFile(resolveExisting(stampPaths(target)))
}

function readStampFile(path: string): Stamp | undefined {
  if (!existsSync(path)) return undefined

  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    return isStamp(parsed) ? withoutRetired(parsed) : undefined
  } catch {
    return undefined
  }
}

/**
 * A stamp written before a domain retired still names it until the next write.
 * Filtering here keeps a report on a target that has not synced since from
 * listing a domain nothing can refresh. The file itself is left as it is.
 */
function withoutRetired(stamp: Stamp): Stamp {
  const domains: Partial<Record<StampDomain, DomainStamp>> = {}
  for (const domain of STAMP_DOMAINS) {
    const record = stamp.domains[domain]
    if (record !== undefined) domains[domain] = withValidDispositions(record)
  }

  const covers = Array.isArray(stamp.covers)
    ? stamp.covers.filter((domain) => STAMP_DOMAINS.includes(domain))
    : []

  return { covers, domains }
}

/** The newest canon release that has written this domain, when one was recorded. */
export function stampedVersion(
  stamp: Stamp | undefined,
  domain: StampDomain,
): string | undefined {
  return stamp?.domains[domain]?.version
}

/** The revision this domain last synced from, which bounds its upstream range. */
export function stampedCommit(
  stamp: Stamp | undefined,
  domain: StampDomain,
): string | undefined {
  return stamp?.domains[domain]?.commit
}

export function stampedHashes(
  stamp: Stamp | undefined,
  domain: StampDomain | undefined,
): DomainHashes {
  if (stamp === undefined || domain === undefined) return {}
  return stamp.domains[domain]?.files ?? {}
}

/**
 * The stack chain a domain's install last recorded. An empty result is the
 * state every target predating that domain's chain recording sits in, and a
 * reader treats it as unmeasured rather than as clean.
 */
export function stampedChain(
  stamp: Stamp | undefined,
  domain: StampDomain,
): readonly string[] {
  return stamp?.domains[domain]?.chain ?? []
}

/** The golden files a domain's project declined or customized. */
export function stampedDispositions(
  stamp: Stamp | undefined,
  domain: StampDomain,
): DomainDispositions {
  return stamp?.domains[domain]?.dispositions ?? {}
}

/**
 * Replaces one domain's file hashes and leaves the others, including that
 * domain's own chain, untouched. Domains install and sync independently but
 * share the one file, and a chain an install recorded is a separate fact a
 * later file-only sync must not erase.
 */
export async function writeStamp(
  target: string,
  source: StampSource,
  hashes: DomainHashes,
  now: Date,
): Promise<void> {
  await putDomain(target, source, { files: sortKeys(hashes) }, now)
}

/**
 * Records the stack chain an install resolved, and leaves that domain's file
 * hashes untouched unless `files` is passed. Tooling passes the golden hash of
 * each config the target matches, since it never runs the sync engine.
 * Governance calls it alongside `writeStamp`, since that records its files.
 */
export async function writeChainStamp(
  target: string,
  source: StampSource,
  chain: readonly string[],
  now: Date,
  files?: DomainHashes,
): Promise<void> {
  await putDomain(
    target,
    source,
    {
      chain: [...chain],
      ...(files === undefined ? {} : { files: sortKeys(files) }),
    },
    now,
  )
}

/**
 * Replaces one domain's dispositions and leaves the rest of its record as it
 * was, sync anchor included, since declining a file is not a sync. A domain
 * with no record yet gets one through the ordinary write.
 */
export async function writeDispositions(
  target: string,
  source: StampSource,
  dispositions: DomainDispositions,
  now: Date,
): Promise<void> {
  const previous = readStamp(target)
  const previousRecord = previous?.domains[source.domain]
  if (previousRecord === undefined) {
    await putDomain(target, source, { dispositions }, now)
    return
  }

  const { dispositions: _replaced, ...rest } = previousRecord
  await persist(
    target,
    previous,
    source.domain,
    { ...rest, ...dispositionsField(dispositions) },
    now,
  )
}

async function putDomain(
  target: string,
  source: StampSource,
  payload: Partial<Pick<DomainStamp, 'files' | 'chain' | 'dispositions'>>,
  now: Date,
): Promise<void> {
  const previous = readStamp(target)
  const previousRecord = previous?.domains[source.domain]
  const commit = await toolkitCommit(source.toolkitRoot)
  const version = newerVersion(readInstalled().version, previousRecord?.version)

  const record: DomainStamp = {
    ...(commit === undefined ? {} : { commit }),
    ...(version === undefined ? {} : { version }),
    syncedAt: now.toISOString(),
    files: payload.files ?? previousRecord?.files ?? {},
    ...resolveChainField(payload.chain, previousRecord?.chain),
    ...dispositionsField(
      payload.dispositions ?? previousRecord?.dispositions ?? {},
    ),
  }

  await persist(target, previous, source.domain, record, now)
}

async function persist(
  target: string,
  previous: Stamp | undefined,
  domain: StampDomain,
  record: DomainStamp,
  now: Date,
): Promise<void> {
  const domains = sortDomains({
    ...previous?.domains,
    [domain]: record,
  })

  const stamp: Stamp = {
    covers: STAMP_DOMAINS.filter((domain) => domains[domain] !== undefined),
    domains,
  }

  const path = stampPath(target)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${serializeStamp(stamp)}\n`)

  // The stamp hashes every file but itself, so reshaping it cannot read as
  // drift. Seeds and goldens stay as copied for the opposite reason: their
  // hashes are taken against the source bytes.
  await formatWritten(target, [path])

  // Every install and sync that stamps a target passes through here, which is
  // what makes this the one place the machine-level index can be kept without
  // each command remembering to. Its outcome is dropped rather than reported:
  // the stamp just written is the authoritative record of this install, the
  // index is a cache over every such stamp, and a state folder nobody can
  // write is not a reason to fail a sync that already landed its files.
  recordTarget(target, now)
}

const WIDTH = 80

/**
 * `JSON.stringify` expands every array one element per line, a shape oxfmt and
 * prettier both reject, so a sync with no formatter to run would leave a
 * target's format gate red. This inlines a string array that fits the default
 * print width and expands one that does not, as both formatters would, and
 * leaves objects expanded, which both preserve. Content and key order are
 * `JSON.stringify`'s own.
 */
function serializeStamp(value: unknown): string {
  return serialize(value, 0, 0, true)
}

function serialize(
  value: unknown,
  depth: number,
  taken: number,
  last: boolean,
): string {
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    const inline = JSON.stringify(value).replace(/","/g, '", "')
    // A comma follows every entry but the last of its object, and counts
    // against the width as it does for a formatter.
    return taken + inline.length + (last ? 0 : 1) <= WIDTH
      ? inline
      : expand(value, depth)
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined)
    if (entries.length === 0) return '{}'

    const pad = '  '.repeat(depth + 1)
    const lines = entries.map(([key, child], index) => {
      const head = `${pad}${JSON.stringify(key)}: `
      return `${head}${serialize(child, depth + 1, head.length, index === entries.length - 1)}`
    })
    return `{\n${lines.join(',\n')}\n${'  '.repeat(depth)}}`
  }

  return JSON.stringify(value)
}

function expand(items: readonly string[], depth: number): string {
  const pad = '  '.repeat(depth + 1)
  const lines = items.map((item) => `${pad}${JSON.stringify(item)}`)
  return `[\n${lines.join(',\n')}\n${'  '.repeat(depth)}]`
}

const commitCache = new Map<string, Promise<string | undefined>>()

/**
 * Resolved once per clone per process. A toolkit reached outside a git clone
 * yields no commit, which costs the report its upstream range but not its
 * per-file attribution.
 */
export function toolkitCommit(root: string): Promise<string | undefined> {
  const cached = commitCache.get(root)
  if (cached !== undefined) return cached

  const pending = readCommit(root)
  commitCache.set(root, pending)
  return pending
}

async function readCommit(root: string): Promise<string | undefined> {
  const result = await execa(
    'git',
    ['-C', root, 'rev-parse', '--short', 'HEAD'],
    { reject: false },
  )

  return result.exitCode === 0 && result.stdout.trim() !== ''
    ? result.stdout.trim()
    : undefined
}

/**
 * Keeps the newer of the running release and the one already recorded, so an
 * older binary syncing after a newer one cannot lower the mark and let a later
 * run delete a rule the newer release installed. An unparseable side loses to
 * a parseable one, and a recorded value survives an unreadable manifest.
 */
function newerVersion(
  running: string | undefined,
  recorded: string | undefined,
): string | undefined {
  if (running === undefined) return recorded
  if (recorded === undefined) return running

  const parsedRunning = parseVersion(running)
  const parsedRecorded = parseVersion(recorded)
  if (parsedRecorded === undefined) return running
  if (parsedRunning === undefined) return recorded

  return compareVersions(parsedRecorded, parsedRunning) > 0 ? recorded : running
}

/**
 * A write naming no chain keeps the domain's previous one rather than dropping
 * it, since `writeStamp` and `writeChainStamp` each touch one half of a
 * governance record and neither should erase what the other wrote.
 */
function resolveChainField(
  chain: readonly string[] | undefined,
  previous: readonly string[] | undefined,
): Pick<DomainStamp, 'chain'> {
  const resolved = chain ?? previous
  return resolved === undefined ? {} : { chain: resolved }
}

/** An empty map is left out of the file, as an unrecorded chain is. */
function dispositionsField(
  dispositions: DomainDispositions,
): Pick<DomainStamp, 'dispositions'> {
  return Object.keys(dispositions).length === 0
    ? {}
    : { dispositions: sortKeys(dispositions) }
}

/**
 * Keeps each well-formed entry and drops the rest, so one bad entry costs only
 * itself, and a map that is not an object costs only the map.
 */
function withValidDispositions(record: DomainStamp): DomainStamp {
  const { dispositions, ...rest } = record
  const raw: unknown = dispositions
  if (raw === undefined) return record
  if (!isRecord(raw)) return rest

  return {
    ...rest,
    ...dispositionsField(
      Object.fromEntries(
        Object.entries(raw).filter(([, entry]) => isDispositionEntry(entry)),
      ) as DomainDispositions,
    ),
  }
}

function isDispositionEntry(value: unknown): value is DispositionEntry {
  if (!isRecord(value)) return false
  if (!(DISPOSITIONS as readonly unknown[]).includes(value.disposition)) {
    return false
  }
  if (value.base !== undefined && typeof value.base !== 'string') return false
  return value.reason === undefined || typeof value.reason === 'string'
}

/** Deterministic key order keeps a re-sync diff empty and a merge conflict local. */
function sortKeys<T>(
  entries: Readonly<Record<string, T>>,
): Readonly<Record<string, T>> {
  return Object.fromEntries(
    Object.entries(entries).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  )
}

function sortDomains(
  domains: Partial<Record<StampDomain, DomainStamp>>,
): Partial<Record<StampDomain, DomainStamp>> {
  const sorted: Partial<Record<StampDomain, DomainStamp>> = {}
  for (const domain of STAMP_DOMAINS) {
    const record = domains[domain]
    if (record !== undefined) sorted[domain] = record
  }

  return sorted
}

/**
 * Validates every recognized domain record rather than only the container. A
 * stamp whose domain value is the wrong shape would otherwise reach
 * `attribute`, where a bad hash lookup silently reads as a customization.
 *
 * A key naming no current domain is ignored rather than failing the parse. A
 * target stamped before the standards install channel closed carries one, and
 * rejecting the file would read as unstamped and then drop the three records it
 * does carry on the next write. `sortDomains` retires the key at that write.
 */
function isStamp(value: unknown): value is Stamp {
  if (!isRecord(value) || !isRecord(value.domains)) return false

  return Object.entries(value.domains)
    .filter(([domain]) => (STAMP_DOMAINS as readonly string[]).includes(domain))
    .every(([, record]) => isDomainStamp(record))
}

/**
 * `chain` is optional, which is what keeps a stamp written before tooling
 * joined the domains readable rather than parsing as corrupt and discarding
 * the three records it does carry.
 */
function isDomainStamp(value: unknown): value is DomainStamp {
  if (!isRecord(value) || !isRecord(value.files)) return false
  if (typeof value.syncedAt !== 'string') return false
  if (value.commit !== undefined && typeof value.commit !== 'string') {
    return false
  }
  if (value.version !== undefined && typeof value.version !== 'string') {
    return false
  }
  if (value.chain !== undefined && !isStringArray(value.chain)) return false

  return Object.values(value.files).every((hash) => typeof hash === 'string')
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
