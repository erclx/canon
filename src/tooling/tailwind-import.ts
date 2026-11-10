import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { configFiles, type Manifest } from '@/tooling/manifest'

/**
 * A fact the scan reports beside its changes. It counts as no change, since
 * nothing `sync` writes would clear it.
 */
export interface ToolingWarning {
  readonly code: 'tailwind-unimported'
  readonly config: string
  readonly message: string
}

const PLUGIN = '@tailwindcss/vite'
const ROOT_CONFIG = /^[^/]+\.config\.(ts|mjs|js)$/
const TAILWIND_IMPORT = /@import\s+(url\(\s*)?['"]tailwindcss(\/[^'"]*)?['"]/

// Dot folders cover `.git`, `.canon`, `.astro`, `.next`, and `.claude`, whose
// worktrees hold whole copies of the project.
const SKIPPED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
])

/**
 * Finds a Tailwind Vite plugin the chain registers with no stylesheet in the
 * target importing Tailwind, which compiles no utility while every check
 * passes. The plugin is read from a root config's effective copy, being the
 * target's when present and the golden otherwise, so a project that removed
 * it is not warned. Reads only, since `scan` runs under the report verbs.
 */
export function tailwindImportWarnings(
  chain: readonly Manifest[],
  target: string,
): ToolingWarning[] {
  const config = registeringConfig(chain, target)
  if (config === undefined || importsTailwind(target)) return []

  return [
    {
      code: 'tailwind-unimported',
      config,
      message: `${config} registers ${PLUGIN}, but no stylesheet imports Tailwind. Add @import 'tailwindcss'; to the global stylesheet, or no utility class compiles.`,
    },
  ]
}

function registeringConfig(
  chain: readonly Manifest[],
  target: string,
): string | undefined {
  const seen = new Set<string>()
  for (const manifest of chain) {
    for (const rel of configFiles(manifest)) {
      if (!ROOT_CONFIG.test(rel) || seen.has(rel)) continue
      seen.add(rel)
      const own = join(target, rel)
      const effective = existsSync(own) ? own : join(manifest.configsDir, rel)
      if (readFileSync(effective, 'utf8').includes(PLUGIN)) return rel
    }
  }
  return undefined
}

function importsTailwind(dir: string): boolean {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || SKIPPED_DIRS.has(entry.name)) continue
      if (importsTailwind(path)) return true
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.css') &&
      TAILWIND_IMPORT.test(readFileSync(path, 'utf8'))
    ) {
      return true
    }
  }
  return false
}
