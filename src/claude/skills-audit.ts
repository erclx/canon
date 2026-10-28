import { existsSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { isFamilyKey } from '@/claude/skills-families'
import { plural } from '@/cli/ui'
import {
  compareLedger,
  countLedgerRows,
  type HeadingCount,
  type LedgerMismatch,
} from '@/gov/audit'
import { parseFrontmatter, readField } from '@/indexes/frontmatter'
import {
  type BodyLine,
  bodyLines,
  maskCodeSpans,
  maskDisplayed,
} from '@/markdown/scan'

/** Returned when a skill folder carries no `REQUIREMENT.md`, the gating check. */
export const EXIT_MISSING_REQUIREMENT = 2

/** The description ceiling stated in the frontmatter rules of `claude/skills/create-skill/references/skill.md`. */
export const DESCRIPTION_LIMIT = 1024

/** The two headings the requirement template declares, matched at any level. */
export const REQUIREMENT_SECTIONS: readonly string[] = ['Gap', 'Must']

/**
 * The caps `claude/skills/create-skill/references/skill-requirement.md` states.
 * Words count body tokens carrying a letter or digit, so a heading or bullet
 * marker costs nothing and frontmatter is left out.
 */
export const REQUIREMENT_LIMITS = { bullets: 5, words: 400 } as const

/** The section the standard retired into Must not, matched at any level. */
export const RETIRED_REQUIREMENT_SECTION = 'Guards'

/** The section that states today's failures, where history is reported. */
const GAP_SECTION = 'Gap'

/** The one tree that ships to a target, and the only one the practice list names. */
export const SHIPPED_CORPUS = join('claude', 'skills')

/**
 * Both trees the standard governs. `claude/skills/` ships to a target and
 * `.claude/skills/` stays here, and every rule measured below applies to each,
 * so a corpus reading one of them reports a pass over half the subject.
 */
export const CORPORA: readonly string[] = [
  SHIPPED_CORPUS,
  join('.claude', 'skills'),
]

/**
 * The practice skills `claude/skills/create-skill/references/skill-practice.md` describes, keyed by corpus-relative
 * folder rather than by name, so a target's own `.claude/skills/` folder that
 * shares a name is never swept in. The list lives here rather than in a skill's
 * frontmatter because a skill declaring its own kind could exempt itself.
 */
export const PRACTICE_SKILLS: readonly string[] = [
  join(SHIPPED_CORPUS, 'codebase-layout'),
  join(SHIPPED_CORPUS, 'test-craft'),
  join(SHIPPED_CORPUS, 'review-craft'),
  join(SHIPPED_CORPUS, 'systematic-debugging'),
  join(SHIPPED_CORPUS, 'api-design'),
  join(SHIPPED_CORPUS, 'code-craft'),
  join(SHIPPED_CORPUS, 'build-in-slices'),
  join(SHIPPED_CORPUS, 'deprecation-migration'),
  join(SHIPPED_CORPUS, 'search-craft'),
  join(SHIPPED_CORPUS, 'teach-craft'),
]

/**
 * Every skill carrying the source ledger, being the practice skills and the
 * skills that teach a craft without the practice closing sections. Kept apart
 * from `PRACTICE_SKILLS` so citing sources never forces those sections onto a
 * skill whose body is not shaped around a practice a session cuts short.
 */
export const LEDGER_SKILLS: readonly string[] = [
  ...PRACTICE_SKILLS,
  join(SHIPPED_CORPUS, 'design-taste'),
  join(SHIPPED_CORPUS, 'write-human'),
  join(SHIPPED_CORPUS, 'test-first'),
  join(SHIPPED_CORPUS, 'ui-craft'),
]

function references(...names: string[]): string[] {
  return names.map((name) => join('references', `${name}.md`))
}

export interface BulletLedgerScope {
  /** References left off, each a checklist or glossary naming no new source. */
  readonly exempt: readonly string[]
  /** True when `SKILL.md` carries directives of its own to ledger. */
  readonly body: boolean
}

/**
 * The ledger-listed skills whose every reference but the source record carries
 * a ledger of its own, one table row per bullet under each H2, the way a rule
 * in a practice folder does. A reference is ledgered unless exempted by name,
 * so one added later fails until its rows land rather than passing unread. The
 * ledgers sit outside the plugin as rule ledgers do, so a target pays nothing
 * for them.
 */
export const BULLET_LEDGER_SKILLS: Readonly<Record<string, BulletLedgerScope>> =
  {
    [join(SHIPPED_CORPUS, 'ui-craft')]: { exempt: [], body: false },
    [join(SHIPPED_CORPUS, 'api-design')]: { exempt: [], body: true },
    [join(SHIPPED_CORPUS, 'code-craft')]: { exempt: [], body: true },
    [join(SHIPPED_CORPUS, 'deprecation-migration')]: { exempt: [], body: true },
    [join(SHIPPED_CORPUS, 'design-taste')]: {
      exempt: references('preflight', 'vocabulary'),
      body: true,
    },
    [join(SHIPPED_CORPUS, 'review-craft')]: {
      exempt: references('ui'),
      body: true,
    },
    [join(SHIPPED_CORPUS, 'teach-craft')]: { exempt: [], body: true },
    [join(SHIPPED_CORPUS, 'test-craft')]: { exempt: [], body: true },
    [join(SHIPPED_CORPUS, 'test-first')]: { exempt: [], body: true },
    [join(SHIPPED_CORPUS, 'codebase-layout')]: { exempt: [], body: true },
    [join(SHIPPED_CORPUS, 'search-craft')]: { exempt: [], body: true },
    [join(SHIPPED_CORPUS, 'write-human')]: { exempt: [], body: true },
    [join(SHIPPED_CORPUS, 'systematic-debugging')]: { exempt: [], body: true },
  }

/** Where a per-bullet ledger lives, as `<skill>/<file>.md` below it. */
export const SKILL_LEDGERS = join('governance', 'ledger', 'skills')

/**
 * The ledger a ledgered file pairs with, keyed by the file's own name, so a
 * reference drops its `references/` segment and a `SKILL.md` keeps its name.
 */
export function skillLedgerPath(folder: string, file: string): string {
  const inside = relative('references', file)
  return join(SKILL_LEDGERS, folder, inside.startsWith('..') ? file : inside)
}

/** The closing H2s a practice skill carries, matched exactly outside fences. */
export const PRACTICE_SECTIONS: readonly string[] = [
  'Excuses and rebuttals',
  'Red flags',
  'Before handing over',
]

/**
 * The H2s that end a listed body's concern groups. The closing sections
 * restate the groups' rules as excuses, signs, and checks, and the delegates
 * section routes, so neither states a rule of its own to source.
 */
export const BODY_CLOSERS: readonly string[] = [
  ...PRACTICE_SECTIONS,
  'What this delegates',
]

/** The source ledger every practice skill carries beside its body. */
export const PRACTICE_LEDGER = join('references', 'adopted.md')

/**
 * A ledger cites a source by linking a page outside the project, as an inline
 * link or an autolink. A relative link points back into the skill and cites
 * nothing a reader could check the rule against.
 */
const EXTERNAL_LINK = /\]\(\s*https?:\/\/|<https?:\/\//

/**
 * A table cell opening on the marker the governance ledgers already use for a
 * rule the toolkit chose, so one check reads every ledger alike.
 */
const HOUSE_CHOICE = /\|\s*House choice\b/

/**
 * The line count past which a reference opens with a contents list, from
 * Anthropic's skill authoring guidance. Counted over the whole file the way
 * `wc -l` counts it, so "over 100" holds at 101 and not at 100.
 */
export const CONTENTS_THRESHOLD = 100

/** The H2 a long reference opens with, matched exactly outside fences. */
export const CONTENTS_SECTION = 'Contents'

/**
 * The one reason this audit refuses. A project carrying neither corpus is the
 * ordinary state of a target that has not adopted either skills convention,
 * the same absence `no-skills` reads for the shipped citation reach check.
 */
export type SkillsAuditRefusal = 'no-corpus'

/** Kebab-case, which the standard states as no spaces, capitals, or underscores. */
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const HEADING = /^#{1,6}\s+(.+?)\s*$/

const SECTION = /^##\s+(.+?)\s*$/

/**
 * An ISO date, read as provenance wherever a reader is told it. The context
 * audit's detector clears a date after "measured" or "verified", and a skill
 * body keeps no such carve-out, since the standard sends every incident and its
 * date to the requirement's Gap or to git.
 */
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/g

/** An issue or pull request number, which a heading's `#` never matches. */
const ISSUE_NUMBER = /(?<![\w&/#])#\d+\b/g

const TOP_LEVEL_BULLET = /^(?:[-*+]|\d+[.)])\s/

/**
 * A line a skill ledger pairs with a row: a top-level `- ` bullet as a rule
 * writes one, or a top-level ordered step, which states a directive as surely.
 */
const LEDGERED_LINE = /^(?:- |\d+[.)]\s)/

const WORD = /\S*[\p{L}\p{N}]\S*/gu

export interface SkillFinding {
  readonly rel: string
  readonly detail: string
}

export interface CorpusReport {
  /**
   * Left as `join` produced it, where `SkillsCorpus.rel` in `skills-list.ts`
   * normalizes the same spelling to POSIX. This one is an existing JSON field
   * a caller already reads, so the split holds until a branch reading this verb
   * is the one to close it.
   */
  readonly rel: string
  readonly skills: number
}

export interface SkillsAudit {
  readonly corpora: readonly CorpusReport[]
  readonly skills: number
  readonly missingRequirement: readonly string[]
  readonly readme: readonly string[]
  readonly folderName: readonly string[]
  readonly missingDescription: readonly string[]
  readonly nameMismatch: readonly SkillFinding[]
  readonly longDescription: readonly SkillFinding[]
  readonly requirementSections: readonly SkillFinding[]
  readonly requirementLimits: readonly SkillFinding[]
  readonly datedProvenance: readonly SkillFinding[]
  readonly practiceShape: readonly SkillFinding[]
  readonly referenceContents: readonly SkillFinding[]
  readonly family: readonly SkillFinding[]
}

interface SkillSource {
  readonly rel: string
  readonly folder: string
  readonly hasReadme: boolean
  readonly name: string | undefined
  readonly description: string | undefined
  /** `metadata.family`, undefined when absent, blank, or not a string. */
  readonly family: string | undefined
  /** Undefined when the folder carries no `REQUIREMENT.md` at all. */
  readonly requirementHeadings: readonly string[] | undefined
  readonly requirement: string | undefined
  /** Every H2 in `SKILL.md` outside a fence, for the practice shape. */
  readonly sections: readonly string[]
  /** Undefined when the folder carries no ledger at all. */
  readonly ledger: string | undefined
  /**
   * `SKILL.md` and every reference below the folder, keyed by the path a
   * finding names. `REQUIREMENT.md` and `EVAL.md` are left out, since the
   * requirement is where the standard sends a date.
   */
  readonly bodies: readonly SkillText[]
  /** One entry per ledgered file of a skill on the per-bullet ledger list. */
  readonly referenceLedgers: readonly ReferenceLedger[]
  /** Exempted references the skill no longer carries, which exempt nothing. */
  readonly staleExemptions: readonly string[]
}

interface ReferenceLedger {
  readonly rel: string
  readonly ledgerRel: string
  /** Undefined when the ledger file is absent. */
  readonly mismatches: readonly LedgerMismatch[] | undefined
}

interface SkillText {
  readonly rel: string
  readonly text: string
  readonly isReference: boolean
}

/**
 * Measures both skill corpora against the rules `claude/skills/create-skill/references/skill.md` states
 * mechanically. A corpus the project does not carry is skipped rather than
 * reported, so a target holding only `.claude/skills/` reads as in scope.
 *
 * Reads raw frontmatter rather than `listSkills`, which prefers the folder name
 * over the declared one and so can never surface a disagreement between them.
 */
export async function auditSkills(root: string): Promise<SkillsAudit> {
  const present = CORPORA.map((rel) => ({ rel, dir: join(root, rel) })).filter(
    (corpus) => existsSync(corpus.dir),
  )

  const perCorpus = await Promise.all(
    present.map((corpus) => readCorpus(root, corpus.rel, corpus.dir)),
  )
  const sources = perCorpus.flat()

  return {
    corpora: present.map((corpus, index) => ({
      rel: corpus.rel,
      skills: perCorpus[index]?.length ?? 0,
    })),
    skills: sources.length,
    missingRequirement: sources
      .filter((source) => source.requirementHeadings === undefined)
      .map((source) => source.rel),
    readme: sources
      .filter((source) => source.hasReadme)
      .map((source) => source.rel),
    folderName: sources
      .filter((source) => !KEBAB_CASE.test(source.folder))
      .map((source) => source.rel),
    missingDescription: sources
      .filter((source) => source.description === undefined)
      .map((source) => source.rel),
    nameMismatch: sources.flatMap(nameFindings),
    longDescription: sources.flatMap(lengthFindings),
    requirementSections: sources.flatMap(sectionFindings),
    requirementLimits: sources.flatMap(limitFindings),
    datedProvenance: sources.flatMap((source) =>
      source.bodies.flatMap(dateFindings),
    ),
    practiceShape: [
      ...missingPracticeSkills(
        present.some((corpus) => corpus.rel === SHIPPED_CORPUS),
        sources,
      ),
      ...sources.flatMap(practiceFindings),
    ],
    referenceContents: sources.flatMap((source) =>
      source.bodies.flatMap(contentsFindings),
    ),
    family: sources.flatMap(familyFindings),
  }
}

/**
 * Only a required file that is absent sets a failing code, which is a fact.
 * Every other measure is a judgment a reader settles, and failing a push on one
 * teaches contributors to route around the stage.
 */
export function auditExitCode(report: SkillsAudit): number {
  return report.missingRequirement.length > 0 ? EXIT_MISSING_REQUIREMENT : 0
}

async function readCorpus(
  root: string,
  rel: string,
  dir: string,
): Promise<SkillSource[]> {
  const paths = [
    ...new Bun.Glob('*/SKILL.md').scanSync({ cwd: dir, onlyFiles: true }),
  ].sort()

  return Promise.all(
    paths.map((path) => readSkill(root, rel, dir, dirname(path))),
  )
}

async function readSkill(
  root: string,
  rel: string,
  dir: string,
  folder: string,
): Promise<SkillSource> {
  const skillDir = join(dir, folder)
  const requirementPath = join(skillDir, 'REQUIREMENT.md')
  const ledgerPath = join(skillDir, PRACTICE_LEDGER)

  const references = [
    ...new Bun.Glob('references/**/*.md').scanSync({
      cwd: skillDir,
      onlyFiles: true,
    }),
  ].sort()

  const [body, requirement, ledger, referenceTexts] = await Promise.all([
    Bun.file(join(skillDir, 'SKILL.md')).text(),
    existsSync(requirementPath)
      ? Bun.file(requirementPath).text()
      : Promise.resolve(undefined),
    existsSync(ledgerPath)
      ? Bun.file(ledgerPath).text()
      : Promise.resolve(undefined),
    Promise.all(
      references.map((path) => Bun.file(join(skillDir, path)).text()),
    ),
  ])

  const fields = parseFrontmatter(body)
  const skillRel = join(rel, folder)
  const scope = BULLET_LEDGER_SKILLS[skillRel]
  const referenceLedgers =
    scope === undefined
      ? []
      : await readReferenceLedgers(root, skillRel, folder, [
          ...(scope.body ? [{ path: 'SKILL.md', text: body }] : []),
          ...references
            .map((path, index) => ({ path, text: referenceTexts[index] ?? '' }))
            .filter(
              ({ path }) =>
                path !== PRACTICE_LEDGER && !scope.exempt.includes(path),
            ),
        ])
  const staleExemptions = (scope?.exempt ?? [])
    .filter((path) => !references.includes(path))
    .map((path) => join(skillRel, path))

  return {
    rel: skillRel,
    folder,
    hasReadme: existsSync(join(skillDir, 'README.md')),
    name: declared(readField(fields, 'name')),
    description: declared(readField(fields, 'description')),
    family: declaredFamily(fields?.fields.metadata),
    requirementHeadings:
      requirement === undefined ? undefined : headings(requirement),
    requirement,
    sections: sectionsOf(body),
    ledger,
    bodies: [
      { rel: join(skillRel, 'SKILL.md'), text: body, isReference: false },
      ...references.map((path, index) => ({
        rel: join(skillRel, path),
        text: referenceTexts[index] ?? '',
        isReference: true,
      })),
    ],
    referenceLedgers,
    staleExemptions,
  }
}

/**
 * Pairs each ledgered file's directives with its ledger's rows through the rule
 * audit's own comparison, so a skill file and a rule mismatch alike.
 */
async function readReferenceLedgers(
  root: string,
  skillRel: string,
  folder: string,
  files: readonly { path: string; text: string }[],
): Promise<ReferenceLedger[]> {
  return Promise.all(
    files.map(async ({ path, text }) => {
      const ledgerRel = skillLedgerPath(folder, path)
      const ledgerPath = join(root, ledgerRel)
      const mismatches = existsSync(ledgerPath)
        ? compareLedger(
            ledgerGroups(text, path === 'SKILL.md'),
            countLedgerRows(await Bun.file(ledgerPath).text()),
          )
        : undefined
      return { rel: join(skillRel, path), ledgerRel, mismatches }
    }),
  )
}

/**
 * Directives per H2, `null` for any above the first. A contents list repeats
 * the headings rather than stating a rule, so `## Contents` takes no rows. A
 * nested bullet elaborates its parent, so only a top-level line counts. A body
 * stops at its first closer, and a ledger table under one then reads as rows
 * with no bullets rather than passing unread.
 */
function ledgerGroups(text: string, isBody: boolean): HeadingCount[] {
  const counts = new Map<string | null, number>()
  let heading: string | null = null

  for (const line of bodyLines(text)) {
    if (line.fenced) continue
    const section = SECTION.exec(line.text)?.[1]
    if (section !== undefined) {
      if (isBody && BODY_CLOSERS.includes(section)) break
      heading = section
      continue
    }
    if (heading === CONTENTS_SECTION || !LEDGERED_LINE.test(line.text)) continue
    counts.set(heading, (counts.get(heading) ?? 0) + 1)
  }

  return [...counts].map(([key, count]) => ({ heading: key, count }))
}

/**
 * A key carrying an empty value declares nothing, so blank reads as absent
 * rather than as a name that disagrees with every folder.
 */
function declared(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed === undefined || trimmed === '' ? undefined : trimmed
}

function declaredFamily(metadata: unknown): string | undefined {
  if (typeof metadata !== 'object' || metadata === null) return undefined
  if (Array.isArray(metadata)) return undefined
  const { family } = metadata as Record<string, unknown>
  return typeof family === 'string' ? declared(family) : undefined
}

/** Every H2 outside a fence, the one level both exact-section checks read. */
function sectionsOf(source: string): string[] {
  return bodyLines(source)
    .filter((line) => !line.fenced)
    .map((line) => SECTION.exec(line.text)?.[1])
    .filter((text): text is string => text !== undefined)
}

function headings(source: string): string[] {
  return source
    .split('\n')
    .map((line) => HEADING.exec(line)?.[1])
    .filter((text): text is string => text !== undefined)
}

function nameFindings(source: SkillSource): SkillFinding[] {
  if (source.name === undefined) {
    return [{ rel: source.rel, detail: 'frontmatter declares no name' }]
  }
  if (source.name === source.folder) return []
  return [{ rel: source.rel, detail: `frontmatter name: ${source.name}` }]
}

function lengthFindings(source: SkillSource): SkillFinding[] {
  const { description } = source
  if (description === undefined) return []
  if (description.length <= DESCRIPTION_LIMIT) return []
  return [{ rel: source.rel, detail: `${description.length} characters` }]
}

/**
 * Stays silent on a folder carrying no requirement at all, which the presence
 * check already reports. Counting the same skill twice reads as two defects.
 */
function sectionFindings(source: SkillSource): SkillFinding[] {
  const { requirementHeadings } = source
  if (requirementHeadings === undefined) return []

  const missing = REQUIREMENT_SECTIONS.filter(
    (section) => !requirementHeadings.includes(section),
  )
  if (missing.length === 0) return []

  return [
    {
      rel: join(source.rel, 'REQUIREMENT.md'),
      detail: `missing: ${missing.join(', ')}`,
    },
  ]
}

/**
 * Reports every cap the standard states, each as its own finding so a file
 * breaching two reads as two edits. Silent on an absent requirement for the
 * reason `sectionFindings` is.
 */
function limitFindings(source: SkillSource): SkillFinding[] {
  const { requirement, requirementHeadings } = source
  if (requirement === undefined || requirementHeadings === undefined) return []

  const rel = join(source.rel, 'REQUIREMENT.md')
  const lines = bodyLines(requirement)
  const details = [
    ...bulletDetails(lines),
    ...wordDetails(lines),
    ...gapHistoryDetails(lines),
    ...(requirementHeadings.includes(RETIRED_REQUIREMENT_SECTION)
      ? [`## ${RETIRED_REQUIREMENT_SECTION}: retired, fold it into Must not`]
      : []),
  ]

  return details.map((detail) => ({ rel, detail }))
}

/**
 * Counts top-level bullets per H2, since the template holds one list per
 * section. A nested bullet elaborates its parent rather than adding to it.
 */
function bulletDetails(lines: readonly BodyLine[]): string[] {
  const counts = new Map<string, number>()
  let section: string | undefined

  for (const line of lines) {
    if (line.fenced) continue
    const heading = SECTION.exec(line.text)?.[1]
    if (heading !== undefined) {
      section = heading
      continue
    }
    if (section === undefined || !TOP_LEVEL_BULLET.test(line.text)) continue
    counts.set(section, (counts.get(section) ?? 0) + 1)
  }

  return [...counts]
    .filter(([, count]) => count > REQUIREMENT_LIMITS.bullets)
    .map(
      ([name, count]) =>
        `## ${name}: ${count} bullets, cap ${REQUIREMENT_LIMITS.bullets}`,
    )
}

function wordDetails(lines: readonly BodyLine[]): string[] {
  const words = lines.reduce(
    (total, line) => total + (line.text.match(WORD)?.length ?? 0),
    0,
  )
  if (words <= REQUIREMENT_LIMITS.words) return []
  return [`${words} words, cap ${REQUIREMENT_LIMITS.words}`]
}

/**
 * Gap states what fails today, so a date or a number naming the incident that
 * earned a line is history git already holds. A code span is quoted data, such
 * as a sample filename, and is masked before matching.
 */
function gapHistoryDetails(lines: readonly BodyLine[]): string[] {
  const details: string[] = []
  let inGap = false

  for (const line of lines) {
    if (line.fenced) continue
    const heading = HEADING.exec(line.text)?.[1]
    if (heading !== undefined) {
      inGap = heading === GAP_SECTION
      continue
    }
    if (!inGap) continue
    const masked = maskDisplayed(line.text)
    for (const match of [
      ...masked.matchAll(ISO_DATE),
      ...masked.matchAll(ISSUE_NUMBER),
    ]) {
      details.push(`line ${line.number}: ${match[0]} in ${GAP_SECTION}`)
    }
  }

  return details
}

/**
 * A listed folder the shipped corpus does not hold, such as a renamed skill or
 * a misspelled append, would otherwise read as a pass. Silent where the
 * shipped corpus is absent, since a target carries none of the listed skills.
 */
function missingPracticeSkills(
  hasShippedCorpus: boolean,
  sources: readonly SkillSource[],
): SkillFinding[] {
  if (!hasShippedCorpus) return []
  const found = new Set(sources.map((source) => source.rel))
  return LEDGER_SKILLS.filter((rel) => !found.has(rel)).map((rel) => ({
    rel,
    detail: 'missing skill: no folder under the shipped corpus',
  }))
}

/**
 * Matches each section as an exact H2, so a heading carrying trailing text or
 * sitting at another level reads as missing rather than as a near match the
 * standard never names.
 */
function practiceFindings(source: SkillSource): SkillFinding[] {
  if (!LEDGER_SKILLS.includes(source.rel)) return []

  const isPractice = PRACTICE_SKILLS.includes(source.rel)
  const sections = (isPractice ? PRACTICE_SECTIONS : [])
    .filter((section) => !source.sections.includes(section))
    .map((section) => ({
      rel: source.rel,
      detail: `missing section: ${section}`,
    }))

  return [
    ...sections,
    ...ledgerFindings(source),
    ...source.referenceLedgers.flatMap(referenceLedgerFindings),
    ...source.staleExemptions.map((rel) => ({
      rel,
      detail: 'missing file: exempt from a ledger',
    })),
  ]
}

function referenceLedgerFindings(entry: ReferenceLedger): SkillFinding[] {
  if (entry.mismatches === undefined) {
    return [{ rel: entry.rel, detail: `missing ledger: ${entry.ledgerRel}` }]
  }
  return entry.mismatches.map((mismatch) => ({
    rel: entry.rel,
    detail: `${mismatch.heading === null ? 'above the first H2' : `## ${mismatch.heading}`}: ${plural(mismatch.bullets, 'bullet')}, ${plural(mismatch.rows, 'ledger row')}`,
  }))
}

/**
 * A ledger present but citing nothing passed for as long as the check read the
 * file's existence alone, so the contents are read too. A sample block shows a
 * reader the shape of a row and cites nothing, so fences and code spans are
 * left out.
 */
function ledgerFindings(source: SkillSource): SkillFinding[] {
  if (source.ledger === undefined) {
    return [{ rel: source.rel, detail: `missing ledger: ${PRACTICE_LEDGER}` }]
  }

  const cites = bodyLines(source.ledger)
    .filter((line) => !line.fenced)
    .map((line) => maskCodeSpans(line.text))
    .some((text) => EXTERNAL_LINK.test(text) || HOUSE_CHOICE.test(text))
  if (cites) return []

  return [
    { rel: source.rel, detail: `ledger cites nothing: ${PRACTICE_LEDGER}` },
  ]
}

/**
 * Asks only the shipped corpus for a family, since the family names the skill
 * map group a skill's row sits under and an internal skill takes no row.
 */
function familyFindings(source: SkillSource): SkillFinding[] {
  if (dirname(source.rel) !== SHIPPED_CORPUS) return []
  if (source.family === undefined) {
    return [
      { rel: source.rel, detail: 'frontmatter declares no metadata.family' },
    ]
  }
  if (isFamilyKey(source.family)) return []
  return [{ rel: source.rel, detail: `unknown family: ${source.family}` }]
}

/**
 * Reads references alone, since `SKILL.md` carries its own length checkpoint
 * and no contents rule. Frontmatter counts toward the length, so the count a
 * finding names is the one `wc -l` prints beside it.
 */
function contentsFindings(source: SkillText): SkillFinding[] {
  if (!source.isReference) return []

  const lines = source.text.replace(/\n$/, '').split('\n').length
  if (lines <= CONTENTS_THRESHOLD) return []
  if (sectionsOf(source.text).includes(CONTENTS_SECTION)) return []

  return [
    { rel: source.rel, detail: `${lines} lines, no ## ${CONTENTS_SECTION}` },
  ]
}

/**
 * A date inside a fence or a code span is example data a reader is shown, such
 * as a sample frontmatter block, so only prose outside both is read.
 */
function dateFindings(source: SkillText): SkillFinding[] {
  return bodyLines(source.text)
    .filter((line) => !line.fenced)
    .flatMap((line) =>
      [...maskDisplayed(line.text).matchAll(ISO_DATE)].map((match) => ({
        rel: source.rel,
        detail: `line ${line.number}: ${match[0]}`,
      })),
    )
}
