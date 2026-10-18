import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PROJECT_ROOT } from '@/roots/project'
import { configFiles, type Manifest, seedFiles } from '@/tooling/manifest'

/**
 * Spells the package root in a report where every other root spells a
 * project-relative path. The `source` field promises a path inside the project
 * and a package copy is the one source that promise cannot cover, so the
 * spelling has to be one nothing will join to a project root.
 */
const PACKAGE_LABEL = '<canon>'

export interface ReferenceRoot {
  /** The root whose `tooling/` this searches, as the manifest loader takes it. */
  readonly root: string
  /** Absolute `tooling/` directory to search. */
  readonly dir: string
  /** How a report spells a copy found under this root. */
  readonly label: string
}

export interface ResolvedReference {
  readonly path: string
  /** The root that won, so the manifest is read from the same copy. */
  readonly root: string
  /** The label of the root that won, joined to the stack and filename. */
  readonly source: string
}

function toolingSourceDir(root: string): string {
  return join(root, 'tooling')
}

/**
 * The roots a stack reference resolves against. No stack reference installs
 * into a project any more, so the package corpus is the only root that answers there. The
 * authoring root stays ahead of it for the toolkit's own repository, which
 * authors the corpus this reads, and for a project authoring stacks of its
 * own under the same layout.
 */
export function referenceRoots(root: string): ReferenceRoot[] {
  return [
    { root, dir: toolingSourceDir(root), label: 'tooling' },
    {
      root: PROJECT_ROOT,
      dir: toolingSourceDir(PROJECT_ROOT),
      label: join(PACKAGE_LABEL, 'tooling'),
    },
  ]
}

/** Resolves a stack's reference doc, working root first. */
export function resolveReference(
  root: string,
  stack: string,
): ResolvedReference | undefined {
  for (const { root: owner, dir, label } of referenceRoots(root)) {
    const path = join(dir, stack, 'reference.md')
    if (existsSync(path)) {
      return { path, root: owner, source: join(label, stack, 'reference.md') }
    }
  }

  return undefined
}

export function readReference(reference: ResolvedReference): string {
  return readFileSync(reference.path, 'utf8')
}

function codeList(items: readonly string[]): string {
  return items.map((item) => `- \`${item}\``).join('\n')
}

/**
 * The sections the verb prints after a stack's reference, read from its
 * manifest so no reference keeps a hand list that drifts from it. A stack lists
 * its own files and groups alone, since a parent's print under the parent's
 * reference, and a section with nothing to list prints no heading.
 */
export function renderStackSections(manifest: Manifest): string {
  const sections: string[] = []
  const configs = configFiles(manifest)
  const seeds = seedFiles(manifest)

  if (configs.length > 0 || seeds.length > 0) {
    const sync = ['## Sync']
    if (configs.length > 0) {
      sync.push('Sync keeps these current, from `configs/`:', codeList(configs))
    }
    if (seeds.length > 0) {
      sync.push('Sync copies these once, from `seeds/`:', codeList(seeds))
    }
    sections.push(sync.join('\n\n'))
  }

  if (manifest.gitignore.length > 0) {
    const groups = manifest.gitignore.map(
      ({ header, entries }) =>
        `- \`${header}\`: ${entries.map((entry) => `\`${entry}\``).join(', ')}`,
    )
    sections.push(`## Gitignore\n\n${groups.join('\n')}`)
  }

  return sections.map((section) => `\n${section}\n`).join('')
}
