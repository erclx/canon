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
  /**
   * Config paths this stack still ships into a folder that skips it, read
   * from `[sync] per_root`. Each is a per-root entry point a subfolder needs
   * as much as the repository root does.
   */
  readonly perRoot?: readonly string[]
  /**
   * Set only on a stack kept in a chain that skips it. The stack then ships
   * these configs and nothing else: no seeds, scripts, dependencies, or
   * gitignore entries.
   */
  readonly onlyConfigs?: readonly string[]
  /**
   * The command that creates a fresh project for this stack, from `[stack]
   * scaffold`, with `{{name}}` standing for the project folder. Unset on a
   * layer stack, which scaffolds nothing of its own.
   */
  readonly scaffold?: string
  /** Post-scaffold setup `canon tooling verify` runs ahead of Sync. */
  readonly prepare?: string
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
  return new Set(chain.flatMap(configFiles))
}

/**
 * The config paths a manifest ships, narrowed to `onlyConfigs` on a stack the
 * chain skipped. `scan` and `injectConfigs` both read this, so the diff and
 * the write cannot disagree on what a skipped stack still carries.
 */
export function configFiles(manifest: Manifest): string[] {
  const files = listFiles(manifest.configsDir)
  const only = manifest.onlyConfigs
  return only === undefined ? files : files.filter((rel) => only.includes(rel))
}

/** The seed paths a manifest ships. A skipped stack ships none. */
export function seedFiles(manifest: Manifest): string[] {
  return manifest.onlyConfigs === undefined ? listFiles(manifest.seedsDir) : []
}

/** Whether the chain carries this stack whole rather than skipped. */
export function isWholeStack(manifest: Manifest): boolean {
  return manifest.onlyConfigs === undefined
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
 * Lists installable stack names, filtering the stacks in `EXCLUDED_STACKS`.
 * Claude is managed by `canon claude`, not `canon tooling`.
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
  const perRoot = readStrings(asTable(parsed.sync).per_root)
  const scaffold = readString(stackTable.scaffold)
  const prepare = readString(asTable(parsed.verify).prepare)
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
    ...(perRoot.length > 0 ? { perRoot } : {}),
    ...(scaffold !== undefined ? { scaffold } : {}),
    ...(prepare !== undefined ? { prepare } : {}),
  }
}

/**
 * Walks the `extends` chain once, self first. Callers that apply parent
 * values before child values reverse the result. Replaces the seventeen
 * copies of `grep '^extends' | cut -d'"' -f2` the bash carried.
 *
 * A stack matching `skipStack` drops from the chain along with every
 * ancestor past it, except that one declaring `[sync] per_root` stays as a
 * restricted manifest shipping those configs alone. A `--skip base` subfolder
 * keeps its own verify entry point that way, while husky, prettier, and the
 * rest stay single at the repository root.
 */
export function resolveChain(
  root: string,
  stack: string,
  options: ChainOptions = {},
): Manifest[] {
  const chain: Manifest[] = []
  const seen = new Set<string>()
  let current: string | undefined = stack
  let isSkipping = false

  while (current !== undefined) {
    if (current === options.skipStack) isSkipping = true
    if (seen.has(current)) break
    seen.add(current)

    const manifest: Manifest | undefined = loadManifest(root, current)
    if (!manifest) break

    if (!isSkipping) chain.push(manifest)
    else if (manifest.perRoot !== undefined) chain.push(restrict(manifest))
    current = manifest.parent
  }

  return chain
}

function restrict(manifest: Manifest): Manifest {
  return {
    ...manifest,
    onlyConfigs: manifest.perRoot,
    scripts: {},
    scriptOverrides: {},
    gitignore: [],
    devPackages: [],
  }
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
  return readStrings(asTable(asTable(dependencies).dev).packages)
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function readStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (entry): entry is string => typeof entry === 'string' && entry !== '',
  )
}
