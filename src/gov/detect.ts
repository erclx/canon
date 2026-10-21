import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { listRepositoryFiles } from '@/git/files'
import { indexRuleSources } from '@/gov/install'
import { resolveRules } from '@/gov/stacks'

/** One table of `governance/detect.toml`. */
export interface DetectEntry {
  readonly rule: string
  readonly deps: readonly string[]
  readonly files: readonly string[]
}

/**
 * What matched for one proposal. `path` is the manifest a dependency was read
 * from, or the path a file glob matched, so a reader can open the evidence.
 */
export interface Evidence {
  readonly kind: 'dep' | 'file'
  readonly match: string
  readonly path: string
}

export interface Proposal {
  readonly rule: string
  readonly evidence: readonly Evidence[]
}

export type DetectResult =
  | { readonly ok: true; readonly proposals: readonly Proposal[] }
  | { readonly ok: false; readonly missingStack: string }

/** How deep detection reads, matching `target-setup`'s marker walk. */
const MAX_DIRS = 2

/** Trees an outside-git walk skips, since each carries manifests of its own. */
const SKIPPED_DIRS = new Set(['.git', 'node_modules', 'vendor', '.venv'])

export function detectFilePath(root: string): string {
  return join(root, 'governance', 'detect.toml')
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

/** Reads every table in file order. An absent file reads as no entries. */
export function loadDetectEntries(root: string): DetectEntry[] {
  const path = detectFilePath(root)
  if (!existsSync(path)) return []

  const parsed = Bun.TOML.parse(readFileSync(path, 'utf8')) as Record<
    string,
    unknown
  >

  return Object.entries(parsed).flatMap(([rule, table]) => {
    if (typeof table !== 'object' || table === null) return []
    const fields = table as Record<string, unknown>
    return [
      { rule, deps: stringList(fields.deps), files: stringList(fields.files) },
    ]
  })
}

/** Keys naming no rule under `governance/rules/`, sorted. */
export function staleDetectKeys(root: string): string[] {
  const live = indexRuleSources(root)
  return loadDetectEntries(root)
    .map((entry) => entry.rule)
    .filter((rule) => !live.has(rule))
    .sort()
}

function depth(path: string): number {
  return path.split('/').length - 1
}

/** Files to depth two when the target is not a git checkout. */
function walkFiles(target: string): string[] {
  const files: string[] = []

  const visit = (rel: string): void => {
    const abs = rel === '' ? target : join(target, rel)
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const child = rel === '' ? entry.name : `${rel}/${entry.name}`
      if (entry.isDirectory()) {
        if (SKIPPED_DIRS.has(entry.name)) continue
        if (depth(child) < MAX_DIRS + 1) visit(child)
      } else if (entry.isFile()) {
        files.push(child)
      }
    }
  }

  visit('')
  return files.sort()
}

interface Candidates {
  readonly paths: readonly string[]
  readonly folders: readonly string[]
}

/**
 * The paths a file glob is matched against: every file to depth two, plus
 * every folder on the way to any listed file, so an evidence folder such as
 * `.github/workflows` matches without naming the file inside it. `folders`
 * holds the folders alone, which a pattern ending in `/` is matched against.
 */
async function candidatePaths(target: string): Promise<Candidates> {
  const listed = (await listRepositoryFiles(target)) ?? walkFiles(target)
  const paths = new Set<string>()
  const folders = new Set<string>()

  for (const file of listed) {
    let dir = dirname(file)
    while (dir !== '.') {
      if (depth(dir) <= MAX_DIRS) {
        paths.add(dir)
        folders.add(dir)
      }
      dir = dirname(dir)
    }
    if (depth(file) <= MAX_DIRS) paths.add(file)
  }

  return { paths: [...paths].sort(), folders: [...folders].sort() }
}

/** A PEP 508 requirement's distribution name, normalized per PEP 503. */
function pythonName(requirement: string): string {
  const name = requirement.trim().split(/[\s<>=!~;[(@,]/)[0] ?? ''
  return name.toLowerCase().replace(/[_.]+/g, '-')
}

function objectKeys(value: unknown): string[] {
  return typeof value === 'object' && value !== null ? Object.keys(value) : []
}

function packageJsonDeps(text: string): string[] {
  const parsed = JSON.parse(text) as Record<string, unknown>
  return [
    ...objectKeys(parsed.dependencies),
    ...objectKeys(parsed.devDependencies),
  ]
}

function composerDeps(text: string): string[] {
  const parsed = JSON.parse(text) as Record<string, unknown>
  return [...objectKeys(parsed.require), ...objectKeys(parsed['require-dev'])]
}

function pyprojectDeps(text: string): string[] {
  const parsed = Bun.TOML.parse(text) as Record<string, unknown>
  const project = (parsed.project ?? {}) as Record<string, unknown>
  const requirements = [
    ...stringList(project.dependencies),
    ...Object.values(
      (project['optional-dependencies'] ?? {}) as Record<string, unknown>,
    ).flatMap(stringList),
    ...Object.values(
      (parsed['dependency-groups'] ?? {}) as Record<string, unknown>,
    ).flatMap(stringList),
  ]

  const poetry = ((parsed.tool ?? {}) as Record<string, unknown>).poetry as
    | Record<string, unknown>
    | undefined
  const groups = (poetry?.group ?? {}) as Record<string, unknown>
  const poetryNames = [
    ...objectKeys(poetry?.dependencies),
    ...objectKeys(poetry?.['dev-dependencies']),
    ...Object.values(groups).flatMap((group) =>
      objectKeys((group as Record<string, unknown>)?.dependencies),
    ),
  ]

  return [...requirements, ...poetryNames].map(pythonName)
}

function goModDeps(text: string): string[] {
  const names: string[] = []
  let inBlock = false

  for (const raw of text.split('\n')) {
    const line = raw.replace(/\/\/.*$/, '').trim()
    if (inBlock) {
      if (line === ')') inBlock = false
      else if (line !== '') names.push(line.split(/\s+/)[0] ?? '')
    } else if (/^require\s*\($/.test(line)) {
      inBlock = true
    } else if (line.startsWith('require ')) {
      names.push(line.split(/\s+/)[1] ?? '')
    }
  }

  return names.filter(Boolean)
}

/** Python names are normalized on read, so `detect.toml` lists them lowercase. */
const READERS: Readonly<Record<string, (text: string) => string[]>> = {
  'package.json': packageJsonDeps,
  'composer.json': composerDeps,
  'pyproject.toml': pyprojectDeps,
  'go.mod': goModDeps,
}

/**
 * Every dependency name a manifest to depth two declares, mapped to the
 * manifests declaring it. A manifest that does not parse contributes nothing
 * rather than failing the run, since one broken fixture folder should not cost
 * a project every other proposal.
 */
function readDependencies(
  target: string,
  paths: readonly string[],
): Map<string, string[]> {
  const deps = new Map<string, string[]>()

  for (const path of paths) {
    const reader = READERS[basename(path)]
    if (reader === undefined) continue

    let declared: string[]
    try {
      declared = reader(readFileSync(join(target, path), 'utf8'))
    } catch {
      continue
    }

    for (const dep of declared) {
      const holders = deps.get(dep) ?? []
      if (!holders.includes(path)) holders.push(path)
      deps.set(dep, holders)
    }
  }

  return deps
}

/** A pattern ending in `/` matches folders only, so a file at that depth misses. */
function isFolderPattern(pattern: string): boolean {
  return pattern.endsWith('/')
}

/** A glob carrying no wildcard names one path rather than a pattern. */
function isLiteral(pattern: string): boolean {
  return !/[*?[\]{}]/.test(pattern)
}

/**
 * A literal pattern is also tested on disk, since evidence such as
 * `.canon/canvas` sits in a folder a target's own `.gitignore` excludes, and
 * the git listing never carries it.
 */
function matchEntry(
  entry: DetectEntry,
  target: string,
  deps: ReadonlyMap<string, readonly string[]>,
  candidates: Candidates,
): Evidence[] {
  const evidence: Evidence[] = []

  for (const dep of entry.deps) {
    const holders = deps.get(dep) ?? []
    for (const path of holders) evidence.push({ kind: 'dep', match: dep, path })
  }

  for (const pattern of entry.files) {
    const folderOnly = isFolderPattern(pattern)
    const glob = new Bun.Glob(folderOnly ? pattern.slice(0, -1) : pattern)
    const hit =
      (folderOnly ? candidates.folders : candidates.paths).find((path) =>
        glob.match(path),
      ) ??
      (isLiteral(pattern) && existsSync(join(target, pattern))
        ? pattern
        : undefined)
    if (hit !== undefined)
      evidence.push({ kind: 'file', match: pattern, path: hit })
  }

  return evidence
}

/**
 * Proposes each opt-in rule whose evidence the target holds. A rule `stack`
 * already resolves is left out, since proposing it would install nothing, and
 * a key naming no live rule is skipped rather than proposed, which the
 * `unreferenced-rules` gate stage reports on the toolkit side.
 */
export async function detectRules(
  root: string,
  target: string,
  stack?: string,
): Promise<DetectResult> {
  let covered = new Set<string>()
  if (stack !== undefined) {
    const resolution = resolveRules(root, stack)
    if (!resolution.ok) return resolution
    covered = new Set(resolution.rules)
  }

  const live = indexRuleSources(root)
  const candidates = await candidatePaths(target)
  const deps = readDependencies(target, candidates.paths)

  const proposals = loadDetectEntries(root)
    .filter((entry) => live.has(entry.rule) && !covered.has(entry.rule))
    .flatMap((entry) => {
      const evidence = matchEntry(entry, target, deps, candidates)
      return evidence.length === 0 ? [] : [{ rule: entry.rule, evidence }]
    })

  return { ok: true, proposals }
}
