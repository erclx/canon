import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { loadDetectEntries, staleDetectKeys } from '@/gov/detect'
import { listRuleSourcePaths, rulesSourceDir } from '@/gov/install'
import {
  expandStackEntry,
  listGovStacks,
  loadGovStack,
  unreferencedRules,
} from '@/gov/stacks'
import { parseFrontmatter, readField } from '@/indexes/frontmatter'

export interface StackEntry {
  readonly name: string
  readonly extends: string | null
  readonly rules: string[]
}

/** The evidence `governance/detect.toml` records for one opt-in rule. */
export interface RuleDetect {
  readonly deps: readonly string[]
  readonly files: readonly string[]
}

export interface RuleEntry {
  readonly name: string
  readonly domain: string
  readonly description: string
  readonly paths: string[] | null
  readonly detect: RuleDetect | null
}

export interface GovCatalog {
  readonly stacks: StackEntry[]
  readonly rules: RuleEntry[]
  readonly unreferenced: string[]
  /** `detect.toml` keys naming no live rule, which the gate fails on. */
  readonly staleDetect: string[]
}

/**
 * Reports each stack's own entries expanded, so a folder entry reaches a
 * consumer as the rules it stands for. the `setup` skill dedupes `--add` extras
 * against this list, and a stack answering `canon` there would re-add every
 * rule that folder already carries.
 *
 * The `extends` chain is deliberately not resolved, which is what the bash
 * did. The list shows what each stack contributes beside the parent it
 * inherits from, rather than repeating the ancestors under every descendant.
 */
export function buildStackEntries(root: string): StackEntry[] {
  const entries: StackEntry[] = []

  for (const name of listGovStacks(root)) {
    const stack = loadGovStack(root, name)
    if (!stack) continue

    const seen = new Set<string>()
    const rules: string[] = []

    for (const entry of stack.rules) {
      for (const rule of expandStackEntry(root, entry)) {
        if (seen.has(rule)) continue
        seen.add(rule)
        rules.push(rule)
      }
    }

    entries.push({ name, extends: stack.parent ?? null, rules })
  }

  return entries
}

/**
 * Reads the catalog straight off the source tree. A rule's domain is the
 * subdirectory it sits in, which is the band grouping install preserves, and
 * its `detect` entry is the evidence that proposes it, null for a rule
 * `detect.toml` does not name.
 */
export function buildRuleEntries(root: string): RuleEntry[] {
  const rulesRoot = rulesSourceDir(root)
  const detect = new Map(
    loadDetectEntries(root).map((entry) => [
      entry.rule,
      { deps: entry.deps, files: entry.files },
    ]),
  )

  return listRuleSourcePaths(root).map((rel) => {
    const frontmatter = parseFrontmatter(
      readFileSync(join(rulesRoot, rel), 'utf8'),
    )
    const paths = frontmatter?.fields.paths
    const name = basename(rel, '.md')

    return {
      name,
      domain: rel.includes('/') ? rel.slice(0, rel.indexOf('/')) : '',
      description: readField(frontmatter, 'description') ?? '',
      paths: Array.isArray(paths)
        ? paths.filter((entry): entry is string => typeof entry === 'string')
        : null,
      detect: detect.get(name) ?? null,
    }
  })
}

export function buildGovCatalog(root: string): GovCatalog {
  return {
    stacks: buildStackEntries(root),
    rules: buildRuleEntries(root),
    unreferenced: unreferencedRules(root),
    staleDetect: staleDetectKeys(root),
  }
}

export function describeStack(entry: StackEntry): string {
  const count = `${entry.rules.length} rules`
  return entry.extends === null
    ? `${entry.name} (${count})`
    : `${entry.name} (extends: ${entry.extends}, ${count})`
}

export function describeRule(entry: RuleEntry): string {
  return `${entry.name} [${entry.domain}] ${entry.description}`
}
