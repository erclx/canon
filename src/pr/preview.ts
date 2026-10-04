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
  | 'unserved'
  | 'unfenced'
  | 'no-alias'
  | 'gh-failed'
  | 'run-failed'
  | 'timeout'

export interface WorkflowFile {
  readonly path: string
  readonly text: string
}

/**
 * Which changed paths a deploy builds from, read off its own push trigger, so
 * the workflow that decides when production deploys is also the one statement
 * of what a branch preview serves.
 */
export type ServedFilter =
  | { readonly kind: 'all' }
  | { readonly kind: 'paths'; readonly patterns: readonly string[] }
  | { readonly kind: 'paths-ignore'; readonly patterns: readonly string[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function readPatterns(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter((entry): entry is string => typeof entry === 'string')
}

/**
 * Reads `on.push.paths` or `on.push.paths-ignore`. A workflow with neither,
 * with no push trigger, or that does not parse serves every change, since
 * reading unserved by mistake stops every reader asking for a preview.
 */
export function readServedPaths(workflowText: string): ServedFilter {
  let parsed: unknown
  try {
    parsed = Bun.YAML.parse(workflowText)
  } catch {
    return { kind: 'all' }
  }
  const on = isRecord(parsed) ? parsed.on : undefined
  const push = isRecord(on) ? on.push : undefined
  if (!isRecord(push)) return { kind: 'all' }

  const paths = readPatterns(push.paths)
  if (paths !== undefined) return { kind: 'paths', patterns: paths }
  const ignored = readPatterns(push['paths-ignore'])
  if (ignored !== undefined) return { kind: 'paths-ignore', patterns: ignored }
  return { kind: 'all' }
}

/** Whether the patterns match a path, applied in order so a later `!` pattern overrides an earlier one, as GitHub applies them. */
function matchesInOrder(patterns: readonly string[], path: string): boolean {
  let isMatched = false
  for (const pattern of patterns) {
    const isNegated = pattern.startsWith('!')
    const glob = new Bun.Glob(isNegated ? pattern.slice(1) : pattern)
    if (glob.match(path)) isMatched = !isNegated
  }
  return isMatched
}

/** Whether a push carrying `changedPaths` would run the deploy, by the filter its trigger declares. */
export function servesChange(
  filter: ServedFilter,
  changedPaths: readonly string[],
): boolean {
  if (filter.kind === 'all') return true
  if (filter.kind === 'paths') {
    return changedPaths.some((path) => matchesInOrder(filter.patterns, path))
  }
  return changedPaths.some((path) => !matchesInOrder(filter.patterns, path))
}

export type WorkflowPick =
  | {
      readonly kind: 'found'
      readonly path: string
      readonly filter: ServedFilter
    }
  | {
      readonly kind: 'refused'
      readonly reason: 'no-deploy' | 'unfenced' | 'no-alias'
    }

interface WorkflowShape {
  readonly path: string
  readonly text: string
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
    text: file.text,
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

  return {
    kind: 'found',
    path: marked.path,
    filter: readServedPaths(marked.text),
  }
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
  readonly headSha: string
  readonly createdAt: string
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

export type PreviewHeadReason = 'fresh' | 'stale' | 'building' | 'no-build'

export type PreviewHeadReading =
  | {
      readonly reason: PreviewHeadReason
      readonly tip: string
      readonly built?: string
      readonly runId?: number
    }
  | { readonly reason: 'gh-failed' }

/**
 * Compares the head the newest successful dispatch built with the branch tip.
 *
 * The run listing is the only record of the built head, since the alias serves
 * the newest successful deployment per branch and names no sha. Runs are
 * ordered by creation rather than list position, so the verdict follows the
 * most recent deploy. A run still going at the tip reads `building` rather
 * than `stale`, so a mint already under way is not reported as a failure.
 */
export async function readPreviewHead(
  runner: PreviewRunner,
  target: {
    readonly workflow: string
    readonly branch: string
    readonly tip: string
  },
): Promise<PreviewHeadReading> {
  const rows = await runner.listRuns(target.workflow, target.branch)
  if (rows === undefined) return { reason: 'gh-failed' }

  const { tip } = target
  const newest = [...rows].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
  const built = newest.find(
    (row) => row.status === 'completed' && row.conclusion === 'success',
  )

  if (built?.headSha === tip) {
    return {
      reason: 'fresh',
      built: built.headSha,
      tip,
      runId: built.databaseId,
    }
  }

  const pending = newest.find(
    (row) => row.status !== 'completed' && row.headSha === tip,
  )
  if (pending !== undefined) {
    return {
      reason: 'building',
      tip,
      runId: pending.databaseId,
      ...(built !== undefined && { built: built.headSha }),
    }
  }

  if (built === undefined) return { reason: 'no-build', tip }
  return { reason: 'stale', built: built.headSha, tip, runId: built.databaseId }
}
