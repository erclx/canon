import { existsSync } from 'node:fs'
import { basename, join, sep } from 'node:path'
import { execa } from 'execa'
import { gitEnv } from '@/git-env'
import { createDesignAdapter, DESIGN_INSTALL_DIR } from '@/design/adapter'
import { createGovAdapter, rulesSourceDir } from '@/gov/adapter'
import { loadGovStack, resolveMissingRules, resolveRules } from '@/gov/stacks'
import { planSync, type ScanEntry, type SyncAdapter } from '@/sync/engine'
import {
  collectSuperseded,
  detectUnmigrated,
  type SupersededEntry,
  type UnmigratedDomain,
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
import { isDirectory } from '@/target'
import { loadManifest } from '@/tooling/manifest'
import { scan } from '@/tooling/scan'
import { readSkew, type SkewReport } from '@/version/skew'

/**
 * Domains the sync engine walks file by file. Tooling is a stamp domain without
 * being one of these, because `src/tooling/` never calls `planSync`, so the
 * three lookups below have no entry to offer it. Standards and snippets left
 * the list with their install channels: nothing writes either corpus into a
 * target, so there is no installed copy to attribute.
 *
 * Design joins as a scanned domain rather than a stamp-only one because its
 * base file is attributed the same way a rule is, and its install marker is
 * what keeps it off a target that never asked for it: a project with no
 * `.claude/design/` is never scanned, so design values arrive on an install
 * rather than on the next sync.
 */
export const SCANNED_DOMAINS = [
  'governance',
  'design',
] as const satisfies readonly StampDomain[]

export type ScannedDomain = (typeof SCANNED_DOMAINS)[number]

/**
 * The toolkit path whose commits change what each domain holds. `claude/skills/`
 * is deliberately absent: skills load live from the plugin directory, so they
 * never go stale and belong in the read-only section instead.
 */
const SYNCED_SOURCES: Record<ScannedDomain, string> = {
  governance: 'governance/rules/',
  design: 'src/design/',
}

const ADAPTERS: Record<ScannedDomain, (root: string) => SyncAdapter> = {
  governance: createGovAdapter,
  design: createDesignAdapter,
}

const INSTALL_MARKERS: Record<ScannedDomain, readonly string[]> = {
  governance: ['.claude', 'rules', 'canon'],
  design: DESIGN_INSTALL_DIR.split(sep),
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
export interface ToolingCounts {
  readonly configs: number
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
    seeds: 0,
    scripts: 0,
    deps: 0,
    gitignore: 0,
  },
  changes: 0,
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
 * Scanned domains a target takes deliberately rather than by being managed.
 *
 * An absent one is a choice, so it is never reported as unstamped. Governance
 * wants the opposite reading, since a managed target without it has yet to
 * install what every project is expected to carry, and naming it is the only
 * place that shows up.
 */
export const OPT_IN_DOMAINS: readonly ScannedDomain[] = ['design']

/**
 * Scanned domains this target should have stamped and has not, which is the
 * one line a domain nobody installed ever appears on.
 *
 * An unmigrated domain is excluded because the relocation is its remedy rather
 * than a sync, and an opt-in domain the target does not hold is excluded
 * because there is nothing there to stamp and the sync it would name refuses.
 */
export function uncoveredDomains(report: CheckReport): ScannedDomain[] {
  const unmigrated = new Set(report.unmigrated.map((entry) => entry.domain))
  const installed = new Set(report.domains.map((entry) => entry.domain))

  return SCANNED_DOMAINS.filter(
    (domain) =>
      !report.covers.includes(domain) &&
      !unmigrated.has(domain) &&
      (!OPT_IN_DOMAINS.includes(domain) || installed.has(domain)),
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
  const manifests = chain
    .map((name) => loadManifest(toolkitRoot, name))
    .filter((manifest) => manifest !== undefined)

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
 * Whether the target is a toolkit-managed project at all. Seeds are enumerated
 * from the source rather than from what a target installed, so without this gate
 * a directory the toolkit has never touched reports every seed as `missing` and
 * routes to a skill that reconciles section by section. `installedStampDomains`
 * gates the three scanned domains the same way, which is why they stay quiet on
 * the same directory.
 *
 * An unmigrated domain counts as a marker in its own right. `detectUnmigrated`
 * fires only on root files whose basename the toolkit ships, so it firing proves
 * the toolkit installed here before the layout moved under `.claude/`. Reading
 * only the markers would report such a target as unmanaged while the same report
 * carried its unmigrated domain, and a consumer reading the JSON would route to
 * the relocation while the rendered half routed to install.
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
  }
}

/**
 * Whether the target has diverged from the toolkit in a way a sync could close.
 * Orphaned files are excluded: a project-authored rule never converges, and
 * counting it would leave `--exit-code` failing forever with no remedy.
 *
 * An unmigrated domain counts, because running the relocation closes it. A
 * superseded artifact does not, for the same reason orphaned files do not: only
 * the user can move content they wrote, so failing a job on it leaves the job
 * red with no mechanical remedy. Seeds are excluded on the same grounds, since
 * every seed a project edits would otherwise fail the check forever.
 *
 * Tooling is excluded on exactly the seeds grounds: a golden config is one the
 * project is expected to edit, so a job counting it stays red with no remedy.
 * Being unmeasured is not what excludes it, since an unmeasured report carries
 * zero changes and would pass a count either way.
 *
 * The reverse report is excluded because every entry in it is a judgment about
 * a file the project may own. `detectUnmigrated` already shipped that exact
 * false positive once, failing a push with no action that cleared it, and a
 * walk that reports `unattributed` by design would repeat it.
 *
 * `missing` is excluded on the same grounds `newRules` already reports on: a
 * sync that adds a rule silently changes what a project is governed by, and
 * nobody chose that, so gating CI on the count would pressure a target into
 * adopting a rule nobody picked.
 *
 * `retired` counts, since a sync deletes it mechanically. A target's CI goes
 * red the day a release retires a rule it holds, and one sync clears it.
 */
export function hasDrift(report: CheckReport): boolean {
  if (report.unmigrated.length > 0) return true

  return report.domains.some(
    (domain) =>
      domain.counts.stale +
        domain.counts.customized +
        domain.counts.drifted +
        domain.counts.stranded +
        domain.counts.retired >
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
      newSkills: [],
      newRules: [],
      reverse: emptyReverseReport(),
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
    newSkills: await readNewSkills(toolkitRoot, anchors),
    newRules: await readNewRules(toolkitRoot, target, stamp),
    reverse: buildReverseReport(toolkitRoot, target),
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
 * every rule name it carries and `bands` every band folder those names sit in.
 *
 * Read off the installed tree rather than off a stack name, because
 * `gov install` records file hashes and never the stack it resolved, so the
 * chain a target consumed survives nowhere else. `installRules` copies each
 * rule into the subdirectory it was authored in, which is what makes the band
 * folders legible as evidence.
 */
export function readInstalledRules(target: string): {
  held: Set<string>
  bands: Set<string>
} {
  const dir = join(target, ...INSTALL_MARKERS.governance)
  const held = new Set<string>()
  const bands = new Set<string>()
  if (!isDirectory(dir)) return { held, bands }

  for (const rel of new Bun.Glob('**/*.md').scanSync({
    cwd: dir,
    onlyFiles: true,
    dot: true,
  })) {
    const posix = rel.split(sep).join('/')
    const boundary = posix.indexOf('/')

    held.add(basename(posix, '.md'))
    if (boundary > 0) bands.add(posix.slice(0, boundary))
  }

  return { held, bands }
}

/**
 * Narrows rules added upstream to the ones this target could receive and does
 * not already hold.
 *
 * The band test is the entitlement filter, and `bands` carries two sources: the
 * folders the target already holds, and the folders the base stack takes whole.
 * A rule authored under `lang/` or `ui/` is named by an individual stack, so it
 * belongs to some targets and not others, and listing every added file would
 * tell a base consumer about rules it was never entitled to. The test
 * over-reports inside a band a target already carries, since one folder can be
 * reached by more than one stack, and that costs a line where under-reporting
 * would cost the whole point of the section.
 *
 * The `held` test is what keeps a rule that moved bands upstream out. A rename
 * reaches this diff as an addition, and the target already has the file under
 * its old folder, so matching by name is what tells the two apart.
 */
export function selectNewRules(
  paths: string,
  held: ReadonlySet<string>,
  bands: ReadonlySet<string>,
): string[] {
  const prefix = 'governance/rules/'
  const names = new Set<string>()

  for (const line of paths.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith(prefix) || !trimmed.endsWith('.md')) continue

    const rel = trimmed.slice(prefix.length)
    const boundary = rel.indexOf('/')
    const band = boundary === -1 ? '' : rel.slice(0, boundary)
    const name = basename(rel, '.md')

    if (held.has(name)) continue
    if (band !== '' && !bands.has(band)) continue

    names.add(name)
  }

  return [...names].sort()
}

/**
 * Band folders the base stack takes whole. Every governance stack extends base,
 * so a rule authored under one of these is entitled to every target.
 *
 * This is what covers a band no target can carry yet. Entitlement is otherwise
 * read off folders the target already holds, and a folder added to base later
 * exists in no installed tree, so without this the rules inside it would reach
 * nobody. Read from the stack file rather than fixed, so that addition needs no
 * code change here.
 *
 * A folder only a leaf stack names is deliberately absent. It is entitled to
 * some targets and not others, which is the distinction the band test makes and
 * the installed tree is the only evidence of.
 */
export function baseBands(root: string): Set<string> {
  const stack = loadGovStack(root, 'base')
  if (stack === undefined) return new Set()

  return new Set(
    stack.rules.filter((entry) =>
      isDirectory(join(rulesSourceDir(root), entry)),
    ),
  )
}

/**
 * A recorded chain answers this without the anchor at all: `resolveMissingRules`
 * compares the entitled set against what the target holds right now, so a rule
 * that shipped before the target's anchor is not a permanent blind spot the
 * way the diff below leaves it. This is the primary path, and it is also what
 * `collectMissing` reports per file through the domain scan, so a rule the
 * chain names and the target lacks reaches both surfaces the same way.
 *
 * The diff-and-bands path stays as the fallback for a target stamped before
 * governance recorded a chain. Rules are domain-scoped there too, so it
 * measures from governance's own anchor rather than from the oldest anchor
 * across domains the way `readNewSkills` does. A shared anchor would let
 * another domain's sync move the revision rules are measured from and drop a
 * rule out of the read.
 *
 * A target carrying no chain and no governance anchor reports nothing. It has
 * no date to measure against, and diffing from the beginning of history would
 * read every rule the toolkit ships as new.
 *
 * An anchor this clone cannot resolve reports nothing by a different route and
 * says so nowhere. `read` yields an empty string on a non-zero exit, so a stamp
 * naming a revision a registry install or a shallow clone has never seen reads
 * as a target holding everything. `readNewSkills` carries the same gap, and
 * neither has the `historyUnavailable` flag the per-domain scan uses to tell an
 * unmeasured result from a clean one.
 *
 * A recorded chain naming a stack the toolkit no longer ships falls through to
 * the band-based path below rather than reporting the empty list an
 * unresolved chain would otherwise produce. That empty list reads exactly
 * like a target holding everything, which is the same failure this function
 * exists to close, so a retired stack name is read the same as no chain at
 * all instead of reintroducing it.
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

  const { held, bands } = readInstalledRules(target)
  return selectNewRules(paths, held, bands.union(baseBands(root)))
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
