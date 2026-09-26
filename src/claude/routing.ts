import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const CLAUDE_MD = 'CLAUDE.md'
const RULES_DIR = join('.claude', 'rules')

/** A backticked token, which is how the always-loaded file spells a path. */
const TOKEN = /`([^`\s]+)`/g

/**
 * A path a reader could open. Admits no `$`, `*`, or `=`, so an assignment
 * (`CANON_NON_INTERACTIVE=1`) and a variable are both excluded.
 */
const PATH_TOKEN = /^[.A-Za-z0-9_][A-Za-z0-9._/-]*$/

/** A placeholder segment, which a shape carries and a real path does not. */
const SHAPE = /<[^>]*>/

/** An alphabetic extension, which separates `cspell.json` from `3.6.0`. */
const EXTENSION = /\.[a-z]{2,5}$/

/** Extensions a folder is probed with, so a glob narrowed by type still hits. */
const PROBES = ['probe.md', 'probe.ts', 'probe.tsx', 'probe.sh', 'probe.json']

export interface RuleGlobs {
  /** Path under `.claude/rules/`, which is how a reader cites a rule. */
  readonly rule: string
  readonly globs: readonly string[]
}

export interface Section {
  /** `Behavior` for an H2, `Behavior / Scope` for the H3 beneath it. */
  readonly heading: string
  /** The top-level bullet lines the heading owns, in reading order. */
  readonly lines: readonly string[]
}

export interface SectionReport {
  readonly heading: string
  readonly bullets: number
  /** Bullets naming at least one path, which is the reading this measures. */
  readonly pathScoped: number
  /** Path-scoped bullets whose named path some rule glob already reaches. */
  readonly covered: number
  /** Distinct named paths no rule glob reaches, in reading order. */
  readonly uncovered: readonly string[]
}

/** Why a scan produced no reading, which is never the same as a clean one. */
export type RoutingRefusal = 'no-claude-md' | 'no-rules'

export type RoutingReport =
  | {
      readonly kind: 'measured'
      readonly rules: number
      readonly sections: readonly SectionReport[]
    }
  | { readonly kind: 'refused'; readonly reason: RoutingRefusal }

/**
 * Every distinct path one bullet names, in reading order.
 *
 * Naming a path is what this measures, not firing only on it. A bullet can
 * name a folder and still apply every session, and one can fire on a path it
 * never spells, so the count is a reading a person still has to judge.
 */
export function namedPaths(line: string): string[] {
  const paths: string[] = []

  for (const match of line.matchAll(TOKEN)) {
    const token = concretePrefix(match[1])
    if (token === undefined) continue
    if (!PATH_TOKEN.test(token)) continue
    if (!token.includes('/') && !EXTENSION.test(token)) continue
    if (!paths.includes(token)) paths.push(token)
  }

  return paths
}

/**
 * The openable part of a token, which for a shape is the folder above the
 * placeholder.
 *
 * `canon/context/<domain>.md` names `canon/context/` and nothing narrower,
 * so dropping the whole token would report the section that carries it as
 * naming no path at all. A token whose placeholder sits in the first segment
 * has no openable prefix and is dropped.
 */
function concretePrefix(token: string): string | undefined {
  if (!SHAPE.test(token)) return token

  const prefix = token.slice(0, token.indexOf('<'))
  return prefix.endsWith('/') ? prefix : undefined
}

/**
 * Splits the file into the sections a reader sees, counting top-level bullets.
 *
 * A nested bullet belongs to the one above it rather than to the section, and
 * a fenced block holds example text rather than instruction, so neither is
 * counted. A heading carrying no bullet is dropped, since the report answers
 * how many bullets are path-scoped and a section with none answers nothing.
 */
export function splitSections(text: string): Section[] {
  const sections: Section[] = []
  let parent = ''
  let heading: string | undefined
  let lines: string[] = []
  let fenced = false

  const flush = (): void => {
    if (heading !== undefined && lines.length > 0)
      sections.push({ heading, lines })
  }

  const open = (next: string): void => {
    flush()
    heading = next
    lines = []
  }

  for (const line of text.split('\n')) {
    if (line.startsWith('```')) {
      fenced = !fenced
      continue
    }
    if (fenced) continue

    const h2 = line.match(/^## (.+)$/)
    if (h2) {
      parent = h2[1]
      open(parent)
      continue
    }

    const h3 = line.match(/^### (.+)$/)
    if (h3) {
      open(parent === '' ? h3[1] : `${parent} / ${h3[1]}`)
      continue
    }

    if (line.startsWith('- ')) lines.push(line)
  }

  flush()
  return sections
}

/**
 * Every path-scoped rule the tree installs, with the globs it declares.
 *
 * An always-on rule declares no `paths` and applies at the same priority as
 * the always-loaded file, so it covers no path in particular and is skipped.
 */
export function readRuleGlobs(root: string): RuleGlobs[] {
  const rulesRoot = join(root, RULES_DIR)
  if (!existsSync(rulesRoot)) return []

  const rules: RuleGlobs[] = []
  const files = [
    ...new Bun.Glob('**/*.md').scanSync({ cwd: rulesRoot, onlyFiles: true }),
  ].sort()

  for (const file of files) {
    const text = readFileSync(join(rulesRoot, file), 'utf8')
    const globs = [...frontmatter(text).matchAll(/^\s*-\s*'([^']+)'\s*$/gm)]
      .map((match) => match[1])
      .filter((glob) => glob.includes('*') || glob.includes('.'))

    if (globs.length === 0) continue
    rules.push({ rule: file.replaceAll('\\', '/'), globs })
  }

  return rules
}

/**
 * The block between the opening and closing `---`, or nothing for a rule
 * carrying no frontmatter.
 *
 * Bounding the read is what keeps a body bullet out of the glob list. A rule
 * quoting a path in prose would otherwise register it as a scope the rule
 * never declared, and the resulting coverage would be wrong with nothing
 * reporting it.
 */
function frontmatter(text: string): string {
  if (!text.startsWith('---\n')) return ''

  const end = text.indexOf('\n---', 3)
  return end === -1 ? '' : text.slice(4, end)
}

/**
 * Whether a glob scopes itself to a location rather than to a file type.
 *
 * A glob opening `**` reaches every folder in the tree, so it answers that a
 * file type is governed and never that a named path is. Counting one would
 * report every markdown path covered by `801-markdown` and leave the column
 * saying nothing a reader could act on.
 */
function isAnchored(glob: string): boolean {
  return !glob.startsWith('**/')
}

/**
 * The first rule scoping itself to a named path, or undefined for none.
 *
 * A folder is probed with a handful of extensions rather than matched as a
 * literal, because a glob narrowed by file type reaches under the folder
 * without ever matching the folder's own name.
 */
export function coveringRule(
  path: string,
  rules: readonly RuleGlobs[],
): string | undefined {
  const bare = path.replace(/\/+$/, '')
  const candidates = [bare, ...PROBES.map((probe) => `${bare}/${probe}`)]

  for (const { rule, globs } of rules) {
    for (const glob of globs) {
      if (!isAnchored(glob)) continue
      const matcher = new Bun.Glob(glob)
      if (candidates.some((candidate) => matcher.match(candidate))) return rule
    }
  }

  return undefined
}

/**
 * Reads the always-loaded file against the rules installed beside it.
 *
 * Measures the tree it is pointed at rather than the toolkit root, so a linked
 * worktree reads its own branch and a target reads its own file.
 */
export function scanRouting(root: string): RoutingReport {
  const file = join(root, CLAUDE_MD)
  if (!existsSync(file)) return { kind: 'refused', reason: 'no-claude-md' }

  const rules = readRuleGlobs(root)
  if (rules.length === 0) return { kind: 'refused', reason: 'no-rules' }

  const sections = splitSections(readFileSync(file, 'utf8')).map((section) =>
    classify(section, rules),
  )

  return { kind: 'measured', rules: rules.length, sections }
}

/** Counts one section's bullets against the rules installed beside the file. */
function classify(
  section: Section,
  rules: readonly RuleGlobs[],
): SectionReport {
  let pathScoped = 0
  let covered = 0
  const uncovered: string[] = []

  for (const line of section.lines) {
    const paths = namedPaths(line)
    if (paths.length === 0) continue
    pathScoped += 1

    const reached = paths.filter(
      (path) => coveringRule(path, rules) !== undefined,
    )
    if (reached.length > 0) covered += 1

    for (const path of paths) {
      if (reached.includes(path) || uncovered.includes(path)) continue
      uncovered.push(path)
    }
  }

  return {
    heading: section.heading,
    bullets: section.lines.length,
    pathScoped,
    covered,
    uncovered,
  }
}
