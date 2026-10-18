import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Where a project adds to or trims the default list of painted paths. */
export const PAINTED_CONFIG_REL = join('canon', 'config', 'painted.json')

export interface PaintedPatterns {
  /** A path matching any of these is painted unless `unpainted` also matches. */
  readonly painted: readonly string[]
  readonly unpainted: readonly string[]
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
 * What a browser renders, minus the tests and stories beside it. A test-only
 * push touches nothing a reviewer drove, which is the case the carry-forward
 * exists for.
 */
export const DEFAULT_PAINTED: PaintedPatterns = {
  painted: [`**/*.{${RENDERED_EXTENSIONS.join(',')}}`],
  unpainted: [
    '**/*.{test,spec,stories}.*',
    '**/__tests__/**',
    '**/__snapshots__/**',
  ],
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

/**
 * The default list plus the project's own, read from `canon/config/painted.json`
 * as `{ "painted": [...], "unpainted": [...] }`. A file that is absent or does
 * not parse leaves the default, since a typo there must not make every push
 * read as unpainted.
 */
export function loadPaintedPatterns(root: string): PaintedPatterns {
  const path = join(root, PAINTED_CONFIG_REL)
  if (!existsSync(path)) return DEFAULT_PAINTED

  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PAINTED
    const { painted, unpainted } = parsed as Record<string, unknown>
    return {
      painted: [...DEFAULT_PAINTED.painted, ...strings(painted)],
      unpainted: [...DEFAULT_PAINTED.unpainted, ...strings(unpainted)],
    }
  } catch {
    return DEFAULT_PAINTED
  }
}

function matchesAny(path: string, globs: readonly string[]): boolean {
  return globs.some((glob) => new Bun.Glob(glob).match(path))
}

export function isPainted(path: string, patterns: PaintedPatterns): boolean {
  return (
    matchesAny(path, patterns.painted) && !matchesAny(path, patterns.unpainted)
  )
}
