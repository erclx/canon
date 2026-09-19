/**
 * The line a deploy workflow prints once Cloudflare returns the branch alias.
 * The workflow and this reader agree on it and on nothing else, so the text is
 * a contract with `tooling/cloudflare/configs/.github/workflows/deploy.yml`.
 */
const ALIAS_MARKER = 'canon-preview-alias:'

/**
 * Anchored on the address itself, since GitHub echoes a step's script above
 * its output and that echo carries the marker with `$ALIAS_URL` unexpanded.
 */
const ALIAS_LINE = /canon-preview-alias:\s*(https:\/\/\S+)/

// biome-ignore lint/suspicious/noTemplateCurlyInString: a workflow expression, not a template
const BRANCH_FENCE = '--branch=${{ github.ref_name }}'

export type PreviewRefusal =
  | 'no-deploy'
  | 'unfenced'
  | 'no-alias'
  | 'gh-failed'
  | 'run-failed'
  | 'timeout'

export interface WorkflowFile {
  readonly path: string
  readonly text: string
}

export type WorkflowPick =
  | { readonly kind: 'found'; readonly path: string }
  | {
      readonly kind: 'refused'
      readonly reason: 'no-deploy' | 'unfenced' | 'no-alias'
    }

interface WorkflowShape {
  readonly path: string
  readonly deployLines: readonly string[]
  readonly isDispatchable: boolean
  readonly hasMarker: boolean
}

/**
 * Reads a workflow's lines with YAML comment lines dropped, since a comment
 * naming the fence would otherwise pass for a fenced command.
 */
function readShape(file: WorkflowFile): WorkflowShape {
  const lines = file.text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
  return {
    path: file.path,
    deployLines: lines.filter((line) => line.includes('pages deploy')),
    isDispatchable: lines.some((line) => /^\s*workflow_dispatch:/.test(line)),
    hasMarker: lines.some((line) => line.includes(ALIAS_MARKER)),
  }
}

/**
 * Picks the workflow a preview dispatch runs: one that deploys to Pages and
 * can be dispatched. A workflow with any `pages deploy` line passing no
 * `--branch` is refused rather than dispatched, because Pages then publishes
 * whatever ref ran to production.
 */
export function findDeployWorkflow(
  files: readonly WorkflowFile[],
): WorkflowPick {
  const dispatchable = [...files]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(readShape)
    .filter((shape) => shape.deployLines.length > 0 && shape.isDispatchable)
  if (dispatchable.length === 0) return { kind: 'refused', reason: 'no-deploy' }

  const fenced = dispatchable.filter((shape) =>
    shape.deployLines.every((line) => line.includes(BRANCH_FENCE)),
  )
  if (fenced.length === 0) return { kind: 'refused', reason: 'unfenced' }

  const marked = fenced.find((shape) => shape.hasMarker)
  if (marked === undefined) return { kind: 'refused', reason: 'no-alias' }

  return { kind: 'found', path: marked.path }
}

export function readPreviewAlias(log: string): string | undefined {
  for (const line of log.split('\n')) {
    const match = ALIAS_LINE.exec(line)
    if (match?.[1] !== undefined) return match[1]
  }
  return undefined
}

export interface RunRow {
  readonly databaseId: number
  readonly status: string
  readonly conclusion: string
}

/** The `gh` calls a preview makes, injected so the wait can be driven without a network. */
export interface PreviewRunner {
  dispatch(workflow: string, ref: string): Promise<boolean>
  listRuns(
    workflow: string,
    ref: string,
  ): Promise<readonly RunRow[] | undefined>
  viewRun(id: number): Promise<RunRow | undefined>
  readLog(id: number): Promise<string | undefined>
  now(): number
  sleep(ms: number): Promise<void>
}

export interface PreviewSettings {
  readonly workflow: string
  readonly branch: string
  readonly timeoutMs: number
  readonly pollMs: number
}

export type PreviewResult =
  | { readonly kind: 'minted'; readonly runId: number; readonly url: string }
  | {
      readonly kind: 'refused'
      readonly reason: PreviewRefusal
      readonly runId?: number
    }

/**
 * Dispatches the deploy on the branch, waits for that run within the bound,
 * and reads the alias out of its log.
 *
 * `gh workflow run` reports no run id, so the run is found as the one id
 * absent from a listing taken before the dispatch. Comparing ids rather than
 * creation times keeps the match independent of this machine's clock.
 */
export async function mintPreview(
  runner: PreviewRunner,
  settings: PreviewSettings,
): Promise<PreviewResult> {
  const { workflow, branch, timeoutMs, pollMs } = settings
  const deadline = runner.now() + timeoutMs

  const before = await runner.listRuns(workflow, branch)
  if (before === undefined) return { kind: 'refused', reason: 'gh-failed' }
  const known = new Set(before.map((row) => row.databaseId))

  if (!(await runner.dispatch(workflow, branch))) {
    return { kind: 'refused', reason: 'gh-failed' }
  }

  let runId: number | undefined
  while (runId === undefined) {
    if (runner.now() >= deadline) return { kind: 'refused', reason: 'timeout' }
    await runner.sleep(pollMs)
    const rows = await runner.listRuns(workflow, branch)
    runId = rows?.find((row) => !known.has(row.databaseId))?.databaseId
  }

  for (;;) {
    const row = await runner.viewRun(runId)
    if (row?.status === 'completed') {
      if (row.conclusion !== 'success') {
        return { kind: 'refused', reason: 'run-failed', runId }
      }
      break
    }
    if (runner.now() >= deadline) {
      return { kind: 'refused', reason: 'timeout', runId }
    }
    await runner.sleep(pollMs)
  }

  const log = await runner.readLog(runId)
  const url = log === undefined ? undefined : readPreviewAlias(log)
  if (url === undefined) return { kind: 'refused', reason: 'no-alias', runId }

  return { kind: 'minted', runId, url }
}
