import { relative } from 'node:path'
import type { Command } from 'commander'
import { type LessonOutcome, planLesson } from '@/teach/lesson'
import { type NavOutcome, generateNav } from '@/teach/nav'
import { type RenderOutcome, renderLessonBody } from '@/teach/render'
import {
  defineTerms,
  type ListOutcome,
  listWorkspaces,
  type OpenOutcome,
  openWorkspace,
  type ReadOutcome,
  readWorkspace,
  recordSources,
  type RevisitItem,
  type Source,
  type SourceOutcome,
  type TeachRefused,
  type Term,
  type TermOutcome,
  type WorkspaceSummary,
  writeStylesheet,
} from '@/teach/workspace'
import {
  intro,
  logAdd,
  logError,
  logInfo,
  logStep,
  logWarn,
  outro,
  pipeOutput,
} from '@/ui'
import { mainWorktreeRoot } from '@/worktree'

/**
 * A pair as the command line spells it, split on the first `=` so a value
 * carrying its own separator survives. A source URL is the case that needs it.
 */
const PAIR = /^([^=]+)=([\s\S]+)$/

interface ListCommandOptions {
  readonly json?: boolean
  readonly root?: string
}

interface OpenCommandOptions {
  readonly date?: string
  readonly json?: boolean
  readonly outOfScope?: readonly string[]
  readonly root?: string
  readonly startingPoint?: string
  readonly subject?: string
  readonly success?: readonly string[]
  readonly title?: string
}

interface ResourceCommandOptions {
  readonly json?: boolean
  readonly lead?: readonly string[]
  readonly read?: readonly string[]
  readonly root?: string
}

interface LessonCommandOptions {
  readonly json?: boolean
  readonly options?: string
  readonly questions?: string
  readonly root?: string
  readonly slug?: string
}

interface GlossaryCommandOptions {
  readonly firstSeen?: string
  readonly json?: boolean
  readonly root?: string
  readonly term?: readonly string[]
}

interface NavCommandOptions {
  readonly json?: boolean
  readonly root?: string
}

interface RenderCommandOptions {
  readonly json?: boolean
}

export function register(program: Command): void {
  const teach = program
    .command('teach')
    .description('Manage learning workspaces in .canon/teach/')
    .helpOption('-h, --help', 'Show this help message')

  teach
    .command('list')
    .description('List learning workspaces, or what one workspace holds')
    .argument('[topic]', 'Workspace folder or topic, as in regular-expressions')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Teach root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  the workspaces or their contents were listed',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'With no topic it reports one line per workspace and the ordinal an',
        'open would take. With one it reports the files behind each count.',
        '',
        'Every record carries due, what the learning records schedule, each',
        'entry with its date, its rung, and the date to write on a hit and',
        'on a miss, so a session picks the next lesson from the schedule',
        'rather than from the last session alone.',
        '',
        'A workspace not named NN-<topic> is still listed. It sorts last and',
        'moves no ordinal, since dropping it hides the folder needing a fix.',
        '',
        'Examples:',
        '  canon teach list',
        '  canon teach list regular-expressions --json',
        '',
      ].join('\n'),
    )
    .action(async (topic: string | undefined, opts: ListCommandOptions) => {
      process.exitCode = await runList(topic, opts)
    })

  teach
    .command('open')
    .description('Open a workspace at the next ordinal with its required files')
    .argument('<topic>', 'Kebab-case topic, as in regular-expressions')
    .helpOption('-h, --help', 'Show this help message')
    .option('--subject <line>', 'One line stating what the workspace covers')
    .option('--starting-point <text>', 'What the learner already knows')
    .option(
      '--success <line>',
      'Observable thing the learner will be able to do, repeatable',
      collect,
      [] as string[],
    )
    .option(
      '--out-of-scope <line>',
      'What this workspace does not cover, repeatable',
      collect,
      [] as string[],
    )
    .option('--title <text>', 'Title, defaulting to the topic in sentence case')
    .option('--date <YYYY-MM-DD>', 'Opening date, defaulting to today')
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Teach root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  the workspace was created',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'It derives the ordinal from the highest already present and writes',
        'MISSION.md, RESOURCES.md, and GLOSSARY.md. A topic another workspace',
        'already covers is refused, since a second one forks the records.',
        '',
        'Examples:',
        '  canon teach open regular-expressions --subject "Reading and writing regular expressions" \\',
        '    --starting-point "Comfortable with the shell, has never written a group" \\',
        '    --success "Write a pattern matching a date" --success "Explain a backreference"',
        '',
      ].join('\n'),
    )
    .action(async (topic: string, opts: OpenCommandOptions) => {
      process.exitCode = await runOpen(topic, opts)
    })

  teach
    .command('resource')
    .description('Record sources and leads in a workspace RESOURCES.md')
    .argument('<topic>', 'Workspace folder or topic, as in regular-expressions')
    .helpOption('-h, --help', 'Show this help message')
    .option(
      '--read <title=url>',
      'Source that stands behind the material, repeatable',
      collect,
      [] as string[],
    )
    .option(
      '--lead <title=url>',
      'Source found and not opened, repeatable',
      collect,
      [] as string[],
    )
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Teach root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  every source was written',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'The pair splits on the first =, so a URL carrying one survives. Say',
        'in the title which claims rest on the source, since the entry is the',
        'only place a later session reads that from.',
        '',
        'A URL already listed under either heading is refused rather than',
        'repeated, because two entries split what rests on one source.',
        '',
        'Examples:',
        '  canon teach resource regular-expressions --read "MDN regular expressions=https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions"',
        '  canon teach resource regular-expressions --lead "RE2 syntax=https://github.com/google/re2/wiki/Syntax" --json',
        '',
      ].join('\n'),
    )
    .action(async (topic: string, opts: ResourceCommandOptions) => {
      process.exitCode = await runResource(topic, opts)
    })

  teach
    .command('glossary')
    .description('Add terms to a workspace GLOSSARY.md, alphabetically')
    .argument('<topic>', 'Workspace folder or topic, as in regular-expressions')
    .helpOption('-h, --help', 'Show this help message')
    .option(
      '--term <term=definition>',
      'Term the subject defines, repeatable',
      collect,
      [] as string[],
    )
    .option(
      '--first-seen <file>',
      'Lesson or reference page the batch first defines these in',
    )
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Teach root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  every term now carries an entry',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'One call writes one file, which is what keeps a batch from racing on',
        'the glossary every term shares. --first-seen names one page for the',
        'whole batch, since a batch comes from one lesson.',
        '',
        'A term already defined is refused rather than replaced. A definition',
        'the subject has moved under is a revision of the entry it has.',
        '',
        'Examples:',
        '  canon teach glossary regular-expressions --term "capture group=A parenthesised part of a pattern whose match is kept" --first-seen 0002-groups.html',
        '',
      ].join('\n'),
    )
    .action(async (topic: string, opts: GlossaryCommandOptions) => {
      process.exitCode = await runGlossary(topic, opts)
    })

  teach
    .command('lesson')
    .description('Resolve what the next lesson needs before it is written')
    .argument('<topic>', 'Workspace folder or topic, as in regular-expressions')
    .helpOption('-h, --help', 'Show this help message')
    .option('--slug <kebab>', "The lesson's own topic, as in capture-groups")
    .option('--questions <n>', 'How many questions the quiz carries')
    .option('--options <n>', 'How many options each question carries', '4')
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Teach root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  the lesson was planned',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'It writes nothing. It reports the numbered path the lesson takes, the',
        'shared stylesheet with whether that file exists yet, the mission',
        'success lines to report progress against, and one option order per',
        'question.',
        '',
        'Write the correct option first and present the options in the order',
        'reported. Position is drawn here rather than chosen, so an answer',
        'cannot settle into the first slot.',
        '',
        'Examples:',
        '  canon teach lesson regular-expressions --slug capture-groups --questions 3 --json',
        '',
      ].join('\n'),
    )
    .action(async (topic: string, opts: LessonCommandOptions) => {
      process.exitCode = await runLesson(topic, opts)
    })

  teach
    .command('stylesheet')
    .description('Seed a workspace stylesheet from the design source')
    .argument('<topic>', 'Workspace folder or topic, as in regular-expressions')
    .helpOption('-h, --help', 'Show this help message')
    .option('--force', 'Rewrite a stylesheet the workspace already carries')
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Teach root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  the workspace carries a stylesheet, written now or already there',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'The file it writes carries the design tokens as custom properties and',
        'the component rules built on them, so a workspace renders in the same',
        'system every other surface does. Add lesson rules under the seed and',
        'read a value through its property rather than restating the hex.',
        '',
        'An existing stylesheet is left alone, since a workspace adds to this',
        'file as it goes. Pass --force to take the seed back over it.',
        '',
        'Examples:',
        '  canon teach stylesheet regular-expressions --json',
        '',
      ].join('\n'),
    )
    .action(async (topic: string, opts: StylesheetCommandOptions) => {
      process.exitCode = await runStylesheet(topic, opts)
    })

  teach
    .command('nav')
    .description('Rewrite the teach root, contents pages, and lesson chrome')
    .argument('[topic]', 'Workspace folder or topic, scoping the run to one')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Teach root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  the root, the contents page(s), and every found lesson chrome were written',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Rewrites the teach-root listing, the contents page of every workspace',
        "or of the one topic named, and each of its lessons' chrome: the",
        'embedded stylesheet, the header with its breadcrumb and jump menus,',
        'the prev/next footer nav, and the behavior scripts. The authored',
        '<h1>, lede, body, and quiz are left untouched.',
        '',
        'A lesson missing one of the four chrome markers is refused rather',
        "than rewritten, reported by name in the JSON record's skipped list",
        'and on stderr, while every other lesson still rewrites.',
        '',
        'Examples:',
        '  canon teach nav',
        '  canon teach nav regular-expressions --json',
        '',
      ].join('\n'),
    )
    .action(async (topic: string | undefined, opts: NavCommandOptions) => {
      process.exitCode = await runNav(topic, opts)
    })

  teach
    .command('render')
    .description('Render a lesson body block list to HTML')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Emit a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  the block list rendered',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Reads a JSON array of blocks from stdin, each a heading, paragraph,',
        'list, or raw block, and renders it through the same components the',
        'fixture lesson is generated from. Content the three cannot express',
        'takes type raw, carrying its own html verbatim, unescaped.',
        '',
        'Takes no topic and no --root: the verb is a stateless transform,',
        'reading nothing off a workspace on disk.',
        '',
        'Examples:',
        '  echo \'[{"type":"heading","level":1,"text":"Compass bearings"}]\' | canon teach render --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: RenderCommandOptions) => {
      process.exitCode = await runRender(opts)
    })
}

interface StylesheetCommandOptions {
  readonly force?: boolean
  readonly json?: boolean
  readonly root?: string
}

async function runStylesheet(
  topic: string,
  opts: StylesheetCommandOptions,
): Promise<number> {
  const emitJson = opts.json ?? false
  const root = await rootFor(opts.root)
  const outcome = await writeStylesheet(root, topic, opts.force ?? false)

  if (!outcome.ok) {
    return reportRefusal('canon teach stylesheet', outcome, emitJson, root)
  }

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        root,
        slug: outcome.slug,
        path: outcome.path,
        basePath: outcome.basePath,
        written: outcome.written,
      })}\n`,
    )
    return 0
  }

  intro('canon teach stylesheet')
  logStep(outcome.written ? 'Written' : 'Already present, left alone')
  logInfo(outcome.path)
  logInfo(outcome.basePath)
  outro()
  return 0
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value]
}

function readStdin(): Promise<string> {
  return new Promise((resolveStream, rejectStream) => {
    const chunks: Buffer[] = []
    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk))
    process.stdin.on('end', () =>
      resolveStream(Buffer.concat(chunks).toString('utf8')),
    )
    process.stdin.on('error', rejectStream)
  })
}

/**
 * Splits every pair or reports the ones that carry no separator. Both halves
 * are reported together, so a caller passing four pairs learns about all the
 * broken ones from one run rather than from four.
 */
function parsePairs(
  raw: readonly string[],
): { pairs: Array<[string, string]> } | { invalid: string[] } {
  const pairs: Array<[string, string]> = []
  const invalid: string[] = []

  for (const entry of raw) {
    const match = PAIR.exec(entry)
    const left = match?.[1].trim()
    const right = match?.[2].trim()

    if (!left || !right) {
      invalid.push(entry)
      continue
    }

    pairs.push([left, right])
  }

  return invalid.length > 0 ? { invalid } : { pairs }
}

function badInput(
  message: string,
  detail: readonly string[] = [],
): TeachRefused {
  return { ok: false, reason: 'bad-input', message, detail }
}

async function rootFor(given: string | undefined): Promise<string> {
  return given ?? (await mainWorktreeRoot())
}

async function runList(
  topic: string | undefined,
  opts: ListCommandOptions,
): Promise<number> {
  const emitJson = opts.json ?? false
  const root = await rootFor(opts.root)

  if (topic === undefined) {
    return reportList(await listWorkspaces(root), emitJson, root)
  }

  return reportWorkspace(await readWorkspace(root, topic), emitJson, root)
}

async function runOpen(
  topic: string,
  opts: OpenCommandOptions,
): Promise<number> {
  const emitJson = opts.json ?? false

  if (!opts.subject) {
    return reportRefusal(
      'canon teach open',
      badInput('No subject. Pass --subject <line>.'),
      emitJson,
      process.cwd(),
    )
  }

  if (!opts.startingPoint) {
    return reportRefusal(
      'canon teach open',
      badInput(
        'No starting point. Pass --starting-point <text>, so difficulty has a floor.',
      ),
      emitJson,
      process.cwd(),
    )
  }

  const root = await rootFor(opts.root)

  return reportOpen(
    await openWorkspace(root, {
      topic,
      subject: opts.subject,
      startingPoint: opts.startingPoint,
      success: opts.success ?? [],
      outOfScope: opts.outOfScope ?? [],
      title: opts.title,
      date: opts.date,
    }),
    emitJson,
    root,
  )
}

async function runResource(
  topic: string,
  opts: ResourceCommandOptions,
): Promise<number> {
  const emitJson = opts.json ?? false
  const raw = [...(opts.read ?? []), ...(opts.lead ?? [])]

  if (raw.length === 0) {
    return reportRefusal(
      'canon teach resource',
      badInput('No source given. Pass --read or --lead as <title>=<url>.'),
      emitJson,
      process.cwd(),
    )
  }

  const parsed = parsePairs(raw)

  if ('invalid' in parsed) {
    return reportRefusal(
      'canon teach resource',
      badInput(
        `Not a title and url: ${parsed.invalid.join(', ')}`,
        parsed.invalid,
      ),
      emitJson,
      process.cwd(),
    )
  }

  const readCount = (opts.read ?? []).length
  const sources: Source[] = parsed.pairs.map(([title, url]) => ({ title, url }))
  const root = await rootFor(opts.root)

  return reportResource(
    await recordSources(
      root,
      topic,
      sources.slice(0, readCount),
      sources.slice(readCount),
    ),
    emitJson,
    root,
  )
}

async function runGlossary(
  topic: string,
  opts: GlossaryCommandOptions,
): Promise<number> {
  const emitJson = opts.json ?? false
  const raw = opts.term ?? []

  if (raw.length === 0) {
    return reportRefusal(
      'canon teach glossary',
      badInput('No term given. Pass --term <term>=<definition>.'),
      emitJson,
      process.cwd(),
    )
  }

  const parsed = parsePairs(raw)

  if ('invalid' in parsed) {
    return reportRefusal(
      'canon teach glossary',
      badInput(
        `Not a term and definition: ${parsed.invalid.join(', ')}`,
        parsed.invalid,
      ),
      emitJson,
      process.cwd(),
    )
  }

  const terms: Term[] = parsed.pairs.map(([term, definition]) => ({
    term,
    definition,
  }))

  const duplicated = terms
    .map((term) => term.term.toLowerCase())
    .filter((term, index, all) => all.indexOf(term) !== index)

  if (duplicated.length > 0) {
    return reportRefusal(
      'canon teach glossary',
      badInput(`Two definitions for ${[...new Set(duplicated)].join(', ')}.`),
      emitJson,
      process.cwd(),
    )
  }

  const root = await rootFor(opts.root)

  return reportGlossary(
    await defineTerms(root, topic, terms, opts.firstSeen),
    emitJson,
    root,
  )
}

async function runLesson(
  topic: string,
  opts: LessonCommandOptions,
): Promise<number> {
  const emitJson = opts.json ?? false

  if (!opts.slug) {
    return reportRefusal(
      'canon teach lesson',
      badInput('No lesson slug. Pass --slug <kebab>.'),
      emitJson,
      process.cwd(),
    )
  }

  if (!opts.questions) {
    return reportRefusal(
      'canon teach lesson',
      badInput('No question count. Pass --questions <n>.'),
      emitJson,
      process.cwd(),
    )
  }

  const root = await rootFor(opts.root)

  return reportLesson(
    await planLesson(root, topic, {
      slug: opts.slug,
      questions: Number(opts.questions),
      options: Number(opts.options ?? '4'),
    }),
    emitJson,
    root,
  )
}

async function runNav(
  topic: string | undefined,
  opts: NavCommandOptions,
): Promise<number> {
  const emitJson = opts.json ?? false
  const root = await rootFor(opts.root)

  return reportNav(await generateNav(root, topic), emitJson, root)
}

async function runRender(opts: RenderCommandOptions): Promise<number> {
  const emitJson = opts.json ?? false

  if (process.stdin.isTTY) {
    return reportRenderRefusal(
      badInput(
        "No blocks on stdin. Pipe a JSON array: echo '[...]' | canon teach render",
      ),
      emitJson,
    )
  }

  const body = (await readStdin()).trim()

  if (!body) {
    return reportRenderRefusal(
      badInput('Empty stdin. Pipe a JSON array of blocks.'),
      emitJson,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return reportRenderRefusal(badInput('Malformed JSON on stdin.'), emitJson)
  }

  if (!Array.isArray(parsed)) {
    return reportRenderRefusal(
      badInput('Stdin must be a JSON array of blocks.'),
      emitJson,
    )
  }

  return reportRender(renderLessonBody(parsed), emitJson)
}

function reportRenderRefusal(refused: TeachRefused, emitJson: boolean): number {
  if (emitJson) {
    process.stderr.write(`${refused.message}\n`)
    process.stdout.write(
      `${JSON.stringify({
        ok: false,
        reason: refused.reason,
        message: refused.message,
      })}\n`,
    )
    return 1
  }

  intro('canon teach render')
  logStep('Refused')
  logError(refused.message)
  outro()
  return 1
}

function reportRender(outcome: RenderOutcome, emitJson: boolean): number {
  if (!outcome.ok) return reportRenderRefusal(outcome, emitJson)

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({ ok: true, html: outcome.html })}\n`,
    )
    return 0
  }

  process.stdout.write(`${outcome.html}\n`)
  return 0
}

function reportNav(
  outcome: NavOutcome,
  emitJson: boolean,
  root: string,
): number {
  if (!outcome.ok)
    return reportRefusal('canon teach nav', outcome, emitJson, root)

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        root: outcome.root,
        contents: outcome.contents,
        lessons: outcome.lessons,
        skipped: outcome.skipped,
      })}\n`,
    )
    return 0
  }

  intro('canon teach nav')
  logStep('Root')
  logInfo(outcome.root)
  logStep('Contents')
  for (const path of outcome.contents) logInfo(path)
  logStep('Lessons rewritten')
  logInfo(String(outcome.lessons))

  if (outcome.skipped.length > 0) {
    logStep('Refused, missing a chrome marker')
    for (const skip of outcome.skipped) {
      logWarn(`${skip.file}: no ${skip.missing}`)
    }
  }

  outro()
  return 0
}

function reportRefusal(
  title: string,
  refused: TeachRefused,
  emitJson: boolean,
  root: string,
): number {
  // The framed branch reaches stderr through logError, so the bare write is
  // what keeps the JSON mode from reporting the reason on stdout alone.
  if (emitJson) {
    process.stderr.write(`${refused.message}\n`)
    process.stdout.write(
      `${JSON.stringify({
        ok: false,
        root,
        reason: refused.reason,
        message: refused.message,
        detail: refused.detail,
      })}\n`,
    )
    return 1
  }

  intro(title)
  logStep('Refused')
  logError(refused.message)
  if (refused.detail.length > 0) pipeOutput(refused.detail.join('\n'))
  outro()

  return 1
}

/**
 * One scheduled revisit, carrying both ladder dates rather than the rung alone.
 * A session copies the date the outcome names instead of computing one from a
 * ladder stated in prose.
 */
function describeRevisit(item: RevisitItem): string {
  const when = item.overdue ? `due ${item.date}` : item.date

  return `${item.item}: ${when}, rung ${item.rung} (hit ${item.hit}, miss ${item.miss}), from ${item.record}`
}

function describe(workspace: WorkspaceSummary): string {
  return `${workspace.slug}: ${workspace.lessons} lesson(s), ${workspace.records} record(s), ${workspace.reference} reference page(s), ${workspace.terms} term(s)`
}

function reportList(
  outcome: ListOutcome,
  emitJson: boolean,
  root: string,
): number {
  if (!outcome.ok)
    return reportRefusal('canon teach list', outcome, emitJson, root)

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        root,
        workspaces: outcome.workspaces,
        next: outcome.next,
      })}\n`,
    )
    return 0
  }

  intro('canon teach list')
  logStep(outcome.workspaces.length > 0 ? 'Workspaces' : 'No workspaces')

  for (const workspace of outcome.workspaces) logInfo(describe(workspace))

  const incomplete = outcome.workspaces.filter(
    (workspace) => workspace.missing.length > 0,
  )

  if (incomplete.length > 0) {
    logStep('Missing a required file')
    for (const workspace of incomplete) {
      logWarn(`${workspace.slug}: no ${workspace.missing.join(' and no ')}`)
    }
  }

  logStep('Next ordinal')
  logInfo(outcome.next)
  outro()

  return 0
}

function reportWorkspace(
  outcome: ReadOutcome,
  emitJson: boolean,
  root: string,
): number {
  if (!outcome.ok)
    return reportRefusal('canon teach list', outcome, emitJson, root)

  const workspace = outcome.workspace

  if (emitJson) {
    process.stdout.write(`${JSON.stringify({ ok: true, root, workspace })}\n`)
    return 0
  }

  intro('canon teach list')
  logStep(workspace.slug)
  logInfo(`${workspace.title ?? 'no title'}, opened ${workspace.opened ?? '?'}`)
  logInfo(workspace.path)

  for (const [label, files] of [
    ['Lessons', workspace.lessonFiles],
    ['Learning records', workspace.recordFiles],
    ['Reference', workspace.referenceFiles],
  ] as const) {
    logStep(files.length > 0 ? label : `${label} (none)`)
    for (const file of files) logInfo(file)
  }

  logStep(workspace.glossary.length > 0 ? 'Glossary' : 'Glossary (empty)')
  for (const entry of workspace.glossary) logInfo(entry)

  logStep(
    workspace.success.length > 0 ? 'Exit criteria' : 'Exit criteria (none)',
  )
  for (const line of workspace.success) logInfo(line)

  logStep(workspace.due.length > 0 ? 'Revisit' : 'Revisit (nothing scheduled)')
  for (const item of workspace.due) logInfo(describeRevisit(item))

  if (workspace.missing.length > 0) {
    logStep('Missing a required file')
    logWarn(`no ${workspace.missing.join(' and no ')}`)
  }

  outro()

  return 0
}

function reportOpen(
  outcome: OpenOutcome,
  emitJson: boolean,
  root: string,
): number {
  if (!outcome.ok)
    return reportRefusal('canon teach open', outcome, emitJson, root)

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        root,
        slug: outcome.slug,
        path: outcome.path,
        created: outcome.created,
      })}\n`,
    )
    return 0
  }

  intro('canon teach open')
  logStep('Opened')
  logInfo(outcome.slug)
  for (const file of outcome.created) logAdd(file)
  outro()

  return 0
}

function reportResource(
  outcome: SourceOutcome,
  emitJson: boolean,
  root: string,
): number {
  if (!outcome.ok) {
    return reportRefusal('canon teach resource', outcome, emitJson, root)
  }

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        root,
        slug: outcome.slug,
        path: relative(root, outcome.path),
        read: outcome.read,
        leads: outcome.leads,
      })}\n`,
    )
    return 0
  }

  intro('canon teach resource')
  logStep('Recorded')
  for (const source of outcome.read) logInfo(`read: ${source.title}`)
  for (const source of outcome.leads) logInfo(`lead: ${source.title}`)
  logAdd(relative(root, outcome.path))
  outro()

  return 0
}

function reportGlossary(
  outcome: TermOutcome,
  emitJson: boolean,
  root: string,
): number {
  if (!outcome.ok) {
    return reportRefusal('canon teach glossary', outcome, emitJson, root)
  }

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        root,
        slug: outcome.slug,
        path: relative(root, outcome.path),
        defined: outcome.defined,
      })}\n`,
    )
    return 0
  }

  intro('canon teach glossary')
  logStep('Defined')
  for (const term of outcome.defined) logInfo(term.term)
  logAdd(relative(root, outcome.path))
  outro()

  return 0
}

function reportLesson(
  outcome: LessonOutcome,
  emitJson: boolean,
  root: string,
): number {
  if (!outcome.ok) {
    return reportRefusal('canon teach lesson', outcome, emitJson, root)
  }

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        root,
        slug: outcome.slug,
        path: outcome.path,
        lesson: outcome.lesson,
        stylesheet: outcome.stylesheet,
        stylesheetExists: outcome.stylesheetExists,
        success: outcome.success,
        quiz: outcome.quiz,
      })}\n`,
    )
    return 0
  }

  intro('canon teach lesson')
  logStep('Lesson')
  logInfo(outcome.lesson)

  logStep(outcome.stylesheetExists ? 'Stylesheet' : 'Stylesheet (to write)')
  logInfo(`${outcome.stylesheet} resolved for embedding`)

  logStep(outcome.success.length > 0 ? 'Exit criteria' : 'Exit criteria (none)')
  for (const line of outcome.success) logInfo(line)

  logStep('Option order')
  for (const question of outcome.quiz) {
    logInfo(
      `question ${question.question}: present ${question.order.join(', ')}, correct answer in position ${question.answer}`,
    )
  }

  outro()

  return 0
}
