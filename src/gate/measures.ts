import { existsSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
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
import { measureDesignProse } from '@/design/budget'
import { DESIGN_DOCUMENT } from '@/design/regen'
import { listRepositoryFiles } from '@/git/files'
import { ceilingFindings } from '@/markdown/ceiling'
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
  README_PARAPHRASE_MARKER,
  readmeCitationsIn,
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
   * Set when the binary could not be started at all, which is a different state
   * from a binary that ran and refused. An absent tool on a contributor's
   * machine is somebody mid-setup, and an absent tool under CI is a broken
   * workflow step, so the two have to stay distinguishable.
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
   * This checkout's own CLI rather than whatever `canon` resolves to on PATH. A
   * globally installed binary resolves to the main checkout no matter which
   * worktree is running, so a gate reading through it would measure the wrong
   * tree and report a pass over a branch it never opened.
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
   * The stage could not read its input at all, so it has no verdict to give.
   *
   * Distinct from a pass with nothing to report, which is what six places in
   * the script this replaces used to print. A skip rendered as a passing line
   * reports the pass the stage exists to withhold, so the sequencer renders
   * this as a warning on a contributor's machine and refuses on it under CI.
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
 * Skills the sandbox skill census reports `asserted`, taken from `canon
 * sandbox coverage --skills` against a clean tree. A dropped pairing lowers
 * this directly, unlike the ceiling above, which a rename can starve without
 * moving: fourteen arms drifted off their skill's name in one branch and the
 * scenario-level ceiling stayed green throughout, since it counts scenarios
 * declaring an expectation rather than skills a scenario reaches. Lowering
 * this floor is a deliberate edit that says which skill lost its arm and why.
 */
export const SANDBOX_ASSERTED_FLOOR = 26

/**
 * Where the retained counts the audit stage compares each run against are
 * read, relative to `root`.
 *
 * A function rather than a spelled constant, since the read resolves at
 * either surface root and a constant naming one of them would be believed of
 * a project that has moved. `canon audits run` owns writing it, at
 * `canon/config/baseline.json` now that the write has flipped, falling back to
 * `.claude/canon/baseline.json` for a target that has not moved.
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
 * A rule no stack reaches arrives at a project only through `canon gov
 * detect`, so each one needs a `governance/detect.toml` entry or nothing ever
 * proposes it. A key naming a retired rule fails too, since it would hide from
 * the rename sweep that keys the file by basename.
 *
 * The check replaced a fixed list of expected unreferenced rules. Once the
 * stacks are thin, that list is most of the catalog and would be rewritten on
 * every new rule, which is a list nobody reads.
 *
 * The catalog is parsed here rather than piped through `bun --eval`, whose
 * interpreter exits 0 when its script throws while stdin is a pipe, so a
 * payload that is not JSON would print nothing and read as every rule
 * reached. Parsing in process keeps the two states distinguishable.
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
 * The files the sweep would rewrite, each with its own count, taken from the
 * `paths` array the record carries beside the total.
 *
 * Every field is tested rather than trusted. The record reaches here as parsed
 * JSON rather than as a type the compiler checked, so a shape that moved
 * upstream drops the entries it can no longer read and leaves the count that
 * was read from a field of its own standing.
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
 * The requirements record against the word cap it states for itself.
 *
 * Read in-process rather than through `context audit`, whose one gating stage
 * here runs `--citations-only` and never opens the record. A project carrying
 * no record, or a record stating no cap, passes, since the rule belongs to the
 * record rather than to the toolkit.
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
 * budget in `@/design/budget`. The worked example is read beside the record,
 * since it is the one a target copies its shape from.
 */
const DESIGN_RECORDS = [
  DESIGN_DOCUMENT,
  join('examples', 'design', 'DESIGN.md'),
] as const

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
 * Every skill body and reference against the no-dated-provenance rule, across
 * both corpora `auditSkills` reads.
 *
 * Read in-process rather than through `claude skills audit`, whose exit code
 * stays a missing requirement only, so a target running the verb is told about
 * a date without failing on one. This repository holds the corpus at zero,
 * which is what lets the same finding fail here.
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
 * Every listed practice skill against the closing sections, and every skill on
 * the wider ledger list against a ledger that cites something, both of which
 * `claude/skills/create-skill/references/skill-practice.md` requires.
 *
 * Read in-process for the reason `skillProvenance` is, so the verb keeps its
 * missing-requirement-only exit. The list names shipped folders alone, so a
 * tree without `claude/skills/` reports unmeasured rather than a vacuous pass.
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
 * Every shipped skill against the family vocabulary, since the landing page
 * groups the skill map by the field and a skill without one has no group.
 *
 * Read in-process for the reason `skillProvenance` is. Only the shipped corpus
 * takes a family, so a tree without `claude/skills/` reports unmeasured rather
 * than a vacuous pass.
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
 * Every tracked markdown document against the whole-document ceiling.
 *
 * A document past the ceiling fails the stage. The failure names every one with
 * its height rather than the first, so a contributor sees the whole set in one
 * pass, and an exempt document is counted and never named.
 *
 * Read in-process rather than through `canon markdown audit`, whose exit code
 * stays bans and dead links only. The plan and groundwork skills run that audit
 * on a gitignored record, and a gating length there would fail every long plan.
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
  const ceiling = CHECKPOINTS.ceiling

  if (over.length === 0) {
    const exemptNote = exempt > 0 ? `, ${exempt} exempt` : ''
    return {
      emissions: [
        info(
          `No document past the ${ceiling}-line ceiling across ${plural(documents.length, 'markdown file')}${exemptNote}`,
        ),
      ],
    }
  }

  const where = over
    .map((finding) => `${finding.rel} ${finding.renderedLines} rendered lines`)
    .join(', ')
  return {
    emissions: [],
    failure: `${plural(over.length, 'document')} past the ${ceiling}-line ceiling: ${where}. Split each at a seam, or for a verbatim record add a \`<!-- canon-length-exempt: <reason> -->\` line naming why.`,
  }
}

/**
 * Whether a path's stem, its basename up to the first `.`, repeats its
 * immediate parent folder, either whole or as a `<folder>-` prefix.
 *
 * Exact rather than singular-aware, so `skills/skill.md` passes. A false
 * positive on a gate stage teaches a contributor to route around it, and a
 * widened match is cheap to add once a real echo slips through.
 *
 * `canon/context/context-model.md` is exempt, since "context model" is the
 * domain's own name and the entry reads as nothing else without the prefix.
 * So is a replay snapshot, which copies a consumer's paths verbatim, such as
 * `canon/config/config.json`, and a renamed copy would sync as another file.
 */
export function isFolderEchoedName(path: string): boolean {
  if (path === 'canon/context/context-model.md') return false
  if (path.startsWith('sandbox/fixtures/replay/')) return false
  const segments = path.split('/')
  if (segments.length < 2) return false
  const folder = segments[segments.length - 2] ?? ''
  const stem = (segments[segments.length - 1] ?? '').split('.')[0] ?? ''
  if (folder === '' || stem === '') return false
  return stem === folder || stem.startsWith(`${folder}-`)
}

/**
 * Every tracked file whose name repeats the folder it sits in, which says the
 * folder's name twice in every path that cites it.
 *
 * Reads paths only, so it runs over the whole tree rather than the markdown
 * corpus. It stays out of `canon markdown audit`, which runs inside every
 * target, where a folder-named file may be a convention the target chose.
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
 * A second run of the records move should rewrite nothing, and the count is
 * only knowable once the folders themselves have landed.
 *
 * `moves` empty means every record folder already sits at `.canon/`, so any
 * citation the sweep would still rewrite is one the move left stale, which is
 * the defect this stage exists to catch. Where `moves` is nonempty the tree has
 * not migrated at all and a nonzero rewrite count is the verb describing its
 * own first pass, so the reading is reported and never failed on.
 *
 * Exit `0` is a tree with nothing to do and exit `2` is a plan drawn without
 * `--write`, so both read a tree and both carry a record. Every other exit is a
 * refusal that planned nothing, which is unmeasured for the reason the markdown
 * stage treats its own refusal exit so.
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
      // The payload already names every file, so listing them here is what
      // separates a count a reader has to go and reproduce from a remedy they
      // can act on. A malformed `paths` costs the list and not the finding,
      // since the count above it was read from a field of its own.
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
 * A banned character, a dead link, and a density finding on a gated path are
 * each a fact rather than a threshold, so any one fails the push while depth
 * weight and cadence stay advisory. The audit decides which density findings
 * gate, from `src/markdown/scope.ts`, so this stage reads its exit alone.
 *
 * The whole corpus is measured rather than the changed files, because a
 * `Do not use` bullet added to a standard bans a token retroactively and no
 * file in the push that adds it was edited.
 *
 * `--json` sends the record to stdout and the frame to stderr, so a passing run
 * stays silent and a failing one is re-run for its frame rather than parsed out
 * of a stream this stage would have to strip.
 */
export const markdownBans: Measure = async (ctx) => {
  const { exitCode } = await ctx.cli(['markdown', 'audit', '--json'])

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
    const frame = await ctx.cli(['markdown', 'audit'])
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
 * The markdown stage audits this repository. The seed tree ships into every
 * scaffolded project, so a seed breaking the standard it seeds propagates
 * instead of sitting still, and no rule path reaches the tree to report it.
 *
 * `--gate` fails on the two findings beside citations that are facts, a missing
 * required section and index drift, and leaves the thresholds advisory for the
 * reason the stage above leaves its own so.
 *
 * The roots are discovered rather than listed, through `seedRoots`, which the
 * Seed independence measure reads too, so a stack seeding `.claude/` later is
 * covered with no edit here and the two stages cannot disagree about which
 * roots exist.
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

    // The audit separates 1 from 2 and they mean opposite things. 2 is a seed
    // breaking the standard it seeds. 1 is the audit refusing, which a seed
    // root carrying a root but no audited folder produces, and reporting that
    // as a violation sends a reader hunting one that does not exist.
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
 * Entries the audit actually measured, summed across the folders it resolved.
 *
 * A root can resolve a folder and measure nothing in it, which is a passing
 * gate over an empty set. The caller states this per root rather than reporting
 * one verdict for every root, or a tree nobody measured reads as a tree that
 * passed.
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
 * Every file in the gated corpus, walked from `ctx.root` rather than from the
 * changed set.
 *
 * The stage's `scope` already decides whether the run happens at all, and once
 * it does the whole corpus is read. A walk keyed on the diff would pass a
 * branch that moved a reference between two files without changing it, and the
 * corpus is a few hundred text files, so reading it whole costs the stage
 * nothing it would notice.
 *
 * `dot` is what reaches the seeds, which is half of what `tooling/` ships. Every
 * seeded `.claude/` tree, `.github/` workflow, and `.husky/` hook sits behind a
 * dotted segment, so the default scan walks `tooling/` and returns none of the
 * files a scaffolded project actually receives.
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
  }
}

/**
 * A pull request number, a commit sha, a docs-path citation, or a phase
 * label that a reader in a target cannot resolve, over the seven corpora
 * that reach one.
 *
 * Every instance on the trunk was written by a branch that passed review, this
 * row's own planning session included, so the only instrument before this stage
 * was a person noticing. That is the argument for gating rather than reporting:
 * `canon labels audit` already demonstrated that a finding nobody gates on goes
 * unread until a range happens to include it, and the count here grew from six
 * to eighteen while a report was the only instrument.
 *
 * It is a prose pattern rather than a resolution. Nothing here asks GitHub
 * whether a number resolves, so a genuinely reachable citation written bare
 * fails it. That is the intended direction, since the repair is one token and
 * the alternative is a network read inside `bun run check`.
 *
 * The whole set is emitted before the failure returns. A stage halts the run on
 * its first failing check, so a branch carrying several references would
 * otherwise see one and repair one.
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
        ? `One reference in the shipped corpora resolves wrong for a reader in a target. Qualify a cross-repository citation as owner/repo#123 or owner/repo@abc1234, cite a docs page through canon docs <name>, cite the owner skill's reference in place of a canon standards call, state a same-repository citation or a phase label as a fact instead and relocate the evidence to the owning canon/context/ entry, state the fact a shipped skill body's cited rule enforces instead of its path, or mark the line ${REFERENCE_MARKER}: <reason> where the bare form is the point.`
        : `${found.length} references in the shipped corpora resolve wrong for a reader in a target. Qualify a cross-repository citation as owner/repo#123 or owner/repo@abc1234, cite a docs page through canon docs <name>, cite the owner skill's reference in place of a canon standards call, state a same-repository citation or a phase label as a fact instead and relocate the evidence to the owning canon/context/ entry, state the fact a shipped skill body's cited rule enforces instead of its path, or mark each line ${REFERENCE_MARKER}: <reason> where the bare form is the point.`,
  }
}

const RAW_FIELD_FILE_REFERENCE = /(?:^|\s)(?:-f|--raw-field)[ =]\S+=@/

/**
 * A `gh api` raw-string flag carrying a file reference, over the seven shipped
 * corpora.
 *
 * `-f body=@<path>` sends the literal path as the field value, so a comment
 * edited that way is overwritten with the path itself and loses the marker a
 * later read resolves it by. `-F` is the flag that reads the file. The pattern
 * requires `=@`, so `-F`, `--field`, and a raw string such as `-f body="text"`
 * all pass.
 *
 * It scans prose rather than parsing a command, so a body quoting the wrong
 * spelling to explain it fails too. Reword it rather than exempting it, since an
 * exemption is what lets a real occurrence hide.
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
 * Every git-tracked file quoting a listed client command with the wrong
 * argument, over the whole tree rather than one corpus, since a wrong
 * quotation can land in any file this repository writes.
 *
 * `commands` defaults to the shipped table and takes a narrower one only to
 * cover the case where that table ships empty, which is a broken check rather
 * than a clean tree, exactly as an empty ban set is for `markdownBans`.
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
 * Every `README.md:` anchor in `web/src/content/copy.ts` whose quoted phrase no
 * longer appears in the current `README.md`, plus any leftover bare
 * `README.md:<n>` citation the retired line-number convention would leave
 * behind.
 *
 * Scoped to the one file carrying the anchors rather than walked across the
 * tree, since `web/src/content/copy.ts` is the only place this repository
 * writes one. A quoted phrase is checked with a plain substring test against
 * the whole `README.md` text rather than against the cited line, which is the
 * property that lets the anchor survive `README.md` growing or shrinking
 * above it: the phrase fails only when the content itself moved or changed,
 * never when a line number did.
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
 * the one case: a change there should report the capture job and never deploy.
 */
const VISUAL_ONLY_GLOBS: readonly string[] = ['tooling/web/configs/e2e/**']

/**
 * `deploy-site.yml` and `pr-visual-checks.yml` each carry their own literal
 * copy of the five path globs a landing-page change should trigger on, plus
 * the `VISUAL_ONLY_GLOBS` the visual workflow adds for itself, per
 * Question 2 in `.canon/plans/archive/feature-render-visibility.md`. A YAML
 * anchor cannot cross files here, so the two copies are read live and compared
 * rather than one asserting a literal the other could drift behind unnoticed,
 * mirroring how `web/e2e/home.spec.ts`'s rule-group test already reads live.
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
 * `canon sandbox coverage` moves only when a person runs it, so a scenario added
 * with no expectation ships unnoticed.
 *
 * The gate is an absolute count of undeclared scenarios rather than a ratio or
 * a floor under the declared count. A floor passes the case this exists to
 * catch, since adding an unarmed scenario leaves that number where it was. A
 * ratio moves when a scenario is legitimately deleted, and this ceiling does
 * not: deleting an unarmed scenario lowers it and deleting an armed one leaves
 * it alone.
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
 * The three stages gating on the three findings here that are facts sit above,
 * and this stage reports the rest. It runs every tracked and per-machine audit
 * rather than only what those stages skip, because the aggregate's own value
 * is one verdict over the corpora describing this tree, and a stage measuring
 * a narrower subset would report a health this repository never took.
 *
 * The upstream corpus is excluded. `deps` reaches a network index rather than
 * this tree, and its wall time dwarfs every other stage combined, so a push
 * gated on it waits on a lookup this tree's own health never depended on. A
 * scheduled `verify.yml` job reports the advisory instead.
 *
 * This reports and never fails. Growth in a judgment count is the thing the
 * baseline exists to make visible, and failing a push on one would teach a
 * contributor to route around the stage. A fact still fails the push, at the
 * specific stage above that names its own remedy.
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

  // An absent field is a record this stage cannot read, which is not the same
  // as a run with nothing to report. Reading it as zero would print a clean
  // line over a summary nobody parsed.
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

  // An absent per-machine folder is the ordinary state here rather than a
  // finding, since every one of them is gitignored and CI carries none. It is
  // still stated, because a stage naming only what it measured claims a
  // coverage it does not have.
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
 * The plugin is the second delivery path and this is the only stage gating it,
 * so an absent binary is a contributor's machine rather than a clean tree. A
 * runner installs the CLI as a workflow step, which makes an absent binary
 * there a broken workflow, and passing would report a verdict for every
 * manifest on the way to a marketplace install.
 *
 * A global install can also land the wrapper and no platform-native binary,
 * which resolves on PATH and cannot run, so the two states are separated by
 * whether the spawn started at all rather than by a second lookup.
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
