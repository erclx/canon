import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'vitest'
import { recordDir } from '@/roots/record'
import { archiveDir, declinedDir, tasksDir } from '@/tasks/archive'
import {
  backlogPath,
  type Finding,
  type FindingKind,
  orderingPath,
  type ValidateOptions,
} from '@/tasks/validate'

export let ROOT: string

export interface RowFixture {
  readonly stem: string
  readonly touches?: string
  readonly plan?: string
}

export function readyTable(rows: readonly RowFixture[]): string {
  const body = rows.map(
    ({ stem, touches = '`src/a.ts`', plan = `../plans/feature-${stem}.md` }) =>
      `| [${stem}](${stem}.md) | ${touches} | [${stem}](${plan}) |`,
  )

  return [
    '## Run now',
    '',
    '| Task | Touches | Plan |',
    '| ---- | ------- | ---- |',
    ...body,
    '',
  ].join('\n')
}

export function boardBody(sections: readonly string[]): string {
  return [
    '---',
    'title: Priority',
    'description: One line on what the board covers',
    '---',
    '',
    '# Priority',
    '',
    ...sections,
  ].join('\n')
}

export async function seedBoard(text: string): Promise<void> {
  mkdirSync(tasksDir(ROOT), { recursive: true })
  await writeFile(orderingPath(ROOT), text)
}

/** Seeds a task carrying no `Plan:` line, which the agreement check reports. */
export const NO_PLAN = ''

export async function seedTask(
  stem: string,
  outcomes = '',
  pullRequest?: number | readonly number[],
  plan: string = `../plans/feature-${stem}.md`,
): Promise<void> {
  mkdirSync(tasksDir(ROOT), { recursive: true })
  const numbers = typeof pullRequest === 'number' ? [pullRequest] : pullRequest
  const origin = numbers
    ? `Pull request: ${numbers.map((number) => `#${number}`).join(', ')}\n\n`
    : ''
  const cites = plan ? `Plan: [feature-${stem}](${plan})\n\n` : ''
  await writeFile(
    join(tasksDir(ROOT), `${stem}.md`),
    `# ${stem}\n\n${cites}${origin}## Outcomes\n\n${outcomes}\n`,
  )
}

/** Answers the trunk from a fixture, so no test reaches for a git history. */
export function trunkHolding(...landed: readonly number[]): ValidateOptions {
  return { trunk: async (number) => landed.includes(number) }
}

export const UNREACHABLE_TRUNK: ValidateOptions = {
  trunk: async () => undefined,
}

export async function seedArchivedTask(stem: string): Promise<void> {
  const archive = archiveDir(ROOT)
  mkdirSync(archive, { recursive: true })
  await writeFile(join(archive, `${stem}.md`), `# ${stem}\n`)
}

export async function seedDeclinedTask(stem: string): Promise<void> {
  const declined = declinedDir(ROOT)
  mkdirSync(declined, { recursive: true })
  await writeFile(join(declined, `${stem}.md`), `# ${stem}\n`)
}

export function needsPlanTable(rows: readonly string[]): string {
  return [
    '## Needs a plan',
    '',
    '| Task | Waiting on |',
    '| ---- | ---------- |',
    ...rows,
    '',
  ].join('\n')
}

/** A board holding one `## Needs a plan` row, for reading a single cell back. */
export function needsPlanBoard(cell: string): string {
  return boardBody([
    needsPlanTable([`| [v3.0-third](v3.0-third.md) | ${cell} |`]),
  ])
}

export function parkedTable(rows: readonly string[]): string {
  return [
    '## Up next',
    '',
    '| Task | Touches | Waiting on |',
    '| ---- | ------- | ---------- |',
    ...rows,
    '',
  ].join('\n')
}

export async function seedBacklog(lines: readonly string[]): Promise<void> {
  mkdirSync(tasksDir(ROOT), { recursive: true })
  await writeFile(
    backlogPath(ROOT),
    [
      '---',
      'title: Backlog',
      'description: One line on what the backlog holds',
      '---',
      '',
      '# Backlog',
      '',
      'Unordered. Nothing here is queued.',
      '',
      ...lines,
      '',
    ].join('\n'),
  )
}

export async function seedPlan(stem: string): Promise<void> {
  const plans = recordDir(ROOT, 'plans')
  mkdirSync(plans, { recursive: true })
  await writeFile(join(plans, `feature-${stem}.md`), `# ${stem}\n`)
}

/** A `Plan:` line linking the stem's own plan and a second one. */
export const SEVERAL_PLANS = (stem: string): string =>
  `Plan: [feature-${stem}](../plans/feature-${stem}.md), [feature-other](../plans/feature-other.md)`

/** Writes a task whose `Plan:` line is given verbatim, for shapes `seedTask` cannot build. */
export async function seedPlanLine(stem: string, line: string): Promise<void> {
  mkdirSync(tasksDir(ROOT), { recursive: true })
  await writeFile(
    join(tasksDir(ROOT), `${stem}.md`),
    `# ${stem}\n\n${line}\n\n## Outcomes\n\n`,
  )
}

export function kinds(findings: readonly Finding[]): FindingKind[] {
  return findings.map((finding) => finding.kind)
}

export function useRoot(): void {
  beforeEach(() => {
    ROOT = mkdtempSync(join(tmpdir(), 'canon-tasks-validate-'))
  })

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true })
  })
}
