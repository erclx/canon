import { existsSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'
import { copyPreservingMode } from '@/sync/copy'

export interface RuleSource {
  readonly rule: string
  readonly src: string
  readonly subdir: string
}

export interface RuleLookup {
  readonly found: readonly RuleSource[]
  readonly missing: readonly string[]
}

export function rulesSourceDir(root: string): string {
  return join(root, 'governance', 'rules')
}

export function installedRulesDir(target: string): string {
  return join(target, '.claude', 'rules')
}

/** Toolkit-shipped stack rules, wrapped so their source reads from location. */
export function canonRulesDir(target: string): string {
  return join(installedRulesDir(target), 'canon')
}

/**
 * This repository's own toolkit-only rules, installed beside `canon/` rather
 * than interleaved into its folders. No target ever holds this folder.
 */
export function installedInternalRulesDir(target: string): string {
  return join(installedRulesDir(target), 'internal')
}

/**
 * Rule names a target already holds, read off the installed `canon/` tree by
 * basename rather than a recorded stack, since `--add` layers on rules no stack
 * lists. `successorOf` adds a renamed rule's new name so it is not named twice.
 */
export function installedRuleNames(
  target: string,
  successorOf?: (name: string) => string | undefined,
): Set<string> {
  const dir = canonRulesDir(target)
  const names = new Set<string>()
  if (!existsSync(dir)) return names

  for (const rel of new Bun.Glob('**/*.md').scanSync({
    cwd: dir,
    onlyFiles: true,
    dot: true,
  })) {
    const name = basename(rel, '.md')
    names.add(name)

    const successor = successorOf?.(name)
    if (successor !== undefined) names.add(successor)
  }

  return names
}

/**
 * A rule sitting directly under `governance/rules/` has no subdirectory and
 * installs flat.
 */
export function ruleSubdir(src: string, rulesRoot: string): string {
  const subdir = dirname(relative(rulesRoot, src))
  return subdir === '.' ? '' : subdir
}

/**
 * Lists every rule source path under `governance/rules/`, relative to it and
 * sorted, so a caller walking the tree and a caller resolving one name read the
 * same order.
 */
export function listRuleSourcePaths(root: string): string[] {
  const rulesRoot = rulesSourceDir(root)
  if (!existsSync(rulesRoot)) return []

  return [
    ...new Bun.Glob('**/*.md').scanSync({ cwd: rulesRoot, onlyFiles: true }),
  ].sort()
}

/**
 * Maps each rule name to its source file. First path wins, so a name appearing
 * in two subdirectories resolves deterministically rather than by whichever
 * entry the filesystem yielded first.
 */
export function indexRuleSources(root: string): Map<string, string> {
  const rulesRoot = rulesSourceDir(root)
  const byName = new Map<string, string>()

  for (const rel of listRuleSourcePaths(root)) {
    const name = rel.slice(rel.lastIndexOf('/') + 1, -'.md'.length)
    if (!byName.has(name)) byName.set(name, join(rulesRoot, rel))
  }

  return byName
}

/**
 * Finds each rule's source file by name across the `governance/rules/`
 * subfolders. A rule with no source is reported rather than dropped, matching
 * the `(source not found, skipping)` warning the bash printed.
 */
export function lookupRules(
  root: string,
  rules: readonly string[],
): RuleLookup {
  const rulesRoot = rulesSourceDir(root)
  const byName = indexRuleSources(root)

  const found: RuleSource[] = []
  const missing: string[] = []

  for (const rule of rules) {
    const src = byName.get(rule)
    if (src === undefined) {
      missing.push(rule)
      continue
    }
    found.push({ rule, src, subdir: ruleSubdir(src, rulesRoot) })
  }

  return { found, missing }
}

/**
 * Copies each rule into the subdirectory it was authored in and returns the
 * target-relative paths the timeline prints. `destSubdir` is `canon` for every
 * target-facing install and `internal` only for this repository's toolkit-only rules.
 */
export async function installRules(
  sources: readonly RuleSource[],
  target: string,
  destSubdir: 'canon' | 'internal' = 'canon',
): Promise<string[]> {
  const rulesDir =
    destSubdir === 'canon'
      ? canonRulesDir(target)
      : installedInternalRulesDir(target)
  const installed: string[] = []

  for (const source of sources) {
    const dest = join(rulesDir, source.subdir, `${source.rule}.md`)
    await copyPreservingMode(source.src, dest)
    installed.push(relative(target, dest))
  }

  return installed
}
