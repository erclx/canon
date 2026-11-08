import { listStacks, loadManifest } from '@/tooling/manifest'

export interface StackSummary {
  readonly name: string
  readonly extends: string | null
  readonly devDeps: number
  readonly scripts: number
  readonly gitignoreGroups: number
  /** Whether `canon tooling scaffold` can start a project on this stack. */
  readonly scaffold: boolean
}

/**
 * Summarizes each installable stack. The counts come from `loadManifest`
 * rather than the three `awk` programs the bash carried, so the list and the
 * sync it previews read the same parse.
 */
export function buildStackSummaries(root: string): StackSummary[] {
  const summaries: StackSummary[] = []

  for (const stack of listStacks(root)) {
    const manifest = loadManifest(root, stack)
    if (!manifest) continue

    summaries.push({
      name: manifest.name,
      extends: manifest.parent ?? null,
      devDeps: manifest.devPackages.length,
      scripts: Object.keys(manifest.scripts).length,
      gitignoreGroups: manifest.gitignore.length,
      scaffold: manifest.scaffold !== undefined,
    })
  }

  return summaries
}

export function describeStack(summary: StackSummary): string {
  const counts = `${summary.devDeps} dev deps, ${summary.scripts} scripts, ${summary.gitignoreGroups} gitignore groups`
  const prefix = summary.extends === null ? '' : `extends: ${summary.extends}, `
  return `${summary.name} (${prefix}${counts})`
}
