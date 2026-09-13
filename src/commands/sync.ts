import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Command } from 'commander'
import { cliPath, cliRun } from '@/cli-run'
import { PROJECT_ROOT } from '@/project-root'
import {
  buildCheckReport,
  type CheckReport,
  hasDrift,
  uncoveredDomains,
} from '@/sync/check'
import { createGitRunner, createPullRequestOpener, hasGh } from '@/sync/git'
import {
  detectDomains,
  installedDomains,
  isTreeClean,
  shouldSync,
  SYNC_DOMAINS,
  type SyncDomain,
} from '@/sync/target'
import type { UnclaimedFolder } from '@/sync/reverse'
import { runGitWorkflow } from '@/sync/workflow'
import { resolveTarget } from '@/target'
import {
  intro,
  isNonInteractive,
  logError,
  logInfo,
  logStep,
  logWarn,
  outro,
  palette,
} from '@/ui'
import { describeSkew } from '@/version/skew'

const SYNC_ARGS: Record<SyncDomain, readonly string[]> = {
  governance: ['gov', 'sync'],
  design: ['design', 'sync'],
  claude: ['claude', 'sync'],
}

interface SyncOptions {
  readonly check?: boolean
  readonly json?: boolean
  readonly exitCode?: boolean
}

export function register(program: Command): void {
  program
    .command('sync')
    .description('Sync all installed domains in a project')
    .argument('[target]', 'Target directory', '.')
    .option('--check', 'Report drift without writing anything')
    .option('--json', 'Emit the drift report as JSON on stdout')
    .option('--exit-code', 'Exit 1 when drift is found, for CI')
    .helpOption('-h, --help', 'Show this help message')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  canon sync',
        '  canon sync ../my-app',
        '  canon sync --check',
        '  canon sync --check --json',
        '  canon sync --check --exit-code',
        '',
      ].join('\n'),
    )
    .action(async (target: string, options: SyncOptions) => {
      process.exitCode =
        options.check === true
          ? await runCheck(target, options)
          : await runSync(target)
    })
}

/**
 * Reads the same plan a sync would apply and writes nothing. Drift between
 * syncs is normal, so the default exit stays 0 and CI opts into failing.
 */
async function runCheck(target: string, options: SyncOptions): Promise<number> {
  const resolved = resolveTarget(target, PROJECT_ROOT)
  if (typeof resolved === 'number') return resolved

  const report = await buildCheckReport(PROJECT_ROOT, resolved)

  if (options.json === true) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  } else {
    renderCheck(report)
  }

  return options.exitCode === true && hasDrift(report) ? 1 : 0
}

function renderCheck(report: CheckReport): void {
  intro('canon sync --check')

  renderSkew(report)

  if (report.stampAtLegacyPath) {
    logWarn(
      'Stamp found at a retired path. Move it to canon/config/config.json.',
    )
  }

  if (!report.managed) {
    logStep('Not a toolkit project')
    logWarn('No .claude/ directory and no CLAUDE.md at the target.')
    logInfo(
      'Run `canon init` to install, or /canon:setup-init to resolve a stack.',
    )
    outro()
    return
  }

  for (const domain of report.domains) {
    logStep(domain.domain)

    if (domain.commit === undefined) {
      logWarn(
        domain.historyUnavailable
          ? 'Not stamped, and this toolkit has no git history. Drift below is reported unattributed.'
          : 'Not stamped. Drift below is attributed from toolkit history.',
      )
    } else {
      logInfo(`Synced from ${domain.commit} on ${domain.syncedAt}`)
    }

    for (const entry of domain.entries) {
      if (entry.state === 'matching' || entry.state === 'orphaned') continue
      logWarn(entry.notice ?? `${entry.rel} (${entry.state})`)
    }

    const { stale, customized, drifted, stranded, orphaned, missing } =
      domain.counts
    if (stale + customized + drifted + stranded === 0) {
      logInfo(orphaned === 0 ? 'up to date' : `up to date (${orphaned} local)`)
    }
    // A local file is not a deficiency and a missing rule is, so this never
    // shares the up-to-date line's parenthetical. It prints on its own,
    // regardless of whether anything above needs a sync.
    if (missing > 0) {
      logWarn(`${missing} listed by the stack, not installed`)
    }

    for (const commit of domain.upstream) {
      logInfo(`${commit.sha} ${commit.subject}`)
    }
  }

  renderTooling(report)

  for (const entry of report.unmigrated) {
    logStep(`${entry.domain} (not migrated)`)
    logWarn(
      `${entry.files} files at ${entry.rootPath}/, nothing at ${entry.installPath}/`,
    )
    logInfo('Move the content yourself. No sync command touches these.')
  }

  renderSeeds(report)

  if (report.superseded.length > 0) {
    logStep('Superseded by a newer layout')
    for (const entry of report.superseded) {
      logWarn(`${entry.rel} (replaced by ${entry.replacedBy}/)`)
    }
    logInfo('Move the content yourself. No sync command touches these.')
  }

  if (report.newSkills.length > 0) {
    logStep('New skills, no sync needed')
    for (const name of report.newSkills) logInfo(name)
  }

  // Warned where `newSkills` is noted, because a new skill loads live and needs
  // nothing run while a rule reaches the target only when someone installs it.
  // No sync closes any of this, so the remedy names the install command.
  if (report.newRules.length > 0) {
    logStep('New rules, never installed')
    for (const name of report.newRules) logWarn(name)
    // `install` re-resolves the whole stack rather than adding one rule, so
    // the remedy names both routes rather than assuming the reader wants all.
    logInfo(
      'Run `canon gov install <stack>` to take the whole stack again, or `--add <rule>` to take one.',
    )
  }

  renderUnclaimed(report)
  renderMigrations(report)

  outro()
  // Scanned domains only. Tooling renders a section on every managed target, so
  // naming it here repeats what that section already said under a second
  // remedy, where a scanned domain nobody installed has no section at all and
  // this line is the only place it appears.
  const uncovered = uncoveredDomains(report)
  if (uncovered.length === 0) return

  const { GREY, NC } = palette(process.stderr)
  process.stderr.write(
    `${GREY}Unstamped: ${uncovered.join(', ')}. Run the matching sync to record one.${NC}\n`,
  )
}

/**
 * The binary reports before any domain does, since a stale binary is what makes
 * every section below it a reading from the wrong toolkit. It prints on all
 * three states rather than only when behind: a check that goes quiet when the
 * registry is unreachable is indistinguishable from one that found nothing.
 */
function renderSkew(report: CheckReport): void {
  const { skew } = report
  logStep('toolkit version')

  if (skew.state === 'behind') {
    logWarn(describeSkew(skew))
    return
  }

  logInfo(describeSkew(skew))
}

/**
 * Tooling prints whether it was measured before it prints any count, because a
 * target with no chain recorded produces the same zero a current target does.
 * Naming the state is the whole reason the section exists.
 */
function renderTooling(report: CheckReport): void {
  const { tooling } = report
  logStep('tooling')

  if (!tooling.measured) {
    logWarn(
      tooling.chain.length === 0
        ? 'Not stamped. No chain recorded, so tooling drift is unmeasured.'
        : `Recorded chain names no stack this toolkit ships: ${tooling.chain.join(' < ')}.`,
    )
    logInfo(
      'Run `canon tooling sync <stack> --write` to record what this target holds.',
    )
    return
  }

  logInfo(`Chain: ${tooling.chain.join(' < ')}`)
  if (tooling.commit !== undefined) {
    logInfo(`Synced from ${tooling.commit} on ${tooling.syncedAt}`)
  }

  if (tooling.changes === 0) {
    logInfo('up to date')
    return
  }

  for (const [category, count] of Object.entries(tooling.counts)) {
    if (count > 0) logWarn(`${count} ${category}`)
  }
  logInfo(
    'Run `canon tooling sync --check` to see which files, `--write` to apply.',
  )
}

/**
 * Seeds print their own section because no sync command applies them. A `stale`
 * seed is safe to take whole and a `drifted` one holds edits, which is the split
 * `seed-sync` reads to decide what needs a section-level merge.
 */
function renderSeeds(report: CheckReport): void {
  const notable = report.seeds.entries.filter(
    (entry) => entry.state !== 'matching',
  )

  if (notable.length === 0) return

  logStep('seeds')
  if (report.seeds.historyUnavailable) {
    logWarn('This toolkit has no git history. Drift below is unattributed.')
  }

  for (const entry of notable) {
    logWarn(`${entry.rel} (${entry.state})`)
  }

  logInfo('Run /canon:seed-sync to reconcile these section by section.')
}

/**
 * Names the attribution before the count, the way the tooling section does. A
 * dropped folder and a project-authored one are the same bytes at the same
 * path, so the count alone is the one thing an operator cannot act on.
 *
 * A folder history proved the project owns is dropped from the render and kept
 * in the JSON. Printing it costs a line on every run for a name collision no
 * remedy closes, which is the bar this section had to clear to exist at all.
 */
function renderUnclaimed(report: CheckReport): void {
  const { unclaimed, historyUnavailable } = report.reverse
  const notable = unclaimed.filter((entry) => entry.attribution !== 'project')

  if (notable.length === 0 && !historyUnavailable) return

  logStep('No longer shipped by the toolkit')

  if (historyUnavailable) {
    logWarn('This toolkit has no git history, so nothing could be walked.')
    return
  }

  for (const entry of notable) {
    logWarn(`${entry.rel}/ (${describeUnclaimed(entry)})`)
  }

  logInfo(
    'Decide what happens to these yourself. No sync command touches them.',
  )
}

/**
 * State first, then the count, then where the content came from. The revision
 * is the commit that published the content the target still holds, never the
 * one that dropped the folder, so it takes a clause of its own. Suffixed onto
 * `dropped upstream` it reads as the date of the drop, and an operator running
 * `git show` on it lands on the commit that added the folder.
 */
function describeUnclaimed(entry: UnclaimedFolder): string {
  const state =
    entry.attribution === 'dropped' ? 'dropped upstream' : 'unattributed'
  const counted = `${state}, ${entry.files} files`

  if (entry.since === undefined) return counted

  return `${counted}, content published at ${entry.since.slice(0, 7)}`
}

/**
 * The proposal-only skills no other field reaches.
 */
function renderMigrations(report: CheckReport): void {
  const { migrations } = report.reverse
  if (migrations.length === 0) return

  logStep('Migrations with a case here')

  for (const candidate of migrations) {
    logWarn(candidate.reason)
    logInfo(`Run /canon:${candidate.skill} for a proposal.`)
  }
}

async function runSync(target: string): Promise<number> {
  intro('canon sync')

  const resolved = resolveTarget(target, PROJECT_ROOT)
  if (typeof resolved === 'number') return resolved

  const git = createGitRunner(resolved)
  const { GREY, NC, YELLOW } = palette(process.stderr)

  logStep('Checking working tree')
  if (!isTreeClean(await git.status([]))) {
    logError(
      'Working tree has uncommitted changes. Commit or stash before syncing.',
    )
    outro()
    return 1
  }
  logInfo('Working tree clean')

  logStep('Detecting domains')
  const states = detectDomains(resolved)
  for (const state of states) {
    if (state.installed) logInfo(state.domain)
    else logWarn(`${state.domain} (not installed, skipping)`)
  }

  if (installedDomains(states).length === 0) {
    outro()
    process.stderr.write(
      `\n${YELLOW}! No domains installed in target. Run domain install commands first.${NC}\n`,
    )
    return 0
  }

  outro()
  process.stderr.write('\n')

  await runDomainSyncs(resolved)

  const code = await runGitWorkflow(resolved, {
    git,
    pullRequests: (await hasGh())
      ? createPullRequestOpener(resolved)
      : undefined,
    now: new Date(),
    nonInteractive: isNonInteractive(),
  })

  if (existsSync(join(resolved, '.claude'))) {
    process.stderr.write(
      `${GREY}Tip: run \`/seed-sync\` to audit seed drift per section, preserving local customizations.${NC}\n`,
    )
  }

  return code
}

/**
 * Each domain sync runs as its own process. They open their own frames and
 * prompt for their own changes, so stdin stays inherited. Claude is the one
 * exception: it runs headless because the combined pull request preview is the
 * single confirmation gate for the whole sync, and `canon claude sync` writes
 * only `.gitignore`.
 */
async function runDomainSyncs(target: string): Promise<void> {
  const path = cliPath(PROJECT_ROOT)

  for (const domain of SYNC_DOMAINS) {
    if (!shouldSync(target, domain)) continue

    await cliRun(path, [...SYNC_ARGS[domain], target], {
      nonInteractive: domain === 'claude',
    })()
  }
}
