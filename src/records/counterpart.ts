import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * What a plan's counterpart check reads off the project beside the plan text.
 * Root config is a file on disk rather than a text pattern, since a dotfile
 * pattern read off text alone fired on extension spans such as `.ts`.
 */
export interface CounterpartRoot {
  readonly rootFiles: ReadonlySet<string>
}

export interface CounterpartFinding {
  readonly kind: 'counterpart-unstated' | 'counterpart-malformed'
  readonly subject: string
  readonly message: string
}

/**
 * The canon CI, hook, script, and seeded stack prefixes. A stack's
 * `manifest.toml` and `reference.md` sit outside `configs/` and `seeds/`, so
 * they have no seeded copy and stay out.
 */
const COUNTERPART_PREFIX = [
  /^\.github(?:\/|$)/,
  /^\.husky(?:\/|$)/,
  /^\.claude\/hooks(?:\/|$)/,
  /^scripts(?:\/|$)/,
  /^tooling\/[^/]+\/(?:configs|seeds)(?:\/|$)/,
]

/** Root files with no seeded counterpart: prose, the license, and lockfiles. */
const ROOT_EXEMPT = [
  /\.md$/i,
  /^LICENSE(?:\..+)?$/i,
  /^(?:bun\.lockb?|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|uv\.lock|go\.sum)$/,
]

/**
 * Reads the root's top-level files, or nothing in a project keeping no stack
 * under `tooling/`. Such a project seeds nothing, so it has no second side for
 * a plan to state.
 */
export async function readCounterpartRoot(
  root: string,
): Promise<CounterpartRoot | undefined> {
  const tooling = join(root, 'tooling')
  if (!existsSync(tooling)) return undefined

  const stacks = await readdir(tooling, { withFileTypes: true })
  const keepsStacks = stacks.some(
    (entry) =>
      entry.isDirectory() &&
      existsSync(join(tooling, entry.name, 'manifest.toml')),
  )
  if (!keepsStacks) return undefined

  const entries = await readdir(root, { withFileTypes: true })
  const rootFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => !ROOT_EXEMPT.some((pattern) => pattern.test(name)))

  return { rootFiles: new Set(rootFiles) }
}

function normalize(span: string): string {
  return span.trim().replace(/^\.\//, '')
}

function spans(text: string): string[] {
  return [...text.matchAll(/`([^`]+)`/g)].map((match) => normalize(match[1]))
}

function isCounterpartPath(path: string, context: CounterpartRoot): boolean {
  return (
    context.rootFiles.has(path) ||
    COUNTERPART_PREFIX.some((pattern) => pattern.test(path))
  )
}

/**
 * Every counterpart-class path a plan's `Files to touch` names, in first-seen
 * order. Every backticked span counts, a path cited in an entry's reason half
 * included, since a cited path is as often the other side as an unrelated one.
 */
export function counterpartPaths(
  entries: readonly string[],
  context: CounterpartRoot,
): string[] {
  const found = new Set<string>()

  for (const line of entries) {
    for (const path of spans(line)) {
      if (isCounterpartPath(path, context)) found.add(path)
    }
  }

  return [...found]
}

/**
 * Joins a wrapped line or a nested bullet onto the bullet above it, so a
 * reason may wrap and still read as one entry.
 */
function readBullets(lines: readonly string[]): string[] {
  const bullets: string[] = []
  let depth: number | undefined

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '') continue

    const indent = line.length - line.trimStart().length
    if (trimmed.startsWith('- ') && (depth === undefined || indent <= depth)) {
      depth = indent
      bullets.push(trimmed)
      continue
    }

    if (bullets.length > 0) bullets[bullets.length - 1] += ` ${trimmed}`
  }

  return bullets
}

interface Bullet {
  readonly text: string
  readonly paths: readonly string[]
  readonly verdict: string | undefined
}

/**
 * Splits a bullet at the first colon outside a code span. The paths are the
 * spans before it, and the verdict is the prose after it.
 */
function parseBullet(text: string): Bullet {
  const body = text.replace(/^-[ \t]*/, '')
  let inSpan = false

  for (let at = 0; at < body.length; at++) {
    if (body[at] === '`') inSpan = !inSpan
    if (body[at] === ':' && !inSpan) {
      return {
        text,
        paths: spans(body.slice(0, at)),
        verdict: body.slice(at + 1).trim(),
      }
    }
  }

  return { text, paths: spans(body), verdict: undefined }
}

const VERDICTS = [
  /^here\b/i,
  /^none\b[\s,;:]+[A-Za-z0-9]/i,
  /^filed\b.*`[^`]+`/i,
] as const

function wellFormed(bullet: Bullet): boolean {
  if (bullet.paths.length === 0 || bullet.verdict === undefined) return false
  const verdict = bullet.verdict
  return VERDICTS.some((pattern) => pattern.test(verdict))
}

function covers(stated: string, path: string): boolean {
  const base = stated.replace(/\/+$/, '')
  return path === base || path.startsWith(`${base}/`)
}

function shorten(label: string): string {
  return label.length > 60 ? `${label.slice(0, 57)}...` : label
}

/**
 * Reports each counterpart-class path no `## Counterparts` bullet covers, and
 * each bullet whose verdict is not `here`, `none` with a reason, or `filed`
 * with a backticked stem. A malformed bullet still covers its paths, so one
 * fault reports once.
 */
export function checkCounterparts(
  filesToTouch: readonly string[],
  section: readonly string[] | undefined,
  context: CounterpartRoot,
): CounterpartFinding[] {
  const paths = counterpartPaths(filesToTouch, context)
  if (paths.length === 0) return []

  const bullets = readBullets(section ?? []).map(parseBullet)
  const findings: CounterpartFinding[] = []

  for (const bullet of bullets) {
    if (wellFormed(bullet)) continue
    findings.push({
      kind: 'counterpart-malformed',
      subject: shorten(bullet.text),
      message:
        'states no path before a colon, or no verdict of here, none with a reason, or filed with a backticked row stem.',
    })
  }

  for (const path of paths) {
    const stated = bullets.some((bullet) =>
      bullet.paths.some((one) => covers(one, path)),
    )
    if (stated) continue
    findings.push({
      kind: 'counterpart-unstated',
      subject: path,
      message:
        'is a canon CI, hook, script, root config, or stack configs or seeds path, and no ## Counterparts bullet states what happens to the other side.',
    })
  }

  return findings
}
