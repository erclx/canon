import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { CORPORA } from '@/claude/skills-audit'
import { isFamilyKey, SKILL_FAMILIES } from '@/claude/skills-families'

const FRONTMATTER = /^---\n([\s\S]*?)\n---/

export interface SkillListing {
  readonly name: string
  readonly description: string
  readonly requirement: boolean
  /**
   * The `metadata.family` the frontmatter declares, read as written. Whether it
   * names a vocabulary key is the audit's finding, not the listing's.
   */
  readonly family: string | null
}

export interface SkillsCorpus {
  /**
   * The corpus spelling in POSIX form. `CorpusReport.rel` in `skills-audit.ts`
   * leaves it as `join` produced it, an existing JSON field left for the audit.
   */
  readonly rel: string
  /** The folder a listing reads, absolute against the root it was resolved at. */
  readonly dir: string
}

/**
 * The skill corpus a measure reads at a given root. `CORPORA` order settles a
 * tree carrying both. Kept apart from `listSkills`, since `src/counts/catalogs.ts`
 * counts the shipped catalog through it and a total must stay on that tree.
 */
export function resolveSkillsCorpus(root: string): SkillsCorpus | undefined {
  for (const rel of CORPORA) {
    const dir = join(root, rel)
    if (existsSync(dir)) return { rel: rel.replaceAll('\\', '/'), dir }
  }

  return undefined
}

/**
 * Enumerates the plugin skill catalog under `claude/`, the only corpus that
 * installs into a target. The folder name wins over the frontmatter `name`,
 * because Claude Code invokes a skill by its directory.
 */
export function listSkills(root: string): SkillListing[] {
  return listSkillsAt(join(root, 'claude', 'skills'))
}

/**
 * The same enumeration against a corpus folder the caller already resolved,
 * which is what `resolveSkillsCorpus` hands a measure that reaches a target.
 */
export function listSkillsAt(skillsRoot: string): SkillListing[] {
  if (!existsSync(skillsRoot)) return []

  const paths = [
    ...new Bun.Glob('*/SKILL.md').scanSync({
      cwd: skillsRoot,
      onlyFiles: true,
    }),
  ].sort()

  return paths.map((path) => {
    const { description, family } = readListedFields(join(skillsRoot, path))
    return {
      name: dirname(path),
      description,
      requirement: existsSync(
        join(skillsRoot, dirname(path), 'REQUIREMENT.md'),
      ),
      family,
    }
  })
}

export interface FamilyGroup {
  readonly key: string
  readonly group: string
  readonly skills: readonly string[]
}

export interface FamilyGrouping {
  /** Vocabulary order, holding only the families some listing declares. */
  readonly groups: readonly FamilyGroup[]
  /** Listings whose family is missing or names no vocabulary key. */
  readonly unassigned: readonly string[]
}

export function groupByFamily(
  listings: readonly SkillListing[],
): FamilyGrouping {
  const groups = SKILL_FAMILIES.map((family) => ({
    ...family,
    skills: listings
      .filter((listing) => listing.family === family.key)
      .map((listing) => listing.name),
  })).filter((group) => group.skills.length > 0)

  return {
    groups,
    unassigned: listings
      .filter(
        (listing) => listing.family === null || !isFamilyKey(listing.family),
      )
      .map((listing) => listing.name),
  }
}

interface ListedFields {
  readonly description: string
  readonly family: string | null
}

/**
 * Returns an empty description and a null family rather than throwing on a
 * skill whose frontmatter is missing or unparseable, so one malformed file
 * does not hide the rest of the catalog from a caller counting it.
 */
function readListedFields(path: string): ListedFields {
  const empty = { description: '', family: null }
  const match = FRONTMATTER.exec(readFileSync(path, 'utf8'))
  if (!match) return empty

  let parsed: unknown
  try {
    parsed = Bun.YAML.parse(match[1])
  } catch {
    return empty
  }
  if (!isRecord(parsed)) return empty

  const { description, metadata } = parsed
  const family = isRecord(metadata) ? metadata.family : undefined
  return {
    description: typeof description === 'string' ? description : '',
    family: typeof family === 'string' ? family : null,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
