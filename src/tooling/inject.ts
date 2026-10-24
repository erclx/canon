import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { copyPreservingMode } from '@/sync/copy'
import { readDispositions } from '@/tooling/disposition'
import { type InstallResult, installDevDependencies } from '@/tooling/install'
import { rewritesOnInstall, stripSeedMarker } from '@/tooling/seed-marker'
import { resolveSurfacePath } from '@/roots/surface'
import { mergeSections, pruneSections } from '@/tooling/gitignore'
import {
  ancestorsFirst,
  configFiles,
  configPaths,
  type Manifest,
  seedFiles,
} from '@/tooling/manifest'
import {
  applyScripts,
  collectDeps,
  declaresInstalls,
  minimalPackage,
  readPackage,
  serializePackage,
} from '@/tooling/package'
import { isSubfolderTarget, isWithheldInSubfolder } from '@/tooling/subfolder'
import { logAdd, logRemove, logStep, logWarn } from '@/cli/ui'

/**
 * Skips every path the project declined or customized, which is what makes
 * the record hold for `sync --write` and `inject` alike. `hold` names the
 * further paths a caller decided this write must leave, which `sync` derives
 * from the scan and `inject`, writing without one, never passes.
 */
export async function injectConfigs(
  chain: readonly Manifest[],
  target: string,
  hold: ReadonlySet<string> = new Set(),
): Promise<string[]> {
  const applied: string[] = []
  const isSubfolder = isSubfolderTarget(target)
  const held = readDispositions(target)

  for (const manifest of ancestorsFirst(chain)) {
    const files = configFiles(manifest).filter(
      (rel) =>
        held[rel] === undefined &&
        !hold.has(rel) &&
        !(isSubfolder && isWithheldInSubfolder(rel)),
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
 * Copies a seed when the target lacks it and leaves an existing file untouched.
 */
async function copySeedIfMissing(src: string, dest: string): Promise<void> {
  await mkdir(dirname(dest), { recursive: true })
  if (existsSync(dest)) return

  await writeSeed(src, dest)
}

export async function injectSeeds(
  chain: readonly Manifest[],
  target: string,
): Promise<string[]> {
  const applied: string[] = []
  const isSubfolder = isSubfolderTarget(target)
  const shadowed = configPaths(chain)
  const held = readDispositions(target)

  for (const manifest of ancestorsFirst(chain)) {
    const files = seedFiles(manifest).filter(
      (rel) =>
        !shadowed.has(rel) &&
        held[rel] === undefined &&
        !(isSubfolder && isWithheldInSubfolder(rel)),
    )
    if (files.length === 0) continue

    logStep(`Applying ${manifest.name} seeds`)
    for (const rel of files) {
      const dest = resolveSurfacePath(target, rel)
      await copySeedIfMissing(join(manifest.seedsDir, rel), dest)
      logAdd(relative(target, dest))
      applied.push(rel)
    }
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
 * gitignore entries. A target with no package.json gets a minimal one first
 * when the chain installs anything. A package.json that exists but cannot be
 * parsed is never rewritten, and the install is skipped with a warning.
 */
export async function injectManifest(
  chain: readonly Manifest[],
  target: string,
): Promise<InstallResult> {
  const packagePath = join(target, 'package.json')

  if (!existsSync(packagePath) && declaresInstalls(chain)) {
    logStep('Writing package.json')
    await writeFile(packagePath, serializePackage(minimalPackage(target)))
    logAdd('package.json')
  }

  const pkg = readPackage(packagePath)

  if (pkg) {
    const missing = collectDeps(chain, pkg)
      .filter((dep) => dep.state === 'missing')
      .map((dep) => dep.spec)

    if (missing.length > 0) {
      logStep('Installing missing dependencies')
      const installed = await installDevDependencies(missing, target)
      if (!installed.ok) return installed
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

  if (!pkg) warnUnreadablePackage(chain, target)

  return { ok: true }
}

/**
 * Only an existing package.json that fails to parse reaches here with installs
 * pending, since an absent one was written above. It is left untouched.
 */
function warnUnreadablePackage(
  chain: readonly Manifest[],
  target: string,
): void {
  if (!declaresInstalls(chain)) return

  const deps = collectDeps(chain, {}).map((dep) => dep.spec)
  const skipped = applyScripts({}, chain)
  const scripts = [...new Set([...skipped.added, ...skipped.overridden])]

  logStep('Skipped installs')
  if (deps.length > 0) {
    logWarn(`Dev dependencies not installed: ${deps.join(', ')}`)
  }
  if (scripts.length > 0) {
    logWarn(`Scripts not added: ${scripts.join(', ')}`)
  }
  logWarn(
    `package.json is not valid JSON: fix it in ${target}, then sync again`,
  )
}
