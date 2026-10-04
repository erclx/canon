import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PROJECT_ROOT } from '@/roots/project'

/**
 * Spells the package root in a report where every other root spells a
 * project-relative path. The `source` field promises a path inside the project
 * and a package copy is the one source that promise cannot cover, so the
 * spelling has to be one nothing will join to a project root.
 */
const PACKAGE_LABEL = '<canon>'

export interface ReferenceRoot {
  /** Absolute `tooling/` directory to search. */
  readonly dir: string
  /** How a report spells a copy found under this root. */
  readonly label: string
}

export interface ResolvedReference {
  readonly path: string
  /** The label of the root that won, joined to the stack and filename. */
  readonly source: string
}

function toolingSourceDir(root: string): string {
  return join(root, 'tooling')
}

/**
 * The roots a stack reference resolves against, mirroring `standardRoots` in
 * `src/standards/read.ts`. No stack reference installs into a project any
 * more, so the package corpus is the only root that answers there. The
 * authoring root stays ahead of it for the toolkit's own repository, which
 * authors the corpus this reads, and for a project authoring stacks of its
 * own under the same layout.
 */
export function referenceRoots(root: string): ReferenceRoot[] {
  return [
    { dir: toolingSourceDir(root), label: 'tooling' },
    {
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
  for (const { dir, label } of referenceRoots(root)) {
    const path = join(dir, stack, 'reference.md')
    if (existsSync(path)) {
      return { path, source: join(label, stack, 'reference.md') }
    }
  }

  return undefined
}

export function readReference(reference: ResolvedReference): string {
  return readFileSync(reference.path, 'utf8')
}
