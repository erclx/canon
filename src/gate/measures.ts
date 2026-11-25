import { existsSync, readFileSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import {
  CLIENT_COMMAND_MARKER,
  CLIENT_COMMANDS,
  type ClientCommand,
  clientCommandCitationsIn,
} from '@/gate/client-commands'
import { isOverWordCap, measureRequirements } from '@/context/requirements'
import {
  auditSkills,
  LEDGER_SKILLS,
  PRACTICE_LEDGER,
  SKILL_LEDGERS,
  PRACTICE_SKILLS,
  SHIPPED_CORPUS,
} from '@/claude/skills-audit'
import { familyKeys } from '@/claude/skills-families'
import { listSkills } from '@/claude/skills-list'
import { measureDesignProse } from '@/design/budget'
import { APP_CONFIG_REL, readAppTable } from '@/config/app'
import { CONFIG_DIR_REL, checkConfigFolder } from '@/config/check'
import { readDeviceConfig } from '@/design/device-classes'
import { DESIGN_DOCUMENT } from '@/design/regen'
import { listRepositoryFiles } from '@/git/files'
import { ceilingFindings, isChangelog } from '@/markdown/ceiling'
import { resolveMarkdown } from '@/markdown/files'
import { CHECKPOINTS } from '@/markdown/structure'
import {
  isShippedCorpus,
  REFERENCE_MARKER,
  referencesIn,
  SHIPPED_CORPORA,
  type ShippedReference,
} from '@/shipped/references'
import { surfaceDir } from '@/roots/surface'
import { seedRoots } from '@/tooling/seeds'
import { plural } from '@/cli/ui'
import {
  README_ONLY_MARKER,
  README_PARAPHRASE_MARKER,
  readmeCitationsIn,
  uncitedReadmeSections,
} from '@/web/readme-citations'

export interface CommandResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
  /**
   * The two streams interleaved, which is what `2>&1` handed the frame in the
   * script this replaces. A stage borrowing a command's own output pipes this
   * rather than either stream alone.
   */
  readonly all: string
  /**
   * Set when the binary could not start at all, which is distinct from one
   * that ran and refused: mid-setup locally, a broken step under CI.
   */
  readonly spawnError?: string
}

/**
 * Spawns one command. `env` adds variables to the child's environment, which a
 * locked stage uses to tell its child which lock the gate already holds.
 */
export type RunCommand = (
  argv: readonly string[],
  env?: Readonly<Record<string, string>>,
) => Promise<CommandResult>

export interface MeasureContext {
  readonly root: string
  /**
   * True where this run is the merge gate rather than a contributor's machine.
   * It decides nothing about what a stage measures and everything about what an
   * absent input means, which is why it reaches a measure at all.
   */
  readonly ci: boolean
  /** Any binary, run from the project root. */
  readonly run: RunCommand
  /**
   * This checkout's own CLI, since a global `canon` resolves to the main
   * checkout and would measure a tree other than the branch.
   */
  readonly cli: RunCommand
}

export type Emission =
  | { readonly kind: 'info'; readonly text: string }
  | { readonly kind: 'warn'; readonly text: string }
  /** Borrowed output, indented under the stage the way `pipe_output` did. */
  | { readonly kind: 'output'; readonly text: string }

export interface MeasureReport {
  readonly emissions: readonly Emission[]
  /** The stage read its input and found a fact, so the run stops here. */
  readonly failure?: string
  /**
   * The stage could not read its input, so it has no verdict. The sequencer
   * warns on it locally and refuses under CI, never rendering it as a pass.
   */
  readonly unmeasured?: string
}

export type Measure = (ctx: MeasureContext) => Promise<MeasureReport>

const info = (text: string): Emission => ({ kind: 'info', text })
const warn = (text: string): Emission => ({ kind: 'warn', text })
const output = (text: string): Emission => ({ kind: 'output', text })

/**
 * Scenarios declaring no expectation, taken from `canon sandbox coverage`
 * against a clean tree. Raising it is a deliberate edit that says which
 * scenario shipped unarmed and why.
 */
export const SANDBOX_UNDECLARED_CEILING = 47

/**
 * Skills `canon sandbox coverage --skills` reports `asserted`. A dropped
 * pairing lowers it where the scenario ceiling stays green, so lowering this
 * floor is a deliberate edit naming the skill that lost its arm.
 */
export const SANDBOX_ASSERTED_FLOOR = 26

/**
 * Where the audit baseline is read relative to `root`, at either surface root,
 * since a constant naming one would be believed of a project that moved.
 */
export function auditsBaselineRel(root: string): string {
  return relative(root, surfaceDir(root, 'canon', 'baseline.json'))
}

function parseJson(payload: string): unknown {
  try {
    return JSON.parse(payload)
  } catch {
    return undefined
  }
}

/**
 * A rule no stack reaches needs a `governance/detect.toml` entry, and a key
 * naming a retired rule fails too. The catalog is parsed here, since
 * `bun --eval` exits 0 on a throw while stdin is a pipe.
 */
export const unreferencedRules: Measure = async (ctx) => {
  const { exitCode, stdout } = await ctx.cli(['gov', 'list', '--json'])
  if (exitCode !== 0 || stdout.trim() === '') {
    return {
      emissions: [],
      unmeasured: 'The governance catalog did not report.',
    }
  }

  const record = parseJson(stdout) as
    | { unreferenced?: unknown; rules?: unknown; staleDetect?: unknown }
    | undefined
  if (
    !Array.isArray(record?.unreferenced) ||
    !Array.isArray(record?.rules) ||
    !Array.isArray(record?.staleDetect)
  ) {
    return {
      emissions: [],
      unmeasured:
        'The governance catalog carried no readable unreferenced, rules, or staleDetect list.',
    }
  }

  const detected = new Set(
    record.rules
      .filter(
        (rule): rule is { name: string; detect: unknown } =>
          typeof rule === 'object' &&
          rule !== null &&
          typeof (rule as { name?: unknown }).name === 'string',
      )
      .filter((rule) => rule.detect !== null && rule.detect !== undefined)
      .map((rule) => rule.name),
  )
  const unreferenced = record.unreferenced.map(String)
  const undetected = unreferenced.filter((rule) => !detected.has(rule))
  const stale = record.staleDetect.map(String)

  const emissions: Emission[] = []
  if (undetected.length > 0) {
    emissions.push(
      warn(
        `Reached by no stack and proposed by nothing: ${undetected.join(' ')}`,
      ),
      warn(
        'Name each in a stack, or add a table to governance/detect.toml with the deps or files that mark a project as wanting it.',
      ),
    )
  }
  if (stale.length > 0) {
    emissions.push(
      warn(`governance/detect.toml names no live rule: ${stale.join(' ')}`),
      warn('Rename the key to the rule it became, or delete the table.'),
    )
  }

  if (emissions.length > 0) {
    return {
      emissions,
      failure: 'An opt-in rule has no route to a project',
    }
  }

  return {
    emissions: [
      info(
        unreferenced.length === 0
          ? 'Every rule is reached by a stack'
          : `${plural(unreferenced.length, 'rule')} reached by no stack, each proposed by governance/detect.toml`,
      ),
    ],
  }
}

/**
 * The files the sweep would rewrite, from the record's `paths`. Each field is
 * tested, so a shape that moved upstream drops entries and keeps the count.
 */
function citedPaths(record: { paths?: unknown } | undefined): string[] {
  if (!Array.isArray(record?.paths)) return []

  return record.paths.flatMap((entry) => {
    const cited = entry as { path?: unknown; rewritten?: unknown }
    if (typeof cited.path !== 'string') return []
    return typeof cited.rewritten === 'number'
      ? [`${cited.path} (${cited.rewritten})`]
      : [cited.path]
  })
}

/**
 * The requirements record against the word cap it states, read in-process
 * since `context audit` there never opens it. No record or no cap passes.
 */
export const canonicalRecords: Measure = async (ctx) => {
  const requirements = await measureRequirements(ctx.root)

  const failures: string[] = []
  const emissions: Emission[] = []

  if (requirements === undefined) {
    emissions.push(info('No requirements record to measure'))
  } else if (isOverWordCap(requirements)) {
    failures.push(
      `${requirements.words} words against a cap of ${requirements.wordCap} in ${requirements.rel}.`,
    )
  } else {
    const cap =
      requirements.wordCap === undefined
        ? 'no word cap stated'
        : `a cap of ${requirements.wordCap}`
    emissions.push(
      info(`${requirements.words} requirements words against ${cap}`),
    )
  }

  if (failures.length > 0) return { emissions: [], failure: failures.join(' ') }
  return { emissions }
}

/**
 * The design records this repository holds, each read against the prose
 * budget in `@/design/budget`. The worked example under `examples/` is read by
 * the record-examples stage alone, so a budget breach there reports once.
 */
const DESIGN_RECORDS = [DESIGN_DOCUMENT] as const

export const designProse: Measure = async (ctx) => {
  const failures: string[] = []
  const emissions: Emission[] = []

  for (const rel of DESIGN_RECORDS) {
    const path = join(ctx.root, rel)
    if (!existsSync(path)) continue
    let source: string
    try {
      source = readFileSync(path, 'utf8')
    } catch {
      return {
        emissions: [],
        unmeasured: `${rel} could not be read, so its prose was not counted.`,
      }
    }
    const findings = measureDesignProse(source)
    if (findings.length > 0) {
      failures.push(
        `${findings.map((finding) => `${finding} in ${rel}`).join('. ')}.`,
      )
    } else {
      emissions.push(info(`${rel} within the prose budget`))
    }
  }

  if (failures.length > 0) {
    return {
      emissions: [],
      failure: `${failures.join(' ')} Cut to the budget in claude/skills/design-record/references/design.md, moving the why to the context entry.`,
    }
  }
  if (emissions.length === 0)
    emissions.push(info('No design record to measure'))
  return { emissions }
}

/**
 * Every file under `canon/config/` against the keys canon reads, so a misspelled key fails here rather than reading
 * as absent. A file no reader reads warns, since deleting it changes nothing.
 */
export const configFiles: Measure = async (ctx) => {
  const findings = checkConfigFolder(ctx.root)
  const failures = findings.filter((finding) => finding.severity === 'fail')
  const warnings = findings
    .filter((finding) => finding.severity === 'warn')
    .map((finding) => warn(finding.message))

  if (failures.length > 0) {
    const pages = [
      ...new Set(
        failures.map((finding) =>
          basename(finding.file) === 'app.toml'
            ? 'canon docs app-config'
            : 'canon docs config',
        ),
      ),
    ]
    return {
      emissions: warnings,
      failure: `${failures.map((finding) => finding.message).join(' ')} Every key: ${pages.join(', ')}`,
    }
  }
  return {
    emissions: [
      ...warnings,
      info(
        existsSync(join(ctx.root, CONFIG_DIR_REL))
          ? `Every key in ${CONFIG_DIR_REL} is one canon reads`
          : `No ${CONFIG_DIR_REL}, so every setting is its default`,
      ),
    ],
  }
}

const PROSE_DEVICE_LINE = /^\s*(?:[-*+]\s+)?Device classes:/im

/**
 * The device class config every width reader shares, so a bad class name fails here rather than at capture time.
 * A `Device classes:` line left in the record fails too, since nothing reads it and the classes silently widen.
 */
export const deviceClasses: Measure = async (ctx) => {
  const failures: string[] = []
  const read = readDeviceConfig(ctx.root)
  if (!read.ok) failures.push(read.message)

  const record = join(ctx.root, DESIGN_DOCUMENT)
  if (
    existsSync(record) &&
    PROSE_DEVICE_LINE.test(readFileSync(record, 'utf8'))
  ) {
    failures.push(
      `${DESIGN_DOCUMENT} still carries a Device classes: line, which no reader reads. Move its classes to default under [device-classes] in ${APP_CONFIG_REL}, with a why, and delete the line.`,
    )
  }

  if (failures.length > 0) {
    return { emissions: [], failure: failures.join(' ') }
  }
  const table = readAppTable(ctx.root, 'device-classes')
  return {
    emissions: [
      info(
        table.kind === 'table'
          ? `[device-classes] in ${table.source} reads clean`
          : `No [device-classes] in ${APP_CONFIG_REL}, so every device class is supported`,
      ),
    ],
  }
}

/**
 * Every skill body and reference against the no-dated-provenance rule. The
 * verb only reports a date, so this holds the corpus at zero in-process.
 */
export const skillProvenance: Measure = async (ctx) => {
  const report = await auditSkills(ctx.root)
  if (report.corpora.length === 0) {
    return {
      emissions: [],
      unmeasured: 'no skill corpus resolved, so no body was read.',
    }
  }

  const found = report.datedProvenance
  if (found.length > 0) {
    const where = found
      .map((finding) => `${finding.rel} ${finding.detail}`)
      .join(', ')
    return {
      emissions: [],
      failure: `${plural(found.length, 'date')} in skill prose: ${where}. Move the incident to REQUIREMENT.md under Gap or leave it to git, or fence the date or put it in a code span when it is an example.`,
    }
  }

  return {
    emissions: [
      info(`No dated provenance across ${plural(report.skills, 'skill')}`),
    ],
  }
}

/**
 * Listed practice skills against the closing sections and a ledger citing a
 * source. A tree without `claude/skills/` reports unmeasured, not a pass.
 */
export const skillPracticeShape: Measure = async (ctx) => {
  const report = await auditSkills(ctx.root)
  if (!report.corpora.some((corpus) => corpus.rel === SHIPPED_CORPUS)) {
    return {
      emissions: [],
      unmeasured: `no skill corpus at ${SHIPPED_CORPUS} resolved, so no practice skill was read.`,
    }
  }

  const found = report.practiceShape
  if (found.length > 0) {
    const where = found
      .map((finding) => `${finding.rel} ${finding.detail}`)
      .join(', ')
    return {
      emissions: [],
      failure: `${plural(found.length, 'practice shape finding')}: ${where}. Add the closing H2 exactly as named to a practice skill, or the ledger at ${PRACTICE_LEDGER} to any skill on the ledger list, citing one linked source or one House choice row. A reference of a skill on the per-bullet list, unless exempted, takes one ledger row per bullet under the same H2 at ${SKILL_LEDGERS}.`,
    }
  }

  return {
    emissions: [
      info(
        `${plural(PRACTICE_SKILLS.length, 'practice skill')} carry every closing section, and ${plural(LEDGER_SKILLS.length, 'listed skill')} carry a ledger citing a source`,
      ),
    ],
  }
}

/**
 * Every shipped skill against the family vocabulary the landing page groups
 * by. A tree without `claude/skills/` reports unmeasured, not a pass.
 */
export const skillFamily: Measure = async (ctx) => {
  const report = await auditSkills(ctx.root)
  const shipped = report.corpora.find((corpus) => corpus.rel === SHIPPED_CORPUS)
  if (shipped === undefined) {
    return {
      emissions: [],
      unmeasured: `no skill corpus at ${SHIPPED_CORPUS} resolved, so no family was read.`,
    }
  }

  const found = report.family
  if (found.length > 0) {
    const where = found
      .map((finding) => `${finding.rel} ${finding.detail}`)
      .join(', ')
    return {
      emissions: [],
      failure: `${plural(found.length, 'skill family finding')}: ${where}. Add metadata.family to the frontmatter, one of ${familyKeys().join(', ')}, matching the skill map group its row sits under.`,
    }
  }

  return {
    emissions: [
      info(`${plural(shipped.skills, 'shipped skill')} declare a known family`),
    ],
  }
}

/**
 * Sized from the corpus total once the 400-character target applied, since
 * `skillOverrides` cannot mark a plugin skill name-only. Raising it is a
 * deliberate edit naming which skill grew the listing.
 */
export const SKILL_DESCRIPTION_CEILING = 31_000

/**
 * The plugin's description characters against one ceiling, since past the
 * listing budget Claude Code drops the least-invoked skills' descriptions and
 * a skill with none has nothing to trigger on.
 */
export const skillDescriptionTotal: Measure = async (ctx) => {
  const skills = listSkills(ctx.root)
  if (skills.length === 0) {
    return {
      emissions: [],
      unmeasured: `no skill corpus at ${SHIPPED_CORPUS} resolved, so no description was read.`,
    }
  }

  const total = skills.reduce((sum, skill) => sum + skill.description.length, 0)
  const measured = `${total} description characters across ${plural(skills.length, 'shipped skill')}`
  if (total > SKILL_DESCRIPTION_CEILING) {
    const longest = [...skills]
      .sort((a, b) => b.description.length - a.description.length)
      .slice(0, 3)
      .map((skill) => `${skill.name} (${skill.description.length})`)
      .join(', ')
    return {
      emissions: [],
      failure: `${measured}, over the ceiling of ${SKILL_DESCRIPTION_CEILING}. The longest are ${longest}. Shorten toward the 400-character target in claude/skills/create-skill/references/skill-frontmatter.md, or raise SKILL_DESCRIPTION_CEILING in src/gate/measures.ts and say which skill grew it.`,
    }
  }

  return {
    emissions: [
      info(`${measured}, under the ceiling of ${SKILL_DESCRIPTION_CEILING}`),
    ],
  }
}

/**
 * Every tracked document against its whole-document ceiling, naming each one
 * past it with the cap it broke. In-process, since a gating length in `canon markdown audit` would
 * fail every long plan the planning skills audit.
 */
export const documentCeiling: Measure = async (ctx) => {
  const scope = await resolveMarkdown(ctx.root, [])
  if (scope.kind === 'unavailable') {
    return {
      emissions: [],
      unmeasured: 'git could not list the tree, so no document was measured.',
    }
  }

  const documents = scope.files.flatMap((rel) => {
    try {
      return [{ rel, source: readFileSync(join(ctx.root, rel), 'utf8') }]
    } catch {
      return []
    }
  })
  const findings = ceilingFindings(documents)
  const over = findings.filter((finding) => finding.exempt === null)
  const exempt = findings.length - over.length
  const caps = `the ${CHECKPOINTS.ceiling}-line ceiling or the ${CHECKPOINTS.docsCeiling}-line docs/ cap`

  if (over.length === 0) {
    const exemptNote = exempt > 0 ? `, ${exempt} exempt` : ''
    return {
      emissions: [
        info(
          `No document past ${caps} across ${plural(documents.length, 'markdown file')}${exemptNote}`,
        ),
      ],
    }
  }

  const where = over
    .map(
      (finding) =>
        `${finding.rel} ${finding.renderedLines} rendered lines past ${finding.ceiling}`,
    )
    .join(', ')
  return {
    emissions: [],
    failure: `${plural(over.length, 'document')} past ${caps}: ${where}. Split each at a seam, or for a verbatim record add a \`<!-- canon-length-exempt: <reason> -->\` line naming why.`,
  }
}

function isPluginHooksManifest(path: string): boolean {
  return (
    path === 'claude/hooks/hooks.json' ||
    /^plugins\/[^/]+\/hooks\/hooks\.json$/.test(path)
  )
}

/**
 * Whether a path's stem repeats its parent folder, whole or as a `<folder>-`
 * prefix. Exempt are the context model, replay snapshots, Frameboard's design
 * assets, and a plugin's `hooks/hooks.json`.
 */
export function isFolderEchoedName(path: string): boolean {
  if (path === 'canon/context/context-model.md') return false
  if (isPluginHooksManifest(path)) return false
  if (path.startsWith('sandbox/fixtures/replay/')) return false
  if (path.startsWith('canon/design/assets/')) return false
  const segments = path.split('/')
  if (segments.length < 2) return false
  const folder = segments[segments.length - 2] ?? ''
  const stem = (segments[segments.length - 1] ?? '').split('.')[0] ?? ''
  if (folder === '' || stem === '') return false
  return stem === folder || stem.startsWith(`${folder}-`)
}

/**
 * Every tracked file whose name repeats its folder. It stays out of
 * `canon markdown audit`, since a target may choose that convention.
 */
export const folderEchoedNames: Measure = async (ctx) => {
  const files = await listRepositoryFiles(ctx.root)
  if (files === undefined) {
    return {
      emissions: [],
      unmeasured:
        'The tracked file list could not be read, so no filename was checked.',
    }
  }

  const echoed = files.filter(isFolderEchoedName)
  if (echoed.length === 0) {
    return {
      emissions: [
        info(
          `No filename repeats its folder across ${plural(files.length, 'tracked file')}`,
        ),
      ],
    }
  }

  return {
    emissions: echoed.map((path) => warn(`${path} repeats its folder's name`)),
    failure: `${echoed.length === 1 ? 'One tracked file repeats its' : `${echoed.length} tracked files repeat their`} folder's name: ${echoed.join(', ')}. Rename each for what it covers inside the folder, dropping the prefix the folder already states.`,
  }
}

/**
 * A second run of the records move should rewrite nothing once `moves` is
 * empty. Exit `0` and `2` carry a record, and any other exit is unmeasured.
 */
export const recordIdempotence: Measure = async (ctx) => {
  const run = await ctx.cli(['migrate', 'records', '--json'])

  if (run.exitCode !== 0 && run.exitCode !== 2) {
    return {
      emissions: [],
      unmeasured: `The records sweep refused (exit ${run.exitCode}) and planned nothing.`,
    }
  }

  const record = parseJson(run.stdout) as
    | {
        moves?: unknown
        rewritten?: unknown
        dropped?: unknown
        paths?: unknown
      }
    | undefined
  const moves = record?.moves
  const rewritten = record?.rewritten
  const dropped = typeof record?.dropped === 'number' ? record.dropped : 0

  if (!Array.isArray(moves) || typeof rewritten !== 'number') {
    return {
      emissions: [],
      unmeasured:
        'The records sweep carried no plan, so the stage read no count. Run bun src/cli.ts migrate records --json.',
    }
  }

  if (moves.length > 0) {
    return {
      emissions: [
        info(
          `${moves.length} record folder(s) still at the old root, with ${rewritten} citation(s) that move with them`,
        ),
      ],
    }
  }

  if (rewritten + dropped > 0) {
    return {
      // A malformed `paths` costs the list, never the counted finding.
      emissions: citedPaths(record).map((path) => warn(path)),
      failure: `The records are at .canon/ and ${rewritten + dropped} citation(s) still name the old root, so a second run of canon migrate records would rewrite or drop them. Repoint each one, or mark it canon-keep-record-root where the sentence has to keep the old spelling.`,
    }
  }

  return {
    emissions: [
      info('Records at .canon/, and a re-run of the move rewrites nothing'),
    ],
  }
}

/**
 * A ban, a dead link, and a gated density finding each fail the push, over the
 * whole corpus but every changelog, since a new ban reaches unedited files.
 */
export const markdownBans: Measure = async (ctx) => {
  const scope = await resolveMarkdown(ctx.root, [])
  if (scope.kind === 'unavailable') {
    return {
      emissions: [],
      unmeasured: 'git could not list the tree, so no markdown was audited.',
    }
  }

  // The release tool writes the changelog and would not keep a ban fixed.
  const files = scope.files.filter((rel) => !isChangelog(rel))
  if (files.length === 0) {
    return {
      emissions: [info('No markdown file to audit outside the changelog')],
    }
  }

  const { exitCode } = await ctx.cli(['markdown', 'audit', '--json', ...files])

  if (exitCode === 0) {
    return {
      emissions: [
        info('No banned character, dead link, or gated density finding'),
      ],
    }
  }

  if (exitCode === 1) {
    return {
      emissions: [],
      unmeasured: 'The markdown audit refused and measured nothing.',
    }
  }

  if (exitCode === 3) {
    return {
      emissions: [],
      failure:
        'The markdown audit shipped an empty ban set, so the corpus was walked and nothing was looked for. Check src/markdown/bans.ts.',
    }
  }

  if (exitCode === 2) {
    const frame = await ctx.cli(['markdown', 'audit', ...files])
    return {
      emissions: [output(frame.all)],
      failure:
        'Markdown prose carries a banned character, a relative link resolves to nothing on disk, or a gated path breaks a density limit. Rewrite the sentence, since a colon or a comma standing where the em dash was is the same sentence, fix the link, or split the block the Density section names, and reach for a code span only where the token is genuinely an identifier under discussion.',
    }
  }

  return {
    emissions: [],
    failure: `The markdown audit exited ${exitCode}, which is neither a pass nor a finding.`,
  }
}

/**
 * The seed tree against the standard it seeds, under `--gate`, since a broken
 * seed propagates into every scaffolded project. Roots come from `seedRoots`.
 */
export const seedStandards: Measure = async (ctx) => {
  const roots = seedRoots(ctx.root)
  if (roots.length === 0) {
    return {
      emissions: [],
      unmeasured:
        'No seed root carries .claude/ or canon/, so nothing was measured.',
    }
  }

  const emissions: Emission[] = []
  let measured = 0

  for (const seedRoot of roots) {
    const run = await ctx.cli([
      'context',
      'audit',
      seedRoot,
      '--gate',
      '--json',
    ])

    // Exit 1 is the audit refusing, as a root with no audited folder does.
    if (run.exitCode === 1) {
      emissions.push(
        warn(
          `${seedRoot}: no audited folder under either root, nothing measured`,
        ),
      )
      continue
    }

    if (run.exitCode !== 0) {
      const frame = await ctx.cli(['context', 'audit', seedRoot, '--gate'])
      emissions.push(output(frame.all))
      return {
        emissions,
        failure:
          run.exitCode === 2
            ? `A seed breaks the standard governing the folder it seeds: ${seedRoot}`
            : `The seed audit exited ${run.exitCode} against ${seedRoot}, which is neither a pass nor a finding.`,
      }
    }

    const entries = seedEntryCount(run.stdout)
    measured += entries
    emissions.push(
      entries === 0
        ? warn(
            `${seedRoot}: no entry under an audited folder, nothing measured`,
          )
        : info(`${seedRoot}: ${entries} entries measured`),
    )
  }

  if (measured === 0) {
    return {
      emissions,
      unmeasured: 'No seed entry was measured, so the stage covered nothing.',
    }
  }

  return { emissions }
}

/**
 * Entries the audit measured across the folders it resolved, so a root that
 * measured nothing is stated rather than read as a pass.
 */
export function seedEntryCount(payload: string): number {
  const record = parseJson(payload) as
    | { folders?: { entries?: unknown }[] }
    | undefined
  const folders = Array.isArray(record?.folders) ? record.folders : []
  return folders.reduce(
    (total, folder) =>
      total + (typeof folder.entries === 'number' ? folder.entries : 0),
    0,
  )
}

/**
 * Every file in the gated corpus, walked whole so a reference moved between
 * files is read. `dot` reaches the seeded `.claude/`, `.github/`, and `.husky/`.
 */
function shippedCorpusFiles(root: string): string[] {
  const files: string[] = []

  for (const corpus of SHIPPED_CORPORA) {
    const dir = join(root, corpus)
    if (!existsSync(dir)) continue

    for (const relative of new Bun.Glob('**/*').scanSync({
      cwd: dir,
      onlyFiles: true,
      dot: true,
    })) {
      const path = `${corpus}/${relative}`
      if (isShippedCorpus(path)) files.push(path)
    }
  }

  return files.sort()
}

/** The clause `shippedReferences` appends after naming a reference's text. */
function describeShippedReference(reference: ShippedReference): string {
  if (reference.selfCitation) {
    return "a citation of this repository's own history that resolves for no reader outside it, qualified or not"
  }

  switch (reference.kind) {
    case 'commit':
      return 'a commit sha that resolves nowhere for a reader in a target'
    case 'pull-request':
      return 'a pull request number that resolves elsewhere for a reader in a target'
    case 'docs-path':
      return 'a path into this repository that a registry install never carries'
    case 'retired-verb':
      return 'a call to canon standards, a verb no installed CLI carries'
    case 'phase-label':
      return 'a phase label that names a board no target holds'
    case 'rule-path':
      return 'a numbered rule path that reaches a target only through a separate canon gov sync, and only where governance was installed at all'
    case 'source-path':
      return "a path into this toolkit's stack source tree, which install flattens into the target's root and no target holds"
  }
}

/**
 * A citation a reader in a target cannot resolve, over the corpora that reach
 * one. It matches prose rather than resolving, so a reachable citation written
 * bare fails, and it emits the whole set before the stage halts.
 */
export const shippedReferences: Measure = async (ctx) => {
  const files = shippedCorpusFiles(ctx.root)

  if (files.length === 0) {
    return {
      emissions: [],
      unmeasured: `No corpus under ${SHIPPED_CORPORA.join(', ')} is present, so no shipped file was read.`,
    }
  }

  const found = files.flatMap((file) =>
    referencesIn(file, readFileSync(join(ctx.root, file), 'utf8'), ctx.root),
  )

  if (found.length === 0) {
    return {
      emissions: [
        info(
          `No unresolvable reference across ${files.length} files in ${SHIPPED_CORPORA.length} shipped corpora`,
        ),
      ],
    }
  }

  return {
    emissions: found.map((reference) =>
      warn(
        `${reference.file}:${reference.line} carries ${reference.text}, ${describeShippedReference(reference)}`,
      ),
    ),
    failure:
      found.length === 1
        ? `One reference in the shipped corpora resolves wrong for a reader in a target. Qualify a cross-repository citation as owner/repo#123 or owner/repo@abc1234, cite a docs page through canon docs <name>, cite the owner skill's reference in place of a canon standards call, state a same-repository citation or a phase label as a fact instead and relocate the evidence to the owning canon/context/ entry, state the fact a shipped skill body's cited rule enforces instead of its path, name the file install writes in place of a stack's source path, or mark the line ${REFERENCE_MARKER}: <reason> where the bare form is the point.`
        : `${found.length} references in the shipped corpora resolve wrong for a reader in a target. Qualify a cross-repository citation as owner/repo#123 or owner/repo@abc1234, cite a docs page through canon docs <name>, cite the owner skill's reference in place of a canon standards call, state a same-repository citation or a phase label as a fact instead and relocate the evidence to the owning canon/context/ entry, state the fact a shipped skill body's cited rule enforces instead of its path, name the file install writes in place of a stack's source path, or mark each line ${REFERENCE_MARKER}: <reason> where the bare form is the point.`,
  }
}

const RAW_FIELD_FILE_REFERENCE = /(?:^|\s)(?:-f|--raw-field)[ =]\S+=@/

/**
 * A `gh api` raw-string flag carrying a file reference, since `-f body=@<path>`
 * sends the path itself as the value. Prose quoting it fails too, so reword it.
 */
export const rawFieldFileReference: Measure = async (ctx) => {
  const files = shippedCorpusFiles(ctx.root)

  if (files.length === 0) {
    return {
      emissions: [],
      unmeasured: `No corpus under ${SHIPPED_CORPORA.join(', ')} is present, so no shipped file was read.`,
    }
  }

  const found = files.flatMap((file) =>
    readFileSync(join(ctx.root, file), 'utf8')
      .split('\n')
      .flatMap((text, index) =>
        RAW_FIELD_FILE_REFERENCE.test(text) ? [`${file}:${index + 1}`] : [],
      ),
  )

  if (found.length === 0) {
    return {
      emissions: [
        info(
          `No raw-field file reference across ${files.length} files in ${SHIPPED_CORPORA.length} shipped corpora`,
        ),
      ],
    }
  }

  return {
    emissions: found.map((location) =>
      warn(
        `${location} passes a file reference through a raw-string flag, which posts the path as the field value. Use -F instead`,
      ),
    ),
    failure:
      found.length === 1
        ? 'One raw-field file reference in the shipped corpora. Change -f or --raw-field to -F or --field where the value reads a file with @, or reword a prose line quoting the wrong spelling.'
        : `${found.length} raw-field file references in the shipped corpora. Change -f or --raw-field to -F or --field where the value reads a file with @, or reword a prose line quoting the wrong spelling.`,
  }
}

/**
 * Every tracked file quoting a listed client command with the wrong argument.
 * `commands` narrows only to cover the shipped table arriving empty.
 */
export const clientCommandCitations = async (
  ctx: MeasureContext,
  commands: readonly ClientCommand[] = CLIENT_COMMANDS,
): Promise<MeasureReport> => {
  if (commands.length === 0) {
    return {
      emissions: [],
      failure:
        'The client command table is empty, so the corpus was walked and nothing was looked for. Check src/gate/client-commands.ts.',
    }
  }

  const files = await listRepositoryFiles(ctx.root)
  if (files === undefined) {
    return {
      emissions: [],
      unmeasured:
        'The tracked file list could not be read, so no client command citation was checked.',
    }
  }

  const found = files.flatMap((file) => {
    let text: string
    try {
      text = readFileSync(join(ctx.root, file), 'utf8')
    } catch {
      return []
    }
    return clientCommandCitationsIn(file, text, commands)
  })

  if (found.length === 0) {
    return {
      emissions: [
        info(
          `No client command carries a wrong argument across ${files.length} tracked files`,
        ),
      ],
    }
  }

  return {
    emissions: found.map((citation) =>
      warn(
        `${citation.file}:${citation.line} carries ${citation.text}, which quotes \`${citation.command}\` with the wrong argument`,
      ),
    ),
    failure:
      found.length === 1
        ? `One tracked citation quotes a client command with the wrong argument. Match it against the canonical form in src/gate/client-commands.ts, or mark the line ${CLIENT_COMMAND_MARKER}: <reason> where the argument differs on purpose.`
        : `${found.length} tracked citations quote a client command with the wrong argument. Match each against the canonical form in src/gate/client-commands.ts, or mark the line ${CLIENT_COMMAND_MARKER}: <reason> where the argument differs on purpose.`,
  }
}

/**
 * Every `README.md:` anchor in `web/src/content/copy.ts` whose quoted phrase
 * left `README.md`, plus any bare line-number citation, read as a substring.
 */
export const readmeCitations: Measure = async (ctx) => {
  const copyPath = 'web/src/content/copy.ts'
  const readmePath = 'README.md'
  const copyFile = join(ctx.root, copyPath)
  const readmeFile = join(ctx.root, readmePath)

  if (!existsSync(copyFile) || !existsSync(readmeFile)) {
    return {
      emissions: [],
      unmeasured: `${copyPath} or ${readmePath} is absent, so no citation was checked.`,
    }
  }

  const readmeText = readFileSync(readmeFile, 'utf8')
  const citations = readmeCitationsIn(copyPath, readFileSync(copyFile, 'utf8'))

  if (citations.length === 0) {
    return {
      emissions: [],
      unmeasured: `${copyPath} carries no README.md citation, so nothing was checked.`,
    }
  }

  const bad = citations.filter(
    (citation) =>
      citation.kind === 'bare' ||
      (citation.kind === 'quoted' &&
        citation.phrases.some((phrase) => !readmeText.includes(phrase))),
  )

  if (bad.length === 0) {
    const uncited = uncitedReadmeSections(
      readmeText,
      citations.flatMap((citation) => citation.phrases),
    )

    if (uncited.length > 0) {
      return {
        emissions: uncited.map((section) =>
          warn(
            `${readmePath}:${section.line} opens ## ${section.heading}, which no quoted phrase in ${copyPath} cites`,
          ),
        ),
        failure: `README.md carries ${plural(uncited.length, 'section')} no landing phrase quotes. Quote one from each in ${copyPath}, or mark each README-only with <!-- ${README_ONLY_MARKER}: <reason> --> on the first line under its heading.`,
      }
    }

    return {
      emissions: [
        info(
          `${citations.length} README.md citation(s) in ${copyPath} verified against the current text`,
        ),
      ],
    }
  }

  return {
    emissions: bad.map((citation) =>
      warn(
        citation.kind === 'bare'
          ? `${citation.file}:${citation.line} carries ${citation.text}, a bare line number that cannot detect a shifted line`
          : `${citation.file}:${citation.line} carries ${citation.text}, whose quoted phrase no longer appears in README.md`,
      ),
    ),
    failure:
      bad.length === 1
        ? `One README.md citation in ${copyPath} failed. Quote a verbatim phrase from the current README.md, or mark the line ${README_PARAPHRASE_MARKER}: <reason> where the string condenses rather than quotes.`
        : `${bad.length} README.md citations in ${copyPath} failed. Quote a verbatim phrase from the current README.md, or mark each line ${README_PARAPHRASE_MARKER}: <reason> where the string condenses rather than quotes.`,
  }
}

/**
 * Globs `pr-visual-checks.yml` carries with no `deploy-site.yml` counterpart,
 * because the path changes no byte of the built site. The capture harness is
 * the one case: a change to it should report the visual jobs and never deploy.
 */
const VISUAL_ONLY_GLOBS: readonly string[] = ['tooling/web/configs/e2e/**']

/**
 * The landing-page path globs `deploy-site.yml` and `pr-visual-checks.yml`
 * each copy, read live and compared, since a YAML anchor cannot cross files.
 */
export const visualPathGlobs: Measure = async (ctx) => {
  const deployPath = '.github/workflows/deploy-site.yml'
  const visualPath = '.github/workflows/pr-visual-checks.yml'
  const deployFile = join(ctx.root, deployPath)
  const visualFile = join(ctx.root, visualPath)

  if (!existsSync(deployFile) || !existsSync(visualFile)) {
    return {
      emissions: [],
      unmeasured: `${deployPath} or ${visualPath} is absent, so no path list was compared.`,
    }
  }

  const deploy = Bun.YAML.parse(readFileSync(deployFile, 'utf8')) as {
    readonly on?: { readonly push?: { readonly paths?: readonly string[] } }
  }
  const visual = Bun.YAML.parse(readFileSync(visualFile, 'utf8')) as {
    readonly on?: {
      readonly pull_request?: { readonly paths?: readonly string[] }
    }
  }

  const deployPaths = deploy.on?.push?.paths ?? []
  const visualPaths = visual.on?.pull_request?.paths ?? []

  if (deployPaths.length === 0 || visualPaths.length === 0) {
    return {
      emissions: [],
      unmeasured: `${deployPath} or ${visualPath} carries no path list to compare.`,
    }
  }

  const onlyDeploy = deployPaths.filter(
    (path) => !visualPaths.includes(path) || VISUAL_ONLY_GLOBS.includes(path),
  )
  const onlyVisual = visualPaths.filter(
    (path) => !deployPaths.includes(path) && !VISUAL_ONLY_GLOBS.includes(path),
  )
  const declaredVisualOnly = visualPaths.filter((path) =>
    VISUAL_ONLY_GLOBS.includes(path),
  )

  if (onlyDeploy.length === 0 && onlyVisual.length === 0) {
    const visualOnlyNote =
      declaredVisualOnly.length > 0
        ? `, plus visual-only ${declaredVisualOnly.join(', ')}`
        : ''
    return {
      emissions: [
        info(
          `${deployPaths.length} path glob(s) agree between ${deployPath} and ${visualPath}${visualOnlyNote}`,
        ),
      ],
    }
  }

  return {
    emissions: [
      ...onlyDeploy.map((path) =>
        warn(
          VISUAL_ONLY_GLOBS.includes(path)
            ? `${deployPath} carries ${path}, which is visual-only and must not trigger a deploy`
            : `${deployPath} carries ${path}, absent from ${visualPath}`,
        ),
      ),
      ...onlyVisual.map((path) =>
        warn(`${visualPath} carries ${path}, absent from ${deployPath}`),
      ),
    ],
    failure: `${deployPath} and ${visualPath} carry different path globs. Bring the two lists back into agreement.`,
  }
}

/**
 * An absolute ceiling on undeclared scenarios, since a floor passes an unarmed
 * addition and a ratio moves on a legitimate deletion.
 */
export const sandboxCoverage: Measure = async (ctx) => {
  const run = await ctx.cli(['sandbox', 'coverage', '--json'])

  if (run.exitCode !== 0) {
    return {
      emissions: [],
      unmeasured: `The scenario tree did not report (exit ${run.exitCode}). It ships in the checkout, so a run that does not report is a broken command rather than an absent tree.`,
    }
  }

  const record = parseJson(run.stdout) as
    | { totalScenarios?: unknown; armedScenarios?: unknown }
    | undefined
  const total = record?.totalScenarios
  const armed = record?.armedScenarios

  if (typeof total !== 'number' || typeof armed !== 'number') {
    return {
      emissions: [],
      failure:
        'The coverage report carried no scenario totals, so the stage measured nothing. Run bun src/cli.ts sandbox coverage --json.',
    }
  }

  const undeclared = total - armed
  if (undeclared > SANDBOX_UNDECLARED_CEILING) {
    return {
      emissions: [],
      failure: `${undeclared} of ${total} scenarios declare no expectation, over the ceiling of ${SANDBOX_UNDECLARED_CEILING}. Declare expectations on the new scenario, or raise SANDBOX_UNDECLARED_CEILING in src/gate/measures.ts and say which scenario shipped unarmed.`,
    }
  }

  const scenarioEmission = info(
    `${armed} of ${total} scenarios declare expectations, ${undeclared} undeclared against a ceiling of ${SANDBOX_UNDECLARED_CEILING}`,
  )

  const skillsRun = await ctx.cli(['sandbox', 'coverage', '--skills', '--json'])

  if (skillsRun.exitCode !== 0) {
    return {
      emissions: [scenarioEmission],
      unmeasured: `The skill census did not report (exit ${skillsRun.exitCode}). It ships in the checkout beside the scenario report, so a run that does not report is a broken command rather than an absent census.`,
    }
  }

  const skillsRecord = parseJson(skillsRun.stdout) as
    | { asserted?: unknown; totalSkills?: unknown }
    | undefined
  const asserted = skillsRecord?.asserted
  const totalSkills = skillsRecord?.totalSkills

  if (typeof asserted !== 'number' || typeof totalSkills !== 'number') {
    return {
      emissions: [scenarioEmission],
      failure:
        'The skill census carried no asserted total, so the stage measured nothing. Run bun src/cli.ts sandbox coverage --skills --json.',
    }
  }

  if (asserted < SANDBOX_ASSERTED_FLOOR) {
    return {
      emissions: [scenarioEmission],
      failure: `${asserted} of ${totalSkills} skills asserted, under the floor of ${SANDBOX_ASSERTED_FLOOR}. A rename or a moved arm likely dropped a skill's pairing; repair the arm's filename against its skill and say which skill lost its arm, or lower SANDBOX_ASSERTED_FLOOR in src/gate/measures.ts.`,
    }
  }

  return {
    emissions: [
      scenarioEmission,
      info(
        `${asserted} of ${totalSkills} skills asserted, against a floor of ${SANDBOX_ASSERTED_FLOOR}`,
      ),
    ],
  }
}

/** The flat scalars `canon audits run --json` publishes for a caller to read. */
interface AuditSummary {
  readonly grown?: number
  readonly shrunk?: number
  readonly facts?: number
  readonly unmeasured?: number
  readonly absent?: number
  readonly unrecorded?: number
}

/**
 * Every tracked and per-machine audit but `deps`, reported and never failed,
 * since failing on judgment growth teaches routing around the stage.
 */
export const auditSet: Measure = async (ctx) => {
  const run = await ctx.cli([
    'audits',
    'run',
    '--corpus',
    'tracked',
    '--corpus',
    'per-machine',
    '--json',
  ])

  if (run.stdout.trim() === '') {
    return {
      emissions: [],
      unmeasured: `The audit set did not report (exit ${run.exitCode}).`,
    }
  }

  const record = parseJson(run.stdout) as { summary?: AuditSummary } | undefined
  const summary = record?.summary

  // An absent field is unreadable, never read as zero.
  if (
    typeof summary?.grown !== 'number' ||
    typeof summary.facts !== 'number' ||
    typeof summary.unmeasured !== 'number'
  ) {
    return {
      emissions: [],
      unmeasured:
        'The audit record carried no summary, so this stage measured nothing. Run bun src/cli.ts audits run.',
    }
  }

  const emissions: Emission[] = []

  // Per-machine folders are absent in CI, and the stage still says so.
  if (typeof summary.absent === 'number' && summary.absent > 0) {
    emissions.push(
      info(
        `${summary.absent} per-machine corpus/corpora absent, so unmeasured here by design`,
      ),
    )
  }
  if (summary.unmeasured > 0) {
    emissions.push(
      warn(
        `${summary.unmeasured} audit(s) did not report, so the set is incomplete. Run bun src/cli.ts audits run.`,
      ),
    )
  }
  if (summary.facts > 0) {
    emissions.push(
      warn(
        `${summary.facts} audit(s) carry a finding that is a fact. The stage above names the remedy.`,
      ),
    )
  }
  if (typeof summary.unrecorded === 'number' && summary.unrecorded > 0) {
    emissions.push(
      warn(
        `${summary.unrecorded} tracked audit(s) have no recorded floor. Take one with bun src/cli.ts audits run --record.`,
      ),
    )
  }
  const baselineRel = auditsBaselineRel(ctx.root)
  emissions.push(
    summary.grown > 0
      ? warn(
          `${summary.grown} measure(s) grew against ${baselineRel}. Run bun src/cli.ts audits run to see which, then fix them or re-record and say why.`,
        )
      : info(`No measure grew against ${baselineRel}`),
  )
  if (typeof summary.shrunk === 'number' && summary.shrunk > 0) {
    emissions.push(
      info(`${summary.shrunk} measure(s) fell against ${baselineRel}`),
    )
  }

  return { emissions }
}

/**
 * The only stage gating the plugin. An absent binary is mid-setup locally and
 * a broken step under CI, told apart by whether the spawn started at all.
 */
export const pluginManifests: Measure = async (ctx) => {
  const version = await ctx.run(['claude', '--version'])

  if (version.spawnError !== undefined) {
    return {
      emissions: [],
      unmeasured:
        'claude is not installed, so no manifest was read. CI installs it before this stage, so read the Install Plugin CLI step in .github/workflows/verify.yml.',
    }
  }

  if (version.exitCode !== 0) {
    return {
      emissions: [],
      unmeasured:
        'claude is on PATH and claude --version fails, so the install brought down no platform-native binary and no manifest was read. Raise or lower the pinned version at the Install Plugin CLI step in .github/workflows/verify.yml, then test the raised pin as `canon/context/development/ci.md` states.',
    }
  }

  const manifests = await collectPluginManifests(ctx)
  if (manifests.length === 0) {
    return {
      emissions: [],
      unmeasured:
        'No plugin or marketplace manifest is present, so none was validated.',
    }
  }

  for (const manifest of manifests) {
    const run = await ctx.run([
      'claude',
      'plugin',
      'validate',
      '--strict',
      manifest,
    ])
    if (run.exitCode !== 0) {
      return {
        emissions: [output(run.all)],
        failure: `Manifest validation failed: ${manifest}`,
      }
    }
  }

  return { emissions: [info('Manifests valid')] }
}

/**
 * Whatever plugin and marketplace manifests the repository currently carries,
 * so the stage picks up a new one without an edit here. Both listings honor
 * `.gitignore`, which keeps linked worktrees and dependency copies out.
 */
async function collectPluginManifests(ctx: MeasureContext): Promise<string[]> {
  const patterns = [
    '*.claude-plugin/plugin.json',
    '*.claude-plugin/marketplace.json',
  ]
  const tracked = await ctx.run(['git', 'ls-files', '--', ...patterns])
  const untracked = await ctx.run([
    'git',
    'ls-files',
    '--others',
    '--exclude-standard',
    '--',
    ...patterns,
  ])

  const seen = new Set(
    `${tracked.stdout}\n${untracked.stdout}`
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== ''),
  )
  return [...seen].sort()
}
