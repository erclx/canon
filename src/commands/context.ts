import { join, relative, resolve } from 'node:path'
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
  extraSections,
  GOTCHA_CAP,
  LAYOUT_BULLET_CAP,
  LAYOUT_PARAGRAPH_CAP,
  missingSections,
  OTHER_FOLDERS,
  PROVENANCE_FOLDER,
  ALLOWED_SECTIONS_BY_FOLDER,
  REQUIRED_SECTIONS,
  REQUIRED_SECTIONS_BY_FOLDER,
  requiredSections,
  RETIRED_SECTIONS_BY_FOLDER,
  shapeFindings,
  type ExtraSectionFinding,
  type SectionFinding,
  type ShapeFinding,
  type ShapeIssue,
} from '@/context/audit'
import { auditCitations, type CitationReport } from '@/context/citations'
import {
  type AuditedFolder,
  DEFAULT_FOLDERS,
  presentNames,
  resolveFolders,
} from '@/context/folders'
import {
  CONTEXT_CONFIG_REL,
  type CoverageReport,
  measureCoverage,
  readGateKeys,
  readRoots,
} from '@/context/coverage'
import { isGating } from '@/context/gate'
import {
  isShapeGated,
  missingGatedPrefixes,
  resolveGatedPrefixes,
} from '@/context/shape-gated'
import { currentWorktreeRoot } from '@/git/worktree'
import {
  isOverWordCap,
  measureRequirements,
  requirementsRel,
  type RequirementsReport,
} from '@/context/requirements'
import { auditIndexes, type FolderDrift } from '@/context/index-drift'
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
} from '@/cli/ui'

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
      'Report required sections, entry length, citations, reference form, catalog tables, provenance, index drift, code folders no entry names, and the requirements record against its own word cap',
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
      'Also fail on a missing required section, an H2 outside the set, a shape break in a gated folder, index drift, or a code folder no entry names, the findings that are facts',
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
        'An unresolved citation always gates. A requirements record',
        'stating a word cap gates past it, on any run except',
        '--citations-only, which never measures it. A record stating no',
        'cap is reported and never gated. --gate widens the gate to the',
        'findings that are facts rather than judgments: a missing',
        'required section, an H2 outside the closed set, index drift, and',
        'a code folder no Layout names or two entries claim. The roots come',
        'from canon/config/context.toml and default to src when present.',
        'A context entry requires Overview and Layout and allows Gotchas.',
        'A shape break, such as a Decisions section or a sixth gotcha, is',
        'reported everywhere and gated only under a shape-gated folder.',
        'The gated folders come from gated in canon/config/context.toml, a',
        'list of path prefixes from the project root that replaces the',
        "toolkit's own layout, and gated = [] gates no folder. Setting",
        'gate-length = true there gates an entry past the line checkpoint',
        'under --gate, unless it carries a canon-length-exempt marker. A',
        'wrongly shaped key, or a gated prefix naming nothing, gates too.',
        'Without either key, entry length, reference form, table, and',
        'provenance are judgments under both.',
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

  // `..` would resolve the folder above the project root, outside the audited tree.
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

  // `--citations-only` measures no `--gate` finding, so both would exit 0 on a bad seed.
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

  // The root base is opt-in, so a bare run never audits a target's root folder.
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

  // A missing default folder stays silent, and a hand-named one is a typo, reported.
  const unresolved = named ? missing : []

  // The gate refuses a scope it could not build rather than exiting 0 on nothing.
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

  const entries = gateOnly ? [] : await measureFolders(root, folders)
  const drift = gateOnly ? [] : await auditIndexes(folders)
  const sections = gateOnly ? [] : missingSections(root, folders, entries)
  const extras = gateOnly ? [] : extraSections(entries)
  // `--citations-only` reads neither gate key, so a fault never fails its stage.
  const keys = gateOnly
    ? { gated: null, gateLength: false, invalid: [] }
    : readGateKeys(root)
  const gatedPrefixes = resolveGatedPrefixes(keys.gated)
  // Default prefixes read from the repository root, a declared list from the audit root.
  const top =
    gateOnly || keys.gated !== null ? root : await currentWorktreeRoot(root)
  const shape = gateOnly
    ? []
    : shapeFindings(entries, (rel) =>
        isShapeGated(relative(top, join(root, rel)), gatedPrefixes),
      )
  const length = gateOnly ? undefined : lengthFindings(entries)
  const gateKeyFaults = [
    ...keys.invalid,
    ...(keys.gated === null ? [] : missingGatedPrefixes(root, keys.gated)).map(
      (prefix) =>
        `${CONTEXT_CONFIG_REL} gates ${prefix}, which names nothing on disk`,
    ),
  ]
  const coverage: CoverageReport | undefined = gateOnly
    ? undefined
    : measureCoverage(root, readRoots(root), folders)
  // Absent when `--citations-only` never looked, null when the project has no record.
  const requirements = gateOnly ? undefined : await measureRequirements(root)

  if (gateOnly) {
    reportGate(citations)
  } else {
    intro('canon context audit')
    reportScope(folders, unresolved)
    reportCitations(citations, cited)
    reportReferenceForm(entries, folders)
    reportSections(sections, extras, folders)
    reportGateKeys(gateKeyFaults)
    reportShape(shape, gatedPrefixes)
    reportLength(length ?? [], keys.gateLength)
    reportTables(entries)
    reportProvenance(entries, folders)
    reportDrift(drift)
    reportCoverage(coverage ?? { kind: 'no-root' })
    reportRequirements(requirements, root)
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
        // Published rather than derived by a consumer, absent under `--citations-only`.
        length,
        missingSections: sections,
        extraSections: extras,
        shapeFindings: shape,
        indexDrift: drift,
        // Absent under `--citations-only`, which never measures it.
        coverage,
        // Null is a project with no record, absent a run that never looked.
        requirements: gateOnly ? undefined : (requirements ?? null),
        // Absent under `--citations-only`, which reads neither gate key.
        gateKeyFaults: gateOnly ? undefined : gateKeyFaults,
        checkpoints: {
          lines: LENGTH_CHECKPOINT,
          renderWidth: RENDER_WIDTH,
          provenanceFolder: PROVENANCE_FOLDER,
          requiredSections: REQUIRED_SECTIONS,
          // The flat key above stays, since removing it would break a caller silently.
          requiredSectionsByFolder: REQUIRED_SECTIONS_BY_FOLDER,
          allowedSectionsByFolder: ALLOWED_SECTIONS_BY_FOLDER,
          retiredSectionsByFolder: RETIRED_SECTIONS_BY_FOLDER,
          gotchaCap: GOTCHA_CAP,
          layoutBulletCap: LAYOUT_BULLET_CAP,
          layoutParagraphCap: LAYOUT_PARAGRAPH_CAP,
          // The resolved list: the declared `gated` key, or the toolkit's own prefixes.
          shapeGatedFolders: gatedPrefixes,
          lengthGate: keys.gateLength,
        },
      })}\n`,
    )
  }

  const gating = isGating({
    unresolvedCitations: citations.unresolved.length,
    requirementsOverWords:
      requirements !== undefined && isOverWordCap(requirements),
    sections,
    extraSections: extras,
    shape,
    drift,
    coverage: coverage ?? { kind: 'no-root' },
    length: length ?? [],
    gateLength: keys.gateLength,
    gateKeyFaults,
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
 * Prints nothing when every path resolves, since `--citations-only` pipes a
 * stage's whole output into its own frame and a passing gate that printed its
 * frame would nest one inside the other on every push.
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
 * that resolved nowhere, since the path says which base a name was taken from
 * once a name can resolve under `.claude/` or at the project root.
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
 * States the reach before the count, as the provenance report does, since a
 * run auditing a folder at the project root builds no pattern and a zero count
 * reads the same as a corpus that cites nothing.
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
 * Reports the references naming a sibling entry by bare filename. It prints
 * beside the citation check, which reads the same thing, and its reach line
 * names the split folders so a flat corpus does not print a clean line.
 */
function reportReferenceForm(
  entries: readonly EntryReport[],
  folders: readonly AuditedFolder[],
): void {
  logStep('Reference form')

  const scoped = folders.filter(matchesSiblings)
  if (scoped.length === 0) {
    logInfo(
      `Out of scope. A bare name is matched against the siblings of a domain split into a folder, and no audited folder under canon/${PROVENANCE_FOLDER}/ is one.`,
    )
    return
  }

  logInfo(
    `Covers ${plural(scoped.length, 'split folder')} under canon/${PROVENANCE_FOLDER}/, whose standard asks a reference to spell its path.`,
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
 * Names the path each finding belongs to, and states the reach on every run as
 * the provenance report does. It prints ahead of the four readability measures
 * because a missing section asks whether the entry is the right shape at all.
 */
function reportSections(
  missing: readonly SectionFinding[],
  extras: readonly ExtraSectionFinding[],
  folders: readonly AuditedFolder[],
): void {
  logStep('Sections')

  const names = [
    ...new Set(
      folders
        .filter((folder) => requiredSections(folder).length > 0)
        .map((folder) => folder.name),
    ),
  ]
  if (names.length === 0) {
    logInfo(
      `Out of scope. The lists are stated in the standards governing ${Object.keys(
        REQUIRED_SECTIONS_BY_FOLDER,
      )
        .map((name) => `canon/${name}/`)
        .join(' and ')}, and no audited folder is one of them.`,
    )
    return
  }

  for (const name of names) {
    logInfo(
      `canon/${name}/ requires ${REQUIRED_SECTIONS_BY_FOLDER[name].join(', ')}.`,
    )
  }
  logInfo(
    'A heading at any level counts. Each entry answers for itself, except in a context domain split across a folder, where a sibling answers for the rest.',
  )

  if (missing.length === 0) {
    logInfo('Every entry declares each required section.')
  } else {
    logWarn(`${plural(missing.length, 'path')} short a required section`)
    pipeOutput(
      missing
        .map((found) => `${found.rel}  missing: ${found.missing.join(', ')}`)
        .join('\n'),
    )
  }

  logInfo(
    `The set is closed: ${Object.entries(ALLOWED_SECTIONS_BY_FOLDER)
      .map(([name, set]) => `canon/${name}/ allows ${set.join(', ')}`)
      .join('. ')} as H2. A folder is an H3 under Layout.`,
  )

  if (extras.length === 0) {
    logInfo('No entry carries an H2 outside the set.')
    return
  }

  logWarn(`${plural(extras.length, 'path')} carrying an H2 outside the set`)
  pipeOutput(
    extras
      .map((found) => `${found.rel}  extra: ${found.headings.join(', ')}`)
      .join('\n'),
  )
}

/** Characters of a paragraph the report quotes, enough to find it by. */
const QUOTE_WIDTH = 60

function clip(text: string): string {
  return text.length > QUOTE_WIDTH ? `${text.slice(0, QUOTE_WIDTH)}...` : text
}

/** How each shape break reads in the report. */
function readIssue(issue: ShapeIssue): string {
  switch (issue.kind) {
    case 'retired-section':
      return `retired section: ${issue.text}`
    case 'gotcha-count':
      return `${issue.count ?? 0} gotchas, past ${GOTCHA_CAP}`
    case 'gotcha-heading':
      return `heading inside Gotchas: ${issue.text}`
    case 'gotcha-paragraph':
      return `paragraph inside Gotchas: ${clip(issue.text)}`
    case 'layout-heading':
      return `Layout H3 titled neither a path nor ${OTHER_FOLDERS}: ${issue.text}`
    case 'layout-bullets':
      return `${issue.count ?? 0} bullets under ${issue.text}, past ${LAYOUT_BULLET_CAP}`
    case 'layout-paragraphs':
      return `${issue.count ?? 0} paragraphs under ${issue.text}, past ${LAYOUT_PARAGRAPH_CAP}`
    case 'layout-depth':
      return `heading below H3 under Layout: ${issue.text}`
  }
}

/**
 * Prints nothing while the gate keys read clean, so a project that sets
 * neither sees the report it always did.
 */
function reportGateKeys(faults: readonly string[]): void {
  if (faults.length === 0) return

  logStep('Gate keys')
  logWarn(plural(faults.length, 'gate key fault'))
  pipeOutput(faults.join('\n'))
}

/**
 * Names each entry breaking the section shape, gated ones first, and states
 * which prefixes gate on every run, since an empty gated list and a corpus that
 * conforms would otherwise print the same report.
 */
function reportShape(
  shape: readonly ShapeFinding[],
  gatedPrefixes: readonly string[],
): void {
  logStep('Shape')

  logInfo(
    gatedPrefixes.length === 0
      ? 'No folder is shape-gated, so every shape break reports and none gates.'
      : `Gated under --gate: ${gatedPrefixes.join(', ')}. A break elsewhere reports and never gates.`,
  )

  if (shape.length === 0) {
    logInfo('Every entry holds the section shape.')
    return
  }

  const gated = shape.filter((finding) => finding.gated)
  if (gated.length > 0) {
    logWarn(
      `${gated.length} gated ${gated.length === 1 ? 'entry' : 'entries'} breaking the shape`,
    )
  }
  logInfo(
    `${shape.length} ${shape.length === 1 ? 'entry' : 'entries'} breaking the shape in all`,
  )
  pipeOutput(
    [...gated, ...shape.filter((finding) => !finding.gated)]
      .map(
        (finding) =>
          `${finding.rel}${finding.gated ? '  gated' : ''}\n${finding.issues
            .map((issue) => `  :${issue.line}  ${readIssue(issue)}`)
            .join('\n')}`,
      )
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
 * asks of it. The checkpoint is not a cap, and reporting success as a smaller
 * count would adopt the number the standard declines.
 */
function reportLength(
  over: readonly LengthFinding[],
  gateLength: boolean,
): void {
  logStep('Length')
  if (gateLength) {
    logInfo(
      `gate-length is set, so under --gate an entry past ${LENGTH_CHECKPOINT} lines fails unless it carries a canon-length-exempt marker naming a reason.`,
    )
  }
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
          `${finding.rel}  ${finding.lines} rendered lines${finding.exempt === null ? '' : `  exempt: ${finding.exempt}`}\n  ${finding.causes
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
 * Groups by entry rather than listing every marker, since a reader acts on
 * which file to open. The reach is stated on every run, even with nothing in
 * scope, so a check that lost a folder does not read as quietly missing things.
 */
function reportProvenance(
  entries: readonly EntryReport[],
  folders: readonly AuditedFolder[],
): void {
  logStep('Provenance')

  const governed = folders.filter(governsContent)
  if (governed.length === 0) {
    logInfo(
      `Out of scope. The rule is stated in the standard governing canon/${PROVENANCE_FOLDER}/, and no audited folder is that one.`,
    )
    return
  }

  logInfo(
    `Covers canon/${PROVENANCE_FOLDER}/ alone, whose standard carries the rule. The sibling standards do not restate it.`,
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

function reportCoverage(report: CoverageReport): void {
  logStep('Coverage')

  if (report.kind === 'no-root') {
    logInfo(
      'No code root found, since no canon/config/context.toml declares one and there is no src/, so nothing was measured.',
    )
    return
  }

  if (report.kind === 'invalid') {
    logWarn(report.reason)
    return
  }

  if (report.kind === 'opted-out') {
    logInfo(
      'canon/config/context.toml declares roots = [], so coverage was not measured.',
    )
    return
  }

  const { unnamed, doubled, missingRoots } = report.findings
  const lines = [
    ...missingRoots.map((root) => `${root}  matches no folder`),
    ...unnamed.map((folder) => `${folder}  named in no Layout`),
    ...doubled.map(
      ({ folder, rels }) => `${folder}  Layout H3 in ${rels.join(', ')}`,
    ),
  ]

  if (lines.length === 0) {
    logInfo(`Every folder under ${report.roots.join(', ')} is named once.`)
    return
  }

  logWarn(plural(lines.length, 'coverage finding'))
  pipeOutput(lines.join('\n'))
}

/** Reports the requirements record against the word cap it states, if any. */
function reportRequirements(
  report: RequirementsReport | undefined,
  root: string,
): void {
  logStep('Requirements record')

  if (report === undefined) {
    logInfo(
      `Out of scope. The project carries no ${requirementsRel(root)}, so there was no record to measure.`,
    )
    return
  }

  if (report.wordCap === undefined) {
    logInfo(
      `${plural(report.words, 'word')} in ${report.rel} and no word cap stated, so the count is reported and never gated.`,
    )
  } else if (isOverWordCap(report)) {
    logError(
      `${plural(report.words, 'word')} against a cap of ${report.wordCap} in ${report.rel}.`,
    )
  } else {
    logInfo(
      `${plural(report.words, 'word')} against a cap of ${report.wordCap} in ${report.rel}.`,
    )
  }
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
