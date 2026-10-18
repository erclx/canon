import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { tasksDir } from '@/tasks/archive'
import { decideClosing, readClosure, readIssues } from '@/tasks/closes'

function task(lines: readonly string[], outcomes = ['- [x] shipped']): string {
  return ['# Task', '', ...lines, '', '## Outcomes', '', ...outcomes, ''].join(
    '\n',
  )
}

describe('readIssues', () => {
  it('should return none without an Issue line', () => {
    expect(readIssues(task(['Plan: [p](../plans/p.md)']))).toEqual([])
  })

  it('should read a comma list and repeated lines in order, deduped', () => {
    const text = task(['Issue: #12, #13', 'Issue: #13', 'Issue: #7'])
    expect(readIssues(text)).toEqual([12, 13, 7])
  })

  it('should read the older bare-path form as no issue', () => {
    expect(readIssues(task(['Issue: ../issues/12.md']))).toEqual([])
    expect(readIssues(task(['Issue: #12 and more']))).toEqual([])
  })

  it('should ignore an Issue line inside a fence', () => {
    const text = task(['```', 'Issue: #99', '```', 'Issue: #12'])
    expect(readIssues(text)).toEqual([12])
  })
})

describe('decideClosing', () => {
  it('should name no issue and not close without an Issue line', () => {
    expect(decideClosing(task([]), ['feat/a'])).toEqual({
      issues: [],
      closing: false,
      reason: 'no-issues',
    })
  })

  it('should close on the last slice', () => {
    expect(decideClosing(task(['Issue: #12']), ['feat/a'])).toEqual({
      issues: [12],
      closing: true,
      reason: 'last-slice',
    })
  })

  it('should keep the issues but not close with an open outcome', () => {
    const text = task(['Issue: #12'], ['- [x] a', '- [ ] b'])
    expect(decideClosing(text, ['feat/a'])).toEqual({
      issues: [12],
      closing: false,
      reason: 'open-outcomes',
    })
  })

  it('should hold while another branch is pending, and close when only this one is', () => {
    const other = task(['Issue: #12', 'Pending branch: feat/a, feat/b'])
    expect(decideClosing(other, ['feat/a'])).toMatchObject({
      closing: false,
      reason: 'pending-branch',
    })

    const alone = task(['Issue: #12', 'Pending branch: feat/a'])
    expect(decideClosing(alone, ['feat/a']).closing).toBe(true)
    expect(decideClosing(alone, ['feat/a', 'feat/old']).closing).toBe(true)
  })

  it('should not close a task with no outcomes', () => {
    expect(decideClosing(task(['Issue: #12'], []), [])).toMatchObject({
      closing: false,
      reason: 'no-outcomes',
    })
  })
})

describe('readClosure', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'closes-'))
    mkdirSync(tasksDir(root), { recursive: true })
  })

  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('should read a task by stem', async () => {
    await writeFile(join(tasksDir(root), 'v1-a.md'), task(['Issue: #12']))

    const result = await readClosure(root, { kind: 'stem', stem: 'v1-a' }, [
      'feat/a',
    ])

    expect(result).toMatchObject({ ok: true, stem: 'v1-a', closing: true })
  })

  it('should refuse a task that does not exist', async () => {
    const result = await readClosure(
      root,
      { kind: 'stem', stem: 'missing' },
      [],
    )

    expect(result).toMatchObject({ ok: false })
  })
})
