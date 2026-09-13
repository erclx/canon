import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveSurfacePath } from '@/surface-root'
import { mergeSections } from '@/tooling/gitignore'
import { ancestorsFirst, listFiles, type Manifest } from '@/tooling/manifest'
import {
  collectDeps,
  collectScripts,
  type DepState,
  readPackage,
  type ScriptState,
} from '@/tooling/package'

export interface ConfigState {
  readonly rel: string
  readonly stack: string
  readonly state: 'new' | 'drifted' | 'matching'
}

export interface SeedState {
  readonly rel: string
  readonly state: 'missing' | 'present'
}

export interface EntryState {
  readonly entry: string
  readonly state: 'missing' | 'present'
}

export interface ScanResult {
  readonly configs: readonly ConfigState[]
  readonly seeds: readonly SeedState[]
  readonly scripts: readonly ScriptState[]
  readonly deps: readonly DepState[]
  readonly gitignore: readonly EntryState[]
  readonly hasPackageJson: boolean
  readonly totalChanges: number
}

function isIdentical(a: string, b: string): boolean {
  if (!existsSync(b)) return false
  return readFileSync(a).equals(readFileSync(b))
}

/**
 * Compares every stack in the chain against the target and reports what would
 * change. Nothing is written. Which stack wins a duplicate differs per
 * category and mirrors the bash: configs, seeds, and scripts resolve nearest
 * stack first, while dependencies and gitignore entries resolve from the
 * furthest ancestor inward.
 */
export function scan(chain: readonly Manifest[], target: string): ScanResult {
  const configs: ConfigState[] = []
  const seenConfigs = new Set<string>()

  for (const manifest of chain) {
    for (const rel of listFiles(manifest.configsDir)) {
      if (seenConfigs.has(rel)) continue
      seenConfigs.add(rel)

      const source = join(manifest.configsDir, rel)
      const dest = join(target, rel)
      const state = !existsSync(dest)
        ? 'new'
        : isIdentical(source, dest)
          ? 'matching'
          : 'drifted'

      configs.push({ rel, stack: manifest.name, state })
    }
  }

  const seeds: SeedState[] = []
  const seenSeeds = new Set<string>()

  for (const manifest of chain) {
    for (const rel of listFiles(manifest.seedsDir)) {
      if (seenSeeds.has(rel)) continue
      seenSeeds.add(rel)

      seeds.push({
        rel,
        state: existsSync(resolveSurfacePath(target, rel))
          ? 'present'
          : 'missing',
      })
    }
  }

  const packagePath = join(target, 'package.json')
  const pkg = readPackage(packagePath)
  const scripts = pkg ? collectScripts(chain, pkg) : []
  const deps = pkg ? collectDeps(chain, pkg) : []

  const gitignorePath = join(target, '.gitignore')
  const gitignoreContent = existsSync(gitignorePath)
    ? readFileSync(gitignorePath, 'utf8')
    : ''
  const gitignore = scanGitignore(chain, gitignoreContent)

  const totalChanges =
    configs.filter((entry) => entry.state !== 'matching').length +
    seeds.filter((entry) => entry.state === 'missing').length +
    scripts.filter((entry) => entry.state !== 'matching').length +
    deps.filter((entry) => entry.state === 'missing').length +
    gitignore.filter((entry) => entry.state === 'missing').length

  return {
    configs,
    seeds,
    scripts,
    deps,
    gitignore,
    hasPackageJson: pkg !== undefined,
    totalChanges,
  }
}

/**
 * Replays the merge against a copy of the file so an entry that an earlier
 * section or stack would add is not also reported as missing.
 */
function scanGitignore(
  chain: readonly Manifest[],
  content: string,
): EntryState[] {
  const states: EntryState[] = []
  const seen = new Set<string>()
  let projected = content

  for (const manifest of ancestorsFirst(chain)) {
    for (const section of manifest.gitignore) {
      for (const entry of section.entries) {
        if (seen.has(entry)) continue
        seen.add(entry)

        const result = mergeSections(projected, [
          { header: section.header, entries: [entry] },
        ])
        states.push({
          entry,
          state: result.added.length > 0 ? 'missing' : 'present',
        })
        projected = result.content
      }
    }
  }

  return states
}
