import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const EXCLUDED_STACKS = ['claude']

export interface GitignoreSection {
  readonly header: string
  readonly entries: readonly string[]
}

export interface Manifest {
  readonly name: string
  readonly parent?: string
  readonly dir: string
  readonly configsDir: string
  readonly seedsDir: string
  readonly scripts: Readonly<Record<string, string>>
  readonly scriptOverrides: Readonly<Record<string, string>>
  readonly gitignore: readonly GitignoreSection[]
  readonly devPackages: readonly string[]
}

export interface ChainOptions {
  readonly skipStack?: string
}

function toolingDir(root: string): string {
  return join(root, 'tooling')
}

function manifestPath(root: string, stack: string): string {
  return join(toolingDir(root), stack, 'manifest.toml')
}

/**
 * Lists every file under a directory, dotfiles included. Bun.Glob skips
 * entries beginning with a dot unless `dot` is set, and tooling configs are
 * almost entirely dotfiles, so omitting it silently matches nothing.
 */
export function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return [
    ...new Bun.Glob('**/*').scanSync({ cwd: dir, onlyFiles: true, dot: true }),
  ].sort()
}

/**
 * Every path any stack in the chain ships as a config. A seed at one of these
 * paths is shadowed, since the config overwrites it on every sync. `scan` and
 * `injectSeeds` both read this, so the report and the write cannot disagree.
 */
export function configPaths(chain: readonly Manifest[]): Set<string> {
  return new Set(chain.flatMap((manifest) => listFiles(manifest.configsDir)))
}

/**
 * Reverses a chain so the furthest ancestor is applied first and nearer
 * stacks overwrite it.
 */
export function ancestorsFirst(chain: readonly Manifest[]): Manifest[] {
  return [...chain].reverse()
}

export function stackExists(root: string, stack: string): boolean {
  return existsSync(join(toolingDir(root), stack))
}

export function isStackExcluded(stack: string): boolean {
  return EXCLUDED_STACKS.includes(stack)
}

/**
 * Lists installable stack names, filtering the `claude` stack the way
 * `is_tooling_stack_excluded` in `scripts/lib/tooling.sh` did. Claude is
 * managed by `canon claude`, not `canon tooling`.
 */
export function listStacks(root: string): string[] {
  const dir = toolingDir(root)
  if (!existsSync(dir)) return []

  return [...new Bun.Glob('*/manifest.toml').scanSync({ cwd: dir })]
    .map((entry) => entry.split('/')[0])
    .filter((name) => !isStackExcluded(name))
    .sort()
}

/**
 * Reads one manifest into a typed shape. Returns undefined when the file is
 * absent, matching the bash guards that silently skipped a missing manifest.
 */
export function loadManifest(
  root: string,
  stack: string,
): Manifest | undefined {
  const path = manifestPath(root, stack)
  if (!existsSync(path)) return undefined

  const parsed = asTable(Bun.TOML.parse(readFileSync(path, 'utf8')))
  const stackTable = asTable(parsed.stack)
  const parent =
    typeof stackTable.extends === 'string' ? stackTable.extends : ''
  const scriptsTable = asTable(parsed.scripts)
  const dir = join(toolingDir(root), stack)

  return {
    name: stack,
    parent: parent === '' ? undefined : parent,
    dir,
    configsDir: join(dir, 'configs'),
    seedsDir: join(dir, 'seeds'),
    scripts: pickStrings(scriptsTable),
    scriptOverrides: pickStrings(asTable(scriptsTable.override)),
    gitignore: readGitignoreSections(asTable(parsed.gitignore)),
    devPackages: readDevPackages(parsed.dependencies),
  }
}

/**
 * Walks the `extends` chain once, self first. Callers that apply parent
 * values before child values reverse the result. Replaces the seventeen
 * copies of `grep '^extends' | cut -d'"' -f2` the bash carried.
 *
 * A stack matching `skipStack` truncates the chain at that point, mirroring
 * the `[ "$stack" = "${SKIP_STACK:-}" ] && return` guard.
 */
export function resolveChain(
  root: string,
  stack: string,
  options: ChainOptions = {},
): Manifest[] {
  const chain: Manifest[] = []
  const seen = new Set<string>()
  let current: string | undefined = stack

  while (current !== undefined) {
    if (current === options.skipStack) break
    if (seen.has(current)) break
    seen.add(current)

    const manifest: Manifest | undefined = loadManifest(root, current)
    if (!manifest) break

    chain.push(manifest)
    current = manifest.parent
  }

  return chain
}

function asTable(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }
  return value as Record<string, unknown>
}

function pickStrings(table: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(table)) {
    if (typeof value === 'string') result[key] = value
  }
  return result
}

function readGitignoreSections(
  table: Record<string, unknown>,
): GitignoreSection[] {
  const sections: GitignoreSection[] = []
  for (const [header, value] of Object.entries(table)) {
    if (!Array.isArray(value)) continue
    const entries = value.filter(
      (entry): entry is string => typeof entry === 'string' && entry !== '',
    )
    sections.push({ header, entries })
  }
  return sections
}

function readDevPackages(dependencies: unknown): string[] {
  const dev = asTable(asTable(dependencies).dev)
  if (!Array.isArray(dev.packages)) return []
  return dev.packages.filter(
    (entry): entry is string => typeof entry === 'string' && entry !== '',
  )
}
