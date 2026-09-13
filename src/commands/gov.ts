import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import type { Command } from 'commander'
import {
  type CountFinding,
  type CountsRefusal,
  type CountsReport,
  scanCounts,
} from '@/counts/scan'
import { checkoutMismatchWarning, PROJECT_ROOT } from '@/project-root'
import { creationRel, SCRATCH } from '@/record-root'
import { createGovAdapter } from '@/gov/adapter'
import { regenConsumedRules } from '@/gov/consumed'
import { installRules, lookupRules } from '@/gov/install'
import { buildGovCatalog, describeRule, describeStack } from '@/gov/list'
import { buildRulesPayload, listRuleFiles } from '@/gov/payload'
import {
  govStackExists,
  listGovStacks,
  mergeExtraRules,
  resolveRules,
} from '@/gov/stacks'
import {
  INSTRUCTIONS_REL,
  type RestatedEntry,
  type RestatedRefusal,
  type RestatedReport,
  readRestated,
  RULES_REL as RESTATED_RULES_REL,
  SEED_REL,
  SHIPPED_SKILLS_REL,
} from '@/gov/restated'
import {
  CITATION_MARKER,
  type CitationReport,
  GLOB_CORPUS,
  readCitations,
  RULE_DIRS,
  type RuleCitation,
} from '@/gov/citations'
import {
  readSuperseded,
  SUPERSEDED_MARKER,
  type SupersededHit,
  type SupersededReport,
} from '@/gov/superseded'
import {
  type PairRecord,
  readTestOrder,
  type TestOrderReport,
} from '@/gov/test-order'
import { recordStamp, runDomainSync } from '@/sync/engine'
import { writeChainStamp } from '@/sync/stamp'
import { resolveTarget } from '@/target'
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

/**
 * Where the rules payload lands, resolved per target rather than once at import.
 *
 * The record root a project uses is a fact about that project, and this command
 * writes into a target the caller named, so a value computed here against this
 * process's own tree would point every target at whichever root the toolkit
 * happens to hold.
 */
function payloadRel(root: string): string {
  return creationRel(root, SCRATCH, 'gov', 'rules.md')
}
const RULES_REL = join('.claude', 'rules')
const CANON_RULES_REL = join('.claude', 'rules', 'canon')

interface InstallOptions {
  readonly add?: string
}

interface RegenOptions {
  readonly root?: string
}

interface ListOptions {
  readonly stacks?: boolean
  readonly rules?: boolean
  readonly json?: boolean
}

interface TestOrderOptions {
  readonly base?: string
  readonly root?: string
  readonly json?: boolean
}

interface SupersededOptions {
  readonly root?: string
  readonly json?: boolean
}

interface CitationsOptions {
  readonly root?: string
  readonly json?: boolean
}

interface RestatedOptions {
  readonly root?: string
  readonly json?: boolean
}

interface CountsOptions {
  readonly root?: string
  readonly json?: boolean
}

/** What a reader does about each way the sweep produced no reading. */
const RESTATED_REFUSALS: Record<RestatedRefusal, string> = {
  'no-instructions': `No ${INSTRUCTIONS_REL} here, or it carries no bullet, so there is no instruction corpus to sweep.`,
  'no-surfaces': `None of ${SEED_REL}, ${SHIPPED_SKILLS_REL}/, or ${RESTATED_RULES_REL}/ is here, so no further surface exists to match against.`,
}

const COUNTS_REFUSALS: Record<CountsRefusal, string> = {
  'no-git':
    'This tree is not a git checkout, so there is no tracked markdown corpus to read.',
  'no-markdown': 'No markdown file in this tree, so there is nothing to scan.',
}

export function register(program: Command): void {
  const gov = program
    .command('gov')
    .description('Governance commands (install, sync, build, list)')
    .helpOption('-h, --help', 'Show this help message')

  gov
    .command('install')
    .description('Install a governance stack into .claude/rules/canon/')
    .argument('[stack]', 'Stack name (e.g. base, node, react)')
    .argument('[target]', 'Target directory', '.')
    .helpOption('-h, --help', 'Show this help message')
    .option('--add <rules>', 'Comma-separated rules to layer on the stack')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  canon gov install react',
        '  canon gov install node ../my-app',
        '  canon gov install astro --add 200-react,260-shadcn ../my-app',
        '',
      ].join('\n'),
    )
    .action(
      async (
        stack: string | undefined,
        target: string,
        opts: InstallOptions,
      ) => {
        process.exitCode = await runInstall(stack, target, opts)
      },
    )

  gov
    .command('sync')
    .description('Update rules already installed under .claude/rules/canon/')
    .argument('[target]', 'Target directory', '.')
    .helpOption('-h, --help', 'Show this help message')
    .action(async (target: string) => {
      process.exitCode = await runDomainSync(
        createGovAdapter(PROJECT_ROOT),
        target,
        { protectedRoot: PROJECT_ROOT },
      )
    })

  gov
    .command('build')
    .description('Concatenate installed rules into .canon/tmp/gov/rules.md')
    .argument('[target]', 'Target directory', '.')
    .helpOption('-h, --help', 'Show this help message')
    .action(async (target: string) => {
      process.exitCode = await runBuild(target)
    })

  gov
    .command('regen')
    .description("Rebuild a repository's own .claude/rules/ from its record")
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Repository root to regenerate', PROJECT_ROOT)
    .addHelpText(
      'after',
      [
        '',
        'Reads internal/governance.toml and installs the stack it names, plus',
        'any rules under internal/rules/. Unlike install and sync, this runs',
        'against the toolkit root, whose .claude/rules/ is produced output.',
        '',
      ].join('\n'),
    )
    .action(async (opts: RegenOptions, cmd: Command) => {
      process.exitCode = await runRegen(
        opts,
        cmd.getOptionValueSource('root') === 'cli',
      )
    })

  gov
    .command('list')
    .description('Emit the catalog of stacks and rules')
    .helpOption('-h, --help', 'Show this help message')
    .option('--stacks', 'Only list stacks')
    .option('--rules', 'Only list rules')
    .option('--json', 'Emit machine-readable JSON')
    .action((opts: ListOptions) => {
      process.exitCode = runList(opts)
    })

  gov
    .command('test-order')
    .description(
      'Report where an implementation reached history before its test',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--base <ref>', 'Far side of the range, defaulting to the trunk')
    .option('--root <path>', 'Repository to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Measures the rule in .claude/rules/canon/core/070-planning.md that asks for',
        'the test before the code. It reports and never gates, because pairing',
        'a test to an implementation is a judgment.',
        '',
        'Coverage:',
        '  a test sits beside its subject under the same name, minus .test',
        '  only .ts and .tsx are paired, and every other path is named as read past',
        '  a module the range modified rather than added is unclassified, since',
        '  a refactor and a new behavior cannot be told apart from history',
        '',
        'Exit codes:',
        '  0  no implementation reached history ahead of its test',
        '  1  refused, with the reason on stderr or in the JSON record',
        '  2  at least one implementation reached history ahead of its test',
        '',
        'Examples:',
        '  canon gov test-order',
        '  canon gov test-order --base origin/main --json',
        '',
      ].join('\n'),
    )
    .action((opts: TestOrderOptions) => {
      process.exitCode = runTestOrder(opts)
    })

  gov
    .command('counts')
    .description(
      'Report a self-stated catalog count that disagrees with what the tree holds',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Tree to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Reads every tracked markdown file for a sentence stating how many',
        'members a closed catalog holds, then compares the stated figure',
        'against what the tree actually counts.',
        '',
        'Catalogs read: skills, governance rules, standards, snippets, CLI',
        'commands, and audit ids. Closed rather than derived, so widening the',
        'set is a deliberate change rather than a side effect of a new list',
        'command shipping elsewhere.',
        '',
        'A sentence carrying a calendar date or a backticked commit reference',
        'is read past, since that is how this corpus already marks a figure as',
        'a historical record rather than a live claim.',
        '',
        'What it does not measure:',
        '  a delta phrased as a transition (from fourteen to fifteen) and a',
        '  fraction (thirteen of sixteen) are both catalog-size claims this',
        '  corpus carries, and neither matches the number-then-noun shape read here',
        '',
        'Exit codes:',
        '  0  no stated figure disagrees with the tree',
        '  1  refused, with the reason on stderr or in the JSON record',
        '  2  at least one stated figure disagrees with the tree',
        '',
        'It reports and never gates. The false-positive rate is read off the',
        'first run rather than assumed, and a push failing on a stated figure',
        'that reads correctly to a person would teach a contributor to route',
        'around the stage.',
        '',
        'Examples:',
        '  canon gov counts',
        '  canon gov counts --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: CountsOptions) => {
      process.exitCode = await runCounts(opts)
    })

  gov
    .command('superseded')
    .description(
      'Report where the tree still asserts a value a changed convention no longer produces',
    )
    .argument('<superseded>', 'The value the convention used to produce')
    .argument('<replacement>', 'What it produces now')
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Tree to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Keyed on the value rather than on the file stating the rule. A fixture',
        'asserting an old output names neither the rule nor the standard behind',
        'it, so a file-scoped map from the changed rule reaches none of them and',
        'the value both sides carry is the only key there is.',
        '',
        'It reports and never gates. A string appears for reasons unrelated to',
        'the convention, so the output is a reading rather than a verdict, and a',
        'declaration disagreeing for a stated reason carries a',
        `\`${SUPERSEDED_MARKER}: <reason>\` marker on its own line or the one above.`,
        '',
        'Pass an empty replacement to retire a value outright. Findings report',
        'the same way, none is annotated, since a line cannot carry a',
        'replacement that does not exist, and no templated form is read, since',
        'there is no second value for a stem to diverge from.',
        '',
        'Templated forms, matched on the segment the two values differ on:',
        '  glob         <stem>-* , the family written as a pattern',
        '  placeholder  <stem>-<X> , the family written with a stand-in segment',
        '  prefix       <stem>- , the family written bare',
        '',
        'A hit under one of them counts as a finding, since a stale templated',
        'citation is as real as a literal one. Each carries the nearest heading',
        'above it in a markdown file, because a line reading as a prohibition',
        'under one section reads as an instruction under another.',
        '',
        'Blind spots:',
        '  a prose reference that went stale without carrying the value, such as',
        '  a declaration citing the wrong standard for the transform, matches',
        '  nothing here and is reached by reading rather than by this sweep',
        '  a family named in any other form, such as a bracket style other than',
        '  <>, a trailing glob with no separator, or a description in words',
        '',
        'Exit codes:',
        '  0  nothing in the corpus asserts the superseded value or its family',
        '  1  refused, with the reason on stderr or in the JSON record',
        '  2  at least one declaration asserts either',
        '',
        'Examples:',
        '  canon gov superseded feature-feat- feature-',
        '  canon gov superseded feature-feat- feature- --json',
        '',
      ].join('\n'),
    )
    .action(
      async (
        superseded: string,
        replacement: string,
        opts: SupersededOptions,
      ) => {
        process.exitCode = await runSuperseded(superseded, replacement, opts)
      },
    )

  gov
    .command('citations')
    .description(
      'Resolve every path a rule cites and every internal frontmatter glob, naming the ones reaching nothing',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Tree to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        `Reads bodies across ${RULE_DIRS.join(' and ')}, and frontmatter globs`,
        `under ${GLOB_CORPUS} alone. A rule citing a file that moved fails`,
        'silently: nothing resolves the path until a session opens it, and the',
        'drift check beside this one passes an authored rule and its consumed',
        'copy that are wrong together. A rule whose glob names a directory that',
        'moved fails the same way, by never firing again.',
        '',
        'This gates, unlike the superseded sweep beside it. A path resolving to',
        'nothing carries no judgment, and the classes where absence is correct',
        'are separated before the verdict rather than left for a reader.',
        '',
        `Frontmatter globs read under ${GLOB_CORPUS} and nowhere else. A rule`,
        `under ${RULE_DIRS[0]} installs into a target and its paths: entries`,
        "name that project's shape, so src/pages/** in the Astro rule cannot be",
        'told by pattern from a path here. Measured over that corpus, 32 of 72',
        'globs match nothing in this tree and every one of them is correct, so',
        'gating them would ship an exemption list the length of the corpus. The',
        'internal corpus ships nowhere, which makes the tree it governs the tree',
        'present and the question answerable.',
        '',
        'Forms read, with where each resolves:',
        '  standard  canon standards <name> , against standards/ alone, which',
        '            is where the verb itself looks. internal/standards/ is not',
        '            tried, since a name resolving only there refuses for the',
        '            session that opens the citation.',
        '  path      a backticked path carrying a directory segment and a file',
        '            extension, against the root',
        "  sibling   a bare <nnn>-<slug>.md , against the citing rule's folder",
        '',
        'Not read, each a shape the corpus writes and none of them a citation:',
        '  a placeholder or glob segment, which describes a shape rather than',
        '  naming a file, such as canon/context/<domain>.md or app/**/route.ts',
        '  a bare filename naming a convention, such as route.ts or manifest.toml',
        '  a span carrying no file extension, which is a folder or a module',
        '  specifier, such as src/pages/ , next/font , or claude/standards',
        '  a fenced block, which displays a path rather than pointing at one',
        '',
        'Exempt, reported by name rather than dropped:',
        '  governed  the citing rule spells the path in its own frontmatter, so',
        '            it names a target artifact rather than a file here. A glob',
        '            never exempts, since a typo inside one is the defect.',
        '  ignored   git ignores the path, which is session scratch a clone is',
        '            not expected to hold',
        `  exempt    the line carries a \`${CITATION_MARKER}: <reason>\` marker`,
        '            on itself or the one above',
        '',
        'Blind spots: a citation that resolves and points at the wrong file, a',
        'path written without backticks, a folder or a path carrying no extension,',
        'which this declines rather than guesses at, and a glob that matches real',
        'files while reaching none of the work it was scoped at, which is a',
        'reading rather than a resolution.',
        '',
        'Exit codes:',
        '  0  every citation resolves or is exempt, and every glob read matches',
        '  1  refused, with the reason on stderr or in the JSON record',
        '  2  at least one cited path resolves to nothing, or one glob matches',
        '     nothing in this tree',
        '',
        'Examples:',
        '  canon gov citations',
        '  canon gov citations --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: CitationsOptions) => {
      process.exitCode = await runCitations(opts)
    })

  gov
    .command('restated')
    .description(
      'Report every instruction the always-loaded file states that a second surface states too',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Tree to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        `Matches every bullet in ${INSTRUCTIONS_REL} and every rule under`,
        `${RESTATED_RULES_REL}/ against ${SEED_REL}, every`,
        `${SHIPPED_SKILLS_REL}/*/SKILL.md body, and every other rule. Matching is`,
        'recall-first, keyed on distinctive tokens two statements share rather',
        'than on a phrase they spell the same way, because the case this exists',
        'for was one rule written three different ways.',
        '',
        'What it separates:',
        '  mirror         a declared authoring-to-consumed pair, where repeating is the design',
        '  repetition     two surfaces state one rule and neither is declared a copy',
        '  contradiction  the prohibition falls on one surface alone, on a strong match',
        '',
        'The contradiction class is a polarity reading rather than a judgment',
        'about meaning, so weigh each against the surfaces it names.',
        '',
        'What it does not measure:',
        '  a rule stated in two skill bodies and never in the always-loaded file',
        '  or a path-scoped rule, since a body is searched but never read as a subject',
        '',
        'Exit codes:',
        '  0  no instruction is restated outside a declared mirror',
        '  1  refused, with the reason on stderr or in the JSON record',
        '  2  at least one instruction is restated outside a declared mirror',
        '',
        'Examples:',
        '  canon gov restated',
        '  canon gov restated --json',
        '',
      ].join('\n'),
    )
    .action((opts: RestatedOptions) => {
      process.exitCode = runRestated(opts)
    })
}

/**
 * Reports and never gates, matching the two sweeps above. A restatement is
 * legitimate more often than not, so failing a push on one would fail on the
 * ordinary case and teach contributors to route around the stage.
 */
function runRestated(opts: RestatedOptions): number {
  const root = resolve(opts.root ?? process.cwd())
  const report = readRestated(root)
  const emitJson = opts.json ?? false

  if (report.kind === 'unreadable') {
    intro('canon gov restated')
    logStep('Refused')
    logWarn(RESTATED_REFUSALS[report.reason])
    outro()

    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({
          root,
          reason: report.reason,
          message: RESTATED_REFUSALS[report.reason],
        })}\n`,
      )
    }

    return 1
  }

  reportRestated(report, root)

  if (emitJson) {
    process.stdout.write(`${JSON.stringify({ root, ...report })}\n`)
  }

  const findings = report.counts.contradictions + report.counts.repetitions
  return findings > 0 ? 2 : 0
}

function describeEntry(entry: RestatedEntry): string[] {
  const lines = [`${entry.subject.file}:${entry.subject.line}`]

  for (const surface of entry.surfaces) {
    lines.push(
      `  [${surface.restatement}] ${surface.file}:${surface.line} via ${surface.anchors.join(', ')}`,
    )
  }

  return lines
}

function reportRestated(
  report: Extract<RestatedReport, { kind: 'measured' }>,
  root: string,
): void {
  intro('canon gov restated')

  // A count of what matched reads as a verdict on the repository unless the run
  // also says how wide the corpus behind it was.
  logStep('Corpus')
  logInfo(
    `${report.corpus.instructions} always-loaded instruction(s) and ${report.corpus.rules} rule file(s) against ${report.corpus.candidates} statement(s) from the seed, ${report.corpus.bodies} shipped body/bodies, and every rule again, in ${root}`,
  )
  logInfo(
    `matched on ${report.matcher.anchors} weighted anchor(s), dropping any token in more than ${report.matcher.common} statements`,
  )

  // Named rather than counted. A polarity split is the only class claiming a
  // defect, and a reader weighing one has to reach both surfaces.
  logStep(
    report.counts.contradictions === 0 ? 'No contradiction' : 'Contradictions',
  )
  if (report.counts.contradictions === 0) {
    logInfo('no restatement puts a prohibition on one surface alone')
  } else {
    for (const entry of report.restatements) {
      const carries = entry.surfaces.some(
        (surface) => surface.restatement === 'contradiction',
      )
      if (!carries) continue
      for (const line of describeEntry(entry)) logWarn(line)
    }
  }

  logStep('Restated')
  logInfo(
    `${report.counts.repetitions} repetition(s) outside a declared mirror, and ${report.counts.mirrors} on one`,
  )
  logInfo(
    `${report.counts.threeSurface} instruction(s) reach three surfaces or more`,
  )

  outro()
}

/**
 * Reports and never gates, matching `test-order` above. The finding count moves
 * the exit code with nothing wiring it into a push, since a value sweep
 * over-reports by construction and gating a measure carrying a known
 * false-positive class is what teaches contributors to route around a stage.
 */
async function runSuperseded(
  superseded: string,
  replacement: string,
  opts: SupersededOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const report = await readSuperseded(root, { superseded, replacement })
  const emitJson = opts.json ?? false

  if (report.kind === 'unreadable') {
    intro('canon gov superseded')
    logStep('Refused')
    logError(report.reason)
    outro()

    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({ ok: false, reason: report.reason })}\n`,
      )
    }

    return 1
  }

  reportSuperseded(report, root)

  if (emitJson) {
    process.stdout.write(`${JSON.stringify({ ok: true, root, ...report })}\n`)
  }

  return report.findings.length > 0 ? 2 : 0
}

/**
 * Gates, unlike `superseded` and `test-order` above. The classes where a path
 * reaching nothing is correct are separated inside the sweep, which is what
 * leaves the remainder a defect with no judgment in it, so a finding fails the
 * push rather than asking a reader to weigh it.
 */
async function runCitations(opts: CitationsOptions): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const report = await readCitations(root)
  const emitJson = opts.json ?? false

  if (report.kind === 'unreadable') {
    intro('canon gov citations')
    logStep('Refused')
    logError(report.reason)
    outro()

    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({ ok: false, reason: report.reason })}\n`,
      )
    }

    return 1
  }

  const dead = report.citations.filter((citation) => citation.status === 'dead')
  const unmatched = report.globs.filter((glob) => !glob.matched)
  reportCitations(report, root)

  if (emitJson) {
    process.stdout.write(`${JSON.stringify({ ok: true, root, ...report })}\n`)
  }

  return dead.length + unmatched.length > 0 ? 2 : 0
}

function describeCitation(citation: RuleCitation): string {
  const tried = citation.candidates.join(', ')
  return `[${citation.form}] ${citation.file}:${citation.line}: ${citation.cited} reaches nothing at ${tried}`
}

/**
 * Named rather than counted, matching the exempt section of the sweep beside
 * this one. An exemption is a judgment the tree recorded, and a reader weighing
 * this report has to be able to reach the line that carries it.
 */
function reportExcused(
  citations: readonly RuleCitation[],
  status: RuleCitation['status'],
  label: string,
  empty: string,
): void {
  const excused = citations.filter((citation) => citation.status === status)

  logStep(label)
  if (excused.length === 0) {
    logInfo(empty)
    return
  }

  for (const citation of excused) {
    logInfo(`${citation.file}:${citation.line}: ${citation.cited}`)
  }
}

/**
 * Names the corpus on every run, clean or not.
 *
 * A section reporting that every glob resolves, over a corpus the reader
 * assumes is both of them, says the shipped rules were checked and they were
 * not. The scope is the finding here as much as the count is.
 */
function reportGlobs(
  report: Extract<CitationReport, { kind: 'measured' }>,
): void {
  const unmatched = report.globs.filter((glob) => !glob.matched)

  logStep('Frontmatter globs')
  logInfo(`${report.globs.length} globs read, under ${GLOB_CORPUS} alone`)

  if (unmatched.length === 0) {
    logInfo('every glob matches a file in this tree')
  } else {
    for (const glob of unmatched) {
      logError(
        `${glob.file}:${glob.line}: ${glob.glob} matches nothing, so the rule never fires`,
      )
    }
  }

  logInfo(
    `not read: a glob under ${RULE_DIRS[0]}, which names the shape a target holds rather than this tree, and a glob matching real files while reaching none of the work it was scoped at`,
  )
}

function reportCitations(
  report: Extract<CitationReport, { kind: 'measured' }>,
  root: string,
): void {
  intro('canon gov citations')

  logStep('Sweep')
  logInfo(`${report.rules} rules under ${RULE_DIRS.join(' and ')} in ${root}`)

  const counted = new Map<RuleCitation['form'], number>()
  for (const citation of report.citations) {
    counted.set(citation.form, (counted.get(citation.form) ?? 0) + 1)
  }
  logInfo(
    report.citations.length === 0
      ? 'no citation in either corpus'
      : `${report.citations.length} citations: ${[...counted]
          .map(([form, count]) => `${count} ${form}`)
          .join(', ')}`,
  )

  const dead = report.citations.filter((citation) => citation.status === 'dead')

  logStep('Unresolved')
  if (dead.length === 0) {
    logInfo('every cited path resolves')
  } else {
    for (const citation of dead) logError(describeCitation(citation))
  }

  reportGlobs(report)

  reportExcused(
    report.citations,
    'governed',
    'Governed',
    'no rule cites a path it declares in its own frontmatter',
  )
  reportExcused(
    report.citations,
    'ignored',
    'Ignored',
    'no rule cites a path git ignores',
  )
  reportExcused(
    report.citations,
    'exempt',
    'Exempt',
    `no line carries a ${CITATION_MARKER} marker`,
  )

  logInfo(
    'not read: a citation that resolves and points at the wrong file, a path written without backticks, and a folder or a path carrying no extension',
  )

  outro()
}

function describeHit(hit: SupersededHit): string {
  const note = hit.carriesReplacement
    ? ' (the replacement is on this line)'
    : ''
  const section = hit.heading === undefined ? '' : ` under ${hit.heading}`
  return `[${hit.match}] ${hit.file}:${hit.line}:${hit.column}${section}${note}: ${hit.preview}`
}

/**
 * Named separately from the literal hits rather than counted in with them. A
 * templated hit is a wider match on a shorter string, so a reader weighing one
 * is weighing a different question, and the section is where the forms it still
 * cannot read are stated.
 */
function reportTemplated(
  report: Extract<SupersededReport, { kind: 'measured' }>,
): void {
  const templated = report.findings.filter((hit) => hit.match !== 'literal')

  logStep('Templated')
  if (report.stems === undefined) {
    logInfo(
      'no stem derives from these two values, so no templated citation was read',
    )
  } else if (templated.length === 0) {
    logInfo(
      `nothing names the family as ${report.stems.superseded}-*, ${report.stems.superseded}-<X>, or ${report.stems.superseded}- bare`,
    )
  } else {
    for (const hit of templated) logWarn(describeHit(hit))
  }

  logInfo(
    'not read: a family named in any other form, such as a bracket style other than <>, a trailing glob with no separator, or a description in words',
  )
}

function reportSuperseded(
  report: Extract<SupersededReport, { kind: 'measured' }>,
  root: string,
): void {
  intro('canon gov superseded')

  logStep('Sweep')
  logInfo(`${report.superseded} → ${report.replacement} in ${root}`)
  logInfo(
    report.stems === undefined
      ? 'no family stem, so the sweep is the literal value alone'
      : `family stem ${report.stems.superseded} → ${report.stems.replacement}`,
  )

  const literal = report.findings.filter((hit) => hit.match === 'literal')

  // Named for the kind rather than for a verdict. `Clean` over the literal half
  // alone would read as a clean tree on a run whose templated half is the one
  // carrying every finding.
  logStep('Literal')
  if (literal.length === 0) {
    logInfo('nothing in the corpus asserts the superseded value')
  } else {
    for (const finding of literal) logWarn(describeHit(finding))
  }

  reportTemplated(report)

  // Named rather than counted. A muted line is a judgment someone recorded,
  // and a reader weighing this report has to be able to reach the reason.
  logStep('Exempt')
  if (report.exempt.length === 0) {
    logInfo('no line carries a marker')
  } else {
    for (const hit of report.exempt) logInfo(describeHit(hit))
  }

  // A count of what passed reads as a verdict on the repository unless the run
  // also says how much of it the corpus left out.
  logStep('Corpus')
  logInfo(
    `${report.files} file(s) opened of ${report.listed} listed, ${report.skipped} skipped as binary or unreadable`,
  )

  outro()
}

/**
 * Reports and never gates, so the finding count moves the exit code without
 * anything wiring it into a push. `canon tasks validate` set that shape: a
 * measure carrying a known false-positive class is what forces contributors to
 * route around a stage, and the unclassified bucket here is that class.
 */
function runTestOrder(opts: TestOrderOptions): number {
  const root = resolve(opts.root ?? process.cwd())
  const report = readTestOrder(root, { base: opts.base })
  const emitJson = opts.json ?? false

  // The frame renders on stderr in both modes and the record goes to stdout
  // alone, which is the split `docs/agents/output-shape.md` fixes. A consumer
  // reading stdout sees pure data either way, and an operator reading the
  // terminal sees the refusal rather than a command that appeared to do nothing.
  if (report.kind === 'unreadable') {
    intro('canon gov test-order')
    logStep('Refused')
    logError(report.message)
    outro()

    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({ root, reason: report.reason, message: report.message })}\n`,
      )
    }

    return 1
  }

  reportTestOrder(report, root)

  if (emitJson) {
    process.stdout.write(`${JSON.stringify({ ok: true, root, ...report })}\n`)
  }

  return report.findings.length > 0 ? 2 : 0
}

function describePair(record: PairRecord): string {
  const test = record.test === null ? 'no test' : record.test
  return `${record.subject} → ${test}: ${record.reason}`
}

function reportTestOrder(
  report: Extract<TestOrderReport, { kind: 'measured' }>,
  root: string,
): void {
  intro('canon gov test-order')

  logStep('Range')
  logInfo(`${report.base.slice(0, 8)}..${report.head.slice(0, 8)} in ${root}`)

  logStep(report.findings.length === 0 ? 'Clean' : 'Findings')
  if (report.findings.length === 0) {
    logInfo('no implementation reached history ahead of the test covering it')
  } else {
    for (const finding of report.findings) logWarn(describePair(finding))
  }

  logStep('Satisfied')
  logInfo(`${report.satisfied.length} pair(s) whose test came first`)

  // The unclassified rows carry the warn glyph and move no exit code. A pass
  // over a change the pairing could not read is the claim this check exists to
  // avoid making, so the rows are named rather than counted into the clean line.
  logStep('Unclassified')
  if (report.unclassified.length === 0) {
    logInfo('every changed module paired')
  } else {
    logWarn(
      `${report.unclassified.length} change(s) the pairing could not read`,
    )
    for (const record of report.unclassified) logWarn(describePair(record))
  }

  // Coverage is narrower than the rule, and a report that did not say so would
  // read as a verdict over every behavior in the range.
  logStep('Read past')
  logInfo(
    `${report.ignored.length} path(s) outside ${report.scope.extensions.join(', ')}`,
  )

  outro()
}

/**
 * Reports and never gates, matching the two sweeps above. The false-positive
 * rate here is unmeasured before a first run against a real corpus, and
 * gating a measure with an unknown false-positive rate is what teaches a
 * contributor to route around the stage.
 */
async function runCounts(opts: CountsOptions): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const report = await scanCounts(root)
  const emitJson = opts.json ?? false

  if (report.kind === 'unreadable') {
    intro('canon gov counts')
    logStep('Refused')
    logWarn(COUNTS_REFUSALS[report.reason])
    outro()

    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({
          root,
          reason: report.reason,
          message: COUNTS_REFUSALS[report.reason],
        })}\n`,
      )
    }

    return 1
  }

  reportCounts(report, root)

  if (emitJson) {
    process.stdout.write(`${JSON.stringify({ root, ...report })}\n`)
  }

  return report.findings.length > 0 ? 2 : 0
}

function describeFinding(finding: CountFinding): string {
  return `${finding.file}:${finding.line} states ${finding.stated} but the tree holds ${finding.actual} ${finding.catalog}`
}

function reportCounts(
  report: Extract<CountsReport, { kind: 'measured' }>,
  root: string,
): void {
  intro('canon gov counts')

  logStep('Corpus')
  logInfo(`${report.filesScanned} tracked markdown file(s) in ${root}`)
  logInfo(
    Object.entries(report.catalogs)
      .map(([id, count]) => `${id}: ${count ?? 'n/a'}`)
      .join(', '),
  )

  logStep(report.findings.length === 0 ? 'Clean' : 'Findings')
  if (report.findings.length === 0) {
    logInfo('no self-stated catalog count disagrees with the tree')
  } else {
    for (const finding of report.findings) logWarn(describeFinding(finding))
  }

  outro()
}

/**
 * Both selectors absent means both sections, which is the bash default. Naming
 * both is the same as naming neither rather than an error, since the two flags
 * read as filters and a caller passing both is asking for everything.
 */
function selectedSections(opts: ListOptions): {
  stacks: boolean
  rules: boolean
} {
  const stacks = opts.stacks === true
  const rules = opts.rules === true
  if (stacks === rules) return { stacks: true, rules: true }
  return { stacks, rules }
}

/**
 * `JSON.stringify` replaces a `printf` that interpolated a description into a
 * JSON string literal through a hand-rolled escaper, so a rule carrying a
 * character that escaper missed emitted output a consuming skill could not
 * parse.
 *
 * `unreferenced` rides the same payload rather than taking a flag of its own.
 * The verify stage and a skill asking what a stack leaves out read one call,
 * and the key is additive, so a consumer reading `stacks` or `rules` is
 * untouched by it.
 */
function runList(opts: ListOptions): number {
  // The warning is a frame-interior line, so it goes out after `intro` on the
  // path that opens one and bare on the `--json` path, which returns first and
  // opens none. One position cannot serve both.
  const mismatch = checkoutMismatchWarning(process.cwd())
  const catalog = buildGovCatalog(PROJECT_ROOT)
  const sections = selectedSections(opts)

  if (opts.json) {
    if (mismatch !== undefined) logWarn(mismatch)
    process.stdout.write(
      `${JSON.stringify({
        ...(sections.stacks ? { stacks: catalog.stacks } : {}),
        ...(sections.rules ? { rules: catalog.rules } : {}),
        unreferenced: catalog.unreferenced,
      })}\n`,
    )
    return 0
  }

  intro('canon gov list')
  if (mismatch !== undefined) logWarn(mismatch)

  if (sections.stacks) {
    logStep('Stacks')
    for (const entry of catalog.stacks) logInfo(describeStack(entry))
  }

  if (sections.rules) {
    logStep('Rules')
    for (const entry of catalog.rules) logInfo(describeRule(entry))
  }

  if (catalog.unreferenced.length > 0) {
    logStep('Reached by no stack')
    for (const rule of catalog.unreferenced) logInfo(rule)
  }

  outro()
  return 0
}

/**
 * Silent on success so the consumed-copy stage that calls it stays quiet. It is
 * the only work that stage does now. The installed set is readable on disk, so
 * printing it would only add noise to every `bun run check`.
 */
async function runRegen(
  opts: RegenOptions,
  rootPassed: boolean,
): Promise<number> {
  // An operator naming `--root` names their own target on purpose, so only the
  // default can silently regenerate against a checkout nobody is standing in.
  // The value alone cannot separate the two, since the flag carries a default.
  if (!rootPassed) {
    const mismatch = checkoutMismatchWarning(process.cwd())
    if (mismatch !== undefined) logWarn(mismatch)
  }

  const result = await regenConsumedRules(resolve(opts.root ?? PROJECT_ROOT))

  if (!result.ok) {
    process.stderr.write(`Consumed-rules regen failed: ${result.reason}\n`)
    return 1
  }

  return 0
}

/**
 * Renders the target-relative path the prompt quotes, keeping the argument the
 * caller typed rather than the absolute path it resolves to.
 */
function displayPath(target: string, rel: string): string {
  const trimmed = target.replace(/\/$/, '').replace(/^\.\//, '')
  return trimmed === '' || trimmed === '.' ? rel : `${trimmed}/${rel}`
}

/**
 * Refuses rather than picking. `select_option` returned `options[0]` under
 * `CANON_NON_INTERACTIVE=1`, so a headless `canon gov install` with no stack
 * installed whichever stack sorted first, measured as 26 astro rules into an
 * empty directory. Every documented agent path already passes the argument.
 */
async function chooseStack(root: string): Promise<string | number> {
  const stacks = listGovStacks(root)

  if (stacks.length === 0) {
    logError('No stacks found in governance/stacks/')
    outro()
    return 1
  }

  if (isNonInteractive()) {
    logError(
      `Stack argument is required in non-interactive mode. One of: ${stacks.join(', ')}.`,
    )
    outro()
    return 1
  }

  return select({
    message: 'Select stack to install:',
    options: stacks.map((stack) => ({ value: stack, label: stack })),
  })
}

async function runInstall(
  stack: string | undefined,
  target: string,
  opts: InstallOptions,
): Promise<number> {
  intro('canon gov install')

  const resolved = resolveTarget(target, PROJECT_ROOT)
  if (typeof resolved === 'number') return resolved

  let selected = stack
  if (selected === undefined) {
    const choice = await chooseStack(PROJECT_ROOT)
    if (typeof choice === 'number') return choice
    selected = choice
  }

  if (!govStackExists(PROJECT_ROOT, selected)) {
    logError(`Stack not found: ${selected}`)
    outro()
    return 1
  }

  const resolution = resolveRules(PROJECT_ROOT, selected)
  if (!resolution.ok) {
    logError(`Stack not found: ${resolution.missingStack}`)
    outro()
    return 1
  }

  const add = opts.add ?? ''
  const rules =
    add === '' ? resolution.rules : mergeExtraRules(resolution.rules, add)

  if (rules.length === 0) {
    logWarn(`No rules defined for stack: ${selected}`)
    outro()
    return 0
  }

  logStep(
    add === ''
      ? `Resolving stack: ${selected}`
      : `Resolving stack: ${selected} + extras`,
  )

  const { found, missing } = lookupRules(PROJECT_ROOT, rules)
  for (const rule of missing) logWarn(`${rule} (source not found, skipping)`)
  for (const source of found) logInfo(source.rule)

  const shouldInstall = await select({
    message: `Install ${found.length} rules to ${displayPath(target, CANON_RULES_REL)}?`,
    options: [
      { value: true, label: 'Yes' },
      { value: false, label: 'No' },
    ],
    nonInteractiveDefault: true,
  })

  if (!shouldInstall) {
    logWarn('Cancelled')
    outro()
    return 0
  }

  logStep('Installing rules')
  for (const rel of await installRules(found, resolved)) logAdd(rel)

  const now = new Date()
  await recordStamp(createGovAdapter(PROJECT_ROOT), resolved, now)
  await writeChainStamp(
    resolved,
    { domain: 'governance', toolkitRoot: PROJECT_ROOT },
    [selected],
    now,
  )

  const { GREEN, NC } = palette(process.stderr)
  outro()
  process.stderr.write(`${GREEN}✓ Rules installed${NC}\n`)
  return 0
}

/**
 * Emits the rules payload the `gov-*` skills read. The output lands in the
 * target's scratch directory rather than stdout because the file is the
 * contract, and the skills point at the path.
 */
async function runBuild(target: string): Promise<number> {
  intro('canon gov build')

  const resolved = resolve(target)
  const payload = payloadRel(resolved)
  const rulesDir = join(resolved, RULES_REL)

  if (!existsSync(rulesDir)) {
    logError(`No rules found at ${rulesDir}. Run \`canon gov install\` first.`)
    outro()
    return 1
  }

  const files = listRuleFiles(rulesDir)
  logStep(`Reading ${RULES_REL} (${files.length} found)`)
  for (const file of files) {
    logInfo(basename(file))
  }

  const shouldBuild = await select({
    message: `Build ${files.length} rules to ${payload}?`,
    options: [
      { value: true, label: 'Yes' },
      { value: false, label: 'No' },
    ],
    nonInteractiveDefault: true,
  })

  if (!shouldBuild) {
    logWarn('Cancelled')
    outro()
    return 0
  }

  logStep('Building rules payload')
  const output = join(resolved, payload)
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, buildRulesPayload(files))
  logAdd(payload)

  const { GREEN, NC } = palette(process.stderr)
  outro()
  process.stderr.write(
    `${GREEN}✓ Rules built (${files.length} rules → ${payload})${NC}\n`,
  )
  return 0
}
