import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import type { Command } from 'commander'
import { BAN_SETS, emptyBanSets } from '@/markdown/bans'
import { lengthExemption } from '@/markdown/ceiling'
import { type MarkdownAuditRefusal, resolveMarkdown } from '@/markdown/files'
import { isGating } from '@/markdown/gate'
import { decodePath, findBrokenLinks, type LinkFinding } from '@/markdown/links'
import {
  type BanFinding,
  type BanSets,
  bodyLines,
  scanBans,
} from '@/markdown/scan'
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
} from '@/ui'

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
      'Fail on a banned character, word, or spelling, and report bullet, paragraph, cadence, depth, and length',
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
        '  2  a banned character, word, or spelling is present, or a relative',
        '     link resolves to nothing on disk',
        '  3  a shipped ban set is empty, so the run measured nothing',
        '',
        'A ban hit and a dead link are each a fact and gate unconditionally.',
        'Bullet, paragraph, and depth weight are judgments a reader settles,',
        'so all three report and none of them fails a run.',
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
        'a near-synonym. A code span clears the report and is the answer only',
        'where the token is genuinely an identifier under discussion, which is',
        'what markdown.md reserves the span for.',
        '',
        'Bans and checkpoints ship with the canon package rather than being read',
        'out of a standards file, so a project that installed no standards is',
        'measured the same as one that did. markdown.md still states every rule',
        'for a reader. No folder has to resolve and no index.md has',
        'to exist, so .claude/rules/, governance/, and snippets/ are in reach.',
        '',
        'Examples:',
        '  canon markdown audit',
        '  canon markdown audit --json',
        '  canon markdown audit .claude/rules governance',
        '  canon markdown audit docs/agents/commands.md',
        "  canon markdown audit 'snippets/**/*.md'",
        '',
      ].join('\n'),
    )
    .action(async (paths: string[], opts: AuditCommandOptions) => {
      process.exitCode = await runAudit(paths, opts)
    })
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

  const bans = BAN_SETS
  const empty = emptyBanSets(bans)
  const checkpoints = CHECKPOINTS

  const reports: FileReport[] = await Promise.all(
    scope.files.map(async (rel) => {
      const abs = resolve(root, rel)
      const source = await readFile(abs, 'utf8')
      const lines = bodyLines(source)
      return {
        rel,
        bans: scanBans(lines, bans),
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
          words: bans.words,
          spellings: bans.spellings,
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
  })

  return gating ? EXIT_GATE : 0
}

function refuse(
  reason: MarkdownAuditRefusal,
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
      `Not measured. The shipped set is empty for: ${empty.join(', ')}. The sets ship with the canon package, so an empty one is a defect in the build rather than a missing install.`,
    )
    return
  }

  logInfo(
    `${plural(bans.characters.length, 'character')}, ${plural(bans.words.length, 'word')}, and ${plural(bans.spellings.length, 'spelling')} shipped with the canon package`,
  )
  logInfo(
    'Frontmatter, fenced blocks, code spans, and link destinations are excluded.',
  )
  logInfo(
    'Phrase bans and every voice rule are patterns rather than closed sets, and stay a judgment for the reader.',
  )

  const carrying = reports
    .filter((report) => report.bans.length > 0)
    .sort((a, b) => b.bans.length - a.bans.length)

  if (carrying.length === 0) {
    logInfo('No banned character, word, or spelling.')
    return
  }

  const total = carrying.reduce((sum, report) => sum + report.bans.length, 0)
  logWarn(`${plural(total, 'hit')} across ${plural(carrying.length, 'file')}`)
  logWarn('This fails the run. Every other check below reports.')
  logInfo(
    'Rewrite the sentence rather than swapping the token for a near-synonym.',
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
