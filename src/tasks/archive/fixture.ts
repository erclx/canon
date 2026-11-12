import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'vitest'
import { tasksDir } from '@/tasks/archive'

export let ROOT: string

const INDEX_SEED = `---
title: Tasks
subtitle: One file per task, ordered by phase label
---

# Tasks

One file per task, ordered by phase label
`

export interface TaskFixture {
  readonly stem?: string
  readonly pullRequest?: number | readonly number[]
  readonly plan?: string
  readonly planLine?: string
  readonly ready?: string
  readonly outcomes?: string
  readonly pending?: readonly string[]
}

function taskBody({
  pullRequest,
  plan,
  planLine,
  ready,
  outcomes = '- [x] Outcome: it shipped',
  pending,
}: TaskFixture): string {
  const lines = [
    '---',
    "title: 'v28.1: A task'",
    'description: One line on what this task achieves',
    '---',
    '',
    '# v28.1: A task',
    '',
  ]

  if (plan) lines.push(`Plan: [${plan}](${plan})`)
  if (planLine) lines.push(planLine)
  if (ready) lines.push(`Ready: [${ready}](../ready/${ready}/)`)
  if (pullRequest) {
    const numbers =
      typeof pullRequest === 'number' ? [pullRequest] : pullRequest
    lines.push(
      `Pull request: ${numbers.map((number) => `#${number}`).join(', ')}`,
    )
  }
  if (pending) lines.push(`Pending branch: ${pending.join(', ')}`)

  lines.push(
    '',
    '## Outcomes',
    '',
    outcomes,
    '',
    '## Findings',
    '',
    '- A note.',
  )

  return `${lines.join('\n')}\n`
}

export async function seedPlan(name = 'feature-trigger.md'): Promise<string> {
  const dir = join(ROOT, '.canon', 'plans')
  mkdirSync(dir, { recursive: true })
  const path = join(dir, name)
  await writeFile(path, '# Feature: the plan a task cites\n')
  return path
}

export function archivedPlan(name = 'feature-trigger.md'): string {
  return join(ROOT, '.canon', 'plans', 'archive', name)
}

export async function seedTask(fixture: TaskFixture = {}): Promise<string> {
  const stem = fixture.stem ?? 'v28.1-trigger-escalation'
  const dir = tasksDir(ROOT)
  mkdirSync(dir, { recursive: true })
  await writeFile(join(dir, 'index.md'), INDEX_SEED)
  await writeFile(join(dir, `${stem}.md`), taskBody(fixture))
  return stem
}

export function useRoot(): void {
  beforeEach(() => {
    ROOT = mkdtempSync(join(tmpdir(), 'canon-tasks-archive-'))
  })

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true })
  })
}

export async function seedSibling(
  dir: string,
  name: string,
  body: string,
): Promise<string> {
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `${name}.md`)
  await writeFile(path, `# ${name}\n\n${body}\n`)
  return path
}
