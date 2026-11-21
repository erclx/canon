import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mergeSections } from '@/tooling/gitignore'
import { type Manifest, resolveChain } from '@/tooling/manifest'

export const CLAUDE_STACK = 'claude'

export interface GitignoreEntry {
  readonly entry: string
  readonly present: boolean
}

export function claudeChain(root: string): Manifest[] {
  return resolveChain(root, CLAUDE_STACK)
}

/**
 * Previews the gitignore merge without writing. The answer comes from
 * `mergeSections`, the same function the apply step runs, so the preview can
 * never disagree with what lands.
 */
export function planGitignore(
  chain: readonly Manifest[],
  target: string,
): GitignoreEntry[] {
  const path = join(target, '.gitignore')
  const content = existsSync(path) ? readFileSync(path, 'utf8') : ''
  const entries: GitignoreEntry[] = []

  for (const manifest of chain) {
    const added = new Set(mergeSections(content, manifest.gitignore).added)
    for (const section of manifest.gitignore) {
      for (const entry of section.entries) {
        entries.push({ entry, present: !added.has(entry) })
      }
    }
  }

  return entries
}

export function pendingEntries(
  entries: readonly GitignoreEntry[],
): GitignoreEntry[] {
  return entries.filter((entry) => !entry.present)
}
