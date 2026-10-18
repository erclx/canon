import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import type { Command } from 'commander'
import { BAN_SETS, emptyBanSets } from '@/markdown/bans'
import { isChangelog, lengthExemption } from '@/markdown/ceiling'
import { type ColonFinding, findColons } from '@/markdown/colons'
import { type MarkdownAuditRefusal, resolveMarkdown } from '@/markdown/files'
import { densityFindings, type DensityKind } from '@/markdown/density'
import {
  type GatedDensityFinding,
  type GatedReferenceShapeFinding,
  isGating,
  referenceShapeGates,
} from '@/markdown/gate'
import {
  findHeadingCase,
  type HeadingCaseFinding,
} from '@/markdown/heading-case'
import { decodePath, findBrokenLinks, type LinkFinding } from '@/markdown/links'
import {
  REFERENCE_SECTIONS,
  type ReferenceShapeKind,
  referenceShapeFindings,
} from '@/markdown/reference-shape'
import {
  type BanFinding,
  type BanSets,
  bodyLines,
  scanBans,
} from '@/markdown/scan'
import {
  appendGatedPrefix,
  findingsUnder,
  GATED_CONFIG_REL,
  type GatedList,
  prefixShapeError,
  readGatedConfig,
  resolveGatedList,
} from '@/markdown/gated'
import { densityGates, inDensityScope } from '@/markdown/scope'
import {
  BASELINE,
  CHECKPOINTS,
  type Checkpoints,
  documentHeight,
  measureStructure,
  type StructureReport,
} from '@/markdown/structure'
import {
  intro,
  logInfo,
  logStep,
  logWarn,
  outro,
  pipeOutput,
  plural,
} from '@/cli/ui'
import { isOwnCheckout } from '@/roots/project'

/** A config the audit cannot read refuses rather than gating nothing. */
type AuditRefusal = MarkdownAuditRefusal | 'malformed-config'

const EXIT_REFUSED = 1
const EXIT_GATE = 2

/**
 * A set shipped empty, so the run measured a corpus against nothing.
 *
 * Distinct from `EXIT_REFUSED` because the two want different responses. A
 * refusal means no corpus was built and a push stage is right to skip, while an
 * empty set means the corpus was walked and nothing was looked for, which is a
 * defect in the build and has to fail.
 */
const EXIT_UNUSABLE = 3

interface AuditCommandOptions {
  readonly json?: boolean
}

interface FileReport {
  readonly rel: string
  readonly bans: readonly BanFinding[]
  readonly links: readonly LinkFinding[]
  readonly colons: readonly ColonFinding[]
  readonly headingCase: readonly HeadingCaseFinding[]
  /** Empty on a path outside the density scope, so a plan never carries one. */
  readonly density: readonly GatedDensityFinding[]
  /** Empty on a page whose frontmatter does not carry `kind: reference`. */
  readonly referenceShape: readonly GatedReferenceShapeFinding[]
  readonly structure: StructureReport
  readonly renderedLines: number
  /** The stated reason, or null where the document is not exempt. */
  readonly exempt: string | null
}

export function register(program: Command): void {
  const markdown = program
    .command('markdown')
    .description('Report markdown files against the attribute standards')
    .helpOption('-h, --help', 'Show this help message')

  markdown
    .command('audit')
    .description(
      'Fail on a banned character, a dead link, or a gated density finding, and report weight, cadence, depth, and length',
    )
    .argument(
      '[path...]',
      'Markdown files, directories, or globs, defaulting to every markdown file git lists',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  the audit completed with no gating finding',
        '  1  refused, with the reason on stderr',
        '  2  a banned character is present, a relative link resolves to',
        '     nothing on disk, or a density or reference shape finding sits',
        '     on a gated path',
        '  3  a shipped ban set is empty, so the run measured nothing',
        '',
        'A ban hit and a dead link are each a fact and gate unconditionally.',
        'Depth weight is a judgment a reader settles, so it reports and never',
        'fails a run.',
        '',
        'Density holds six limits: a 350-character paragraph, 2 paragraphs in',
        'a row, a 200-character bullet, 5 plain bullets in a row, no H4, and a',
        'paragraph or table opening every H3. Only context, docs, skills, tooling',
        'seeds and references, the wiki, README.md, and CONTRIBUTING.md take a',
        'finding. In a canon checkout one gates under a prefix in GATED_PATHS in',
        'src/markdown/scope.ts, and a bullet run gates in context, docs, and',
        'skills from the start. Elsewhere one gates only under a prefix',
        'canon/config/markdown.toml lists, which canon markdown gated add writes,',
        'and with no such file every density finding reports and none gates.',
        'A config that does not parse refuses with its path named.',
        '',
        'A page whose frontmatter carries kind: reference takes the reference',
        'shape: no H2 beyond Output, Refusals, and See also, each at most once',
        'and in that order, no H3, and no table whose first header cell names',
        'flags or options. It gates under the same prefixes density does, and',
        'an unmarked page is never measured.',
        '',
        'A mid-sentence colon and a heading with a capital after its first word',
        'report the same way. A proper noun is the one case the second cannot',
        'tell from title case, and the first is sometimes right.',
        '',
        'Length reports a whole document past the ceiling and never exits 2.',
        'The Document ceiling gate stage owns that verdict, since this audit also',
        'runs on a record kept out of version control, where a long plan is not',
        'a defect.',
        '',
        'Cadence reports the same way and carries one more caveat. Its range is',
        'drawn from prose a person reads, so terse reference prose sits below',
        'it correctly and a flat paragraph there is not a defect.',
        '',
        'Rewrite the sentence carrying a hit rather than swapping the token for',
        'a near-synonym or a colon or a comma. A code span clears the report and is the answer only',
        'where the token is genuinely an identifier under discussion, which is',
        'what markdown.md reserves the span for.',
        '',
        'Bans and checkpoints ship with the canon package rather than being read',
        'out of a standards file, so a project that installed no standards is',
        'measured the same as one that did. markdown.md still states every rule',
        'for a reader. No folder has to resolve and no index.md has',
        'to exist, so .claude/rules/ and governance/ are in reach.',
        '',
        'Examples:',
        '  canon markdown audit',
        '  canon markdown audit --json',
        '  canon markdown audit .claude/rules governance',
        '  canon markdown audit docs/agents/install-and-sync.md',
        "  canon markdown audit 'standards/**/*.md'",
        '',
      ].join('\n'),
    )
    .action(async (paths: string[], opts: AuditCommandOptions) => {
      process.exitCode = await runAudit(paths, opts)
    })

  const gated = markdown
    .command('gated')
    .description("Read and extend a project's gated density prefixes")
    .helpOption('-h, --help', 'Show this help message')

  gated
    .command('add')
    .description(
      'Gate a folder or file once it carries no density or reference shape finding',
    )
    .argument(
      '<prefix>',
      'A folder ending in a slash, or the path of one existing file',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  the prefix is listed, appended now or already present',
        '  1  refused, with the reason on stderr, and the config left untouched',
        '',
        'Appends the prefix to canon/config/markdown.toml only when every file',
        'under it carries zero findings that would gate once it is listed, so a',
        'gated folder never fails a push the moment it is added. A folder holding',
        'no markdown file passes. A prefix without a trailing slash would also',
        'match a sibling such as docs-old/, so one must name an existing file.',
        "A skill's REQUIREMENT.md gates only on its own path, never a folder.",
        '',
        "Canon's own checkout lists its prefixes in GATED_PATHS in",
        'src/markdown/scope.ts, so the verb refuses there.',
        '',
        'Examples:',
        '  canon markdown gated add docs/',
        '  canon markdown gated add .claude/skills/my-skill/REQUIREMENT.md --json',
        '',
      ].join('\n'),
    )
    .action(async (prefix: string, opts: AuditCommandOptions) => {
      process.exitCode = await runGatedAdd(prefix, opts)
    })
}

type GatedAddRefusal =
  'canon-checkout' | 'malformed-config' | 'bad-prefix' | 'no-git' | 'findings'

async function runGatedAdd(
  prefix: string,
  opts: AuditCommandOptions,
): Promise<number> {
  const root = process.cwd()
  const json = opts.json ?? false
  const refuseAdd = (
    reason: GatedAddRefusal,
    message: string,
    extra: Record<string, unknown> = {},
  ): number => {
    intro('canon markdown gated add')
    logStep('Refused')
    logWarn(message)
    outro()
    if (json) {
      process.stdout.write(
        `${JSON.stringify({ root, prefix, reason, message, ...extra })}\n`,
      )
    }
    return EXIT_REFUSED
  }

  if (isOwnCheckout(root)) {
    return refuseAdd(
      'canon-checkout',
      'This is a canon checkout, which gates through GATED_PATHS in src/markdown/scope.ts. Add the prefix there.',
    )
  }

  const config = readGatedConfig(root)
  if (config.kind === 'malformed') {
    return refuseAdd('malformed-config', config.message)
  }

  const shape = prefixShapeError(root, prefix)
  if (shape !== undefined) return refuseAdd('bad-prefix', shape)

  const findings = await findingsUnder(root, prefix)
  if (!findings) {
    return refuseAdd(
      'no-git',
      'git could not list the tree, so nothing under the prefix was measured. Run inside a git repository.',
    )
  }
  if (findings.length > 0) {
    return refuseAdd(
      'findings',
      `${plural(findings.length, 'finding')} under ${prefix} would gate once it is listed. Run 'canon markdown audit ${prefix}' and bring it to zero first.`,
      { findings },
    )
  }

  const current = config.kind === 'listed' ? config.prefixes : []
  const action = appendGatedPrefix(root, current, prefix)

  intro('canon markdown gated add')
  logStep(action === 'appended' ? 'Appended' : 'Already listed')
  logInfo(
    action === 'appended'
      ? `${prefix} now gates in ${GATED_CONFIG_REL}.`
      : `${prefix} was already listed in ${GATED_CONFIG_REL}, so nothing was written.`,
  )
  outro()

  if (json) {
    process.stdout.write(
      `${JSON.stringify({ root, prefix, action, config: GATED_CONFIG_REL })}\n`,
    )
  }

  return 0
}

async function runAudit(
  paths: string[],
  opts: AuditCommandOptions,
): Promise<number> {
  const root = process.cwd()
  const scope = await resolveMarkdown(root, paths)

  if (scope.kind === 'unavailable') {
    return refuse(
      'no-git',
      'git could not list the tree, so no corpus was built. Run inside a git repository.',
      root,
      opts.json ?? false,
    )
  }

  if (scope.files.length === 0) {
    return refuse(
      paths.length === 0 ? 'no-markdown' : 'no-match',
      paths.length === 0
        ? 'No markdown file in the tree.'
        : `No markdown file matched: ${scope.unmatched.join(', ')}`,
      root,
      opts.json ?? false,
    )
  }

  const resolution = resolveGatedList(root)
  if (resolution.kind === 'malformed') {
    return refuse(
      'malformed-config',
      resolution.message,
      root,
      opts.json ?? false,
    )
  }
  const gated = resolution.list

  const bans = BAN_SETS
  const empty = emptyBanSets(bans)
  const checkpoints = CHECKPOINTS

  const reports: FileReport[] = await Promise.all(
    scope.files.map(async (rel) => {
      const abs = resolve(root, rel)
      const source = await readFile(abs, 'utf8')
      const lines = bodyLines(source)
      // The release tool writes a changelog, so neither advisory reads it.
      const advisory = !isChangelog(rel)
      return {
        rel,
        bans: scanBans(lines, bans),
        colons: advisory ? findColons(lines) : [],
        headingCase: advisory ? findHeadingCase(source) : [],
        density: inDensityScope(rel)
          ? densityFindings(lines).map((finding) => ({
              ...finding,
              gating: densityGates(
                rel,
                finding.kind,
                gated.prefixes,
                gated.alwaysGated,
              ),
            }))
          : [],
        referenceShape: referenceShapeFindings(source).map((finding) => ({
          ...finding,
          gating: referenceShapeGates(rel, gated.prefixes),
        })),
        links: findBrokenLinks(lines, (path) =>
          existsSync(resolve(dirname(abs), path)),
        ),
        structure: measureStructure(rel, lines, checkpoints),
        renderedLines: documentHeight(source, checkpoints.renderWidth),
        exempt: lengthExemption(rel, source),
      }
    }),
  )

  intro('canon markdown audit')
  reportScope(scope.files, scope.unmatched)
  reportBans(reports, bans, empty)
  reportLinks(reports, root)
  reportColons(reports)
  reportHeadingCase(reports)
  reportDensity(reports, gated, resolution.source)
  reportReferenceShape(reports, gated)
  reportBullets(reports, checkpoints)
  reportParagraphs(reports, checkpoints)
  reportCadence(reports, checkpoints)
  reportDepth(reports, checkpoints)
  reportLength(reports, checkpoints)
  outro()

  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        files: scope.files,
        unmatchedPaths: scope.unmatched,
        bans: {
          characters: bans.characters,
          emptySets: empty,
        },
        checkpoints: {
          run: checkpoints.run,
          peerBullet: checkpoints.peerBullet,
          bullet: checkpoints.bullet,
          paragraph: checkpoints.paragraph,
          sentences: checkpoints.sentences,
          renderWidth: checkpoints.renderWidth,
          cadence: checkpoints.cadence,
          spread: checkpoints.spread,
          opener: checkpoints.opener,
          ceiling: checkpoints.ceiling,
        },
        entries: reports.map((report) => ({
          path: report.rel,
          bans: report.bans,
          links: report.links,
          colons: report.colons,
          headingCase: report.headingCase,
          density: report.density,
          referenceShape: report.referenceShape,
          longestRun: report.structure.longestRun,
          longestRunLine: report.structure.longestRunLine,
          heavyBullets: report.structure.heavyBullets,
          heavyParagraphs: report.structure.heavyParagraphs,
          cadence: report.structure.cadence,
          renderedLines: report.renderedLines,
          exempt: report.exempt,
        })),
      })}\n`,
    )
  }

  // An empty set finds nothing and would exit clean, which reports a corpus
  // nobody checked as a corpus carrying no violation.
  if (empty.length > 0) return EXIT_UNUSABLE

  const gating = isGating({
    bans: reports.flatMap((report) => report.bans),
    links: reports.flatMap((report) => report.links),
    structure: reports.map((report) => report.structure),
    colons: reports.flatMap((report) => report.colons),
    headingCase: reports.flatMap((report) => report.headingCase),
    density: reports.flatMap((report) => report.density),
    referenceShape: reports.flatMap((report) => report.referenceShape),
  })

  return gating ? EXIT_GATE : 0
}

function refuse(
  reason: AuditRefusal,
  message: string,
  root: string,
  emitJson: boolean,
): number {
  intro('canon markdown audit')
  logStep('Refused')
  logWarn(message)
  outro()

  if (emitJson) {
    process.stdout.write(`${JSON.stringify({ root, reason, message })}\n`)
  }

  return EXIT_REFUSED
}

function reportScope(
  files: readonly string[],
  unmatched: readonly string[],
): void {
  logStep('Scope')
  logInfo(`${plural(files.length, 'markdown file')}`)

  if (unmatched.length === 0) return

  logWarn(`Matched no markdown file: ${unmatched.join(', ')}`)
}

/**
 * Names what the closed sets reach and what they leave to a reader.
 *
 * The two standards state bans in three shapes and only two of them are a
 * closed set. A phrase ban carries a placeholder standing in for the rest of
 * the sentence and every voice rule is a judgment, so a report listing hits
 * without naming those would read as a verdict on the whole standard.
 */
function reportBans(
  reports: readonly FileReport[],
  bans: BanSets,
  empty: readonly string[],
): void {
  logStep('Bans')

  if (empty.length > 0) {
    logWarn(
      `Not measured. The shipped set is empty for: ${empty.join(', ')}. The set ships with the canon package, so an empty set is a defect in the build rather than a missing install.`,
    )
    return
  }

  logInfo(
    `${plural(bans.characters.length, 'character')} shipped with the canon package`,
  )
  logInfo(
    'Frontmatter, fenced blocks, code spans, and link destinations are excluded.',
  )
  logInfo(
    'Word bans, phrase bans, and every voice rule are guidance for the reader',
  )

  const carrying = reports
    .filter((report) => report.bans.length > 0)
    .sort((a, b) => b.bans.length - a.bans.length)

  if (carrying.length === 0) {
    logInfo('No banned character.')
    return
  }

  const total = carrying.reduce((sum, report) => sum + report.bans.length, 0)
  logWarn(`${plural(total, 'hit')} across ${plural(carrying.length, 'file')}`)
  logWarn('This fails the run. Every other check below reports.')
  logInfo(
    "Rewrite the sentence rather than swapping the token for a near-synonym, or a colon or a comma in the dash's place. That is the same sentence.",
  )
  logInfo(
    'A code span clears the report and is the answer only where the token is genuinely an identifier under discussion, which is what markdown.md reserves the span for.',
  )
  pipeOutput(
    carrying
      .map(
        (report) =>
          `${report.rel}  ${plural(report.bans.length, 'hit')}\n${report.bans
            .map(
              (found) =>
                `  :${found.line}:${found.column + 1}  ${found.kind}  ${found.term}`,
            )
            .join('\n')}`,
      )
      .join('\n'),
  )
}

/**
 * Names both the destination as written and the path it resolved to, since
 * the second is what an editor can go check and the first is what a fix
 * touches.
 */
function resolvedLinkPath(
  root: string,
  rel: string,
  destination: string,
): string {
  const path = decodePath(destination)
  if (path === undefined) return '(destination carries a malformed encoding)'
  return relative(root, resolve(dirname(resolve(root, rel)), path))
}

function reportLinks(reports: readonly FileReport[], root: string): void {
  logStep('Links')
  logInfo(
    "A relative link's destination resolves against the filesystem, over the same corpus the ban scan reads.",
  )
  logInfo(
    'A destination carrying a template placeholder in angle brackets reads as an illustration rather than a literal path.',
  )

  const carrying = reports
    .filter((report) => report.links.length > 0)
    .sort((a, b) => b.links.length - a.links.length)

  if (carrying.length === 0) {
    logInfo('No relative link resolving to nothing on disk.')
    return
  }

  const total = carrying.reduce((sum, report) => sum + report.links.length, 0)
  logWarn(
    `${plural(total, 'dead link')} across ${plural(carrying.length, 'file')}`,
  )
  logWarn('This fails the run. Every other check below reports.')
  pipeOutput(
    carrying
      .map(
        (report) =>
          `${report.rel}  ${plural(report.links.length, 'link')}\n${report.links
            .map(
              (found) =>
                `  :${found.line}:${found.column + 1}  ${found.destination}  -> ${resolvedLinkPath(root, report.rel, found.destination)}`,
            )
            .join('\n')}`,
      )
      .join('\n'),
  )
}

const DENSITY_LABELS: Record<DensityKind, string> = {
  'paragraph-length': 'paragraph length',
  'paragraph-run': 'paragraphs in a row',
  'bullet-length': 'bullet length',
  'bullet-run': 'bullets in a row',
  'heading-depth': 'heading depth',
  'h3-opening': 'H3 opening',
}

function describeDensity(finding: GatedDensityFinding): string {
  const measured =
    finding.kind === 'h3-opening'
      ? 'opens with neither a paragraph nor a table'
      : finding.kind === 'heading-depth'
        ? `H${finding.value} past H${finding.limit}`
        : `${finding.value} past ${finding.limit}`
  const gate = finding.gating ? '  gating' : ''
  return `  :${finding.line}  ${DENSITY_LABELS[finding.kind]}  ${measured}${gate}`
}

/**
 * Lists every density finding with whether it gates, since an in-scope path
 * under no gated prefix reports the same finding a gated one fails on and a
 * reader has to tell the two apart in one frame.
 */
function reportDensity(
  reports: readonly FileReport[],
  gated: GatedList,
  source: 'canon' | 'config' | 'absent',
): void {
  logStep('Density')
  logInfo(
    `Paragraphs past ${CHECKPOINTS.paragraph} characters, more than 2 paragraphs in a row, bullets past ${CHECKPOINTS.bullet} characters, more than 5 plain bullets in a row, a heading past H3, and an H3 opening with neither a paragraph nor a table.`,
  )
  logInfo(
    'Measured on context entries, docs, skill bodies, references, and requirements, tooling seeds and stack references, the wiki, README.md, and CONTRIBUTING.md. Every other path takes no density finding.',
  )
  logInfo(densityGatingLine(gated, source))

  const carrying = reports
    .filter((report) => report.density.length > 0)
    .sort((a, b) => b.density.length - a.density.length)

  if (carrying.length === 0) {
    logInfo('No density finding.')
    return
  }

  const total = carrying.reduce((sum, report) => sum + report.density.length, 0)
  const gating = carrying.reduce(
    (sum, report) =>
      sum + report.density.filter((finding) => finding.gating).length,
    0,
  )
  logWarn(
    `${plural(total, 'finding')} across ${plural(carrying.length, 'file')}, ${gating} gating`,
  )
  if (gating > 0) logWarn('A gating finding fails the run.')
  logInfo(
    'Split a long block at its seam, put a heading or a table between paragraphs, give a long list H3s, and open each H3 with a sentence or a table.',
  )
  pipeOutput(
    carrying
      .map(
        (report) =>
          `${report.rel}  ${plural(report.density.length, 'finding')}\n${report.density
            .map(describeDensity)
            .join('\n')}`,
      )
      .join('\n'),
  )
}

function densityGatingLine(
  gated: GatedList,
  source: 'canon' | 'config' | 'absent',
): string {
  if (source === 'absent') {
    return `No ${GATED_CONFIG_REL} lists a gated prefix, so every density finding reports and none gates. Run 'canon markdown gated add <prefix>' once a folder reaches zero.`
  }
  const listed =
    gated.prefixes.length === 0 ? 'none yet' : gated.prefixes.join(', ')
  return source === 'canon'
    ? `A finding gates under a gated prefix (${listed}), and a bullet run gates in context, docs, and skills already. Every other finding reports.`
    : `A finding gates under a prefix ${GATED_CONFIG_REL} lists (${listed}). Every other finding reports.`
}

const REFERENCE_SHAPE_LABELS: Record<ReferenceShapeKind, string> = {
  'extra-section': 'section outside the shape',
  'section-order': 'section out of order or repeated',
  subsection: 'H3',
  'flag-table': 'flag table',
}

function describeReferenceShape(finding: GatedReferenceShapeFinding): string {
  const gate = finding.gating ? '  gating' : ''
  return `  :${finding.line}  ${REFERENCE_SHAPE_LABELS[finding.kind]}  ${finding.text}${gate}`
}

/**
 * Lists every reference shape finding with whether it gates, under the same
 * prefixes the density step names.
 */
function reportReferenceShape(
  reports: readonly FileReport[],
  gated: GatedList,
): void {
  logStep('Reference shape')
  logInfo(
    `A page whose frontmatter carries kind: reference holds its opening, then ${REFERENCE_SECTIONS.join(', ')}, each at most once and in that order, with no H3 and no table of flags. An unmarked page is never measured.`,
  )
  logInfo(
    gated.prefixes.length > 0
      ? 'A finding gates under the prefixes the density step names. Every other finding reports.'
      : 'No prefix is gated, so every reference shape finding reports and none gates.',
  )

  const carrying = reports.filter((report) => report.referenceShape.length > 0)

  if (carrying.length === 0) {
    logInfo('No reference shape finding.')
    return
  }

  const total = carrying.reduce(
    (sum, report) => sum + report.referenceShape.length,
    0,
  )
  const gating = carrying.reduce(
    (sum, report) =>
      sum + report.referenceShape.filter((finding) => finding.gating).length,
    0,
  )
  logWarn(
    `${plural(total, 'finding')} across ${plural(carrying.length, 'file')}, ${gating} gating`,
  )
  if (gating > 0) logWarn('A gating finding fails the run.')
  logInfo(
    "Fold an H3 into its section, move a section the shape lacks into the opening or a linked page, and point at the command's own --help for flags.",
  )
  pipeOutput(
    carrying
      .map(
        (report) =>
          `${report.rel}  ${plural(report.referenceShape.length, 'finding')}\n${report.referenceShape
            .map(describeReferenceShape)
            .join('\n')}`,
      )
      .join('\n'),
  )
}

function reportColons(reports: readonly FileReport[]): void {
  logStep('Colons')
  logInfo(
    'A colon followed by more text in a prose line, outside a label, a code span, and a link.',
  )
  logInfo(
    'A heading, a table row, a fenced block, and a line-final colon are excluded. This never fails a run.',
  )

  const carrying = reports
    .filter((report) => report.colons.length > 0)
    .sort((a, b) => b.colons.length - a.colons.length)

  if (carrying.length === 0) {
    logInfo('No colon joining two clauses.')
    return
  }

  const total = carrying.reduce((sum, report) => sum + report.colons.length, 0)
  logWarn(`${plural(total, 'colon')} across ${plural(carrying.length, 'file')}`)
  logInfo(
    'Split the sentence or rewrite it. A colon belongs after a label or at the end of a line introducing a list.',
  )
  pipeOutput(
    carrying
      .map(
        (report) =>
          `${report.rel}  ${plural(report.colons.length, 'colon')}\n${report.colons
            .map((found) => `  :${found.line}:${found.column + 1}`)
            .join('\n')}`,
      )
      .join('\n'),
  )
}

function reportHeadingCase(reports: readonly FileReport[]): void {
  logStep('Heading case')
  logInfo(
    'A heading or frontmatter title with a capitalized word after its first, outside code spans and all-caps tokens.',
  )
  logInfo(
    'A proper noun reports too and is left as it is. This never fails a run.',
  )

  const carrying = reports
    .filter((report) => report.headingCase.length > 0)
    .sort((a, b) => b.headingCase.length - a.headingCase.length)

  if (carrying.length === 0) {
    logInfo('No heading carrying a capital after its first word.')
    return
  }

  const total = carrying.reduce(
    (sum, report) => sum + report.headingCase.length,
    0,
  )
  logWarn(
    `${plural(total, 'heading')} across ${plural(carrying.length, 'file')}`,
  )
  pipeOutput(
    carrying
      .map(
        (report) =>
          `${report.rel}  ${plural(report.headingCase.length, 'heading')}\n${report.headingCase
            .map((found) => `  :${found.line}  ${found.text}`)
            .join('\n')}`,
      )
      .join('\n'),
  )
}

function reportBullets(
  reports: readonly FileReport[],
  checkpoints: Checkpoints,
): void {
  logStep('Bullets')
  logInfo(
    'Top-level bullets measure characters, folding in continuation lines.',
  )
  logInfo(
    'Nested items and fenced blocks are excluded. Weight is a judgment, never a defect.',
  )

  const carrying = reports
    .filter((report) => report.structure.heavyBullets.length > 0)
    .sort(
      (a, b) =>
        b.structure.heavyBullets.length - a.structure.heavyBullets.length,
    )

  if (carrying.length === 0) {
    logInfo(`No bullet past the ${checkpoints.bullet}-character checkpoint.`)
    return
  }

  const total = carrying.reduce(
    (sum, report) => sum + report.structure.heavyBullets.length,
    0,
  )
  logWarn(
    `${plural(total, 'bullet')} past the ${checkpoints.bullet}-character checkpoint across ${plural(carrying.length, 'file')}`,
  )
  pipeOutput(
    carrying
      .map(
        (report) =>
          `${report.rel}  ${plural(report.structure.heavyBullets.length, 'bullet')}\n${report.structure.heavyBullets
            .map((found) => `  :${found.line}  ${found.characters} characters`)
            .join('\n')}`,
      )
      .join('\n'),
  )
}

/**
 * States both halves of the checkpoint on every run.
 *
 * The standard states a sentence cap and a weight, and a report naming only the
 * first would leave a reader unable to tell why a two-sentence paragraph is
 * listed.
 */
function reportParagraphs(
  reports: readonly FileReport[],
  checkpoints: Checkpoints,
): void {
  logStep('Paragraphs')
  logInfo(
    `Prose paragraphs report past ${checkpoints.sentences} sentences or past ${checkpoints.paragraph} characters.`,
  )
  logInfo(
    'The standard states both, and weight moves independently of the bullet checkpoint.',
  )
  logInfo(
    'Bullets, headings, tables, quotes, and fenced blocks each end a paragraph, so a bullet is measured once.',
  )

  const carrying = reports
    .filter((report) => report.structure.heavyParagraphs.length > 0)
    .sort(
      (a, b) =>
        b.structure.heavyParagraphs.length - a.structure.heavyParagraphs.length,
    )

  if (carrying.length === 0) {
    logInfo('No paragraph past either checkpoint.')
    return
  }

  const total = carrying.reduce(
    (sum, report) => sum + report.structure.heavyParagraphs.length,
    0,
  )
  logWarn(
    `${plural(total, 'paragraph')} past a checkpoint across ${plural(carrying.length, 'file')}`,
  )
  pipeOutput(
    carrying
      .map(
        (report) =>
          `${report.rel}  ${plural(report.structure.heavyParagraphs.length, 'paragraph')}\n${report.structure.heavyParagraphs
            .map(
              (found) =>
                `  :${found.line}  ${found.sentences} sentences, ${found.characters} characters`,
            )
            .join('\n')}`,
      )
      .join('\n'),
  )
}

/**
 * Reports the distribution rather than a verdict, which is what separates this
 * step from the three above it.
 *
 * Bullet, paragraph, and depth weight each report a count against a checkpoint
 * a reader settles. Cadence reports a count as well, and the range behind it is
 * drawn from one surface class rather than from the corpus, so the step states
 * where the numbers came from beside them. A reader whose file is terse
 * reference prose is meant to read a flat paragraph as correct, and a number
 * printed with no comparison beside it reads as a finding whatever the step is
 * called.
 */
function reportCadence(
  reports: readonly FileReport[],
  checkpoints: Checkpoints,
): void {
  logStep('Cadence')
  logInfo(
    `Paragraphs of ${checkpoints.cadence} sentences or more measure the words between their longest and shortest sentence, and the times one word opens a sentence.`,
  )
  logInfo(
    `A spread of ${checkpoints.spread} words or under reads as one cadence, and a word opening more than ${checkpoints.opener} sentences is a pattern rather than a coincidence.`,
  )
  logInfo(
    'Both numbers are stated under Rhythm in the write-human skill, which writes them about prose a person reads.',
  )
  logInfo(
    'A shorter paragraph stays unmeasured, since a two-sentence note carries no spread worth reading.',
  )
  logInfo(
    'A healthy range differs by surface, so neither number gates and neither names a file wrong. Terse reference prose sits below the range a page written for a reader sits in.',
  )
  logInfo(
    `The corpus these numbers were read against measured ${BASELINE.flatShare} percent flat overall, and its files carrying ${BASELINE.floor} or more measured paragraphs ran from ${BASELINE.low} to ${BASELINE.high} percent with a median near ${BASELINE.median}. Compare a rate against that rather than against zero.`,
  )

  const measured = reports.reduce(
    (sum, report) => sum + report.structure.cadence.measured,
    0,
  )

  if (measured === 0) {
    logInfo(
      `No paragraph reached ${checkpoints.cadence} sentences, so nothing was measured.`,
    )
    return
  }

  const flat = reports.reduce(
    (sum, report) => sum + report.structure.cadence.flat,
    0,
  )
  const repeating = reports.reduce(
    (sum, report) => sum + report.structure.cadence.repeating,
    0,
  )

  logInfo(
    `${plural(measured, 'paragraph')} measured, ${flat} at or under the spread checkpoint (${Math.round((flat / measured) * 100)} percent) and ${repeating} past the opener checkpoint.`,
  )

  const carrying = reports
    .filter(
      (report) =>
        report.structure.cadence.flattest ||
        report.structure.cadence.mostRepeated,
    )
    .sort(
      (a, b) =>
        b.structure.cadence.flat +
        b.structure.cadence.repeating -
        (a.structure.cadence.flat + a.structure.cadence.repeating),
    )

  if (carrying.length === 0) return

  pipeOutput(
    carrying
      .map((report) => {
        const { flattest, mostRepeated } = report.structure.cadence
        const lines = [
          flattest &&
            `  :${flattest.line}  ${plural(flattest.sentences, 'sentence')}, spread ${plural(flattest.spread, 'word')}`,
          mostRepeated &&
            `  :${mostRepeated.line}  ${plural(mostRepeated.sentences, 'sentence')}, "${mostRepeated.opener}" opens ${mostRepeated.repeats}`,
        ].filter(Boolean)

        return `${report.rel}\n${lines.join('\n')}`
      })
      .join('\n'),
  )
}

/**
 * Names the render width and the blank-line convention on every run.
 *
 * The standard settles heading level and fenced blocks and stops there, so a
 * hand reader who drops blank lines lands a line or two below this number.
 * Stating both keeps the two measurements reconcilable, and the width matters
 * more, since a number counted in rendered lines cannot be reproduced without
 * it.
 */
function reportDepth(
  reports: readonly FileReport[],
  checkpoints: Checkpoints,
): void {
  logStep('Depth')
  logInfo(
    `Runs measure rendered lines at ${checkpoints.renderWidth} columns and count blank lines.`,
  )
  logInfo(
    `Fenced blocks are excluded, and so are peer lists averaging under ${checkpoints.peerBullet} characters a bullet.`,
  )
  logInfo(
    'A run that is entirely table rows is excluded too, since a heading inside a table splits the table rather than the run.',
  )
  logInfo(
    'A heading breaks a run and so does a bold section marker at column zero, such as a line reading only Risks in bold. A colon-less one breaks when it holds one whole code span, or when it runs to 20 characters or fewer, and an indented one stays prose.',
  )

  const over = reports
    .filter((report) => report.structure.longestRun > checkpoints.run)
    .sort((a, b) => b.structure.longestRun - a.structure.longestRun)

  if (over.length === 0) {
    logInfo(`No run past the ${checkpoints.run}-line checkpoint.`)
    return
  }

  logWarn(`${over.length} past the ${checkpoints.run}-line checkpoint`)
  pipeOutput(
    over
      .map(
        (report) =>
          `${report.structure.rel}:${report.structure.longestRunLine}  ${report.structure.longestRun} rendered lines unbroken`,
      )
      .join('\n'),
  )
}

/**
 * Lists every document past the ceiling and counts the exempt ones rather than
 * naming them, since an exemption is settled where its marker sits.
 */
function reportLength(
  reports: readonly FileReport[],
  checkpoints: Checkpoints,
): void {
  logStep('Length')
  logInfo(
    `Whole documents measure rendered lines at ${checkpoints.renderWidth} columns, frontmatter and fenced blocks included.`,
  )
  logInfo(
    'A changelog is exempt by name, and so is a document carrying a canon-length-exempt marker that names a reason.',
  )

  const past = reports.filter(
    (report) => report.renderedLines > checkpoints.ceiling,
  )
  const over = past
    .filter((report) => report.exempt === null)
    .sort((a, b) => b.renderedLines - a.renderedLines)
  const exempt = past.length - over.length

  if (over.length === 0) {
    logInfo(`No document past the ${checkpoints.ceiling}-line ceiling.`)
  } else {
    logWarn(
      `${plural(over.length, 'document')} past the ${checkpoints.ceiling}-line ceiling`,
    )
    pipeOutput(
      over
        .map(
          (report) => `${report.rel}  ${report.renderedLines} rendered lines`,
        )
        .join('\n'),
    )
  }

  if (exempt > 0) {
    logInfo(`${plural(exempt, 'exempt document')} past the ceiling.`)
  }
}
