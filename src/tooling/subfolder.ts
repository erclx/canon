import { existsSync, readdirSync, realpathSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { gitEnv } from '@/git-env'
import { listFiles, type Manifest } from '@/tooling/manifest'

/**
 * The path the generated subfolder spell config is written to. Written
 * copy-once, since a project that already configured cspell here owns it.
 */
export const SUBFOLDER_SPELL_CONFIG = 'cspell.json'

const WITHHELD_PREFIX = '.github/'

const SPELL_CONFIG_NAMES = ['cspell.json', '.cspell.json']

/**
 * Whether the target sits below the root of the git repository holding it. A
 * target outside any repository, or one git cannot read, counts as a root, so
 * a scratch folder with no repository keeps the behavior a root sync has.
 *
 * Synchronous because `scan` and `buildToolingReport` are, which is why this
 * does not reuse the async worktree reader.
 */
export function isSubfolderTarget(target: string): boolean {
  return subfolderPath(target) !== undefined
}

/**
 * The target's path relative to its git toplevel, which is what a root CI
 * job names as its `working-directory`. Undefined wherever
 * `isSubfolderTarget` reads a root.
 */
export function subfolderPath(target: string): string | undefined {
  const result = Bun.spawnSync(
    ['git', '-C', target, 'rev-parse', '--show-toplevel'],
    { env: gitEnv(), stdout: 'pipe', stderr: 'ignore' },
  )
  if (result.exitCode !== 0) return undefined

  const toplevel = result.stdout.toString().trim()
  if (toplevel === '') return undefined

  try {
    const path = relative(realpathSync(toplevel), realpathSync(target))
    return path === '' ? undefined : path
  } catch {
    return undefined
  }
}

/**
 * GitHub reads workflows only at the repository root, so a `.github/` copied
 * into a subfolder is a file nothing runs. `scan` and `injectConfigs` both
 * read this, so the set the diff withholds and the set the sync skips cannot
 * disagree.
 */
export function isWithheldInSubfolder(rel: string): boolean {
  return rel.startsWith(WITHHELD_PREFIX)
}

/**
 * Whether the target already carries a cspell config of its own, in any of
 * the file names cspell searches for.
 */
export function hasSpellConfig(target: string): boolean {
  if (SPELL_CONFIG_NAMES.some((name) => existsSync(join(target, name)))) {
    return true
  }
  if (!existsSync(target)) return false
  return readdirSync(target).some((name) => name.startsWith('cspell.config.'))
}

/**
 * Builds the nested cspell config that registers a subfolder's seeded word
 * lists. A root `cspell '**'` merges it with the root config for files under
 * the subfolder. Each dictionary takes a `local-` name, since reusing a root
 * dictionary's name shadows it inside the subfolder and a root word then fails
 * there.
 *
 * Returns nothing when the chain carries `base`, whose own seed already writes
 * a config, or when no stack seeds a word list.
 */
export function subfolderSpellConfig(
  chain: readonly Manifest[],
): string | undefined {
  if (chain.some((manifest) => manifest.name === 'base')) return undefined

  const lists = new Set<string>()
  for (const manifest of chain) {
    for (const rel of listFiles(manifest.seedsDir)) {
      if (rel.startsWith('.cspell/') && rel.endsWith('.txt')) lists.add(rel)
    }
  }
  if (lists.size === 0) return undefined

  const definitions = [...lists].sort().map((path) => ({
    name: `local-${basename(path, '.txt')}`,
    path,
    addWords: true,
  }))

  const config = {
    version: '0.2',
    dictionaryDefinitions: definitions,
    dictionaries: definitions.map((definition) => definition.name),
    ignorePaths: ['.cspell/**'],
  }

  return `${JSON.stringify(config, null, 2)}\n`
}
