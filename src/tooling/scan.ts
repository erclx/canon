import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveSurfacePath } from '@/roots/surface'
import { type Disposition, hashFile } from '@/sync/stamp'
import { readDispositions } from '@/tooling/disposition'
import { mergeSections } from '@/tooling/gitignore'
import {
  ancestorsFirst,
  configFiles,
  configPaths,
  type Manifest,
  seedFiles,
} from '@/tooling/manifest'
import {
  collectDeps,
  collectScripts,
  declaresInstalls,
  type DepState,
  readPackage,
  type ScriptState,
} from '@/tooling/package'
import { isSubfolderTarget, isWithheldInSubfolder } from '@/tooling/subfolder'

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

export interface WithheldState {
  readonly rel: string
  readonly stack: string
  readonly present: boolean
}

/**
 * A golden file the project declined or customized, which every write skips.
 * `moved` is set on a customized config alone, true once the golden copy no
 * longer hashes to the one the project took.
 */
export interface DispositionState {
  readonly rel: string
  readonly stack: string
  readonly kind: 'config' | 'seed'
  readonly disposition: Disposition
  readonly present: boolean
  readonly moved?: boolean
}

export interface ScanResult {
  readonly configs: readonly ConfigState[]
  readonly withheld: readonly WithheldState[]
  readonly dispositions: readonly DispositionState[]
  readonly seeds: readonly SeedState[]
  readonly scripts: readonly ScriptState[]
  readonly deps: readonly DepState[]
  readonly gitignore: readonly EntryState[]
  readonly hasPackageJson: boolean
  readonly newManifest: boolean
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
 *
 * A seed at a path the chain also ships as a config is left to the config,
 * so the path is reported once.
 *
 * A target below its git toplevel is scanned as a subfolder: a config or seed
 * GitHub reads only at the root moves to `withheld` and counts as no change.
 * The scope is read here so every caller of `scan` agrees without passing a
 * flag.
 *
 * A path the project declined or customized moves to `dispositions` ahead of
 * the subfolder test, so it is listed once. The record is read here for the
 * same reason as the scope.
 */
export function scan(chain: readonly Manifest[], target: string): ScanResult {
  const isSubfolder = isSubfolderTarget(target)
  const held = readDispositions(target)
  const configs: ConfigState[] = []
  const withheld: WithheldState[] = []
  const dispositions: DispositionState[] = []
  const seenConfigs = new Set<string>()

  for (const manifest of chain) {
    for (const rel of configFiles(manifest)) {
      if (seenConfigs.has(rel)) continue
      seenConfigs.add(rel)

      const source = join(manifest.configsDir, rel)
      const dest = join(target, rel)

      const entry = held[rel]
      if (entry !== undefined) {
        dispositions.push({
          rel,
          stack: manifest.name,
          kind: 'config',
          disposition: entry.disposition,
          present: existsSync(dest),
          ...(entry.disposition === 'customized'
            ? { moved: hashFile(source) !== entry.base }
            : {}),
        })
        continue
      }

      if (isSubfolder && isWithheldInSubfolder(rel)) {
        withheld.push({ rel, stack: manifest.name, present: existsSync(dest) })
        continue
      }

      const state = !existsSync(dest)
        ? 'new'
        : isIdentical(source, dest)
          ? 'matching'
          : 'drifted'

      configs.push({ rel, stack: manifest.name, state })
    }
  }

  const seeds: SeedState[] = []
  const seenSeeds = configPaths(chain)

  for (const manifest of chain) {
    for (const rel of seedFiles(manifest)) {
      if (seenSeeds.has(rel)) continue
      seenSeeds.add(rel)

      const entry = held[rel]
      if (entry !== undefined) {
        dispositions.push({
          rel,
          stack: manifest.name,
          kind: 'seed',
          disposition: entry.disposition,
          present: existsSync(resolveSurfacePath(target, rel)),
        })
        continue
      }

      if (isSubfolder && isWithheldInSubfolder(rel)) {
        withheld.push({
          rel,
          stack: manifest.name,
          present: existsSync(join(target, rel)),
        })
        continue
      }

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
  const newManifest = !existsSync(packagePath) && declaresInstalls(chain)
  const basis = pkg ?? (newManifest ? {} : undefined)
  const scripts = basis ? collectScripts(chain, basis) : []
  const deps = basis ? collectDeps(chain, basis) : []

  const gitignorePath = join(target, '.gitignore')
  const gitignoreContent = existsSync(gitignorePath)
    ? readFileSync(gitignorePath, 'utf8')
    : ''
  const gitignore = scanGitignore(chain, gitignoreContent)

  const totalChanges =
    (newManifest ? 1 : 0) +
    configs.filter((entry) => entry.state !== 'matching').length +
    dispositions.filter((entry) => entry.moved === true).length +
    seeds.filter((entry) => entry.state === 'missing').length +
    scripts.filter((entry) => entry.state !== 'matching').length +
    deps.filter((entry) => entry.state === 'missing').length +
    gitignore.filter((entry) => entry.state === 'missing').length

  return {
    configs,
    withheld,
    dispositions,
    seeds,
    scripts,
    deps,
    gitignore,
    hasPackageJson: pkg !== undefined,
    newManifest,
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
