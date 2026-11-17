import { existsSync } from 'node:fs'
import { basename, join, sep } from 'node:path'
import { execa } from 'execa'
import { gitEnv } from '@/git/env'
import { createGovAdapter } from '@/gov/adapter'
import { successorResolver } from '@/gov/renames'
import { lookupRules } from '@/gov/install'
import { resolveMissingRules, resolveRules } from '@/gov/stacks'
import type { UnwiredHook } from '@/migrate/hook-wiring'
import { readSessionDefaults } from '@/migrate/session-defaults'
import { planSync, type ScanEntry, type SyncAdapter } from '@/sync/engine'
import {
  collectSuperseded,
  detectUnmigrated,
  detectUnmovedSurfaces,
  type SupersededEntry,
  type UnmigratedDomain,
  type UnmovedSurface,
} from '@/sync/layout'
import {
  buildReverseReport,
  emptyReverseReport,
  type ReverseReport,
} from '@/sync/reverse'
import { buildSeedsReport, type SeedsReport } from '@/sync/seeds-report'
import {
  isLegacyStamped,
  readStamp,
  type Stamp,
  stampedChain,
  stampedCommit,
  type StampDomain,
} from '@/sync/stamp'
import { isDirectory } from '@/targets/validate'
import {
  isWholeStack,
  loadManifest,
  type Manifest,
  resolveChain,
} from '@/tooling/manifest'
import { scan } from '@/tooling/scan'
import { isAddOn } from '@/tooling/stamp'
import { readSkew, type SkewReport } from '@/version/skew'

/**
 * Domains the sync engine walks file by file. Tooling is a stamp domain without
 * being one of these, because `src/tooling/` never calls `planSync`, so the
 * three lookups below have no entry to offer it. Standards and snippets left
 * the list with their install channels: nothing writes either corpus into a
 * target, so there is no installed copy to attribute. Design left with its
 * install verb for the same reason.
 */
export const SCANNED_DOMAINS = [
  'governance',
] as const satisfies readonly StampDomain[]

export type ScannedDomain = (typeof SCANNED_DOMAINS)[number]

/**
 * The toolkit path whose commits change what each domain holds. `claude/skills/`
 * is deliberately absent: skills load live from the plugin directory, so they
 * never go stale and belong in the read-only section instead.
 */
const SYNCED_SOURCES: Record<ScannedDomain, string> = {
  governance: 'governance/rules/',
}

const ADAPTERS: Record<ScannedDomain, (root: string) => SyncAdapter> = {
  governance: createGovAdapter,
}

const INSTALL_MARKERS: Record<ScannedDomain, readonly string[]> = {
  governance: ['.claude', 'rules', 'canon'],
}

export interface StateCounts {
  readonly matching: number
  readonly stale: number
  readonly customized: number
  readonly drifted: number
  readonly orphaned: number
  readonly stranded: number
  readonly missing: number
  readonly retired: number
  readonly renamed: number
}

export interface DomainReport {
  readonly domain: ScannedDomain
  readonly stamped: boolean
  /** This domain's own anchor, not the target's most recent sync. */
  readonly commit?: string
  readonly syncedAt?: string
  readonly counts: StateCounts
  readonly entries: readonly ScanEntry[]
  readonly upstream: readonly UpstreamCommit[]
  /**
   * Separates a toolkit that could not attribute from one that attributed and
   * found a local edit. Only the first is a capability the install lacks.
   */
  readonly historyUnavailable: boolean
}

export interface UpstreamCommit {
  readonly sha: string
  readonly subject: string
}

/** Pending changes per category, from the same scan `canon tooling sync` reads. */
/**
 * `customized` counts a customization whose golden copy moved, which no write
 * touches, so a caller points at `canon tooling lift` rather than `--write`.
 */
export interface ToolingCounts {
  readonly configs: number
  readonly customized: number
  readonly seeds: number
  readonly scripts: number
  readonly deps: number
  readonly gitignore: number
}

/**
 * Tooling's own section. `measured` is the field the report exists for: without
 * it a target that never installed tooling and a target whose tooling is current
 * both render as zero changes, which is a claim rather than an absence of one.
 */
export interface ToolingReport {
  readonly measured: boolean
  /**
   * Stack names the install resolved, nearest first. Carried even when the
   * report is unmeasured, so a chain naming stacks this toolkit no longer ships
   * stays distinguishable from a target that recorded none.
   */
  readonly chain: readonly string[]
  readonly commit?: string
  readonly syncedAt?: string
  readonly counts: ToolingCounts
  readonly changes: number
}

const UNMEASURED_TOOLING: ToolingReport = {
  measured: false,
  chain: [],
  counts: {
    configs: 0,
    customized: 0,
    seeds: 0,
    scripts: 0,
    deps: 0,
    gitignore: 0,
  },
  changes: 0,
}

/**
 * Seeded hooks the target holds the script for and its `settings.json` never
 * runs. Read from `settings.json` alone, since Claude Code gitignores
 * `settings.local.json` and CI never sees it. `skipped` covers an unmanaged
 * target and the toolkit root, `absent` a target with no settings file, and
 * `unreadable` a settings file the migrate verb refuses, named in `reason`.
 */
export interface HooksReport {
  readonly state: 'read' | 'absent' | 'unreadable' | 'skipped'
  readonly unwired: readonly UnwiredHook[]
  readonly reason?: string
}

const SKIPPED_HOOKS: HooksReport = { state: 'skipped', unwired: [] }

export async function buildHooksReport(
  toolkitRoot: string,
  target: string,
): Promise<HooksReport> {
  if (target === toolkitRoot) return SKIPPED_HOOKS

  const read = await readSessionDefaults(target, toolkitRoot)
  if (read.kind === 'refused') {
    return { state: 'unreadable', unwired: [], reason: read.reason }
  }
  if (read.kind === 'absent') return { state: 'absent', unwired: read.unwired }
  return { state: 'read', unwired: read.plan.unwired }
}

export interface CheckReport {
  readonly covers: readonly StampDomain[]
  /**
   * True when the stamp `readStamp` found sits at one of the retired paths
   * rather than the current one. Read only: nothing in the check migrates a
   * target's config as a side effect of reporting it.
   *
   * canon-keep-retired
   * The two are `.claude/aitk/config.json` and `.claude/aitk.json`.
   */
  readonly stampAtLegacyPath: boolean
  /** False when the target is not a toolkit project, so every section stays empty. */
  readonly managed: boolean
  readonly domains: readonly DomainReport[]
  /**
   * Reported beside the domains rather than as one of them, because tooling
   * carries no per-file entries and no upstream range, so it fills almost none
   * of `DomainReport`.
   */
  readonly tooling: ToolingReport
  /**
   * Reported beside the domains rather than as one of them, because seeds carry
   * no stamp and produce no change. See `@/sync/seeds-report`.
   */
  readonly seeds: SeedsReport
  readonly superseded: readonly SupersededEntry[]
  readonly unmigrated: readonly UnmigratedDomain[]
  /**
   * Report-only like `superseded`, since a target's CI gating on `--exit-code`
   * would otherwise start failing on a layout nobody asked it to move yet.
   */
  readonly unmovedSurfaces: readonly UnmovedSurface[]
  readonly newSkills: readonly string[]
  /**
   * Rules the toolkit authored after this target's governance anchor, filtered
   * to what the target could receive. It rides beside `newSkills` rather than
   * folding into it because the two answer the same question about different
   * corpora and a reader acting on one runs a different command from the other.
   */
  readonly newRules: readonly string[]
  /**
   * The one section built by walking the target rather than the catalog. It
   * reports beside `superseded`, `unmigrated`, and `newSkills` rather than
   * absorbing them, because each of those already answers a narrower version of
   * the same question correctly. See `@/sync/reverse`.
   */
  readonly reverse: ReverseReport
  readonly hooks: HooksReport
  /**
   * The binary running the check, not the target. It reports on an unmanaged
   * target too, since a reader told to run `canon init` is better off knowing
   * first whether the binary about to install is the current one.
   *
   * `hasDrift` deliberately ignores it. A registry lookup inside a check that
   * gates would fail CI on an offline machine for a condition the check never
   * measured, and the state reaching the reader is the point rather than the
   * exit code.
   */
  readonly skew: SkewReport
}

/**
 * Scanned domains this target should have stamped and has not, which is the
 * one line a domain nobody installed ever appears on.
 *
 * An unmigrated domain is excluded because the relocation is its remedy rather
 * than a sync.
 */
export function uncoveredDomains(report: CheckReport): ScannedDomain[] {
  const unmigrated = new Set(report.unmigrated.map((entry) => entry.domain))

  return SCANNED_DOMAINS.filter(
    (domain) => !report.covers.includes(domain) && !unmigrated.has(domain),
  )
}

export function installedStampDomains(target: string): ScannedDomain[] {
  return SCANNED_DOMAINS.filter((domain) =>
    isDirectory(join(target, ...INSTALL_MARKERS[domain])),
  )
}

/**
 * Reads the chain the install recorded and scans against those stacks rather
 * than re-resolving from the leaf. A run that passed `--skip` installed fewer
 * layers than the leaf's own chain reproduces, so re-resolving would report
 * drift against a layer the target deliberately does not carry.
 *
 * A recorded stack the toolkit no longer ships resolves to nothing, and a chain
 * where none resolve reads as unmeasured. Scanning the survivors would measure
 * against a chain neither side agrees on.
 */
export function buildToolingReport(
  toolkitRoot: string,
  target: string,
  stamp: Stamp | undefined,
): ToolingReport {
  const chain = stampedChain(stamp, 'tooling')
  const manifests = resolveRecorded(toolkitRoot, chain)

  if (manifests.length === 0) return { ...UNMEASURED_TOOLING, chain }

  const result = scan(manifests, target)
  const record = stamp?.domains.tooling

  return {
    measured: true,
    chain,
    commit: record?.commit,
    syncedAt: record?.syncedAt,
    counts: {
      configs: result.configs.filter((entry) => entry.state !== 'matching')
        .length,
      customized: result.dispositions.filter((entry) => entry.moved === true)
        .length,
      seeds: result.seeds.filter((entry) => entry.state === 'missing').length,
      scripts: result.scripts.filter((entry) => entry.state !== 'matching')
        .length,
      deps: result.deps.filter((entry) => entry.state === 'missing').length,
      gitignore: result.gitignore.filter((entry) => entry.state === 'missing')
        .length,
    },
    changes: result.totalChanges,
  }
}

/**
 * Loads each recorded stack whole. When the recorded chain stops short of its
 * last stack's parent, the install skipped that parent, so the chain is
 * re-resolved with it as the skip to bring back any per-root configs the
 * skipped stack still shipped. The re-resolution is kept only when its whole
 * stacks are exactly the recorded ones.
 */
export function resolveRecorded(
  toolkitRoot: string,
  recorded: readonly string[],
): Manifest[] {
  const addOns = recorded
    .map((name) => loadManifest(toolkitRoot, name))
    .filter((manifest) => manifest !== undefined)
    .filter(isAddOn)
  const addOnNames = new Set(addOns.map((manifest) => manifest.name))
  const core = recorded.filter((name) => !addOnNames.has(name))

  return [...resolveCore(toolkitRoot, core), ...addOns]
}

function resolveCore(
  toolkitRoot: string,
  recorded: readonly string[],
): Manifest[] {
  const loaded = recorded
    .map((name) => loadManifest(toolkitRoot, name))
    .filter((manifest) => manifest !== undefined)

  const parent = loaded.at(-1)?.parent
  if (
    loaded.length !== recorded.length ||
    parent === undefined ||
    recorded.includes(parent)
  ) {
    return loaded
  }

  const resolved = resolveChain(toolkitRoot, recorded[0], {
    skipStack: parent,
  })
  const whole = resolved.filter(isWholeStack).map((manifest) => manifest.name)
  return whole.join('\0') === recorded.join('\0') ? resolved : loaded
}

/**
 * Whether the target is a toolkit-managed project at all. Seeds are enumerated
 * from the source, so without this gate an untouched directory reports every
 * seed as `missing`. An unmigrated domain counts as a marker, since
 * `detectUnmigrated` fires only on root files the toolkit ships, proving an
 * install before the layout moved under `.claude/`. Reading markers alone would
 * route the JSON and the rendered half of one report differently.
 */
export function isManagedTarget(
  target: string,
  unmigrated: readonly UnmigratedDomain[],
): boolean {
  if (unmigrated.length > 0) return true

  return (
    isDirectory(join(target, '.claude')) ||
    existsSync(join(target, 'CLAUDE.md'))
  )
}

export function countStates(entries: readonly ScanEntry[]): StateCounts {
  return {
    matching: count(entries, 'matching'),
    stale: count(entries, 'stale'),
    customized: count(entries, 'customized'),
    drifted: count(entries, 'drifted'),
    orphaned: count(entries, 'orphaned'),
    stranded: count(entries, 'stranded'),
    missing: count(entries, 'missing'),
    retired: count(entries, 'retired'),
    renamed: count(entries, 'renamed'),
  }
}

/**
 * Whether the target has diverged from the toolkit in a way a command could
 * close.
 *
 * An unmigrated domain counts, and so do `stale`, `customized`, `drifted`,
 * `stranded`, `retired`, and `renamed` entries. An unwired seeded hook counts,
 * since `canon migrate session-defaults --write` wires it, and so does a
 * settings file that verb cannot read, since a check that cannot see the hooks
 * must not pass. Orphaned files, superseded artifacts, seeds, tooling configs,
 * and the reverse report are excluded, since each is content the project may
 * own and a job counting it stays red with no remedy. `missing` is excluded
 * too, since gating CI on it would press a target into adopting a rule nobody
 * picked, and a deleted hook script never reaches `unwired`, which is how a
 * project opts out of one.
 */
export function hasDrift(report: CheckReport): boolean {
  if (report.unmigrated.length > 0) return true
  if (report.hooks.state === 'unreadable' || report.hooks.unwired.length > 0) {
    return true
  }

  return report.domains.some(
    (domain) =>
      domain.counts.stale +
        domain.counts.customized +
        domain.counts.drifted +
        domain.counts.stranded +
        domain.counts.retired +
        domain.counts.renamed >
      0,
  )
}

/**
 * Bounds each domain's upstream read by that domain's own anchor and its own
 * source path. A shared anchor would let a gov sync advance the revision
 * snippets measures from, silently dropping a snippets change out of the read.
 */
export async function buildCheckReport(
  toolkitRoot: string,
  target: string,
): Promise<CheckReport> {
  const stamp = readStamp(target)

  // Started before the local scan and awaited after it, so the network wait
  // overlaps work the report needs anyway rather than adding to it.
  const skewRead = readSkew()

  const domains = await Promise.all(
    installedStampDomains(target).map((domain) =>
      buildDomainReport(toolkitRoot, target, stamp, domain),
    ),
  )

  const anchors = domains
    .map((domain) => domain.commit)
    .filter((commit): commit is string => commit !== undefined)

  const unmigrated = detectUnmigrated(toolkitRoot, target)
  const managed = isManagedTarget(target, unmigrated)

  if (!managed) {
    return {
      covers: [],
      stampAtLegacyPath: isLegacyStamped(target),
      managed,
      domains: [],
      tooling: UNMEASURED_TOOLING,
      seeds: { entries: [], historyUnavailable: false },
      superseded: [],
      unmigrated: [],
      unmovedSurfaces: [],
      newSkills: [],
      newRules: [],
      reverse: emptyReverseReport(),
      hooks: SKIPPED_HOOKS,
      skew: await skewRead,
    }
  }

  return {
    covers: stamp?.covers ?? [],
    stampAtLegacyPath: isLegacyStamped(target),
    managed,
    domains,
    tooling: buildToolingReport(toolkitRoot, target, stamp),
    seeds: buildSeedsReport(toolkitRoot, target),
    superseded: collectSuperseded(target),
    unmigrated,
    unmovedSurfaces: detectUnmovedSurfaces(target),
    newSkills: await readNewSkills(toolkitRoot, anchors),
    newRules: await readNewRules(toolkitRoot, target, stamp),
    reverse: buildReverseReport(toolkitRoot, target),
    hooks: await buildHooksReport(toolkitRoot, target),
    skew: await skewRead,
  }
}

async function buildDomainReport(
  toolkitRoot: string,
  target: string,
  stamp: Stamp | undefined,
  domain: ScannedDomain,
): Promise<DomainReport> {
  const plan = planSync(ADAPTERS[domain](toolkitRoot), target)
  const record = stamp?.domains[domain]
  const since = stampedCommit(stamp, domain)

  return {
    domain,
    stamped: record !== undefined,
    commit: since,
    syncedAt: record?.syncedAt,
    counts: countStates(plan.entries),
    entries: plan.entries,
    historyUnavailable: plan.historyUnavailable,
    upstream:
      since === undefined
        ? []
        : await readUpstream(toolkitRoot, since, SYNCED_SOURCES[domain]),
  }
}

export function parseUpstream(log: string): UpstreamCommit[] {
  const commits: UpstreamCommit[] = []

  for (const line of log.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '') continue

    const boundary = trimmed.indexOf(' ')
    if (boundary === -1) continue

    commits.push({
      sha: trimmed.slice(0, boundary),
      subject: trimmed.slice(boundary + 1),
    })
  }

  return commits
}

/** A skill is new when its `SKILL.md` was added, not when a support file was. */
export function parseNewSkills(paths: string): string[] {
  const names = paths
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.endsWith('/SKILL.md'))
    .map((line) => line.split('/').at(-2))
    .filter((name): name is string => name !== undefined)

  return [...new Set(names)].sort()
}

/**
 * What the target's `.claude/rules/` proves about its entitlement. `held` is
 * every rule name it carries and `folders` every rule folder those names sit in.
 *
 * Read off the installed tree, since `gov install` records file hashes and
 * never the stack it resolved, and `installRules` keeps each rule in its
 * authored subdirectory. `successorOf` adds a held rule's new name, which the
 * next sync installs, so the fallback does not report it as new.
 */
export function readInstalledRules(
  target: string,
  successorOf?: (name: string) => string | undefined,
): {
  held: Set<string>
  folders: Set<string>
} {
  const dir = join(target, ...INSTALL_MARKERS.governance)
  const held = new Set<string>()
  const folders = new Set<string>()
  if (!isDirectory(dir)) return { held, folders }

  for (const rel of new Bun.Glob('**/*.md').scanSync({
    cwd: dir,
    onlyFiles: true,
    dot: true,
  })) {
    const posix = rel.split(sep).join('/')
    const boundary = posix.indexOf('/')

    const name = basename(posix, '.md')
    held.add(name)
    const successor = successorOf?.(name)
    if (successor !== undefined) held.add(successor)
    if (boundary > 0) folders.add(posix.slice(0, boundary))
  }

  return { held, folders }
}

/**
 * Narrows rules added upstream to the ones this target could receive and does
 * not already hold.
 *
 * The folder test is the entitlement filter, over the folders the target holds
 * and those base reaches, since a rule under `lang/` or `ui/` belongs only to
 * the stacks naming it. It over-reports inside a shared folder, which costs a
 * line where under-reporting would defeat the section. The `held` test keeps a
 * rule that moved folders out, since a rename reaches this diff as an addition.
 */
export function selectNewRules(
  paths: string,
  held: ReadonlySet<string>,
  folders: ReadonlySet<string>,
): string[] {
  const prefix = 'governance/rules/'
  const names = new Set<string>()

  for (const line of paths.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith(prefix) || !trimmed.endsWith('.md')) continue

    const rel = trimmed.slice(prefix.length)
    const boundary = rel.indexOf('/')
    const folder = boundary === -1 ? '' : rel.slice(0, boundary)
    const name = basename(rel, '.md')

    if (held.has(name)) continue
    if (folder !== '' && !folders.has(folder)) continue

    names.add(name)
  }

  return [...names].sort()
}

/**
 * Rule folders holding a rule the base stack resolves to. Every stack extends
 * base, so a new rule beside one of base's reaches every target the fallback
 * reads, including a folder no installed tree carries yet. Read through
 * `resolveRules`, since base names rules one by one by slug. A folder only a
 * leaf stack reaches stays absent, since the installed tree is the only
 * evidence of that entitlement.
 */
export function baseFolders(root: string): Set<string> {
  const resolution = resolveRules(root, 'base')
  if (!resolution.ok) return new Set()

  return new Set(
    lookupRules(root, resolution.rules)
      .found.map((source) => source.subdir.split(sep)[0] ?? '')
      .filter((folder) => folder !== ''),
  )
}

/**
 * Rules the target is entitled to and lacks. A recorded chain answers this
 * through `resolveMissingRules`, comparing the entitled set against what the
 * target holds, as `collectMissing` does per file.
 *
 * A target stamped before chains were recorded, or naming a retired stack,
 * falls back to a diff from governance's own anchor rather than a shared one,
 * so another domain's sync cannot move it. With no chain and no anchor it
 * reports nothing. An anchor this clone cannot resolve also reads empty and
 * says so nowhere, the gap `readNewSkills` shares.
 */
export async function readNewRules(
  root: string,
  target: string,
  stamp: Stamp | undefined,
): Promise<string[]> {
  const chain = stampedChain(stamp, 'governance')
  const stack = chain[0]

  if (stack !== undefined && resolveRules(root, stack).ok) {
    return resolveMissingRules(root, target, chain)
      .map((source) => source.rule)
      .sort()
  }

  const since = stampedCommit(stamp, 'governance')
  if (since === undefined) return []

  const paths = await read(root, [
    'diff',
    '--name-only',
    '--diff-filter=A',
    `${since}..HEAD`,
    '--',
    'governance/rules/',
  ])

  const { held, folders } = readInstalledRules(target, successorResolver(root))
  return selectNewRules(paths, held, folders.union(baseFolders(root)))
}

async function readUpstream(
  root: string,
  since: string,
  sourcePath: string,
): Promise<UpstreamCommit[]> {
  const log = await read(root, [
    'log',
    '--oneline',
    '--no-decorate',
    `${since}..HEAD`,
    '--',
    sourcePath,
  ])

  return parseUpstream(log)
}

/**
 * Skills are not domain-scoped, so the read runs from the oldest anchor across
 * domains. Over-reporting a skill costs a line, while measuring from the newest
 * would hide one that arrived before the most recent domain sync.
 */
async function readNewSkills(
  root: string,
  anchors: readonly string[],
): Promise<string[]> {
  const since = await oldestAnchor(root, anchors)
  if (since === undefined) return []

  const paths = await read(root, [
    'diff',
    '--name-only',
    '--diff-filter=A',
    `${since}..HEAD`,
    '--',
    'claude/skills/',
  ])

  return parseNewSkills(paths)
}

async function oldestAnchor(
  root: string,
  anchors: readonly string[],
): Promise<string | undefined> {
  const unique = [...new Set(anchors)]
  let oldest = unique[0]

  for (const candidate of unique.slice(1)) {
    if (await isAncestor(root, candidate, oldest)) oldest = candidate
  }

  return oldest
}

async function isAncestor(
  root: string,
  candidate: string,
  reference: string,
): Promise<boolean> {
  const result = await execa(
    'git',
    ['-C', root, 'merge-base', '--is-ancestor', candidate, reference],
    { reject: false, env: gitEnv(), extendEnv: false },
  )

  return result.exitCode === 0
}

/**
 * A toolkit outside a git clone, or a stamped revision this clone has never
 * seen, yields no range. The per-file report still stands on its own.
 *
 * Scrubbed through `gitEnv` because a git hook exports `GIT_DIR` and its
 * siblings into every process it runs and they outrank `-C`. A check invoked
 * from a hook would otherwise diff the hook's repository and report a range for
 * a tree nobody asked about, which reads as an ordinary answer.
 */
async function read(root: string, args: readonly string[]): Promise<string> {
  const result = await execa('git', ['-C', root, ...args], {
    reject: false,
    env: gitEnv(),
    extendEnv: false,
  })
  return result.exitCode === 0 ? result.stdout : ''
}

function count(
  entries: readonly ScanEntry[],
  state: ScanEntry['state'],
): number {
  return entries.filter((entry) => entry.state === state).length
}
