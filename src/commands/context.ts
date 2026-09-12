import { resolve } from 'node:path'
import type { Command } from 'commander'
import {
  type ContextAuditRefusal,
  type EntryReport,
  governsContent,
  type LengthCause,
  type LengthFinding,
  lengthFindings,
  type LengthQuestion,
  LENGTH_CHECKPOINT,
  matchesSiblings,
  measureFolders,
  missingSections,
  PROVENANCE_FOLDER,
  REQUIRED_SECTIONS,
  type SectionFinding,
} from '@/context/audit'
import {
  architectureRel,
  type ArchitectureReport,
  coveredCount,
  isOverLength,
  measureArchitecture,
  testableCount,
} from '@/context/architecture'
import { auditCitations, type CitationReport } from '@/context/citations'
import {
  type AuditedFolder,
  DEFAULT_FOLDERS,
  presentNames,
  resolveFolders,
} from '@/context/folders'
import { isGating } from '@/context/gate'
import { auditIndexes, type FolderDrift } from '@/context/index-drift'
import {
  loadNarration,
  type Narration,
  PRONOUN_HEADING,
  VERB_HEADING,
} from '@/context/narration'
import { RENDER_WIDTH } from '@/markdown/structure'
import {
  frameError,
  intro,
  logError,
  logInfo,
  logStep,
  logWarn,
  outro,
  pipeOutput,
  plural,
} from '@/ui'

/** Returned when a gating finding is present. */
const EXIT_GATE = 2

/** A name of dots alone is `.` or `..`, both of which escape the audit root. */
const FOLDER_NAME = /^(?!\.+$)[A-Za-z0-9._-]+$/

interface AuditCommandOptions {
  readonly json?: boolean
  readonly folder?: string
  readonly citationsOnly?: boolean
  readonly gate?: boolean
}

export function register(program: Command): void {
  const context = program
    .command('context')
    .description('Report the structural state of the context folders')
    .helpOption('-h, --help', 'Show this help message')

  context
    .command('audit')
    .description(
      'Report required sections, entry length, citations, reference form, catalog tables, provenance, superseded-decision narration, index drift, and the architecture record against its own ceiling',
    )
    .argument('[path]', 'Project root, defaulting to the current directory')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .option(
      '--folder <list>',
      'Comma-separated folder names, resolved under .claude/ then the project root',
    )
    .option('--citations-only', 'Run the gating citation check alone')
    .option(
      '--gate',
      'Also fail on a missing required section or index drift, the findings that are facts',
    )
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  the audit completed with no gating finding',
        '  1  refused, with the reason on stderr',
        '  2  a gating finding is present',
        '',
        'An unresolved citation always gates. An architecture record that',
        'states its own line allowances gates when it is past the ceiling',
        'those derive, on any run except --citations-only, which never',
        'measures it. A record stating no allowance is reported and never',
        'gated. --gate widens the gate to the other two findings that are',
        'facts rather than judgments: a missing required section and index',
        'drift. Entry length, reference form, table, provenance, narration,',
        'and the record claim classification are judgments under both.',
        '',
        'Depth and bullet weight are stated over every markdown file rather',
        'than over a context entry, so `canon markdown audit` measures them.',
        '',
        'Examples:',
        '  canon context audit',
        '  canon context audit --json',
        '  canon context audit --citations-only',
        '  canon context audit --folder context,diagrams',
        '  canon context audit --folder docs',
        '  canon context audit tooling/base/seeds --gate',
        '',
      ].join('\n'),
    )
    .action(async (path: string | undefined, opts: AuditCommandOptions) => {
      process.exitCode = await runAudit(path, opts)
    })
}

function parseFolders(list: string | undefined): string[] | string {
  if (!list) return [...DEFAULT_FOLDERS]

  const names = list
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)

  if (names.length === 0) return 'Empty --folder list. Pass at least one name.'

  // `..` would resolve the audited folder above the project root, taking the
  // scan and the citation pattern outside the tree the audit describes.
  const invalid = names.filter((name) => !FOLDER_NAME.test(name))
  if (invalid.length > 0) {
    return `--folder takes folder names, not paths: ${invalid.join(', ')}`
  }

  return names
}

async function runAudit(
  path: string | undefined,
  opts: AuditCommandOptions,
): Promise<number> {
  const root = resolve(path ?? process.cwd())
  const names = parseFolders(opts.folder)
  const gateOnly = opts.citationsOnly ?? false
  const widened = opts.gate ?? false

  // `--citations-only` runs the citation check alone, so the two findings
  // `--gate` adds are never measured. Honouring both would exit 0 on a seed
  // short a required section, which is the pass a gate exists to prevent.
  if (gateOnly && widened) {
    return refuse(
      'conflicting-options',
      '--citations-only runs the citation check alone, so --gate would widen the gate to findings the run never measures. Pass one.',
      gateOnly,
      root,
      opts.json ?? false,
    )
  }

  if (typeof names === 'string') {
    return refuse('bad-folder-list', names, gateOnly, root, opts.json ?? false)
  }

  // The root base is opt-in. A target carrying a root `wireframes/` would
  // otherwise be audited against a standard it never adopted, on a bare run
  // that named nothing.
  const named = opts.folder !== undefined
  const { folders, missing } = await resolveFolders(root, names, {
    canResolveAtRoot: named,
  })
  if (folders.length === 0) {
    return refuse(
      'no-folders',
      `No audited folder found ${named ? 'under a record root or the project root' : 'under a record root'}, since resolving one needs its own index.md file. Looked for: ${names.join(', ')}.`,
      gateOnly,
      root,
      opts.json ?? false,
    )
  }

  // A default folder a project does not carry is the ordinary case and stays
  // silent. A name passed by hand that resolves nowhere is a typo, and the run
  // measuring the names that did resolve reads as a pass against a folder it
  // never opened.
  const unresolved = named ? missing : []

  // The gate runs one check. Letting it exit 0 against a scope it could not
  // build reports a pass on nothing measured, which is the outcome a gate is
  // there to prevent.
  const cited = presentNames(folders)
  if (gateOnly && cited.length === 0) {
    return refuse(
      'no-citation-scope',
      `The citation check spells the record-root prefixes and no audited folder resolved under one. Looked for: ${names.join(', ')}.`,
      gateOnly,
      root,
      opts.json ?? false,
    )
  }

  const citations = await auditCitations(root, cited)
  if (citations.kind === 'unavailable') {
    return refuse(
      'no-git',
      'git could not list the tree, so no citation was checked. Run inside a git repository.',
      gateOnly,
      root,
      opts.json ?? false,
    )
  }

  const narration: Narration = gateOnly
    ? { kind: 'absent' }
    : await loadNarration(root)
  const entries = gateOnly
    ? []
    : await measureFolders(
        root,
        folders,
        narration.kind === 'loaded' ? narration : undefined,
      )
  const drift = gateOnly ? [] : await auditIndexes(folders)
  const sections = gateOnly ? [] : missingSections(root, folders, entries)
  const length = gateOnly ? undefined : lengthFindings(entries)
  // Absent under `--citations-only` and null when the project carries no
  // record, for the reason `checkpoints.narration` states about its own two
  // absences. A run that never looked and a project with nothing to look at
  // are different answers, and one value for both reports the second as the
  // first.
  const record = gateOnly ? undefined : await measureArchitecture(root)

  if (gateOnly) {
    reportGate(citations)
  } else {
    intro('canon context audit')
    reportScope(folders, unresolved)
    reportCitations(citations, cited)
    reportReferenceForm(entries, folders)
    reportSections(sections, folders)
    reportLength(length ?? [])
    reportTables(entries)
    reportProvenance(entries, folders)
    reportNarration(entries, folders, narration)
    reportDrift(drift)
    reportRecord(record, root)
    outro()
  }

  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        folders: folders.map((folder) => ({
          path: folder.rel,
          base: folder.base,
          entries: folder.entries.length,
          governsContent: governsContent(folder),
        })),
        unresolvedFolders: unresolved,
        citations: {
          scanned: citations.scanned,
          total: citations.total,
          unresolved: citations.unresolved,
        },
        entries,
        // The join is published rather than left to a consumer, since deriving
        // it from `entries` means restating which question the provenance count
        // answers, and one wrong restatement is a cause reported against the
        // wrong entry.
        //
        // Absent rather than empty under `--citations-only`, for the reason
        // `checkpoints.narration` below carries. That mode measures no entry,
        // so an empty array here reads as a corpus with nothing past the
        // checkpoint rather than as a run that never looked.
        length,
        missingSections: sections,
        indexDrift: drift,
        // Null says the run opened the project and found no record, which a
        // target that never wrote one is entitled to. Absent says the run
        // never looked, which is `--citations-only`.
        architecture: gateOnly ? undefined : (record ?? null),
        checkpoints: {
          lines: LENGTH_CHECKPOINT,
          renderWidth: RENDER_WIDTH,
          provenanceFolder: PROVENANCE_FOLDER,
          requiredSections: REQUIRED_SECTIONS,
          // Three states rather than two, so a record showing no finding says
          // which terms were looked for. The key is absent when the run never
          // scanned, which is `--citations-only`, and null when it scanned and
          // no rule published both headings. Collapsing the first into null
          // reports an absent rule against a run that never opened one.
          narration: gateOnly
            ? undefined
            : narration.kind === 'loaded'
              ? {
                  source: narration.source,
                  pronouns: narration.pronouns,
                  verbs: narration.verbs,
                }
              : null,
        },
      })}\n`,
    )
  }

  const gating = isGating({
    unresolvedCitations: citations.unresolved.length,
    recordOverLength: record !== undefined && isOverLength(record),
    sections,
    drift,
    widened,
  })

  return gating ? EXIT_GATE : 0
}

function refuse(
  reason: ContextAuditRefusal,
  message: string,
  gateOnly: boolean,
  root: string,
  emitJson: boolean,
): number {
  if (gateOnly) {
    frameError(message)
  } else {
    intro('canon context audit')
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
 * Prints nothing when every path resolves.
 *
 * `--citations-only` is what the merge gate runs on every push, and it pipes
 * a stage's whole output into its own frame. A passing gate that printed
 * its frame would nest one inside the other on every contributor's push.
 */
function reportGate(report: ScannedCitations): void {
  const count = report.unresolved.length
  if (count === 0) return

  intro('canon context audit')
  logError(
    count === 1
      ? '1 cited path does not resolve'
      : `${count} cited paths do not resolve`,
  )
  pipeOutput(
    report.unresolved
      .map((citation) => `${citation.file}:${citation.line}  ${citation.path}`)
      .join('\n'),
  )
  outro()
}

/**
 * Names the resolved path of every audited folder, plus the requested names
 * that resolved nowhere.
 *
 * The path is what says which base a name was taken from, which matters once a
 * name can resolve under `.claude/` or at the project root and a project may
 * carry both.
 */
function reportScope(
  folders: readonly AuditedFolder[],
  unresolved: readonly string[],
): void {
  logStep('Scope')

  for (const folder of folders) {
    logInfo(`${folder.rel}: ${folder.entries.length} entries`)
  }

  if (unresolved.length === 0) return

  logWarn(
    `Not audited, since resolving needs its own index.md: ${unresolved.join(', ')}`,
  )
}

type ScannedCitations = Extract<CitationReport, { kind: 'scanned' }>

/**
 * States the reach before the count, for the reason the provenance report
 * states its own.
 *
 * A run auditing a folder at the project root builds no pattern, and a count of
 * zero followed by a line saying every path resolves is indistinguishable from
 * a corpus that cites nothing.
 */
function reportCitations(
  report: ScannedCitations,
  cited: readonly string[],
): void {
  logStep('Citations')

  if (cited.length === 0) {
    logInfo(
      'Out of scope. The pattern spells the record-root prefixes, and no audited folder resolved under one.',
    )
    return
  }

  logInfo(
    `${plural(report.total, 'cited path')} across ${plural(report.scanned, 'file')}, fixtures and fenced examples excluded`,
  )

  if (report.unresolved.length === 0) {
    logInfo('Every cited path resolves.')
    return
  }

  logWarn(`${report.unresolved.length} unresolved`)
  pipeOutput(
    report.unresolved
      .map((citation) => `${citation.file}:${citation.line}  ${citation.path}`)
      .join('\n'),
  )
}

/**
 * Reports the references naming a sibling entry by bare filename.
 *
 * This prints beside the citation check rather than among the readability
 * measures, since the two read the same thing: one resolves a path a reference
 * spells and this one finds the references that spell none. The reach line
 * names the split folders rather than the governed folder alone, because a run
 * whose only context folder is flat measures nothing here and would otherwise
 * print the same clean line as a run that measured every split.
 */
function reportReferenceForm(
  entries: readonly EntryReport[],
  folders: readonly AuditedFolder[],
): void {
  logStep('Reference form')

  const scoped = folders.filter(matchesSiblings)
  if (scoped.length === 0) {
    logInfo(
      `Out of scope. A bare name is matched against the siblings of a domain split into a folder, and no audited folder under .claude/${PROVENANCE_FOLDER}/ is one.`,
    )
    return
  }

  logInfo(
    `Covers ${plural(scoped.length, 'split folder')} under .claude/${PROVENANCE_FOLDER}/, whose standard asks a reference to spell its path.`,
  )
  logInfo(
    'The flat folder is out of reach, since a domain filename there is shared by seeds and other trees.',
  )

  const carrying = entries
    .filter((entry) => entry.bareReferences.length > 0)
    .sort((a, b) => b.bareReferences.length - a.bareReferences.length)

  if (carrying.length === 0) {
    logInfo('Every reference to a sibling entry spells its path.')
    return
  }

  const total = carrying.reduce(
    (sum, entry) => sum + entry.bareReferences.length,
    0,
  )
  logWarn(
    `${plural(total, 'bare name')} across ${carrying.length} ${carrying.length === 1 ? 'entry' : 'entries'}`,
  )
  pipeOutput(
    carrying
      .map(
        (entry) =>
          `${entry.rel}  ${plural(entry.bareReferences.length, 'bare name')}\n${entry.bareReferences
            .map((found) => `  :${found.line}  ${found.name}`)
            .join('\n')}`,
      )
      .join('\n'),
  )
}

/**
 * Names the path each finding belongs to, which is an entry in the folder named
 * under `.claude/` and the folder itself in a domain split across one. States
 * the reach on every run for the reason the provenance report does.
 *
 * This prints ahead of the four readability measures because a missing section
 * asks whether the entry is the right shape at all, which precedes asking
 * whether it has grown too long.
 */
function reportSections(
  missing: readonly SectionFinding[],
  folders: readonly AuditedFolder[],
): void {
  logStep('Sections')

  const governed = folders.filter(governsContent)
  if (governed.length === 0) {
    logInfo(
      `Out of scope. The list is stated in the standard governing .claude/${PROVENANCE_FOLDER}/, and no audited folder is that one.`,
    )
    return
  }

  logInfo(
    `Covers .claude/${PROVENANCE_FOLDER}/ alone, whose standard requires ${REQUIRED_SECTIONS.join(' and ')}.`,
  )
  logInfo(
    'A heading at any level counts. Each entry answers for itself, except in a domain split across a folder, where a sibling answers for the rest.',
  )

  if (missing.length === 0) {
    logInfo('Every entry declares each required section.')
    return
  }

  logWarn(`${plural(missing.length, 'path')} short a required section`)
  pipeOutput(
    missing
      .map((found) => `${found.rel}  missing: ${found.missing.join(', ')}`)
      .join('\n'),
  )
}

/** How each question reads in the report, in the standard's own order. */
const QUESTION_LABEL: Record<LengthQuestion, string> = {
  domain: 'one domain',
  reproduced: 'reproduced content',
  history: 'own history',
}

function readCause(cause: LengthCause): string {
  const label = QUESTION_LABEL[cause.question]

  if (cause.state === 'unanswered') return `${label}: open`
  if (cause.state === 'no') return `${label}: no`

  return `${label}: yes, ${plural(cause.markers ?? 0, 'change marker')}`
}

/**
 * Names each entry past the checkpoint with the three questions the standard
 * asks of it, rather than a count a reader has to cross-reference by eye.
 *
 * The checkpoint is not a cap, so the legend says what the list is for. An
 * entry that answers all three and is still long is a correct outcome under a
 * standard stating there is no hard cap, and a run reporting success as a
 * smaller count would have adopted the number the standard declines.
 */
function reportLength(over: readonly LengthFinding[]): void {
  logStep('Length')
  logInfo(
    `Entries measure rendered lines at ${RENDER_WIDTH} columns, counting frontmatter and fenced blocks.`,
  )
  logInfo(
    'A reference-heavy entry therefore ranks by its examples, which the depth check in `canon markdown audit` excludes.',
  )

  if (over.length === 0) {
    logInfo(`No entry past the ${LENGTH_CHECKPOINT}-line checkpoint.`)
    return
  }

  logWarn(`${over.length} past the ${LENGTH_CHECKPOINT}-line checkpoint`)
  logInfo(
    'The checkpoint is not a cap. Each entry carries the three questions the standard asks past it, and the fix goes to whichever is true.',
  )
  logInfo(
    'Own history is answered from the change markers below. A date stamping a measurement is not one of them, so an entry recording what its runs cost answers no. The other two are judgments no measure settles, so they stay open for a reader.',
  )
  pipeOutput(
    over
      .map(
        (finding) =>
          `${finding.rel}  ${finding.lines} rendered lines\n  ${finding.causes
            .map(readCause)
            .join('  ')}`,
      )
      .join('\n'),
  )
}

function reportTables(entries: readonly EntryReport[]): void {
  logStep('Tables')

  const candidates = entries.flatMap((entry) =>
    entry.catalogTables.map(
      (table) => `${entry.rel}:${table.line}  ${table.rows} rows`,
    ),
  )

  if (candidates.length === 0) {
    logInfo('No table reads as a catalog that grows a row per shipped thing.')
    return
  }

  logWarn(`${plural(candidates.length, 'candidate')} for a bullet list`)
  pipeOutput(candidates.join('\n'))
}

/**
 * Groups by entry rather than listing every marker.
 *
 * The two entries carrying most of a corpus's markers carry them a dozen at a
 * time, and a flat list of those buries the entries holding one. What a reader
 * acts on is which file to open, so the count sits beside the name and the
 * lines follow it.
 *
 * The reach is stated on every run, including the run where nothing is in
 * scope. A check that covered three folders and now covers one reads as quietly
 * missing things unless the report says which folder it measured.
 */
function reportProvenance(
  entries: readonly EntryReport[],
  folders: readonly AuditedFolder[],
): void {
  logStep('Provenance')

  const governed = folders.filter(governsContent)
  if (governed.length === 0) {
    logInfo(
      `Out of scope. The rule is stated in the standard governing .claude/${PROVENANCE_FOLDER}/, and no audited folder is that one.`,
    )
    return
  }

  logInfo(
    `Covers .claude/${PROVENANCE_FOLDER}/ alone, whose standard carries the rule. The sibling standards do not restate it.`,
  )
  logInfo(
    'Fenced blocks are excluded, and so is a date whose clause stamps a measurement. A marker is a judgment, never a defect.',
  )

  const carrying = entries
    .filter((entry) => entry.provenance.length > 0)
    .sort((a, b) => b.provenance.length - a.provenance.length)

  if (carrying.length === 0) {
    logInfo('No entry narrates a change.')
    return
  }

  const total = carrying.reduce(
    (sum, entry) => sum + entry.provenance.length,
    0,
  )
  logWarn(
    `${plural(total, 'marker')} across ${carrying.length} ${carrying.length === 1 ? 'entry' : 'entries'}`,
  )
  pipeOutput(
    carrying
      .map(
        (entry) =>
          `${entry.rel}  ${plural(entry.provenance.length, 'marker')}\n${entry.provenance
            .map((found) => `  :${found.line}  ${found.kind}  ${found.text}`)
            .join('\n')}`,
      )
      .join('\n'),
  )
}

/**
 * Reports the bullets narrating a decision the bullet above them replaced.
 *
 * The reach line names the rule the sets were read from, since the check is
 * silent when no rule publishes them and a run that scanned nothing otherwise
 * prints the same clean line as a run that scanned everything.
 *
 * The legitimate-hit line is here for the same reason the provenance section
 * says a marker is a judgment. The standard keeps a rejected alternative and
 * why it lost, which is a back-reference in the past tense by construction, and
 * no measure separates one from the shape the rule bans.
 */
function reportNarration(
  entries: readonly EntryReport[],
  folders: readonly AuditedFolder[],
  narration: Narration,
): void {
  logStep('Narration')

  const governed = folders.filter(governsContent)
  if (governed.length === 0) {
    logInfo(
      `Out of scope. The rule is stated in the standard governing .claude/${PROVENANCE_FOLDER}/, and no audited folder is that one.`,
    )
    return
  }

  if (narration.kind === 'absent') {
    logWarn(
      `Not scanned. No rule under .claude/rules/ or governance/rules/ publishes both ${PRONOUN_HEADING} and ${VERB_HEADING}.`,
    )
    return
  }

  logInfo(
    `Covers .claude/${PROVENANCE_FOLDER}/ alone, reading ${plural(narration.pronouns.length, 'pronoun')} and ${plural(narration.verbs.length, 'verb')} from ${narration.source}.`,
  )
  logInfo(
    'A rejected alternative is a legitimate hit, since the standard keeps what was tried and why it lost.',
  )

  const carrying = entries
    .filter((entry) => entry.narration.length > 0)
    .sort((a, b) => b.narration.length - a.narration.length)

  if (carrying.length === 0) {
    logInfo('No bullet narrates a decision the bullet above it replaced.')
    return
  }

  const total = carrying.reduce((sum, entry) => sum + entry.narration.length, 0)
  logWarn(
    `${plural(total, 'bullet')} to read across ${carrying.length} ${carrying.length === 1 ? 'entry' : 'entries'}`,
  )
  pipeOutput(
    carrying
      .map(
        (entry) =>
          `${entry.rel}  ${plural(entry.narration.length, 'bullet')}\n${entry.narration
            .map(
              (found) =>
                `  :${found.line}  ${found.pronoun} with ${found.verb}`,
            )
            .join('\n')}`,
      )
      .join('\n'),
  )
}

/** How each classification reads in the report. */
const CLAIM_LABEL: Record<string, string> = {
  countable: 'countable claim',
  invariant: 'structural invariant',
  neither: 'reasoning only',
}

/**
 * Reports the architecture record against the ceiling it states for itself and
 * against what a machine could test in it.
 *
 * The length reading is a fact and gates. Everything below it names candidates
 * a reader adjudicates, because deciding whether a sentence states a claim is a
 * judgment no parser settles, and a stored verdict would age the way the
 * anchors it sits beside already do. Nothing is stored: every run reclassifies,
 * so an entry rewritten tomorrow is read as it stands then.
 */
function reportRecord(
  report: ArchitectureReport | undefined,
  root: string,
): void {
  logStep('Architecture record')

  if (report === undefined) {
    logInfo(
      `Out of scope. The project carries no ${architectureRel(root)}, so there was no record to measure.`,
    )
    return
  }

  const decisions = report.decisions.length
  const { allowances } = report

  if (allowances === undefined) {
    logInfo(
      `Covers ${report.rel} alone. No standard sets a length rule for it and this record states none, so its ${plural(report.lines, 'line')} across ${plural(decisions, 'decision')} are reported and nothing is gated.`,
    )
    logInfo(
      'A record declaring an allowance for its frame and one a decision is measured against the ceiling those two derive. That rule belongs to whichever record writes it, never to the toolkit.',
    )
  } else {
    logInfo(
      `Covers ${report.rel} alone, which states its own allowance of ${plural(allowances.frame, 'line')} for the frame and ${allowances.perDecision} a decision.`,
    )
    if (isOverLength(report)) {
      logError(
        `${report.lines} lines against a ceiling of ${report.ceiling} from ${plural(decisions, 'decision')}`,
      )
    } else {
      logInfo(
        `${report.lines} lines against a ceiling of ${report.ceiling} from ${plural(decisions, 'decision')}.`,
      )
    }
    logInfo(
      `The ceiling rises with the decision count, so adding a decision buys ${allowances.perDecision} lines and the check passes exactly when the file grew.`,
    )
  }

  if (decisions === 0) {
    logWarn('The record declares no decision, so nothing was classified.')
    return
  }

  const testable = testableCount(report)
  const covered = coveredCount(report)

  logInfo(
    'A countable claim carries a figure a run could recompute and an invariant quantifies over a named tree a walk could falsify. Both are candidates a reader settles, and neither gates.',
  )
  logInfo(
    'A figure spelled in words reads as uncounted, since a cardinal in prose is pronominal more often than measured. Entries are counted by heading, so a heading carrying several decisions counts once and the total reads low by however many it holds.',
  )
  const line = `${testable} of ${decisions} carry a claim a machine could test, ${covered} of which name a check that exists`
  // A record whose every testable claim names a check has nothing to act on,
  // and so does one carrying no testable claim at all. Warning on both is how
  // a section becomes one nobody reads after the second run.
  if (testable > covered) logWarn(line)
  else logInfo(`${line}.`)
  logInfo(
    'Coverage reads the entry rather than the tree, so a claim some check happens to cover without the entry naming it reads as unchecked.',
  )

  pipeOutput(
    report.decisions
      .map((entry) => {
        const kind = CLAIM_LABEL[entry.claim] ?? entry.claim
        const evidence =
          entry.figures.length > 0 ? `  ${entry.figures.join(' ')}` : ''
        const checks =
          entry.checks.length > 0
            ? `\n  checked by ${entry.checks.join(', ')}`
            : ''
        return `${report.rel}:${entry.line}  ${kind}${evidence}\n  ${entry.heading}${checks}`
      })
      .join('\n'),
  )
}

function reportDrift(drift: readonly FolderDrift[]): void {
  logStep('Index drift')

  const lines = drift.flatMap((folder) => [
    ...folder.unlisted.map((name) => `${folder.rel}  unlisted: ${name}`),
    ...folder.missing.map((name) => `${folder.rel}  missing: ${name}`),
  ])

  if (lines.length === 0) {
    logInfo('Every index agrees with its siblings.')
    return
  }

  logWarn(plural(lines.length, 'disagreement'))
  pipeOutput(lines.join('\n'))
}
