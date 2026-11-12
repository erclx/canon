import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Where a project adds to or trims the default list of painted paths. */
export const PAINTED_CONFIG_REL = join('canon', 'config', 'painted.json')

export interface PaintedPatterns {
  /** A path matching any of these is painted unless `unpainted` also matches. */
  readonly painted: readonly string[]
  readonly unpainted: readonly string[]
  /**
   * The project's own `painted` globs. A path matching one paints even inside
   * a default fixture folder, so a target serving a real page from one keeps
   * its capture gate. Test, story, and project exclusions still apply.
   */
  readonly repainted?: readonly string[]
  /**
   * Paths outside the painted set a reel reads, such as the engine that films
   * it and the lockfile pinning its browser. Declared, a reel carries to a
   * later head across any push changing neither a painted path nor one of
   * these. Absent, it carries only across inert pushes.
   */
  readonly reelInputs?: readonly string[]
}

const RENDERED_EXTENSIONS = [
  'tsx',
  'jsx',
  'vue',
  'svelte',
  'astro',
  'html',
  'css',
  'scss',
  'svg',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'avif',
  'ico',
  'woff',
  'woff2',
  'ttf',
  'otf',
]

/**
 * What a browser renders, minus the tests, stories, and fixtures beside it. A
 * test-only push touches nothing a reviewer drove, which is the case the
 * carry-forward exists for. A fixture is test input no app renders, the same
 * judgment `INCIDENTAL` in `src/pr/bijection.ts` makes, so only a whole
 * `fixtures`, `__fixtures__`, or `testdata` segment exempts a path.
 */
const FIXTURE_FOLDERS: readonly string[] = [
  '**/fixtures/**',
  '**/__fixtures__/**',
  '**/testdata/**',
]

export const DEFAULT_PAINTED: PaintedPatterns = {
  painted: [`**/*.{${RENDERED_EXTENSIONS.join(',')}}`],
  unpainted: [
    '**/*.{test,spec,stories}.*',
    '**/__tests__/**',
    '**/__snapshots__/**',
    ...FIXTURE_FOLDERS,
  ],
}

/**
 * A list holding anything but strings reads as undeclared rather than
 * filtered, since dropping an entry would let a reel carry past a change to
 * the path it named.
 */
function stringList(value: unknown): string[] | undefined {
  return Array.isArray(value) &&
    value.every((item): item is string => typeof item === 'string')
    ? value
    : undefined
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

/**
 * The default list plus the project's own, read from `canon/config/painted.json`
 * as `{ "painted": [...], "unpainted": [...], "reelInputs": [...] }`. A file
 * that is absent or does not parse leaves the default, since a typo there must
 * not make every push read as unpainted.
 */
export function loadPaintedPatterns(root: string): PaintedPatterns {
  const path = join(root, PAINTED_CONFIG_REL)
  if (!existsSync(path)) return DEFAULT_PAINTED

  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PAINTED
    const { painted, unpainted, reelInputs } = parsed as Record<string, unknown>
    const inputs = stringList(reelInputs)
    return {
      painted: [...DEFAULT_PAINTED.painted, ...strings(painted)],
      unpainted: [...DEFAULT_PAINTED.unpainted, ...strings(unpainted)],
      repainted: strings(painted),
      ...(inputs !== undefined && { reelInputs: inputs }),
    }
  } catch {
    return DEFAULT_PAINTED
  }
}

function matchesAny(path: string, globs: readonly string[]): boolean {
  return globs.some((glob) => new Bun.Glob(glob).match(path))
}

export function isPainted(path: string, patterns: PaintedPatterns): boolean {
  if (!matchesAny(path, patterns.painted)) return false
  const exclusions = matchesAny(path, patterns.repainted ?? [])
    ? patterns.unpainted.filter((glob) => !FIXTURE_FOLDERS.includes(glob))
    : patterns.unpainted
  return !matchesAny(path, exclusions)
}
