import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, sep } from 'node:path'
import { execa } from 'execa'
import { recordTarget } from '@/targets/registry'

/**
 * Domains the stamp can record. Governance and design both attribute file by
 * file through the sync engine. Tooling runs its own inject and manifest
 * machinery, so it records the stack chain it resolved instead and carries no
 * file hashes.
 *
 * A stamp written before the standards or snippets install channel closed
 * still carries a `standards` or `snippets` record. `isStamp` ignores the key
 * and `sortDomains` drops it on the next write, so the target loses a domain
 * nothing can refresh rather than losing the whole file.
 */
export const STAMP_DOMAINS = ['governance', 'design', 'tooling'] as const

export type StampDomain = (typeof STAMP_DOMAINS)[number]

/** What a domain needs to stamp itself: its key, and the clone to date it against. */
export interface StampSource {
  readonly domain: StampDomain
  readonly toolkitRoot: string
}

/** Target-relative posix path to content hash, for one domain. */
export type DomainHashes = Readonly<Record<string, string>>

/**
 * One domain's record. The anchor sits here rather than at the top level
 * because domains sync independently, and a shared anchor would let a gov sync
 * advance the revision standards measures its upstream range from.
 */
export interface DomainStamp {
  /** Toolkit revision this domain last synced from. Absent outside a git clone. */
  readonly commit?: string
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
}

export interface Stamp {
  /** Domains actually stamped in this target, so an unstamped one is legible. */
  readonly covers: readonly StampDomain[]
  readonly domains: Readonly<Partial<Record<StampDomain, DomainStamp>>>
}

export function stampPath(target: string): string {
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
 * The stamp path under the new surface root, `canon/config/config.json`.
 *
 * Read ahead of `stampPath`, extending the same mechanism rather than adding a
 * new one: a target that has moved reads its config from the root it moved
 * to, and one that has not falls through to the spellings below unchanged.
 * The write destination does not move to it in this batch.
 */
function surfaceStampPath(target: string): string {
  return join(target, 'canon', 'config', 'config.json')
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
export function stampPaths(target: string): readonly string[] {
  return [
    surfaceStampPath(target),
    stampPath(target),
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
  if (existsSync(surfaceStampPath(target)) || existsSync(stampPath(target))) {
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
  const found = stampPaths(target).find((path) => existsSync(path))
  return found === undefined ? undefined : readStampFile(found)
}

function readStampFile(path: string): Stamp | undefined {
  if (!existsSync(path)) return undefined

  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    return isStamp(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
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
 * Records the stack chain an install resolved and leaves that domain's file
 * hashes untouched. Tooling calls this with no files ever recorded, since
 * `src/tooling/` never runs the sync engine and the chain is its whole record.
 * Governance calls it alongside `writeStamp`, since it records both.
 */
export async function writeChainStamp(
  target: string,
  source: StampSource,
  chain: readonly string[],
  now: Date,
): Promise<void> {
  await putDomain(target, source, { chain: [...chain] }, now)
}

async function putDomain(
  target: string,
  source: StampSource,
  payload: Partial<Pick<DomainStamp, 'files' | 'chain'>>,
  now: Date,
): Promise<void> {
  const previous = readStamp(target)
  const previousRecord = previous?.domains[source.domain]
  const commit = await toolkitCommit(source.toolkitRoot)

  const record: DomainStamp = {
    ...(commit === undefined ? {} : { commit }),
    syncedAt: now.toISOString(),
    files: payload.files ?? previousRecord?.files ?? {},
    ...resolveChainField(payload.chain, previousRecord?.chain),
  }

  const domains = sortDomains({
    ...previous?.domains,
    [source.domain]: record,
  })

  const stamp: Stamp = {
    covers: STAMP_DOMAINS.filter((domain) => domains[domain] !== undefined),
    domains,
  }

  const path = stampPath(target)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(stamp, null, 2)}\n`)

  // Every install and sync that stamps a target passes through here, which is
  // what makes this the one place the machine-level index can be kept without
  // each command remembering to. Its outcome is dropped rather than reported:
  // the stamp just written is the authoritative record of this install, the
  // index is a cache over every such stamp, and a state folder nobody can
  // write is not a reason to fail a sync that already landed its files.
  recordTarget(target, now)
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

/** Deterministic key order keeps a re-sync diff empty and a merge conflict local. */
function sortKeys(hashes: DomainHashes): DomainHashes {
  return Object.fromEntries(
    Object.entries(hashes).sort(([left], [right]) => left.localeCompare(right)),
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
  if (value.chain !== undefined && !isStringArray(value.chain)) return false

  return Object.values(value.files).every((hash) => typeof hash === 'string')
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
