import { existsSync } from 'node:fs'
import { chmod, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Command } from 'commander'
import { execa } from 'execa'
import { singleLine } from '@/commands/upgrade'
import { gitEnv } from '@/git-env'
import { claudeChain, pendingEntries, planGitignore } from '@/claude/gitignore'
import {
  matchInstall,
  type PluginInstall,
  readPluginName,
  updatedMessage,
} from '@/claude/plugin-update'
import {
  applySeeds,
  countByScope,
  pendingSeeds,
  planSeeds,
  type Seed,
} from '@/claude/seeds'
import { listSeeds, readSeedContents } from '@/claude/seeds-list'
import { readArrivals } from '@/claude/skills-arrivals'
import {
  auditExitCode,
  auditSkills,
  CORPORA,
  DESCRIPTION_LIMIT,
  REQUIREMENT_SECTIONS,
  type SkillFinding,
  type SkillsAudit,
  type SkillsAuditRefusal,
} from '@/claude/skills-audit'
import {
  type RoutingRefusal,
  type RoutingReport,
  scanRouting,
} from '@/claude/routing'
import { type DriftReport, readDrift } from '@/claude/skills-drift'
import { listSkills } from '@/claude/skills-list'
import {
  type ReachRefusal,
  type ReachReport,
  scanReach,
} from '@/claude/skills-reach'
import { SKILL_CASES } from '@/claude/cases/all'
import {
  loadCaseCorpus,
  type RankRefusal,
  type RankReport,
  scanRank,
  type SkillCase,
} from '@/claude/skills-rank'
import {
  planSettings,
  readSettings,
  serializeSettings,
  writeSettings,
} from '@/claude/settings'
import { copyPreservingMode } from '@/copy'
import { execScript } from '@/exec'
import { checkoutMismatchWarning, PROJECT_ROOT } from '@/project-root'
import { recordDir } from '@/record-root'
import { SURFACE_ENTRIES, surfaceDir } from '@/surface-root'
import { isDirectory, resolveTarget } from '@/target'
import { injectGitignore, pruneGitignore } from '@/tooling/inject'
import {
  frameError,
  intro,
  isNonInteractive,
  logAdd,
  logError,
  logInfo,
  logStep,
  logWarn,
  outro,
  palette,
  pipeOutput,
  plural,
  select,
} from '@/ui'
import { describeSkew, readSkew, type SkewReport } from '@/version/skew'

interface SeedsListOptions {
  readonly json?: boolean
  readonly names?: boolean
}

interface SkillsListOptions {
  readonly json?: boolean
  readonly names?: boolean
}

interface SkillsAuditOptions {
  readonly json?: boolean
  readonly requirementsOnly?: boolean
  readonly arrivals?: boolean
}

interface SkillsDriftOptions {
  readonly json?: boolean
}

interface PluginUpdateOptions {
  readonly json?: boolean
}

/**
 * `no-claude` and `no-plugin` name permanent conditions on a machine that
 * never carries the marketplace plugin at all, matching the `gh-missing` and
 * `no-repository` reasons `.husky/post-merge`'s other two steps already stay
 * quiet on forever rather than nagging a project that will never fix them.
 * Every other reason is a real defect and prints.
 */
type PluginUpdateReason =
  | 'no-claude'
  | 'no-manifest'
  | 'no-name'
  | 'list-failed'
  | 'no-plugin'
  | 'ambiguous'
  | 'update-failed'
  | 'after-list-failed'

interface PluginUpdateRecord {
  readonly root: string
  readonly id?: string
  readonly before?: string
  readonly after?: string
  readonly state: 'updated' | 'current' | 'refused'
  readonly reason?: PluginUpdateReason
  readonly message: string
}

interface SkillsReachOptions {
  readonly json?: boolean
}

interface SkillsRankOptions {
  readonly json?: boolean
  readonly cases?: string
}

interface RoutingOptions {
  readonly json?: boolean
}

const SEEDED_FILES: readonly string[] = [
  'ARCHITECTURE.md',
  'REQUIREMENTS.md',
  'DESIGN.md',
]
const SEEDED_DIRS: readonly string[] = [
  'decisions',
  'memory',
  'tasks',
  'wireframes',
]

/**
 * Where a `SEEDED_DIRS` entry resolves for the sync presence check.
 *
 * `wireframes` and `decisions` are tracked surface entries, resolved under
 * `canon/` ahead of `.claude/`, while `memory` and `tasks` are session records
 * resolved under `.canon/` ahead of `.claude/`. Routing every name through
 * `recordDir` reported a migrated target's `canon/wireframes/` or
 * `canon/decisions/` as missing, since that resolver never checks `canon/`.
 */
export function seededDirPath(resolved: string, name: string): string {
  return SURFACE_ENTRIES.includes(name)
    ? surfaceDir(resolved, name)
    : recordDir(resolved, name)
}
const USER_DIR = join('tooling', 'claude', 'user')
const STATUSLINE = 'statusline-command.sh'
const PLUGIN_MANIFEST = join('claude', '.claude-plugin', 'plugin.json')

/** A local cache read, not a network round trip, matching reclaim.ts's own bound for `claude agents --json`. */
const PLUGIN_LIST_TIMEOUT_MS = 10_000

/**
 * `claude plugin update` fetches a marketplace archive over the network, so a
 * stalled fetch should not hang the caller, which is a git hook on the
 * ordinary path.
 */
const PLUGIN_UPDATE_TIMEOUT_MS = 60_000

export function register(program: Command): void {
  const claude = program
    .command('claude')
    .description(
      'Claude workflow (init, seeds, sync, setup, routing, plugin-update)',
    )
    .helpOption('-h, --help', 'Show this help message')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  canon claude init',
        '  canon claude seeds list --json',
        '  canon claude sync ../my-app',
        '',
      ].join('\n'),
    )

  claude
    .command('init')
    .description('Seed .claude/ workflow docs into a project')
    .argument('[target]', 'Target directory', '.')
    .helpOption('-h, --help', 'Show this help message')
    .action(async (target: string) => {
      process.exitCode = await runInit(target)
    })

  claude
    .command('sync')
    .description('Reconcile .gitignore against the claude manifest')
    .argument('[target]', 'Target directory', '.')
    .helpOption('-h, --help', 'Show this help message')
    .action(async (target: string) => {
      process.exitCode = await runSync(target)
    })

  claude
    .command('setup')
    .description('One-shot user-level config (statusline, attribution)')
    .argument('[dest]', 'User config directory', join(homedir(), '.claude'))
    .helpOption('-h, --help', 'Show this help message')
    .action(async (dest: string) => {
      process.exitCode = await runSetup(dest)
    })

  const seeds = claude
    .command('seeds')
    .description('Seed doc sources (list)')
    .argument('[subcommand]', "Only 'list' is supported")
    .helpOption('-h, --help', 'Show this help message')
    .action((subcommand: string | undefined) => {
      intro('canon claude')
      logError(
        subcommand === undefined
          ? "Missing subcommand. Use 'list'."
          : `Unknown subcommand: ${subcommand}. Use 'list'.`,
      )
      outro()
      process.exitCode = 1
    })

  seeds
    .command('list')
    .description('List toolkit seed docs as installed by canon claude init')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Emit JSON with name, source, target, content')
    .option('--names', 'Only list target paths, one per line')
    .addHelpText(
      'after',
      [
        '',
        'Notes:',
        '  JSON is intended for skills that audit drift in target projects.',
        '',
      ].join('\n'),
    )
    .action(async (opts: SeedsListOptions) => {
      process.exitCode = await runSeedsList(opts)
    })

  claude
    .command('routing')
    .description('Report per CLAUDE.md section how many bullets name a path')
    .argument('[path]', 'Repository root, defaulting to the current directory')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Scope:',
        '  Every H2 and H3 in CLAUDE.md that owns at least one top-level',
        '  bullet, counted against the path-scoped rules under .claude/rules/.',
        '  A bullet is path-scoped here when it names a path, which is not the',
        "  same as firing only on one. A rule's glob covers a named folder",
        '  only when the glob is anchored to a location rather than to a file',
        '  type, so **/*.md covers README.md and no folder at all.',
        '',
        'Exit codes:',
        '  0  the file was read',
        '  1  refused, with the reason on stderr',
        '',
        'Reports rather than gates. Whether a bullet belongs in a rule is the',
        'judgment 592-claude-md states, and naming a path is evidence for it',
        'rather than the answer.',
        '',
        'Examples:',
        '  canon claude routing',
        '  canon claude routing --json',
        '',
      ].join('\n'),
    )
    .action((path: string | undefined, opts: RoutingOptions) => {
      process.exitCode = runRouting(path, opts)
    })

  claude
    .command('plugin-update')
    .description(
      'Update the installed marketplace plugin cache to match this CLI',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Mechanics:',
        '  Reads the plugin name out of claude/.claude-plugin/plugin.json,',
        '  matches it against an installed row from `claude plugin list',
        '  --json` by id prefix (<name>@), then runs `claude plugin update',
        '  <id> -y`. There is no --json on the update call itself, so the',
        '  version is read back off `claude plugin list --json` again and',
        '  compared to what it was before.',
        '',
        'Exit codes:',
        '  0  current already, or the update ran',
        '  1  refused, with the reason on stderr',
        '',
        'Examples:',
        '  canon claude plugin-update',
        '  canon claude plugin-update --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: PluginUpdateOptions) => {
      process.exitCode = await runPluginUpdate(opts)
    })

  const skills = claude
    .command('skills')
    .description('Plugin skill catalog (list, audit, drift, reach, rank)')
    .argument(
      '[subcommand]',
      "One of 'list', 'audit', 'drift', 'reach', or 'rank'",
    )
    .helpOption('-h, --help', 'Show this help message')
    .action((subcommand: string | undefined) => {
      intro('canon claude')
      logError(
        subcommand === undefined
          ? "Missing subcommand. Use 'list', 'audit', 'drift', 'reach', or 'rank'."
          : `Unknown subcommand: ${subcommand}. Use 'list', 'audit', 'drift', 'reach', or 'rank'.`,
      )
      outro()
      process.exitCode = 1
    })

  skills
    .command('list')
    .description('List the plugin skills shipped under claude/skills/')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Emit JSON with name and description')
    .option('--names', 'Only list skill names, one per line')
    .addHelpText(
      'after',
      [
        '',
        'Notes:',
        '  Internal skills under .claude/skills/ are excluded, since they',
        '  never install into a target project.',
        '',
      ].join('\n'),
    )
    .action((opts: SkillsListOptions) => {
      process.exitCode = runSkillsList(opts)
    })

  skills
    .command('audit')
    .description(
      'Report both skill corpora against the mechanical rules in standards/skill.md',
    )
    .argument('[path]', 'Project root, defaulting to the current directory')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .option(
      '--requirements-only',
      'Run the gating requirement-presence check alone',
    )
    .option(
      '--arrivals',
      'List each SKILL.md present in the working tree and absent at the merge base',
    )
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  the audit completed with every skill carrying a requirement',
        '  1  refused, with the reason on stderr',
        '  2  a skill folder carries no REQUIREMENT.md',
        '',
        'Only a missing REQUIREMENT.md sets a failing exit code. Name, description,',
        'folder, and requirement-section findings are advisory.',
        '',
        '--arrivals reports rather than gates, so it exits 0 whether or not a body',
        'arrived, and 1 when no merge base resolves.',
        '',
        'Examples:',
        '  canon claude skills audit',
        '  canon claude skills audit --json',
        '  canon claude skills audit --requirements-only',
        '  canon claude skills audit --arrivals --json',
        '',
      ].join('\n'),
    )
    .action(async (path: string | undefined, opts: SkillsAuditOptions) => {
      process.exitCode = await runSkillsAudit(path, opts)
    })

  skills
    .command('drift')
    .description('Name the shipped skill bodies rewritten since a given ref')
    .argument('<ref>', 'The commit a session started from')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  history was read, whether or not a body moved',
        '  1  the question could not be answered, with the reason on stderr',
        '',
        'A moved body means the file changed, not that a session holds a stale',
        'copy. Passing a ref older than the oldest load over-reports, which is',
        'the safe direction. Confirm a name by reading the body.',
        '',
        'Every run also reports the installed version against the newest',
        'published one. That report never changes the exit code, so an offline',
        'machine reads it as unknown rather than as a failure.',
        '',
        'Examples:',
        '  canon claude skills drift HEAD~20',
        '  canon claude skills drift 02d7b265 --json',
        '',
      ].join('\n'),
    )
    .action(async (ref: string, opts: SkillsDriftOptions) => {
      process.exitCode = await runSkillsDrift(ref, opts)
    })

  skills
    .command('reach')
    .description('Report skill bodies citing a path no target receives')
    .argument('[path]', 'Project root, defaulting to the current directory')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Scope:',
        '  Every markdown file under claude/skills/, which is the tree that',
        '  installs into a target, or under .claude/skills/ in a project',
        '  carrying that corpus alone. A cited path counts when it sits under',
        '  an authoring root no install channel delivers and the project',
        '  holds it. A path under src/, scripts/, or bare docs/ names the',
        "  reader's own tree and is not measured, and canon/context/ joins",
        "  them when the corpus read is a project's own.",
        '',
        'Exit codes:',
        '  0  every citation names the toolkit as the owner',
        '  1  refused, with the reason on stderr',
        '  2  at least one citation is unqualified',
        '',
        'Reports rather than gates. A toolkit-scoped instruction is sometimes',
        'meant for a session in this repository, so the verdict is a reading',
        'and the repair is to name the owner in the sentence.',
        '',
        'Examples:',
        '  canon claude skills reach',
        '  canon claude skills reach --json',
        '  canon claude skills reach ~/repos/my-project',
        '',
      ].join('\n'),
    )
    .action((path: string | undefined, opts: SkillsReachOptions) => {
      process.exitCode = runSkillsReach(path, opts)
    })

  skills
    .command('rank')
    .description('Score a skill catalog against a routing case corpus')
    .argument('[path]', 'Project root, defaulting to the current directory')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .option(
      '--cases <path>',
      "A project's own case corpus as JSON, replacing the toolkit's",
    )
    .addHelpText(
      'after',
      [
        '',
        'Scope:',
        '  TF-IDF cosine similarity over every SKILL.md frontmatter',
        '  description under claude/skills/, or under .claude/skills/ in a',
        '  project carrying that corpus alone, scored against the',
        '  hand-authored corpus at src/claude/cases/. A necessary condition',
        '  rather than a report of real routing behavior: it asks whether the',
        '  descriptions are separable by the words they use, and Claude Code',
        '  does not route this way.',
        '',
        'The case corpus:',
        '  --cases takes a JSON array of { "prompt", "expect" } objects, the',
        '  shape src/claude/cases/ already holds, where expect is a skill',
        "  folder name. A project's own skills need its own prompts, so the",
        '  toolkit corpus is not a default anything else can measure against.',
        '  No standard stands behind the file until a third project needs one.',
        '',
        'Exit codes:',
        '  0  the catalog was read, whether or not a case missed rank one',
        '  1  refused, with the reason on stderr',
        '',
        'Reports rather than gates. The corpus is a first run with no',
        'baseline to fail a push against, so `canon audits run` registers',
        'this with no gating exit and joins the ratchet instead.',
        '',
        'Examples:',
        '  canon claude skills rank',
        '  canon claude skills rank --json',
        '  canon claude skills rank ~/repos/my-project --cases cases.json',
        '',
      ].join('\n'),
    )
    .action((path: string | undefined, opts: SkillsRankOptions) => {
      process.exitCode = runSkillsRank(path, opts)
    })
}

function succeed(message: string): number {
  const { GREEN, NC } = palette(process.stderr)
  outro()
  process.stderr.write(`${GREEN}✓ ${message}${NC}\n`)
  return 0
}

async function runInit(target: string): Promise<number> {
  intro('canon claude')

  const resolved = resolveTarget(target, PROJECT_ROOT)
  if (typeof resolved === 'number') return resolved

  logStep('Scanning .claude/')
  const seedEntries = planSeeds(PROJECT_ROOT, resolved)
  for (const entry of seedEntries) {
    if (entry.present) logInfo(entry.seed.scanLabel)
    else logAdd(entry.seed.scanLabel)
  }
  const seeds = pendingSeeds(seedEntries)

  logStep('Scanning .gitignore')
  const chain = claudeChain(PROJECT_ROOT)
  const gitignoreEntries = planGitignore(chain, resolved)
  for (const entry of gitignoreEntries) {
    if (entry.present) logInfo(entry.entry)
    else logAdd(entry.entry)
  }
  const missing = pendingEntries(gitignoreEntries)

  const total = seeds.length + missing.length
  if (total === 0) return succeed('Claude already initialized')

  const shouldApply = await select({
    message: `Apply ${total} change(s) (${summarize(seeds, missing.length)})?`,
    options: [
      { value: true, label: 'Apply all' },
      { value: false, label: 'Cancel' },
    ],
    nonInteractiveDefault: true,
  })

  if (!shouldApply) {
    logWarn('Cancelled')
    outro()
    return 0
  }

  logStep('Applying changes')
  for (const label of await applySeeds(seeds)) logAdd(label)
  if (missing.length > 0) await injectGitignore(chain, resolved)

  return succeed('Claude ready')
}

function summarize(seeds: readonly Seed[], gitignoreCount: number): string {
  const counts = countByScope(seeds)
  const parts: string[] = []
  if (counts.claude > 0) parts.push(`${counts.claude} .claude`)
  if (counts.root > 0) parts.push(`${counts.root} CLAUDE.md`)
  if (gitignoreCount > 0) parts.push(`${gitignoreCount} .gitignore`)
  return parts.join(', ')
}

async function runSync(target: string): Promise<number> {
  intro('canon claude')

  const resolved = resolveTarget(target, PROJECT_ROOT)
  if (typeof resolved === 'number') return resolved

  // A record folder resolves at either root, so a migrated target is reported as
  // seeded rather than sent to `canon claude init` to re-create records it
  // already holds. `wireframes` and `decisions` are tracked surface entries
  // instead, resolved through `surfaceDir`, since a migrated target holds them
  // at `canon/` rather than under either record root.
  logStep('Seeded')
  for (const name of SEEDED_FILES) {
    if (existsSync(join(resolved, '.claude', name))) logInfo(name)
    else logWarn(`${name} missing. Run \`canon claude init\``)
  }
  for (const name of SEEDED_DIRS) {
    if (isDirectory(seededDirPath(resolved, name))) logInfo(`${name}/`)
    else logWarn(`${name}/ missing. Run \`canon claude init\``)
  }

  logStep('Scanning .gitignore')
  const chain = claudeChain(PROJECT_ROOT)
  const pruned = await pruneGitignore(chain, resolved)
  const gitignoreEntries = planGitignore(chain, resolved)
  for (const entry of gitignoreEntries) {
    if (entry.present) logInfo(entry.entry)
    else logAdd(entry.entry)
  }
  const missing = pendingEntries(gitignoreEntries)

  if (missing.length === 0 && pruned.length === 0) {
    return succeed('Claude workflow up to date')
  }

  if (missing.length > 0) {
    if (isNonInteractive()) {
      logInfo(`Applying ${missing.length} update(s) (non-interactive)`)
    } else {
      const shouldApply = await select({
        message: `Apply ${missing.length} update(s) (${missing.length} .gitignore)?`,
        options: [
          { value: true, label: 'Apply all' },
          { value: false, label: 'Cancel' },
        ],
      })

      if (!shouldApply) {
        logWarn('Cancelled')
        outro()
        return 0
      }
    }

    logStep('Applying changes')
    await injectGitignore(chain, resolved)
  }

  return succeed('Claude workflow synced')
}

/**
 * Writes to the operator's own machine rather than a project, so the
 * destination is a parameter. That lets a test cover the merge without
 * pointing it at a real home directory.
 */
async function runSetup(dest: string): Promise<number> {
  intro('canon claude')

  const resolved = resolve(dest)
  if (resolved === join(PROJECT_ROOT, '.claude')) {
    logError(
      'Cannot run against the toolkit .claude/. Files here are the source of truth.',
    )
    outro()
    return 1
  }

  const userDir = join(PROJECT_ROOT, USER_DIR)
  const scriptSrc = join(userDir, STATUSLINE)
  const scriptDest = join(resolved, STATUSLINE)
  const settingsPath = join(resolved, 'settings.json')

  logStep('Statusline script')
  if (await sameContent(scriptSrc, scriptDest)) {
    logInfo(STATUSLINE)
  } else {
    await copyPreservingMode(scriptSrc, scriptDest)
    await chmod(scriptDest, 0o755)
    logAdd(STATUSLINE)
  }

  logStep('Settings')
  const template = await readSettings(join(userDir, 'settings.template.json'))

  let current: Awaited<ReturnType<typeof readSettings>>
  try {
    current = await readSettings(settingsPath)
  } catch (error) {
    logError(error instanceof Error ? error.message : String(error))
    logError('Fix the file by hand, or move it aside and rerun.')
    outro()
    return 1
  }

  const { value, indent } = current
  const plan = planSettings(value, template.value, `bash ${scriptDest}`)

  for (const key of plan.keys) {
    if (key.changed) logAdd(key.label)
    else logInfo(key.label)
  }

  if (plan.changed) {
    await writeSettings(settingsPath, serializeSettings(plan.next, indent))
  }

  return succeed('Claude user config ready')
}

async function sameContent(src: string, dest: string): Promise<boolean> {
  if (!existsSync(dest)) return false
  const [left, right] = await Promise.all([
    readFile(src, 'utf8'),
    readFile(dest, 'utf8'),
  ])
  return left === right
}

/**
 * `--json` and `--names` write to stdout so a skill can pipe them, while the
 * human listing stays on the timeline. Only the human mode opens a frame.
 */
async function runSeedsList(opts: SeedsListOptions): Promise<number> {
  // The warning is a frame-interior line, so it goes out after `intro` on the
  // path that opens one and bare on the two that return first and open none.
  // One position cannot serve all three.
  const mismatch = checkoutMismatchWarning(process.cwd())
  const listings = listSeeds(PROJECT_ROOT)

  if (opts.json) {
    if (mismatch !== undefined) logWarn(mismatch)
    const withContent = await readSeedContents(listings)
    process.stdout.write(`${JSON.stringify(withContent)}\n`)
    return 0
  }

  if (opts.names) {
    if (mismatch !== undefined) logWarn(mismatch)
    process.stdout.write(
      listings.map((listing) => listing.target).join('\n') + '\n',
    )
    return 0
  }

  const { GREY, NC } = palette(process.stderr)
  intro('canon claude')
  if (mismatch !== undefined) logWarn(mismatch)
  logStep('Seed docs')
  for (const listing of listings) {
    logInfo(`${listing.target} ${GREY}← ${listing.source}${NC}`)
  }
  outro()
  return 0
}

function runSkillsList(opts: SkillsListOptions): number {
  // The warning is a frame-interior line, so it goes out after `intro` on the
  // path that opens one and bare on the two that return first and open none.
  // One position cannot serve all three.
  const mismatch = checkoutMismatchWarning(process.cwd())
  const listings = listSkills(PROJECT_ROOT)

  if (opts.json) {
    if (mismatch !== undefined) logWarn(mismatch)
    process.stdout.write(`${JSON.stringify({ skills: listings })}\n`)
    return 0
  }

  if (opts.names) {
    if (mismatch !== undefined) logWarn(mismatch)
    process.stdout.write(
      listings.map((listing) => listing.name).join('\n') + '\n',
    )
    return 0
  }

  intro('canon claude')
  if (mismatch !== undefined) logWarn(mismatch)
  logStep('Plugin skills')
  for (const listing of listings) {
    logInfo(listing.name)
  }
  outro()
  return 0
}

/**
 * Measures the cwd for the same reason the audit does, and takes the ref as a
 * required argument with no default. `HEAD` would be the only defensible one and
 * it answers every run with nothing moved, which is the silence this reports
 * against.
 */
async function runSkillsDrift(
  ref: string,
  opts: SkillsDriftOptions,
): Promise<number> {
  const root = process.cwd()
  const report = readDrift(root, ref)
  const skew = await readSkew()

  if (report.kind === 'measured') {
    intro('canon claude skills drift')
    reportSkew(skew)
    reportDrift(report, ref)
    outro()
  } else {
    frameError(report.reason)
    // The refusal path names the binary too. A project consuming the plugin
    // from a marketplace cache is refused here for having no history, and that
    // is the moment a skew warning is worth most, since an old binary is one
    // reason the cache and the CLI disagree in the first place.
    if (skew.state === 'behind') {
      const { GREY, NC } = palette(process.stderr)
      process.stderr.write(`${GREY}${describeSkew(skew)}${NC}\n`)
    }
  }

  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify(
        report.kind === 'measured'
          ? {
              root,
              ref,
              base: report.base,
              head: report.head,
              moved: report.moved,
              skew,
            }
          : { root, ref, unreadable: report.reason, skew },
      )}\n`,
    )
  }

  return report.kind === 'measured' ? 0 : 1
}

/**
 * The binary reports before the range does, for the reason the range section
 * states about itself: the command answers what changed on disk, and a binary
 * behind the published one is a second way the tree a session reads differs
 * from the tree it holds.
 */
function reportSkew(skew: SkewReport): void {
  logStep('Toolkit version')
  if (skew.state === 'behind') logWarn(describeSkew(skew))
  else logInfo(describeSkew(skew))
}

/** What a reader does about each way the reading cannot be taken. */
const ROUTING_REFUSALS: Record<RoutingRefusal, string> = {
  'no-claude-md': 'No CLAUDE.md here, so this tree has no always-loaded file.',
  'no-rules':
    'No path-scoped rules under .claude/rules/, so nothing covers a path yet.',
}

/**
 * Measures the cwd rather than the toolkit root, matching the reach and drift
 * verbs, so a linked worktree reads its own branch instead of `main`.
 */
function runRouting(path: string | undefined, opts: RoutingOptions): number {
  const root = resolve(path ?? process.cwd())
  const report = scanRouting(root)

  if (report.kind === 'refused') {
    frameError(ROUTING_REFUSALS[report.reason])
    if (opts.json) {
      process.stdout.write(
        `${JSON.stringify({
          root,
          reason: report.reason,
          message: ROUTING_REFUSALS[report.reason],
        })}\n`,
      )
    }
    return 1
  }

  intro('canon claude routing')
  reportRouting(report)
  outro()

  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        rules: report.rules,
        sections: report.sections,
      })}\n`,
    )
  }

  return 0
}

/**
 * States the corpus on every run, so a section naming no path reads as
 * measured rather than as skipped. A reader deciding what to cut needs the
 * sections that stay as much as the ones that move.
 */
function reportRouting(
  report: Extract<RoutingReport, { kind: 'measured' }>,
): void {
  const bullets = report.sections.reduce(
    (total, section) => total + section.bullets,
    0,
  )
  const pathScoped = report.sections.reduce(
    (total, section) => total + section.pathScoped,
    0,
  )

  logStep('Corpus')
  logInfo(
    `${plural(report.sections.length, 'section')} carrying ${plural(bullets, 'bullet')}, read against ${plural(report.rules, 'path-scoped rule')}`,
  )

  logStep('Sections')
  logInfo(`${pathScoped} of ${bullets} bullets name a path`)
  pipeOutput(
    report.sections
      .map(
        (section) =>
          `${section.pathScoped}/${section.bullets} path-scoped, ${section.covered} covered  ${section.heading}${
            section.uncovered.length === 0
              ? ''
              : `  [uncovered: ${section.uncovered.join(', ')}]`
          }`,
      )
      .join('\n'),
  )
}

/**
 * Reads the plugin name off the manifest, matches it against an installed row,
 * runs the update, and reads the version back off the same list rather than
 * trusting the update call's own report, since `claude plugin update` carries
 * no `--json` to answer with. `canon upgrade` makes the identical move for the
 * package managers it drives.
 */
async function runPluginUpdate(opts: PluginUpdateOptions): Promise<number> {
  const mismatch = checkoutMismatchWarning(process.cwd())
  intro('canon claude plugin-update')
  if (mismatch !== undefined) logWarn(mismatch)

  const manifestPath = join(PROJECT_ROOT, PLUGIN_MANIFEST)
  let manifestText: string
  try {
    manifestText = await readFile(manifestPath, 'utf8')
  } catch {
    return refusePluginUpdate(
      opts,
      'no-manifest',
      `No manifest at ${manifestPath}, so there is no plugin name to update.`,
    )
  }

  const name = readPluginName(manifestText)
  if (name === undefined) {
    return refusePluginUpdate(
      opts,
      'no-name',
      `No name field in ${manifestPath}, so there is nothing to match against an installed plugin.`,
    )
  }

  logStep('Manifest')
  logInfo(`${name}, from ${manifestPath}`)

  const before = await listPluginInstalls()
  if (before.kind === 'missing') {
    return refusePluginUpdate(
      opts,
      'no-claude',
      'claude is not on PATH, so no installed plugin could be read.',
    )
  }
  if (before.kind === 'failed') {
    return refusePluginUpdate(
      opts,
      'list-failed',
      `\`claude plugin list --json\` failed. ${before.detail}`,
    )
  }

  const match = matchInstall(name, before.installs)
  if (match.kind === 'none') {
    return refusePluginUpdate(
      opts,
      'no-plugin',
      `No installed plugin carries the id prefix "${name}@". Install it with \`claude plugin install\` first.`,
    )
  }
  if (match.kind === 'many') {
    return refusePluginUpdate(
      opts,
      'ambiguous',
      `Multiple installed plugins share the name "${name}": ${match.installs
        .map((install) => install.id)
        .join(', ')}. Refusing rather than picking one.`,
    )
  }

  const { install } = match
  logStep('Installed')
  logInfo(`${install.id} ${install.version}`)

  logStep('Updating')
  const result = await execa('claude', ['plugin', 'update', install.id, '-y'], {
    reject: false,
    timeout: PLUGIN_UPDATE_TIMEOUT_MS,
    env: gitEnv(),
    extendEnv: false,
  })

  if (result.exitCode !== 0) {
    return refusePluginUpdate(
      opts,
      'update-failed',
      `\`claude plugin update ${install.id} -y\` exited ${result.exitCode}. ${(result.stderr || result.stdout).trim()}`,
      install.id,
      install.version,
    )
  }

  const after = await listPluginInstalls()
  if (after.kind !== 'ok') {
    return refusePluginUpdate(
      opts,
      'after-list-failed',
      '`claude plugin update` ran, but `claude plugin list --json` failed to read the version back.',
      install.id,
      install.version,
    )
  }

  const afterVersion =
    after.installs.find((row) => row.id === install.id)?.version ??
    install.version
  const state = afterVersion === install.version ? 'current' : 'updated'

  logStep('Installed')
  logInfo(
    afterVersion === install.version
      ? `${afterVersion}, unchanged`
      : `${install.version} to ${afterVersion}`,
  )
  outro()

  emitPluginUpdate(opts, {
    root: PROJECT_ROOT,
    id: install.id,
    before: install.version,
    after: afterVersion,
    state,
    message: updatedMessage(install.version, afterVersion),
  })
  return 0
}

type ListInstallsResult =
  | { readonly kind: 'ok'; readonly installs: readonly PluginInstall[] }
  | { readonly kind: 'missing' }
  | { readonly kind: 'failed'; readonly detail: string }

/**
 * `missing` separates a `claude` binary that is not on PATH from every other
 * failure, since only that condition is permanent enough for the hook to
 * silence forever. execa reports it as `ENOENT` on the result rather than by
 * throwing, because the call runs with `reject: false`.
 */
async function listPluginInstalls(): Promise<ListInstallsResult> {
  const result = await execa('claude', ['plugin', 'list', '--json'], {
    reject: false,
    timeout: PLUGIN_LIST_TIMEOUT_MS,
    env: gitEnv(),
    extendEnv: false,
  })

  if (result.code === 'ENOENT') return { kind: 'missing' }
  if (result.exitCode !== 0) {
    return { kind: 'failed', detail: (result.stderr || result.stdout).trim() }
  }

  try {
    return {
      kind: 'ok',
      installs: JSON.parse(result.stdout) as readonly PluginInstall[],
    }
  } catch {
    return {
      kind: 'failed',
      detail: '`claude plugin list --json` did not print valid JSON.',
    }
  }
}

function refusePluginUpdate(
  opts: PluginUpdateOptions,
  reason: PluginUpdateReason,
  message: string,
  id?: string,
  before?: string,
): number {
  outro()
  frameError(message)
  emitPluginUpdate(opts, {
    root: PROJECT_ROOT,
    ...(id === undefined ? {} : { id }),
    ...(before === undefined ? {} : { before }),
    state: 'refused',
    reason,
    message,
  })
  return 1
}

function emitPluginUpdate(
  opts: PluginUpdateOptions,
  record: PluginUpdateRecord,
): void {
  if (opts.json !== true) return
  process.stdout.write(
    `${JSON.stringify({ ...record, message: singleLine(record.message) })}\n`,
  )
}

/** What a reader does about the one way the corpus fails to build. */
const REACH_REFUSALS: Record<ReachRefusal, string> = {
  'no-skills':
    'Neither claude/skills/ nor .claude/skills/ here, so this project carries no skill body to measure.',
}

/**
 * Measures the cwd rather than the toolkit root, matching the audit and drift
 * verbs, so a linked worktree reads its own branch instead of `main`, and a
 * target carrying `.claude/skills/` alone is in scope the way the audit
 * already has it.
 */
function runSkillsReach(
  path: string | undefined,
  opts: SkillsReachOptions,
): number {
  const root = resolve(path ?? process.cwd())
  const report = scanReach(root)

  if (report.kind === 'refused') {
    frameError(REACH_REFUSALS[report.reason])
    if (opts.json) {
      process.stdout.write(
        `${JSON.stringify({
          root,
          reason: report.reason,
          message: REACH_REFUSALS[report.reason],
        })}\n`,
      )
    }
    return 1
  }

  intro('canon claude skills reach')
  reportReach(report)
  outro()

  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        corpus: report.corpus,
        bodies: report.bodies,
        qualified: report.qualified,
        unqualified: report.unqualified,
      })}\n`,
    )
  }

  return report.unqualified.length === 0 ? 0 : 2
}

/**
 * States the corpus on every run, including the clean one. A count of what
 * failed reads as a verdict on the catalog unless the run also says how many
 * bodies it opened and how many citations it already accepted.
 */
function reportReach(report: Extract<ReachReport, { kind: 'measured' }>): void {
  logStep('Corpus')
  logInfo(
    `${report.corpus}: ${plural(report.bodies, 'file')} read, ${plural(report.qualified.length, 'citation')} already naming the toolkit as owner`,
  )

  logStep('Unqualified citations')
  if (report.unqualified.length === 0) {
    logInfo('Every toolkit-owned path a shipped body cites names its owner.')
    return
  }

  logWarn(plural(report.unqualified.length, 'citation'))
  pipeOutput(
    report.unqualified
      .map((citation) => `${citation.file}:${citation.line}  ${citation.path}`)
      .join('\n'),
  )
}

/** What a reader does about each way the measure fails to build. */
const RANK_REFUSALS: Record<RankRefusal, string> = {
  'no-skills':
    'Neither claude/skills/ nor .claude/skills/ here, so this project carries no skill body to measure.',
  'no-cases': 'No case corpus at the path given to --cases.',
  'bad-cases':
    'The case corpus is not a JSON array of { "prompt", "expect" } objects.',
}

/**
 * Measures the cwd rather than the toolkit root, matching the reach and audit
 * verbs, so a linked worktree reads its own branch instead of `main`, and a
 * target carrying `.claude/skills/` alone is in scope.
 *
 * The toolkit's own cases are the default and answer for this catalog alone.
 * A project measuring its own skills supplies its own prompts through
 * `--cases`, since a corpus written against skills it did not author scores
 * vocabulary it never uses.
 */
function runSkillsRank(
  path: string | undefined,
  opts: SkillsRankOptions,
): number {
  const root = resolve(path ?? process.cwd())

  let cases: readonly SkillCase[] = SKILL_CASES
  if (opts.cases !== undefined) {
    const corpus = loadCaseCorpus(resolve(opts.cases))
    if (corpus.kind === 'refused') {
      return refuseRank(root, corpus.reason, corpus.detail, opts)
    }
    cases = corpus.cases
  }

  const report = scanRank(root, cases)

  if (report.kind === 'refused') {
    return refuseRank(root, report.reason, '', opts)
  }

  intro('canon claude skills rank')
  reportRank(report)
  outro()

  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        corpus: report.corpus,
        skills: report.skills,
        cases: report.cases,
        rank1: report.rank1,
        top3: report.top3,
        misses: report.misses,
        unmeasurable: report.unmeasurable,
      })}\n`,
    )
  }

  return 0
}

/**
 * Carries the detail beside the reason, since three refusals share one verb
 * and only one of them names a path the caller can correct without it.
 */
function refuseRank(
  root: string,
  reason: RankRefusal,
  detail: string,
  opts: SkillsRankOptions,
): number {
  const message = RANK_REFUSALS[reason]
  frameError(detail === '' ? message : `${message} ${detail}`)

  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify({ root, reason, message, detail })}\n`,
    )
  }

  return 1
}

/**
 * States the corpus and both counts on every run, including a clean one. A
 * miss list alone reads as a verdict on the catalog unless the run also says
 * how many skills and cases it measured against.
 */
function reportRank(report: Extract<RankReport, { kind: 'measured' }>): void {
  logStep('Corpus')
  logInfo(
    `${report.corpus}: ${plural(report.skills, 'skill')} scored against ${plural(report.cases, 'case')}`,
  )

  logStep('Score')
  logInfo(
    `rank one: ${report.rank1}/${report.cases}, top three: ${report.top3}/${report.cases}`,
  )

  if (report.unmeasurable.length > 0) {
    logWarn(plural(report.unmeasurable.length, 'unmeasurable case'))
    pipeOutput(
      report.unmeasurable
        .map((skillCase) => `${skillCase.expect}  ${skillCase.prompt}`)
        .join('\n'),
    )
  }

  if (report.misses.length === 0) {
    logInfo('Every measurable case ranked its expected skill first.')
    return
  }

  logWarn(plural(report.misses.length, 'collision'))
  pipeOutput(
    report.misses
      .map(
        (miss) =>
          `${miss.expect} lost to ${miss.won} (rank ${miss.rank})  ${miss.prompt}`,
      )
      .join('\n'),
  )
}

/**
 * States the bound on every run, including the run that names nothing. A report
 * listing only what moved reads as a verdict on what a session holds, and the
 * command has no access to that.
 */
function reportDrift(
  report: Extract<DriftReport, { kind: 'measured' }>,
  ref: string,
): void {
  logStep('Range')
  logInfo(`${ref} to HEAD, resolved as ${report.base}..${report.head}.`)
  logInfo(
    'A body here changed on disk. Whether a session still holds the old one is what reading it settles.',
  )

  logStep('Moved bodies')
  if (report.moved.length === 0) {
    logInfo('No shipped body changed in this range.')
    return
  }

  const count = report.moved.length
  logWarn(
    `${count} skill ${count === 1 ? 'body' : 'bodies'} rewritten since ${ref}`,
  )
  pipeOutput(
    report.moved
      .map((moved) => `${moved.name}  ${moved.commit.slice(0, 8)}`)
      .join('\n'),
  )
}

/**
 * Measures the tree at the cwd rather than the toolkit root the catalog reads,
 * so a linked worktree audits its own branch instead of reporting on `main`. A
 * target carrying `.claude/skills/` alone is in scope for the same reason.
 */
async function runSkillsAudit(
  path: string | undefined,
  opts: SkillsAuditOptions,
): Promise<number> {
  const root = resolve(path ?? process.cwd())
  if (opts.arrivals && opts.requirementsOnly) {
    const message =
      '--arrivals and --requirements-only cannot combine: the first reports and exits 0, the second gates.'
    frameError(message)
    if (opts.json) {
      process.stdout.write(
        `${JSON.stringify({ root, reason: 'conflicting-flags', message })}\n`,
      )
    }
    return 1
  }
  if (opts.arrivals) return runSkillsArrivals(root, opts.json ?? false)

  const gateOnly = opts.requirementsOnly ?? false
  const report = await auditSkills(root)

  if (report.corpora.length === 0) {
    return refuseAudit(
      'no-corpus',
      `No skill corpus under ${root}. Looked for ${CORPORA.join(' and ')}.`,
      gateOnly,
      root,
      opts.json ?? false,
    )
  }

  if (gateOnly) {
    reportRequirementGate(report)
  } else {
    intro('canon claude skills audit')
    reportScope(report)
    reportRequirements(report)
    reportFrontmatter(report)
    reportFolder(report)
    reportRequirementShape(report)
    reportUnmeasured()
    outro()
  }

  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        corpora: report.corpora.map((corpus) => ({
          path: corpus.rel,
          skills: corpus.skills,
        })),
        skills: report.skills,
        findings: {
          missingRequirement: report.missingRequirement,
          nameMismatch: report.nameMismatch,
          missingDescription: report.missingDescription,
          longDescription: report.longDescription,
          readme: report.readme,
          folderName: report.folderName,
          requirementSections: report.requirementSections,
        },
        checkpoints: {
          descriptionLimit: DESCRIPTION_LIMIT,
          requirementSections: REQUIREMENT_SECTIONS,
          corpora: CORPORA,
        },
      })}\n`,
    )
  }

  return auditExitCode(report)
}

/** Reports arrivals and never gates, since it cannot check the answers a session gives. */
async function runSkillsArrivals(
  root: string,
  emitJson: boolean,
): Promise<number> {
  const result = await readArrivals(root)

  intro('canon claude skills audit --arrivals')
  if (result.kind === 'refused') {
    logStep('Refused')
    logWarn(result.message)
  } else if (result.arrivals.length === 0) {
    logStep('No skill body arrived on this branch')
  } else {
    logStep(`${result.arrivals.length} skill body arrived on this branch`)
    pipeOutput(result.arrivals.map((arrival) => arrival.path).join('\n'))
  }
  outro()

  if (emitJson) {
    process.stdout.write(`${JSON.stringify({ root, ...result })}\n`)
  }

  return result.kind === 'refused' ? 1 : 0
}

function refuseAudit(
  reason: SkillsAuditRefusal,
  message: string,
  gateOnly: boolean,
  root: string,
  emitJson: boolean,
): number {
  if (gateOnly) {
    frameError(message)
  } else {
    intro('canon claude skills audit')
    logStep('Refused')
    logWarn(message)
    outro()
  }

  if (emitJson) {
    process.stdout.write(`${JSON.stringify({ root, reason, message })}\n`)
  }

  return 1
}

/**
 * Prints nothing when every skill carries a requirement.
 *
 * `--requirements-only` is what the merge gate runs on every push, and it pipes
 * a stage's whole output into its own frame. A passing gate that printed
 * its frame would nest one inside the other on every contributor's push.
 */
function reportRequirementGate(report: SkillsAudit): void {
  const missing = report.missingRequirement
  if (missing.length === 0) return

  intro('canon claude skills audit')
  logError(
    missing.length === 1
      ? '1 skill folder carries no REQUIREMENT.md'
      : `${missing.length} skill folders carry no REQUIREMENT.md`,
  )
  pipeOutput(missing.join('\n'))
  outro()
}

function reportFindings(findings: readonly SkillFinding[]): void {
  pipeOutput(
    findings.map((found) => `${found.rel}  ${found.detail}`).join('\n'),
  )
}

/**
 * Names each corpus that resolved, since a corpus the tree does not carry is
 * skipped silently and a count taken over one of the two reads as the whole.
 */
function reportScope(report: SkillsAudit): void {
  logStep('Scope')
  for (const corpus of report.corpora) {
    logInfo(`${corpus.rel}: ${plural(corpus.skills, 'skill')}`)
  }
}

function reportRequirements(report: SkillsAudit): void {
  logStep('Requirements')
  logInfo('Every skill folder carries REQUIREMENT.md beside SKILL.md.')
  logInfo('This is the only measure here that fails a run.')

  if (report.missingRequirement.length === 0) {
    logInfo('Every skill carries one.')
    return
  }

  logWarn(`${plural(report.missingRequirement.length, 'skill')} without one`)
  pipeOutput(report.missingRequirement.join('\n'))
}

function reportFrontmatter(report: SkillsAudit): void {
  logStep('Frontmatter')
  logInfo(
    `name matches the folder, and description is present and under ${DESCRIPTION_LIMIT} characters.`,
  )
  logInfo('A body whose frontmatter does not parse reads as declaring neither.')

  const findings =
    report.nameMismatch.length +
    report.missingDescription.length +
    report.longDescription.length
  if (findings === 0) {
    logInfo('Every body declares both fields.')
    return
  }

  if (report.nameMismatch.length > 0) {
    logWarn(
      `${plural(report.nameMismatch.length, 'body')} whose name does not match its folder`,
    )
    reportFindings(report.nameMismatch)
  }

  if (report.missingDescription.length > 0) {
    logWarn(
      `${plural(report.missingDescription.length, 'body')} without a description`,
    )
    pipeOutput(report.missingDescription.join('\n'))
  }

  if (report.longDescription.length > 0) {
    logWarn(
      `${plural(report.longDescription.length, 'description')} past the ${DESCRIPTION_LIMIT}-character ceiling`,
    )
    reportFindings(report.longDescription)
  }
}

function reportFolder(report: SkillsAudit): void {
  logStep('Folder')
  logInfo(
    'No README.md inside a skill folder, and a folder name in kebab-case carrying no capital or underscore.',
  )

  if (report.readme.length === 0 && report.folderName.length === 0) {
    logInfo('Every folder conforms.')
    return
  }

  if (report.readme.length > 0) {
    logWarn(`${plural(report.readme.length, 'folder')} carrying a README.md`)
    pipeOutput(report.readme.join('\n'))
  }

  if (report.folderName.length > 0) {
    logWarn(
      `${plural(report.folderName.length, 'folder name')} outside kebab-case`,
    )
    pipeOutput(report.folderName.join('\n'))
  }
}

function reportRequirementShape(report: SkillsAudit): void {
  logStep('Requirement shape')
  logInfo(
    `Each REQUIREMENT.md declares ${REQUIREMENT_SECTIONS.join(' and ')}, matched at any heading level.`,
  )
  logInfo(
    'A folder carrying no requirement is reported above rather than counted twice here.',
  )

  if (report.requirementSections.length === 0) {
    logInfo('Every requirement declares both.')
    return
  }

  logWarn(
    `${plural(report.requirementSections.length, 'requirement')} short a declared section`,
  )
  reportFindings(report.requirementSections)
}

/**
 * Stated on every run, including the run where everything above passed. A
 * report that lists only what it measured reads as a verdict on the standard
 * rather than on the half of it a parser can reach.
 */
function reportUnmeasured(): void {
  logStep('Unmeasured')
  logInfo(
    'The standard states rules no parser reads, and a pass above says nothing about them.',
  )
  logInfo(
    'Whether each Must traces to a stated gap, whether a gap reads as an observed failure rather than an intent, and whether a description routes.',
  )
  logInfo(
    'The 150-line body checkpoint is mechanical and still absent here, and it would print a count rather than a defect.',
  )
}
