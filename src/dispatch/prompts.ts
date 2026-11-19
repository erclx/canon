import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'
import {
  isReservedStem,
  readPlanTargets,
  SESSION_ID_PATTERN,
  tasksDir,
} from '@/tasks/archive'
import { checkClaim } from '@/sessions/claim'
import { branchOfPlan } from '@/tasks/branch'
import { LABEL_PATTERN } from '@/tasks/label'
import { readDeclarations } from '@/tasks/reach'

export const PROMPT_ROLES = ['worker', 'planner', 'reviewer'] as const
export type PromptRole = (typeof PROMPT_ROLES)[number]

/**
 * `bad-input` describes the command line, `no-task` and `no-plan` the board,
 * `claimed` a worker branch something already holds, and `malformed` a
 * prompts file a hand edit broke, which the verb refuses rather than rewriting.
 */
export const PROMPT_REFUSALS = [
  'bad-input',
  'no-task',
  'no-plan',
  'claimed',
  'malformed',
] as const
export type PromptRefusal = (typeof PROMPT_REFUSALS)[number]

export interface PromptRefused {
  readonly ok: false
  readonly reason: PromptRefusal
  readonly message: string
}

export interface Prompt {
  readonly label: string
  readonly title: string
  readonly role: PromptRole
  readonly model: string
  readonly effort: string
  /** The fence body, its command at position zero. */
  readonly lines: readonly string[]
}

export interface PromptQueue {
  readonly mergeOrder: string | null
  readonly prompts: readonly Prompt[]
}

/** A queued prompt as `list` reports it, with what its command derives. */
export interface ListedPrompt extends Prompt {
  readonly plan?: string
  readonly branch?: string
  readonly pr?: number
}

export interface PromptsListed {
  readonly ok: true
  readonly path: string
  readonly mergeOrder: string | null
  readonly prompts: readonly ListedPrompt[]
}

export interface DroppedPrompt {
  readonly label: string
  readonly role: PromptRole
  readonly branch: string
}

export interface PromptAdded {
  readonly ok: true
  readonly path: string
  readonly action: 'added' | 'replaced'
  readonly prompt: ListedPrompt
  readonly mergeOrder: string | null
  readonly mergeOrderDropped: boolean
  /** Queued worker rows whose branch a session, worktree, or ref now holds. */
  readonly dropped: readonly DroppedPrompt[]
  /** Branches whose claim could not be read, kept queued rather than dropped. */
  readonly claimUnread: readonly string[]
}

export interface ClaimReading {
  readonly claimed: boolean
  readonly readable: boolean
}

export type ClaimReader = (branch: string) => Promise<ClaimReading>

export interface AddOptions {
  readonly readClaim?: ClaimReader
}

export interface PromptsRemoved {
  readonly ok: true
  readonly path: string
  readonly removed: readonly { label: string; role: PromptRole }[]
  readonly mergeOrder: string | null
  readonly mergeOrderDropped: boolean
}

export type ListOutcome = PromptsListed | PromptRefused
export type AddOutcome = PromptAdded | PromptRefused
export type RemoveOutcome = PromptsRemoved | PromptRefused

export interface AddInput {
  readonly task: string
  readonly role: string
  readonly model: string
  readonly effort: string
  readonly controller: string
  readonly pr?: string
  readonly lines?: readonly string[]
  readonly mergeOrder?: string
}

const HEADING = '# Dispatch prompts'
const EMPTY_LINE = 'No prompts waiting.'
const MERGE_PREFIX = 'Merge order: '
const FENCE_OPEN = '```text'
const FENCE_CLOSE = '```'

const ROLE_HEADINGS: Record<PromptRole, string> = {
  worker: 'Worker',
  planner: 'Planner',
  reviewer: 'Reviewer',
}

const WORKER_COMMAND = /^\/canon:auto-ship (\S+)$/
const REVIEWER_COMMAND = /\/canon:review-pr (\d+)$/

export function promptsPath(root: string): string {
  return join(root, '.canon', 'dispatch', 'prompts.md')
}

function refuse(reason: PromptRefusal, message: string): PromptRefused {
  return { ok: false, reason, message }
}

function isRole(value: string): value is PromptRole {
  return (PROMPT_ROLES as readonly string[]).includes(value)
}

/**
 * Reads the file the verb writes. Blank lines between elements are free, and
 * anything else out of the fixed order is refused with its line number, since
 * a guess at a hand edit's intent could launch the wrong row.
 */
export function parsePrompts(text: string): PromptQueue | PromptRefused {
  const lines = text.split('\n').map((line) => line.trimEnd())
  let at = 0

  const skipBlank = (): void => {
    while (at < lines.length && lines[at] === '') at += 1
  }
  const malformed = (expected: string): PromptRefused =>
    refuse(
      'malformed',
      `Line ${at + 1} of the prompts file reads "${lines[at] ?? ''}" where ${expected} belongs. Fix the edit or remove the file.`,
    )

  skipBlank()
  if (lines[at] !== HEADING) return malformed(`"${HEADING}"`)
  at += 1
  skipBlank()

  if (lines[at] === EMPTY_LINE) {
    at += 1
    skipBlank()
    if (at < lines.length) return malformed('nothing')
    return { mergeOrder: null, prompts: [] }
  }

  let mergeOrder: string | null = null
  if (lines[at]?.startsWith(MERGE_PREFIX)) {
    mergeOrder = lines[at].slice(MERGE_PREFIX.length).trim() || null
    at += 1
    skipBlank()
  }

  const prompts: Prompt[] = []
  while (at < lines.length) {
    const task = /^## (\S+): (.+)$/.exec(lines[at])
    if (!task) return malformed('a "## <label>: <title>" heading')
    const [, label, title] = task
    at += 1
    skipBlank()

    let roles = 0
    while (at < lines.length && lines[at].startsWith('### ')) {
      const heading = lines[at].slice(4)
      const role = PROMPT_ROLES.find((r) => ROLE_HEADINGS[r] === heading)
      if (!role)
        return malformed('"### Worker", "### Planner", or "### Reviewer"')
      at += 1
      skipBlank()

      const model = /^Model: (\S+)$/.exec(lines[at] ?? '')
      if (!model) return malformed('a "Model: <model>" line')
      at += 1
      const effort = /^Effort: (\S+)$/.exec(lines[at] ?? '')
      if (!effort) return malformed('an "Effort: <effort>" line')
      at += 1
      skipBlank()

      if (lines[at] !== FENCE_OPEN) return malformed(`"${FENCE_OPEN}"`)
      at += 1
      const body: string[] = []
      while (at < lines.length && lines[at] !== FENCE_CLOSE) {
        body.push(lines[at])
        at += 1
      }
      if (at >= lines.length) return malformed(`a closing "${FENCE_CLOSE}"`)
      if (body.length === 0) return malformed('a command inside the fence')
      at += 1
      skipBlank()

      prompts.push({
        label,
        title,
        role,
        model: model[1],
        effort: effort[1],
        lines: body,
      })
      roles += 1
    }
    if (roles === 0) return malformed('a "### <role>" heading')
  }

  return { mergeOrder: prompts.length > 0 ? mergeOrder : null, prompts }
}

/** Groups prompts under their task in first-queued order, one H3 per role. */
export function renderPrompts(queue: PromptQueue): string {
  if (queue.prompts.length === 0) return `${HEADING}\n\n${EMPTY_LINE}\n`

  const out = [HEADING, '']
  if (queue.mergeOrder !== null)
    out.push(`${MERGE_PREFIX}${queue.mergeOrder}`, '')

  const labels = [...new Set(queue.prompts.map((prompt) => prompt.label))]
  for (const label of labels) {
    const group = queue.prompts.filter((prompt) => prompt.label === label)
    out.push(`## ${label}: ${group[0].title}`, '')
    for (const prompt of group) {
      out.push(
        `### ${ROLE_HEADINGS[prompt.role]}`,
        '',
        `Model: ${prompt.model}`,
        `Effort: ${prompt.effort}`,
        '',
        FENCE_OPEN,
        ...prompt.lines,
        FENCE_CLOSE,
        '',
      )
    }
  }

  return out.join('\n')
}

async function readQueue(root: string): Promise<PromptQueue | PromptRefused> {
  const path = promptsPath(root)
  if (!existsSync(path)) return { mergeOrder: null, prompts: [] }

  return parsePrompts(await readFile(path, 'utf8'))
}

async function writeQueue(root: string, queue: PromptQueue): Promise<void> {
  const path = promptsPath(root)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, renderPrompts(queue), 'utf8')
}

function describe(prompt: Prompt): ListedPrompt {
  const command = prompt.lines[0] ?? ''

  if (prompt.role === 'worker') {
    const worker = WORKER_COMMAND.exec(command)
    if (worker) {
      return { ...prompt, plan: worker[1], branch: branchOfPlan(worker[1]) }
    }
  }

  if (prompt.role === 'reviewer') {
    const reviewer = REVIEWER_COMMAND.exec(command)
    if (reviewer) return { ...prompt, pr: Number(reviewer[1]) }
  }

  return prompt
}

/**
 * The order is the orchestrator's judgment and the sharing is measurable, so
 * the order survives only while two queued worker plans declare one path.
 */
async function sharesPath(
  root: string,
  prompts: readonly Prompt[],
): Promise<boolean> {
  const plans = prompts
    .map(describe)
    .flatMap((prompt) => (prompt.plan === undefined ? [] : [prompt.plan]))
  const declared = await Promise.all(
    plans.map(async (plan) => {
      const path = join(root, plan)
      if (!existsSync(path)) return new Set<string>()
      return new Set(readDeclarations(await readFile(path, 'utf8')))
    }),
  )

  return declared.some((paths, index) =>
    declared
      .slice(index + 1)
      .some((other) => [...paths].some((path) => other.has(path))),
  )
}

async function settleMergeOrder(
  root: string,
  prompts: readonly Prompt[],
  wanted: string | null,
): Promise<{ mergeOrder: string | null; mergeOrderDropped: boolean }> {
  if (wanted === null) return { mergeOrder: null, mergeOrderDropped: false }
  if (await sharesPath(root, prompts)) {
    return { mergeOrder: wanted, mergeOrderDropped: false }
  }

  return { mergeOrder: null, mergeOrderDropped: true }
}

/** The label a stem, a label, or a task path names, read off its filename. */
export function labelOf(task: string): string {
  const stem = basename(task, '.md')
  const labelled = LABEL_PATTERN.exec(stem)

  return labelled ? stem.slice(0, labelled[0].length - 1) : stem
}

interface TaskFile {
  readonly stem: string
  readonly path: string
  readonly text: string
}

async function findTask(
  root: string,
  task: string,
): Promise<TaskFile | PromptRefused> {
  const dir = tasksDir(root)
  const wanted = basename(task, '.md')
  const stems = existsSync(dir)
    ? (await readdir(dir))
        .filter((name) => name.endsWith('.md'))
        .map((name) => name.slice(0, -'.md'.length))
        .filter((stem) => !isReservedStem(stem))
    : []

  const matched = stems.filter(
    (stem) => stem === wanted || stem.startsWith(`${wanted}-`),
  )
  if (matched.length !== 1) {
    return refuse(
      'no-task',
      matched.length === 0
        ? `No live task at .canon/tasks/ matches ${task}.`
        : `${task} matches ${matched.length} tasks (${matched.join(', ')}). Name the stem.`,
    )
  }

  const path = join(dir, `${matched[0]}.md`)

  return { stem: matched[0], path, text: await readFile(path, 'utf8') }
}

function titleOf(task: TaskFile, label: string): string {
  const heading = task.text.split('\n').find((line) => line.startsWith('# '))
  if (heading === undefined) return task.stem
  const text = heading.slice(2).trim()

  return text.startsWith(`${label}: `) ? text.slice(label.length + 2) : text
}

function planOf(root: string, task: TaskFile): string | PromptRefused {
  const targets = readPlanTargets(task.text)
  if (targets.length !== 1) {
    return refuse(
      'no-plan',
      targets.length === 0
        ? `${task.stem} links no plan, so a worker has nothing to build. Plan it first.`
        : `${task.stem} links ${targets.length} plans, so no one plan is the worker's.`,
    )
  }

  const path = resolve(dirname(task.path), targets[0])
  if (!existsSync(path)) {
    return refuse(
      'no-plan',
      `${task.stem} links ${targets[0]}, which resolves to no file.`,
    )
  }

  return relative(root, path)
}

const SINGLE_TOKEN = /^\S+$/

function checkInput(input: AddInput): PromptRefused | null {
  if (!isRole(input.role)) {
    return refuse(
      'bad-input',
      `--role takes ${PROMPT_ROLES.join(', ')}, not ${input.role}.`,
    )
  }
  if (!SINGLE_TOKEN.test(input.model) || !SINGLE_TOKEN.test(input.effort)) {
    return refuse('bad-input', '--model and --effort each take one word.')
  }
  if (!SESSION_ID_PATTERN.test(input.controller)) {
    return refuse(
      'bad-input',
      `--controller takes a full sessionId, not ${input.controller}.`,
    )
  }
  if (input.role === 'reviewer' && !/^[1-9]\d*$/.test(input.pr ?? '')) {
    return refuse(
      'bad-input',
      'A reviewer row takes --pr <number>, which exists once the worker opened its pull request.',
    )
  }
  if (input.role !== 'reviewer' && input.pr !== undefined) {
    return refuse('bad-input', '--pr belongs to a reviewer row alone.')
  }
  const bad = (input.lines ?? []).find(
    (line) => line.trim() === '' || line.includes('\n') || line.includes('```'),
  )
  if (bad !== undefined) {
    return refuse(
      'bad-input',
      'Each --line takes one non-empty line carrying no fence.',
    )
  }
  if (input.mergeOrder !== undefined && input.mergeOrder.trim() === '') {
    return refuse('bad-input', '--merge-order takes text.')
  }

  return null
}

function commandFor(
  role: PromptRole,
  task: TaskFile,
  plan: string | null,
  pr: string | undefined,
): string {
  if (role === 'worker') return `/canon:auto-ship ${plan}`
  if (role === 'reviewer') {
    return `Run /canon:role-reviewer, then /canon:review-pr ${pr}`
  }

  return `Run /canon:role-planner, then /canon:plan-feature .canon/tasks/${task.stem}.md`
}

/**
 * Queues one prompt. A task and role already queued is replaced in place, so a
 * retried call lands once.
 */
export async function addPrompt(
  root: string,
  input: AddInput,
  opts: AddOptions = {},
): Promise<AddOutcome> {
  const readClaim = opts.readClaim ?? claimReaderAt(root)
  const invalid = checkInput(input)
  if (invalid) return invalid
  const role = input.role as PromptRole

  const queue = await readQueue(root)
  if ('ok' in queue) return queue

  const task = await findTask(root, input.task)
  if ('ok' in task) return task

  let plan: string | null = null
  if (role === 'worker') {
    const resolved = planOf(root, task)
    if (typeof resolved !== 'string') return resolved
    plan = resolved
  }

  const label = labelOf(task.stem)
  const prompt: Prompt = {
    label,
    title: titleOf(task, label),
    role,
    model: input.model,
    effort: input.effort,
    lines: [
      commandFor(role, task, plan, input.pr),
      `Controller: ${input.controller}`,
      ...(input.lines ?? []).map((line) => line.trim()),
    ],
  }

  const listed = describe(prompt)
  const ownUnread: string[] = []
  if (listed.branch !== undefined) {
    const reading = await readClaim(listed.branch)
    if (!reading.readable) ownUnread.push(listed.branch)
    if (reading.claimed) {
      return refuse(
        'claimed',
        `${listed.branch} is already held by a session, a worktree, or a ref, so ${label} has launched. Clear its row rather than queue it again.`,
      )
    }
  }

  const pruned = await pruneClaimed(queue.prompts, readClaim)
  const index = pruned.kept.findIndex(
    (queued) => queued.label === label && queued.role === role,
  )
  const prompts =
    index === -1
      ? [...pruned.kept, prompt]
      : pruned.kept.map((queued, at) => (at === index ? prompt : queued))

  const settled = await settleMergeOrder(
    root,
    prompts,
    input.mergeOrder?.trim() ?? queue.mergeOrder,
  )
  await writeQueue(root, { mergeOrder: settled.mergeOrder, prompts })

  return {
    ok: true,
    path: relative(root, promptsPath(root)),
    action: index === -1 ? 'added' : 'replaced',
    prompt: listed,
    ...settled,
    dropped: pruned.dropped,
    claimUnread: [...pruned.unread, ...ownUnread],
  }
}

function claimReaderAt(root: string): ClaimReader {
  return async (branch) => {
    const report = await checkClaim(branch, { cwd: root })

    return {
      claimed: report.claimed,
      readable: report.sessionsReadable && report.refsReadable,
    }
  }
}

/**
 * Rows outlive a wave, so a launched row left queued would be pasted again.
 * An unreadable claim keeps its row, since dropping on a failed read loses a
 * prompt nobody launched.
 */
async function pruneClaimed(
  prompts: readonly Prompt[],
  readClaim: ClaimReader,
): Promise<{ kept: Prompt[]; dropped: DroppedPrompt[]; unread: string[] }> {
  const readings = await Promise.all(
    prompts.map(async (prompt) => {
      const branch = describe(prompt).branch
      return branch === undefined
        ? { prompt, branch, reading: null }
        : { prompt, branch, reading: await readClaim(branch) }
    }),
  )

  const kept: Prompt[] = []
  const dropped: DroppedPrompt[] = []
  const unread: string[] = []
  for (const { prompt, branch, reading } of readings) {
    if (branch === undefined || reading === null) {
      kept.push(prompt)
    } else if (!reading.readable) {
      unread.push(branch)
      kept.push(prompt)
    } else if (reading.claimed) {
      dropped.push({ label: prompt.label, role: prompt.role, branch })
    } else {
      kept.push(prompt)
    }
  }

  return { kept, dropped, unread }
}

/**
 * Drops a task's prompts, or one role's. A row that is not queued answers with
 * nothing removed, since the launch it records may already have been cleared.
 */
export async function removePrompts(
  root: string,
  task: string,
  role?: string,
): Promise<RemoveOutcome> {
  if (role !== undefined && !isRole(role)) {
    return refuse(
      'bad-input',
      `--role takes ${PROMPT_ROLES.join(', ')}, not ${role}.`,
    )
  }

  const queue = await readQueue(root)
  if ('ok' in queue) return queue

  const label = labelOf(task)
  const matches = (prompt: Prompt): boolean =>
    prompt.label === label && (role === undefined || prompt.role === role)
  const removed = queue.prompts
    .filter(matches)
    .map((prompt) => ({ label: prompt.label, role: prompt.role }))
  const path = relative(root, promptsPath(root))

  if (removed.length === 0) {
    return {
      ok: true,
      path,
      removed,
      mergeOrder: queue.mergeOrder,
      mergeOrderDropped: false,
    }
  }

  const prompts = queue.prompts.filter((prompt) => !matches(prompt))
  const settled = await settleMergeOrder(root, prompts, queue.mergeOrder)
  await writeQueue(root, { mergeOrder: settled.mergeOrder, prompts })

  return { ok: true, path, removed, ...settled }
}

export async function listPrompts(root: string): Promise<ListOutcome> {
  const queue = await readQueue(root)
  if ('ok' in queue) return queue

  return {
    ok: true,
    path: relative(root, promptsPath(root)),
    mergeOrder: queue.mergeOrder,
    prompts: queue.prompts.map(describe),
  }
}
