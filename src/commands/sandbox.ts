import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Command } from 'commander'
import { execScript } from '@/exec'
import { checkoutMismatchWarning, PROJECT_ROOT } from '@/project-root'
import {
  assertedPercent,
  collectCensus,
  type CensusReport,
} from '@/sandbox/census'
import {
  collectCoverage,
  coveragePercent,
  type CoverageReport,
} from '@/sandbox/coverage'
import {
  expectFilePath,
  parseTarget,
  resolveVerdict,
  verdictExitCode,
  type RunEnvelope,
  type Verdict,
} from '@/sandbox/expect'
import { sandboxTree } from '@/sandbox/tree'
import {
  frameError,
  intro,
  logError,
  logInfo,
  logRemove,
  logStep,
  logWarn,
  outro,
  select,
} from '@/ui'

const SANDBOX_DIR = join(PROJECT_ROOT, 'scripts', 'sandbox')

/**
 * Reports that the scenario tree does not ship, and answers whether it reported,
 * so a caller that sees `true` returns without touching the tree.
 *
 * `scripts/sandbox` is excluded from the published package, so an installed
 * `canon` resolves `SANDBOX_DIR` to a directory that is not there. Both entry
 * points that walk the tree ask here rather than carrying a check each, because
 * absence is a property of the install rather than of a verb, and a second copy
 * of the question is a second message to keep true. `check` reads the tree as
 * well, through `expectFilePath`, and needs no guard because its provisioned-tree
 * check already stops an installed run before the read.
 *
 * The distinction it preserves is between an absent tree and an empty one. Only
 * the second is a real zero, and a coverage percentage over a denominator nobody
 * looked at reads as a suite that examined everything and found it clean.
 *
 * The frame opens and closes here, so this runs before `intro` rather than
 * inside an open frame.
 */
function reportAbsentScenarioTree(): boolean {
  if (existsSync(SANDBOX_DIR)) return false

  frameError('sandbox is toolkit-only and is absent from an installed canon')
  process.exitCode = 1

  return true
}

/**
 * Holds fixture content for scenarios rather than scenarios of its own.
 * Twin of the `-not -name fixtures` filter in `scripts/manage-sandbox.sh`.
 */
const FIXTURES_DIR = 'fixtures'

/** A run that reported nothing counts as clean, so only real signals fail. */
const CLEAN_ENVELOPE: RunEnvelope = { isError: false, turns: 0, denials: 0 }

interface CheckOptions {
  readonly envelope?: string
  readonly writes?: string
  readonly escapes?: string
  readonly escapesWatched?: boolean
  readonly concurrentSessions?: string
  readonly json?: boolean
  readonly strict?: boolean
}

interface CoverageOptions {
  readonly json?: boolean
  readonly strict?: boolean
  readonly skills?: boolean
}

function getCategories(): string[] {
  return readdirSync(SANDBOX_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== FIXTURES_DIR)
    .map((d) => d.name)
    .sort()
}

function getCommands(category: string): string[] {
  return readdirSync(join(SANDBOX_DIR, category), { withFileTypes: true })
    .filter((f) => f.isFile() && f.name.endsWith('.sh'))
    .map((f) => f.name.replace(/\.sh$/, ''))
    .sort()
}

async function interactivePicker(): Promise<string> {
  intro('canon sandbox')

  const categories = getCategories()
  const category = await select({
    message: 'Select category:',
    options: categories.map((c) => ({ value: c, label: c })),
  })

  const commands = getCommands(category)
  const command = await select({
    message: 'Select command:',
    options: commands.map((c) => ({ value: c, label: c })),
  })

  return `${category}:${command}`
}

/**
 * Reads the `claude -p --output-format json` envelope. Returns undefined when no
 * file was given, so the turn ceiling reports as skipped rather than passing on a
 * fabricated zero. A file that exists but does not parse falls back to clean,
 * since decision 8 lets the envelope fail a run but never pass one.
 *
 * `result` carries the reply text and is left undefined on both fallbacks, which
 * routes a reply assertion to skipped. Fabricating an empty string there would
 * fail every reply assertion on a run that supplied no envelope, turning a gap in
 * the input into a red arm.
 */
function readEnvelope(path: string | undefined): RunEnvelope | undefined {
  if (path === undefined) return undefined
  if (!existsSync(path)) return CLEAN_ENVELOPE

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<
      string,
      unknown
    >
    const denials = parsed.permission_denials

    return {
      isError: parsed.is_error === true,
      turns: typeof parsed.num_turns === 'number' ? parsed.num_turns : 0,
      denials: Array.isArray(denials) ? denials.length : 0,
      reply: typeof parsed.result === 'string' ? parsed.result : undefined,
    }
  } catch {
    return CLEAN_ENVELOPE
  }
}

/**
 * Shared by `--writes` and `--escapes`, which are both a newline-delimited
 * path list written by `run.sh`. Undefined when no file was given, which is
 * not the same as a run that produced no paths. Write scope and escape scope
 * both need that distinction: an empty list is a finding, an absent list is a
 * gap in what the caller supplied.
 */
function readPathList(path: string | undefined): string[] | undefined {
  if (path === undefined) return undefined
  if (!existsSync(path)) return []

  return readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

/**
 * The unchecked count rides the summary line in every verdict, including a pass.
 * It is the number the rollout is measured by, and a count that surfaces only on
 * arms that happen to carry prose is a count nobody drains.
 */
function reportVerdict(verdict: Verdict): void {
  if (verdict.results.length > 0) {
    logStep('Checking expectations')
    for (const result of verdict.results) {
      if (result.ok) logInfo(result.message)
      else logRemove(result.message)
    }
  }

  if (verdict.manual.length > 0) {
    logStep('Not checked (needs a reader)')
    for (const line of verdict.manual) logWarn(line)
  }

  if (verdict.skipped.length > 0) {
    logStep('Not checked (no data supplied)')
    for (const line of verdict.skipped) logWarn(line)
  }

  logStep(`Verdict: ${verdict.state.toUpperCase()}`)
  if (verdict.note !== undefined) logWarn(verdict.note)

  const summary = `${verdict.asserted} asserted, ${verdict.failed} failed, ${verdict.unchecked} unchecked`
  if (verdict.state === 'unchecked') logWarn(summary)
  else logInfo(summary)
}

/**
 * Lists the undeclared scenarios by name rather than counting them. A percentage
 * alone is a number nobody acts on, while a name is the next thing to arm.
 */
function reportCoverage(report: CoverageReport): void {
  const armed = report.scenarios.filter((s) => s.armed.length > 0)
  const bare = report.scenarios.filter((s) => s.armed.length === 0)

  if (armed.length > 0) {
    logStep('Declares expectations')
    for (const scenario of armed) {
      logInfo(
        `${scenario.category}:${scenario.command} (${scenario.armed.join(', ')})`,
      )
    }
  }

  if (bare.length > 0) {
    logStep('Provisions only, asserts nothing')
    for (const scenario of bare)
      logWarn(`${scenario.category}:${scenario.command}`)
  }

  logStep('Coverage')
  const summary =
    `${report.armedScenarios}/${report.totalScenarios} scenarios declared ` +
    `(${coveragePercent(report)}%), ${report.armedArms} armed arms`
  if (bare.length > 0) logWarn(summary)
  else logInfo(summary)
}

/**
 * Names the skills nothing can fail, which is the work queue the arm batches
 * consume. Exempt entries print their reason, since an exemption with no reason
 * beside it is indistinguishable from a skill nobody has got to yet.
 */
function reportCensus(report: CensusReport): void {
  const shouldBe = report.skills.filter(
    (s) => s.verdict === 'should-be-asserted',
  )
  const exempt = report.skills.filter((s) => s.verdict === 'exempt')

  if (shouldBe.length > 0) {
    logStep('No arm can fail these')
    for (const entry of shouldBe)
      logWarn(
        `${entry.skill} (${entry.scenarios.length === 0 ? 'no scenario' : entry.scenarios.join(', ')})`,
      )
  }

  if (exempt.length > 0) {
    logStep('Exempt')
    for (const entry of exempt) logInfo(`${entry.skill}: ${entry.reason}`)
  }

  // A wrong exemption is the one way this report can overstate itself, so both
  // kinds print as errors even on a run that is otherwise clean. They separate
  // because the reader checks a different thing: whether the skill left the
  // tree, or whether an arm landed and the entry outlived its reason.
  if (report.staleExemptions.length > 0) {
    logStep('Exemptions naming no shipped skill')
    for (const skill of report.staleExemptions) logError(skill)
  }

  if (report.supersededExemptions.length > 0) {
    logStep('Exemptions an arm now asserts')
    for (const skill of report.supersededExemptions)
      logError(`${skill}, delete the entry`)
  }

  logStep('Skills')
  const summary =
    `${report.asserted}/${report.totalSkills} skills asserted ` +
    `(${assertedPercent(report)}%), ${report.shouldBeAsserted} should be, ` +
    `${report.exempt} exempt`
  if (report.shouldBeAsserted > 0) logWarn(summary)
  else logInfo(summary)
}

function runCoverage(options: CoverageOptions): void {
  if (reportAbsentScenarioTree()) return

  intro('canon sandbox coverage')

  const mismatch = checkoutMismatchWarning(process.cwd())
  if (mismatch !== undefined) logWarn(mismatch)

  const report = collectCoverage(PROJECT_ROOT)

  // A broken `exempt.toml` reads as a caller error, not as a crash. The parser
  // throws rather than returning a smaller set, since a dropped exemption is
  // invisible in the counts, and the conversion belongs here for the reason
  // `resolveVerdict` catches its own parse: a typo in a declaration should read
  // the way a pattern that does not compile does rather than as a stack trace.
  let census: CensusReport | undefined
  if (options.skills === true) {
    try {
      census = collectCensus(PROJECT_ROOT, report)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      reportCoverage(report)
      logStep('Skills')
      logError(`Cannot read the exemptions: ${reason}`)
      outro()
      process.exitCode = 1

      return
    }
  }

  // The scenario view stays whichever way `--skills` is set. The two count
  // different denominators, and replacing one with the other loses the scenario
  // rollout the strict gate is written against.
  reportCoverage(report)
  if (census !== undefined) reportCensus(census)

  if (options.json === true)
    process.stdout.write(
      `${JSON.stringify(census === undefined ? report : { ...report, ...census })}\n`,
    )

  outro()

  // A wrong exemption exits non-zero without `--strict`. It is a wrong claim in
  // committed data rather than a rollout still in progress, and the whole point
  // of the verdict is that an exemption someone can no longer check is worse
  // than no exemption at all.
  const wrongExemption =
    (census?.staleExemptions.length ?? 0) > 0 ||
    (census?.supersededExemptions.length ?? 0) > 0
  const rolloutIncomplete =
    options.strict === true && report.armedScenarios < report.totalScenarios
  process.exitCode = wrongExemption || rolloutIncomplete ? 1 : 0
}

function runCheck(
  target: string,
  arm: string | undefined,
  options: CheckOptions,
): void {
  intro('canon sandbox check')

  const mismatch = checkoutMismatchWarning(process.cwd())
  if (mismatch !== undefined) logWarn(mismatch)

  const parsed = parseTarget(target)
  if (parsed === undefined) {
    logError(
      'Invalid target. Use <category>:<command>, e.g. claude:context-fold.',
    )
    outro()
    process.exitCode = 1
    return
  }

  // A sandbox that was never provisioned fails every path assertion, reading as a
  // skill that did nothing rather than a caller that ran check too early. The
  // whole point of a verdict is that it means what it says.
  const sandboxDir = sandboxTree()
  if (!existsSync(sandboxDir)) {
    logError(`No sandbox at ${sandboxDir}. Provision one with canon sandbox.`)
    outro()
    process.exitCode = 1
    return
  }

  const verdict = resolveVerdict(
    expectFilePath(PROJECT_ROOT, parsed.category, parsed.command, arm ?? ''),
    {
      sandboxDir,
      writes: readPathList(options.writes),
      escapes: readPathList(options.escapes),
      escapesWatched:
        options.escapes === undefined
          ? undefined
          : options.escapesWatched === true,
      concurrentSessions: readPathList(options.concurrentSessions),
      envelope: readEnvelope(options.envelope),
    },
  )

  // The report always renders on stderr. `--json` adds the machine copy on
  // stdout rather than replacing the frame, per the stream contract in
  // `docs/agents/output-shape.md`, so one invocation serves a human and a caller at once.
  reportVerdict(verdict)
  if (options.json === true)
    process.stdout.write(`${JSON.stringify(verdict)}\n`)

  outro()
  process.exitCode = verdictExitCode(verdict.state, options.strict === true)
}

export function register(program: Command): void {
  const sandbox = program
    .command('sandbox')
    .description('Provision and run sandbox scenarios')
    .allowUnknownOption()
    .allowExcessArguments(true)
    .passThroughOptions()
    .action(async (_opts: unknown, cmd: Command) => {
      if (reportAbsentScenarioTree()) return

      const args = cmd.args

      if (args.length === 0) {
        const resolved = await interactivePicker()
        await execScript('manage-sandbox.sh', ['--no-header', resolved])
      } else {
        await execScript('manage-sandbox.sh', args)
      }
    })

  sandbox
    .command('check')
    .description('Check a provisioned sandbox against a scenario expectation')
    .argument(
      '<target>',
      'Scenario as <category>:<command>, e.g. claude:context-fold',
    )
    .argument('[arm]', 'Named scenario arm, e.g. drift')
    .helpOption('-h, --help', 'Show this help message')
    .option('--envelope <file>', 'Run envelope JSON from claude -p')
    .option('--writes <file>', 'Newline-delimited paths the session wrote')
    .option(
      '--escapes <file>',
      'Newline-delimited paths written to a watched toolkit root, for escape scope',
    )
    .option(
      '--escapes-watched',
      'At least one watched root held a target this run, so a zero-escape file is a clean watch rather than one with nothing to watch',
    )
    .option(
      '--concurrent-sessions <file>',
      'Newline-delimited sessions live in the registry both before and after this run, a witness for an unbounded escape',
    )
    .option('--json', 'Emit the verdict as JSON on stdout')
    .option('--strict', 'Exit non-zero when the arm declares no expectation')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  canon sandbox check claude:context-fold drift',
        '  canon sandbox check claude:context-fold drift --envelope run.json --json',
        '',
        'Exit codes: 0 on pass or unchecked, 1 on failure.',
        'With --strict, unchecked exits 1 as well.',
      ].join('\n'),
    )
    .action(
      (target: string, arm: string | undefined, options: CheckOptions) => {
        runCheck(target, arm, options)
      },
    )

  sandbox
    .command('coverage')
    .description('Report which scenarios declare expectations')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Emit the report as JSON on stdout')
    .option('--strict', 'Exit non-zero while any scenario declares nothing')
    .option('--skills', 'Add a per-skill asserted, should-be, or exempt census')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  canon sandbox coverage',
        '  canon sandbox coverage --json',
        '  canon sandbox coverage --skills',
        '',
        'Exit codes: 0, unless --strict and a scenario declares nothing, or',
        '--skills and an exemption names no shipped skill or one an arm asserts.',
        'Where the scenario tree does not ship, exits 1 without a report.',
      ].join('\n'),
    )
    .action((options: CoverageOptions) => {
      runCoverage(options)
    })
}
