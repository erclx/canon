import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

import { merge } from '../content/copy'
import { readCanonJson, readCanonText, repoRoot } from './canon-cli'
import { readCatalogCounts } from './counts'
import {
  commandNamesFromHelp,
  firstSentence,
  type HookAction,
  hookActions,
  matchRules,
  requireListed,
  type RuleMatchResult,
  type RuleMeta,
  ruleBullet,
} from './derive'

/**
 * Every value the session page reads at build time, gathered once. Each read
 * goes through this checkout's own CLI where a verb answers it, and through
 * the file the claim is about where none does, and every one refuses rather
 * than falling back. `internal/rules/claude/593-landing-page.md` states why a
 * fallback is worse than a failed build.
 */

/** The path the depicted session edited, which is what decides the rules figure. */
export const EDITED_PATH = 'src/design/tokens.ts'

interface GovList {
  readonly stacks: readonly { name: string; rules: readonly string[] }[]
  readonly rules: readonly RuleMeta[]
}

interface Skill {
  readonly name: string
  readonly description: string
}

export interface SessionReads {
  readonly skills: readonly Skill[]
  readonly standards: number
  readonly commands: readonly string[]
  readonly toolingFiles: number
  readonly seedFiles: number
  readonly baseRules: number
  readonly rules: RuleMatchResult
  readonly roles: Readonly<Record<'planner' | 'worker', string>>
  readonly testFirst: string
  readonly mergeActions: readonly HookAction[]
  readonly version: string
}

/**
 * The rules this repository installs into its own sessions, which is the set
 * the depicted session actually loaded. Names come off the installed folder,
 * and what each carries comes off the catalog, so a rule installed here and
 * dropped from the catalog fails the build rather than rendering blank.
 */
function installedRules(
  root: string,
  catalog: readonly RuleMeta[],
): RuleMeta[] {
  const dir = join(root, '.claude', 'rules', 'canon')
  const names = readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith('.md'))
    .map((path) => basename(path, '.md'))
  if (names.length === 0) throw new Error(`${dir} holds no installed rule`)

  return names.map((name) => {
    const rule = catalog.find((entry) => entry.name === name)
    if (!rule) throw new Error(`Installed rule ${name} is not in the catalog`)
    return rule
  })
}

function readRole(skills: readonly Skill[], name: string): string {
  const skill = skills.find((entry) => entry.name === name)
  if (!skill) throw new Error(`The skill catalog carries no ${name}`)
  return firstSentence(skill.description)
}

function readRepoFile(root: string, path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

let cached: SessionReads | undefined

export function readSession(): SessionReads {
  if (cached) return cached
  const root = repoRoot()

  const counts = readCatalogCounts()
  const gov = readCanonJson<GovList>(['gov', 'list'])
  const { skills } = readCanonJson<{ skills: Skill[] }>([
    'claude',
    'skills',
    'list',
  ])
  const seeds = readCanonJson<unknown[]>(['claude', 'seeds', 'list'])
  const census = readCanonJson<{ files: number }>([
    'census',
    'tooling/base/configs',
  ])
  const base = gov.stacks.find((stack) => stack.name === 'base')
  if (!base) throw new Error('The governance catalog carries no base stack')

  // The memory figure states that the pen keeps only the residue. It is read
  // here so the page stops claiming it the moment the rule stops saying it.
  const memoryRule = readRepoFile(root, 'governance/rules/core/045-memory.md')
  if (!memoryRule.includes('no context entry owns')) {
    throw new Error(
      '045-memory no longer limits the memory folder to what no context entry owns',
    )
  }

  cached = {
    skills,
    standards: counts.standards,
    commands: commandNamesFromHelp(readCanonText(['--help'])),
    toolingFiles: census.files,
    seedFiles: seeds.length,
    baseRules: base.rules.length,
    rules: matchRules(installedRules(root, gov.rules), EDITED_PATH),
    roles: {
      planner: readRole(skills, 'role-planner'),
      worker: readRole(skills, 'role-worker'),
    },
    testFirst: ruleBullet(
      readRepoFile(root, 'governance/rules/core/070-planning.md'),
      'Write the test for a behavior',
    ),
    mergeActions: hookActions(
      readRepoFile(root, '.husky/post-merge'),
      merge.effects,
    ),
    version: readCanonText(['--version']).trim(),
  }
  return cached
}

/** The lit names in each field, checked against the catalog they sit in. */
export function usedNames(
  used: readonly string[],
  catalog: readonly string[],
  label: string,
): Set<string> {
  return new Set(requireListed(used, catalog, label))
}

/**
 * Whether the registry's latest matches the version this build carries. It
 * reports state rather than a count, so an unreachable registry reads as
 * unconfirmed rather than failing the build, and the dot says so.
 */
export async function isPublished(version: string): Promise<boolean> {
  try {
    const response = await fetch(
      'https://registry.npmjs.org/@erclx/canon/latest',
      { signal: AbortSignal.timeout(10_000) },
    )
    if (!response.ok) return false
    const latest = (await response.json()) as { version?: string }
    return latest.version === version
  } catch {
    return false
  }
}
