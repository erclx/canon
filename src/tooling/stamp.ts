import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  type DomainHashes,
  hashFile,
  readStamp,
  stampedChain,
  stampedHashes,
  writeChainStamp,
} from '@/sync/stamp'
import {
  configFiles,
  isWholeStack,
  loadManifest,
  type Manifest,
} from '@/tooling/manifest'
import { readPackage } from '@/tooling/package'

/**
 * Whether the target is a workspace root, where every package resolves its own
 * stack. `package.json` covers bun, npm, and yarn, and pnpm declares the same
 * fact in its own file instead.
 */
export function isWorkspaceRoot(target: string): boolean {
  if (existsSync(join(target, 'pnpm-workspace.yaml'))) return true

  const workspaces = readPackage(join(target, 'package.json'))?.workspaces
  return Array.isArray(workspaces) || isRecord(workspaces)
}

/**
 * Records the chain an install resolved, and returns the names it wrote, or
 * nothing when it wrote none. The names are the merged list, which can carry
 * stacks an earlier sync recorded. A
 * workspace root is the single refusal: one chain recorded there would be a
 * guess at what its packages hold, and the report reading tooling as unmeasured
 * is the true answer rather than a clean one.
 */
export async function recordToolingChain(
  toolkitRoot: string,
  target: string,
  chain: readonly Manifest[],
  now: Date,
): Promise<string[] | undefined> {
  if (isWorkspaceRoot(target)) return undefined

  const stamp = readStamp(target)
  const merged = mergeAddOns(toolkitRoot, stampedChain(stamp, 'tooling'), chain)
  await writeChainStamp(
    target,
    { domain: 'tooling', toolkitRoot },
    merged,
    now,
    matchedHashes(chain, target, stampedHashes(stamp, 'tooling')),
  )
  return merged
}

/**
 * The golden hash of every config the target now matches, over the hashes an
 * earlier run recorded. A config the target holds a different copy of keeps
 * its previous hash, so a held edit still reads as edited on the next run
 * rather than as a stale copy the write may replace.
 */
function matchedHashes(
  chain: readonly Manifest[],
  target: string,
  previous: DomainHashes,
): DomainHashes {
  const hashes: Record<string, string> = { ...previous }
  const seen = new Set<string>()

  for (const manifest of chain) {
    for (const rel of configFiles(manifest)) {
      if (seen.has(rel)) continue
      seen.add(rel)

      const dest = join(target, rel)
      if (!existsSync(dest)) continue
      const golden = hashFile(join(manifest.configsDir, rel))
      if (hashFile(dest) === golden) hashes[rel] = golden
    }
  }

  return hashes
}

/**
 * An add-on stands alone beside a core chain, so syncing one must not displace
 * the chain it layers onto. Base extends nothing and still heads a core chain.
 */
export function isAddOn(manifest: Manifest | undefined): boolean {
  return (
    manifest !== undefined &&
    manifest.parent === undefined &&
    manifest.name !== 'base'
  )
}

/**
 * Merges what this sync resolved into what an earlier one recorded. The core
 * chain is the one just synced, or the recorded one when only add-ons synced.
 * Add-ons accumulate after it, so a later stackless report measures them all.
 */
function mergeAddOns(
  toolkitRoot: string,
  recorded: readonly string[],
  chain: readonly Manifest[],
): string[] {
  const synced = chain.filter(isWholeStack)
  const syncedCore = synced.filter((m) => !isAddOn(m)).map((m) => m.name)
  const syncedAddOns = synced.filter(isAddOn).map((m) => m.name)

  const recordedManifests = recorded.map((name) => ({
    name,
    manifest: loadManifest(toolkitRoot, name),
  }))
  const recordedCore = recordedManifests
    .filter(({ manifest }) => !isAddOn(manifest))
    .map(({ name }) => name)
  const recordedAddOns = recordedManifests
    .filter(({ manifest }) => isAddOn(manifest))
    .map(({ name }) => name)

  const core = syncedCore.length > 0 ? syncedCore : recordedCore
  const addOns = [...new Set([...recordedAddOns, ...syncedAddOns])]
  return [...core, ...addOns]
}

/**
 * The stack names a chain stamp records. A skipped stack kept for its
 * per-root configs stays out, since the report re-resolves each recorded name
 * as a whole manifest and would then measure every config the skip withheld.
 */
export function recordedStacks(chain: readonly Manifest[]): string[] {
  return chain.filter(isWholeStack).map((manifest) => manifest.name)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
