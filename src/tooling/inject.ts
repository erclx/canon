import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { $ } from 'bun'
import { copyPreservingMode } from '@/copy'
import { rewritesOnInstall, stripSeedMarker } from '@/seed-marker'
import { resolveSurfacePath } from '@/surface-root'
import { mergeSections, pruneSections } from '@/tooling/gitignore'
import {
  ancestorsFirst,
  configPaths,
  listFiles,
  type Manifest,
} from '@/tooling/manifest'
import {
  applyScripts,
  collectDeps,
  collectScripts,
  readPackage,
  serializePackage,
} from '@/tooling/package'
import {
  hasSpellConfig,
  isSubfolderTarget,
  isWithheldInSubfolder,
  SUBFOLDER_SPELL_CONFIG,
  subfolderSpellConfig,
} from '@/tooling/subfolder'
import { logAdd, logRemove, logStep, logWarn } from '@/ui'

export async function injectConfigs(
  chain: readonly Manifest[],
  target: string,
): Promise<string[]> {
  const applied: string[] = []
  const isSubfolder = isSubfolderTarget(target)

  for (const manifest of ancestorsFirst(chain)) {
    const files = listFiles(manifest.configsDir).filter(
      (rel) => !(isSubfolder && isWithheldInSubfolder(rel)),
    )
    if (files.length === 0) continue

    logStep(`Applying ${manifest.name} configs`)
    for (const rel of files) {
      await copyPreservingMode(
        join(manifest.configsDir, rel),
        join(target, rel),
      )
      logAdd(rel)
      applied.push(rel)
    }
  }

  return applied
}

/**
 * Writes a seed to a target that does not have it, dropping the stub marker on
 * the way. The marker is toolkit bookkeeping read by the seed gate, so a target
 * receiving it would carry a field its own tooling never reads. Only markdown
 * carries frontmatter, and every other seed copies byte for byte.
 */
async function writeSeed(src: string, dest: string): Promise<void> {
  if (!rewritesOnInstall(src)) {
    await copyFile(src, dest)
    return
  }

  await writeFile(dest, stripSeedMarker(await readFile(src, 'utf8')))
}

/**
 * Copies a seed when the target lacks it. When the target already has one and
 * the seed is a `.txt` word list, missing lines are appended and the file is
 * re-sorted. Every other existing file is left untouched.
 */
async function mergeSeedFile(src: string, dest: string): Promise<void> {
  await mkdir(dirname(dest), { recursive: true })

  if (!existsSync(dest)) {
    await writeSeed(src, dest)
    return
  }

  if (!src.endsWith('.txt')) return

  const existing = (await readFile(dest, 'utf8')).split('\n')
  const incoming = (await readFile(src, 'utf8')).split('\n')
  const missing = incoming.filter(
    (word) => word !== '' && !existing.includes(word),
  )

  if (missing.length === 0) return

  const merged = [...existing.filter((line) => line !== ''), ...missing].sort()
  await writeFile(dest, `${merged.join('\n')}\n`)
}

export async function injectSeeds(
  chain: readonly Manifest[],
  target: string,
): Promise<string[]> {
  const applied: string[] = []
  const isSubfolder = isSubfolderTarget(target)
  const shadowed = configPaths(chain)

  for (const manifest of ancestorsFirst(chain)) {
    const files = listFiles(manifest.seedsDir).filter(
      (rel) =>
        !shadowed.has(rel) && !(isSubfolder && isWithheldInSubfolder(rel)),
    )
    if (files.length === 0) continue

    logStep(`Applying ${manifest.name} seeds`)
    for (const rel of files) {
      const dest = resolveSurfacePath(target, rel)
      await mergeSeedFile(join(manifest.seedsDir, rel), dest)
      logAdd(relative(target, dest))
      applied.push(rel)
    }
  }

  const spellConfig = isSubfolder ? subfolderSpellConfig(chain) : undefined
  if (spellConfig !== undefined && !hasSpellConfig(target)) {
    logStep('Applying subfolder spell config')
    await writeFile(join(target, SUBFOLDER_SPELL_CONFIG), spellConfig)
    logAdd(SUBFOLDER_SPELL_CONFIG)
    applied.push(SUBFOLDER_SPELL_CONFIG)
  }

  return applied
}

export async function injectGitignore(
  chain: readonly Manifest[],
  target: string,
): Promise<string[]> {
  const path = join(target, '.gitignore')
  const added: string[] = []

  for (const manifest of ancestorsFirst(chain)) {
    if (manifest.gitignore.length === 0) continue

    const content = existsSync(path) ? await readFile(path, 'utf8') : ''
    const result = mergeSections(content, manifest.gitignore)
    if (result.added.length === 0) continue

    logStep(`Applying ${manifest.name} gitignore`)
    await writeFile(path, result.content)
    for (const entry of result.added) {
      logAdd(entry)
      added.push(entry)
    }
  }

  if (added.length === 0 && !existsSync(path)) await writeFile(path, '')

  return added
}

export async function pruneGitignore(
  chain: readonly Manifest[],
  target: string,
): Promise<string[]> {
  const path = join(target, '.gitignore')
  if (!existsSync(path)) return []

  const removed: string[] = []

  for (const manifest of ancestorsFirst(chain)) {
    if (manifest.gitignore.length === 0) continue

    const content = await readFile(path, 'utf8')
    const result = pruneSections(content, manifest.gitignore)
    if (result.removed.length === 0) continue

    await writeFile(path, result.content)
    for (const entry of result.removed) {
      logRemove(entry)
      removed.push(entry)
    }
  }

  return removed
}

/**
 * Installs missing dev dependencies, fills package scripts, and merges
 * gitignore entries. A target with no package.json gets the gitignore alone,
 * plus a warning naming every install it skipped, since seeding a package.json
 * would pick a package manager and a project name on the target's behalf.
 */
export async function injectManifest(
  chain: readonly Manifest[],
  target: string,
): Promise<void> {
  const packagePath = join(target, 'package.json')
  const pkg = readPackage(packagePath)

  if (pkg) {
    const missing = collectDeps(chain, pkg)
      .filter((dep) => dep.state === 'missing')
      .map((dep) => dep.spec)

    if (missing.length > 0) {
      logStep('Installing missing dependencies')
      await $`bun add -D ${missing}`.cwd(target)
      for (const spec of missing) logAdd(spec)
    }

    const fresh = readPackage(packagePath)
    if (fresh) {
      const result = applyScripts(fresh, chain)
      if (result.added.length > 0 || result.overridden.length > 0) {
        logStep('Applying scripts')
        for (const key of result.added) logAdd(key)
        for (const key of result.overridden) logAdd(key)
        await writeFile(packagePath, serializePackage(result.pkg))
      }
    }
  }

  await injectGitignore(chain, target)

  if (!pkg) warnSkippedInstalls(chain, target)
}

function warnSkippedInstalls(chain: readonly Manifest[], target: string): void {
  const deps = collectDeps(chain, {}).map((dep) => dep.spec)
  const scripts = collectScripts(chain, {}).map((script) => script.key)
  if (deps.length === 0 && scripts.length === 0) return

  logStep('Skipped installs')
  if (deps.length > 0) {
    logWarn(`Dev dependencies not installed: ${deps.join(', ')}`)
  }
  if (scripts.length > 0) {
    logWarn(`Scripts not added: ${scripts.join(', ')}`)
  }
  logWarn(`No package.json: run 'bun init' in ${target}, then sync again`)
}
