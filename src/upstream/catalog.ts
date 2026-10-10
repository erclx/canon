import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { COMMAND_GROUPS } from '@/cli/help'
import { listSkillsAt } from '@/claude/skills-list'
import { STAGES } from '@/gate/stages'

const MAX_TEXT = 140
const PLUGIN_SKILLS = 'claude/skills'
const INTERNAL_SKILLS = '.claude/skills'

export interface CatalogEntry {
  readonly name: string
  readonly text: string
}

export interface Catalog {
  readonly skills: CatalogEntry[]
  readonly internalSkills: CatalogEntry[]
  readonly verbs: CatalogEntry[]
  readonly hooks: CatalogEntry[]
  readonly gate: CatalogEntry[]
  /** Rows that exist but could not be described, so none drops out silently. */
  readonly gaps: string[]
}

const firstSentence = (text: string): string =>
  text.split(/\.\s/)[0]?.replace(/\.$/, '').slice(0, MAX_TEXT) ?? ''

function skillsAt(
  root: string,
  corpus: string,
  gaps: string[],
): CatalogEntry[] {
  const dir = join(root, corpus)
  if (!existsSync(dir)) return []

  const listed = listSkillsAt(dir)
  const named = new Set(listed.map((skill) => skill.name))
  const folders = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

  for (const folder of folders) {
    if (!named.has(folder)) gaps.push(`${corpus}/${folder}: no SKILL.md`)
  }
  for (const skill of listed) {
    if (!skill.description) gaps.push(`${corpus}/${skill.name}: no description`)
  }

  return listed.map((skill) => ({
    name: skill.name,
    text: firstSentence(skill.description),
  }))
}

function hooksAt(root: string): CatalogEntry[] {
  const dir = join(root, '.claude', 'hooks')
  if (!existsSync(dir)) return []

  return readdirSync(dir)
    .filter((file) => file.endsWith('.sh'))
    .sort()
    .map((file) => {
      const comment = readFileSync(join(dir, file), 'utf8')
        .split('\n')
        .find((line) => /^#\s*\S/.test(line) && !line.startsWith('#!'))

      return {
        name: file,
        text: (comment ?? '').replace(/^#\s*/, '').slice(0, MAX_TEXT),
      }
    })
}

export function buildCatalog(root: string): Catalog {
  const gaps: string[] = []

  return {
    skills: skillsAt(root, PLUGIN_SKILLS, gaps),
    internalSkills: skillsAt(root, INTERNAL_SKILLS, gaps),
    verbs: COMMAND_GROUPS.flatMap((group) => group.rows).map(
      ([signature, description]) => ({
        name: `canon ${signature}`,
        text: description,
      }),
    ),
    hooks: hooksAt(root),
    gate: STAGES.map((stage) => ({ name: stage.id, text: stage.label })),
    gaps,
  }
}

const section = (title: string, entries: readonly CatalogEntry[]): string[] => [
  `### ${title}`,
  ...entries.map((entry) =>
    entry.text ? `- ${entry.name}: ${entry.text}` : `- ${entry.name}`,
  ),
  '',
]

export function renderCatalog(catalog: Catalog): string {
  return [
    ...section('Plugin skills (claude/skills/)', catalog.skills),
    ...section('Internal skills (.claude/skills/)', catalog.internalSkills),
    ...section('CLI verbs', catalog.verbs),
    ...section('Hooks (.claude/hooks/)', catalog.hooks),
    ...section('Gate stages (canon gate run)', catalog.gate),
    ...(catalog.gaps.length > 0
      ? ['### Gaps', ...catalog.gaps.map((gap) => `- ${gap}`), '']
      : []),
  ].join('\n')
}
