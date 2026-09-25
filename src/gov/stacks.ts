import { existsSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import {
  installedRuleNames,
  listRuleSourcePaths,
  lookupRules,
  type RuleSource,
  rulesSourceDir,
} from '@/gov/install'
import { successorResolver } from '@/gov/renames'

export interface GovStack {
  readonly name: string
  readonly parent?: string
  readonly rules: readonly string[]
}

export type RuleResolution =
  | { readonly ok: true; readonly rules: string[] }
  | { readonly ok: false; readonly missingStack: string }

function stacksDir(root: string): string {
  return join(root, 'governance', 'stacks')
}

export function govStackPath(root: string, stack: string): string {
  return join(stacksDir(root), `${stack}.toml`)
}

export function govStackExists(root: string, stack: string): boolean {
  return existsSync(govStackPath(root, stack))
}

/**
 * Lists stack names the way `find -name "*.toml" -exec basename {} .toml` did.
 */
export function listGovStacks(root: string): string[] {
  const dir = stacksDir(root)
  if (!existsSync(dir)) return []

  return [...new Bun.Glob('*.toml').scanSync({ cwd: dir, onlyFiles: true })]
    .map((entry) => entry.slice(0, -'.toml'.length))
    .sort()
}

/**
 * Reads one stack file. `Bun.TOML.parse` replaces a `BASH_REMATCH` loop that
 * consumed each rules line with `sed` as it walked, which is the hand-rolled
 * parser shape the tooling manifest already moved off.
 */
export function loadGovStack(
  root: string,
  stack: string,
): GovStack | undefined {
  const path = govStackPath(root, stack)
  if (!existsSync(path)) return undefined

  const parsed = Bun.TOML.parse(readFileSync(path, 'utf8')) as Record<
    string,
    unknown
  >
  const parent = typeof parsed.extends === 'string' ? parsed.extends : ''

  return {
    name: stack,
    parent: parent === '' ? undefined : parent,
    rules: Array.isArray(parsed.rules)
      ? parsed.rules.filter(
          (rule): rule is string => typeof rule === 'string' && rule !== '',
        )
      : [],
  }
}

/**
 * Expands one stack entry. An entry naming a directory under
 * `governance/rules/` resolves to every rule inside it, sorted, and any other
 * entry resolves to itself, so a folder and a slug reach the caller as one
 * shape rather than two the caller has to tell apart.
 *
 * The directory wins over a rule file of the same name. They cannot collide
 * while `standards/rule.md` requires a numeric prefix on a rule slug, since a
 * band folder carries none.
 */
export function expandStackEntry(root: string, entry: string): string[] {
  const dir = join(rulesSourceDir(root), entry)
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [entry]

  return [...new Bun.Glob('**/*.md').scanSync({ cwd: dir, onlyFiles: true })]
    .sort()
    .map((rel) => basename(rel, '.md'))
}

/**
 * Walks `extends` ancestors first, then the stack's own rules, deduped by
 * first appearance. Tooling's `resolveChain` returns full manifests nearest
 * first and carries `skipStack` truncation, so the two walks stay separate
 * rather than fitting one shape to both.
 *
 * Dedupe runs on expanded names rather than on the entries, so a stack naming
 * a folder and an ancestor naming a rule inside it yield that rule once.
 */
export function resolveRules(root: string, stack: string): RuleResolution {
  const rules: string[] = []
  const seen = new Set<string>()
  const visited = new Set<string>()

  const walk = (current: string): string | undefined => {
    if (visited.has(current)) return undefined
    visited.add(current)

    const loaded = loadGovStack(root, current)
    if (!loaded) return current

    if (loaded.parent !== undefined) {
      const missing = walk(loaded.parent)
      if (missing !== undefined) return missing
    }

    for (const entry of loaded.rules) {
      for (const rule of expandStackEntry(root, entry)) {
        if (seen.has(rule)) continue
        seen.add(rule)
        rules.push(rule)
      }
    }

    return undefined
  }

  const missingStack = walk(stack)
  if (missingStack !== undefined) return { ok: false, missingStack }

  return { ok: true, rules }
}

/**
 * Names every rule no stack reaches, sorted. A rule outside every stack still
 * installs through `--add`, so this reports an opt-in library and an oversight
 * alike and leaves telling them apart to the reader.
 *
 * A stack whose `extends` does not resolve contributes nothing rather than
 * aborting the sweep, or one broken stack would report the whole catalog as
 * unreferenced.
 */
export function unreferencedRules(root: string): string[] {
  const reached = new Set<string>()

  for (const stack of listGovStacks(root)) {
    const resolution = resolveRules(root, stack)
    if (!resolution.ok) continue
    for (const rule of resolution.rules) reached.add(rule)
  }

  return listRuleSourcePaths(root)
    .map((rel) => basename(rel, '.md'))
    .filter((rule) => !reached.has(rule))
    .sort()
}

/**
 * Rules the target's recorded chain entitles it to that its installed tree
 * does not hold. `resolveRules` already walks a stack's `extends` ancestors,
 * so reading its leaf entry is enough; no second walk resolves the chain
 * itself. A stack the toolkit no longer ships resolves to nothing rather than
 * throwing, the same way `readNewRules`'s band fallback already treats it.
 *
 * A held rule's declared successor counts as held, since the sync that
 * renames the old file installs it.
 */
export function resolveMissingRules(
  root: string,
  target: string,
  chain: readonly string[],
): readonly RuleSource[] {
  const stack = chain[0]
  if (stack === undefined) return []

  const resolution = resolveRules(root, stack)
  if (!resolution.ok) return []

  const { found } = lookupRules(root, resolution.rules)
  const held = installedRuleNames(target, successorResolver(root))

  return found
    .filter((source) => !held.has(source.rule))
    .sort((left, right) => left.rule.localeCompare(right.rule))
}

/**
 * Layers `--add` names on top of a resolved stack. The bash trimmed a single
 * leading and trailing space per entry; trimming fully is the same result for
 * every input that parsed before.
 */
export function mergeExtraRules(
  rules: readonly string[],
  add: string,
): string[] {
  const merged = [...rules]

  for (const raw of add.split(',')) {
    const extra = raw.trim()
    if (extra === '') continue
    if (merged.includes(extra)) continue
    merged.push(extra)
  }

  return merged
}
