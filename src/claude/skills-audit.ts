import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { isFamilyKey } from '@/claude/skills-families'
import { parseFrontmatter, readField } from '@/indexes/frontmatter'
import { bodyLines, maskDisplayed } from '@/markdown/scan'

/** Returned when a skill folder carries no `REQUIREMENT.md`, the gating check. */
export const EXIT_MISSING_REQUIREMENT = 2

/** The description ceiling stated in the frontmatter rules of `standards/skill.md`. */
export const DESCRIPTION_LIMIT = 1024

/** The two headings the requirement template declares, matched at any level. */
export const REQUIREMENT_SECTIONS: readonly string[] = ['Gap', 'Must']

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
 * The practice skills `standards/skill-practice.md` describes, keyed by corpus-relative
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
  join(SHIPPED_CORPUS, 'video-craft'),
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
]

/** The closing H2s a practice skill carries, matched exactly outside fences. */
export const PRACTICE_SECTIONS: readonly string[] = [
  'Excuses and rebuttals',
  'Red flags',
  'Before handing over',
]

/** The source ledger every practice skill carries beside its body. */
export const PRACTICE_LEDGER = join('references', 'adopted.md')

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
  /** Every H2 in `SKILL.md` outside a fence, for the practice shape. */
  readonly sections: readonly string[]
  readonly hasLedger: boolean
  /**
   * `SKILL.md` and every reference below the folder, keyed by the path a
   * finding names. `REQUIREMENT.md` and `EVAL.md` are left out, since the
   * requirement is where the standard sends a date.
   */
  readonly bodies: readonly SkillText[]
}

interface SkillText {
  readonly rel: string
  readonly text: string
  readonly isReference: boolean
}

/**
 * Measures both skill corpora against the rules `standards/skill.md` states
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
    present.map((corpus) => readCorpus(corpus.rel, corpus.dir)),
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

async function readCorpus(rel: string, dir: string): Promise<SkillSource[]> {
  const paths = [
    ...new Bun.Glob('*/SKILL.md').scanSync({ cwd: dir, onlyFiles: true }),
  ].sort()

  return Promise.all(paths.map((path) => readSkill(rel, dir, dirname(path))))
}

async function readSkill(
  rel: string,
  dir: string,
  folder: string,
): Promise<SkillSource> {
  const skillDir = join(dir, folder)
  const requirementPath = join(skillDir, 'REQUIREMENT.md')

  const references = [
    ...new Bun.Glob('references/**/*.md').scanSync({
      cwd: skillDir,
      onlyFiles: true,
    }),
  ].sort()

  const [body, requirement, referenceTexts] = await Promise.all([
    Bun.file(join(skillDir, 'SKILL.md')).text(),
    existsSync(requirementPath)
      ? Bun.file(requirementPath).text()
      : Promise.resolve(undefined),
    Promise.all(
      references.map((path) => Bun.file(join(skillDir, path)).text()),
    ),
  ])

  const fields = parseFrontmatter(body)
  const skillRel = join(rel, folder)

  return {
    rel: skillRel,
    folder,
    hasReadme: existsSync(join(skillDir, 'README.md')),
    name: declared(readField(fields, 'name')),
    description: declared(readField(fields, 'description')),
    family: declaredFamily(fields?.fields.metadata),
    requirementHeadings:
      requirement === undefined ? undefined : headings(requirement),
    sections: sectionsOf(body),
    hasLedger: existsSync(join(skillDir, PRACTICE_LEDGER)),
    bodies: [
      { rel: join(skillRel, 'SKILL.md'), text: body, isReference: false },
      ...references.map((path, index) => ({
        rel: join(skillRel, path),
        text: referenceTexts[index] ?? '',
        isReference: true,
      })),
    ],
  }
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
  const ledger = source.hasLedger
    ? []
    : [{ rel: source.rel, detail: `missing ledger: ${PRACTICE_LEDGER}` }]

  return [...sections, ...ledger]
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
