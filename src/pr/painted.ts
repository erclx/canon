import { readAppTable } from '@/config/app'

export interface PaintedPatterns {
  /** A path matching any of these is painted unless `unpainted` also matches. */
  readonly painted: readonly string[]
  readonly unpainted: readonly string[]
  /**
   * The project's own `paths` globs under `[painted]`. A path matching one paints even inside
   * a default fixture folder, so a target serving a real page from one keeps
   * its capture gate. Test, story, and project exclusions still apply.
   */
  readonly repainted?: readonly string[]
  /**
   * Paths outside the painted set a reel reads, such as the filming engine and
   * the lockfile pinning its browser. Declared, a reel carries to a later head
   * across a push changing none of them; absent, only across inert pushes.
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
 * What a browser renders, minus the tests, stories, and fixtures beside it, so a
 * test-only push touches nothing a reviewer drove. A fixture is test input no app
 * renders, as `INCIDENTAL` in `src/pr/bijection.ts` judges; whole segments only.
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
 * The default list plus the project's own, read from the `[painted]` table of
 * `canon/config/app.toml` as `paths`, `exclude`, and `reel-inputs`, or from
 * `painted.json` before it. A table that is absent or does not parse leaves the
 * default, since a typo must not make every push unpainted.
 */
export function loadPaintedPatterns(root: string): PaintedPatterns {
  const read = readAppTable(root, 'painted')
  if (read.kind !== 'table') return DEFAULT_PAINTED
  const parsed = read.value
  if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PAINTED
  const {
    paths,
    exclude,
    'reel-inputs': reelInputs,
  } = parsed as Record<string, unknown>
  const inputs = stringList(reelInputs)
  return {
    painted: [...DEFAULT_PAINTED.painted, ...strings(paths)],
    unpainted: [...DEFAULT_PAINTED.unpainted, ...strings(exclude)],
    repainted: strings(paths),
    ...(inputs !== undefined && { reelInputs: inputs }),
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
