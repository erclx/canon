import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseFrontmatter, readField } from '@/indexes/frontmatter'

/** Returned when a skill folder carries no `REQUIREMENT.md`, the gating check. */
export const EXIT_MISSING_REQUIREMENT = 2

/** The description ceiling stated in the frontmatter rules of `standards/skill.md`. */
export const DESCRIPTION_LIMIT = 1024

/** The two headings the requirement template declares, matched at any level. */
export const REQUIREMENT_SECTIONS: readonly string[] = ['Gap', 'Must']

/**
 * Both trees the standard governs. `claude/skills/` ships to a target and
 * `.claude/skills/` stays here, and every rule measured below applies to each,
 * so a corpus reading one of them reports a pass over half the subject.
 */
export const CORPORA: readonly string[] = [
  join('claude', 'skills'),
  join('.claude', 'skills'),
]

/**
 * The one reason this audit refuses. A project carrying neither corpus is the
 * ordinary state of a target that has not adopted either skills convention,
 * the same absence `no-skills` reads for the shipped citation reach check.
 */
export type SkillsAuditRefusal = 'no-corpus'

/** Kebab-case, which the standard states as no spaces, capitals, or underscores. */
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const HEADING = /^#{1,6}\s+(.+?)\s*$/

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
}

interface SkillSource {
  readonly rel: string
  readonly folder: string
  readonly hasReadme: boolean
  readonly name: string | undefined
  readonly description: string | undefined
  /** Undefined when the folder carries no `REQUIREMENT.md` at all. */
  readonly requirementHeadings: readonly string[] | undefined
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

  const [body, requirement] = await Promise.all([
    Bun.file(join(skillDir, 'SKILL.md')).text(),
    existsSync(requirementPath)
      ? Bun.file(requirementPath).text()
      : Promise.resolve(undefined),
  ])

  const fields = parseFrontmatter(body)

  return {
    rel: join(rel, folder),
    folder,
    hasReadme: existsSync(join(skillDir, 'README.md')),
    name: declared(readField(fields, 'name')),
    description: declared(readField(fields, 'description')),
    requirementHeadings:
      requirement === undefined ? undefined : headings(requirement),
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
