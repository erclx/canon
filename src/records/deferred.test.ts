import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkDeferrals, readDeferralRoot } from '@/records/deferred'
import { archiveDir, declinedDir, tasksDir } from '@/tasks/archive'

const CONTEXT = {
  filed: new Set(['v223.1-live-row', 'v100.2-archived-row']),
  declined: new Set(['v101.4-declined-row']),
}

function deferred(...bullets: string[]): string[] {
  return ['', ...bullets, '']
}

describe('checkDeferrals', () => {
  it.each([['v223.1-live-row'], ['v100.2-archived-row']])(
    'should pass a bullet naming the filed stem %s',
    (stem) => {
      const findings = checkDeferrals(
        deferred(`- \`${stem}\`: resize grips`),
        CONTEXT,
      )

      expect(findings).toEqual([])
    },
  )

  it.each([
    ['a declined stem', '- `v101.4-declined-row`: resize grips', 'declined'],
    ['an absent stem', '- `v999.9-nobody-filed`: resize grips', 'no live'],
    ['no code span', '- resize grips, later', 'no backticked'],
    [
      'a span past the opening',
      '- resize grips: `v223.1-live-row`',
      'no backticked',
    ],
    ['a non-stem span', '- `Resize Grips`: later', 'not a bare'],
    ['a .md suffix', '- `v223.1-live-row.md`: resize grips', 'not a bare'],
    [
      'a tasks/ prefix',
      '- `tasks/v223.1-live-row`: resize grips',
      'not a bare',
    ],
  ])('should report %s as unfiled', (_label, bullet, reason) => {
    const findings = checkDeferrals(deferred(bullet), CONTEXT)

    expect(findings.map((found) => found.kind)).toEqual(['deferral-unfiled'])
    expect(findings[0].message).toContain(reason)
  })

  it.each([
    ['a prose-only section', ['The resize grips wait for a later row.']],
    [
      'a paragraph ahead of a bullet',
      ['The grips wait.', '', '- `v223.1-live-row`: resize grips'],
    ],
  ])('should report %s as unfiled', (_label, lines) => {
    const findings = checkDeferrals(deferred(...lines), CONTEXT)

    expect(findings.map((found) => found.kind)).toEqual(['deferral-unfiled'])
    expect(findings[0].message).toContain('prose')
  })

  it('should read None identified. as a section deferring nothing', () => {
    expect(checkDeferrals(deferred('None identified.'), CONTEXT)).toEqual([])
  })

  it('should report nothing for a plan with no Deferred section', () => {
    expect(checkDeferrals(undefined, CONTEXT)).toEqual([])
  })

  it('should read a wrapped bullet as one entry', () => {
    const findings = checkDeferrals(
      deferred('- `v223.1-live-row`: resize grips', '  and the drag handles'),
      CONTEXT,
    )

    expect(findings).toEqual([])
  })
})

describe('readDeferralRoot', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-deferred-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  function seed(dir: string, ...names: string[]): void {
    mkdirSync(dir, { recursive: true })
    for (const name of names) writeFileSync(join(dir, name), '# Task\n')
  }

  it('should read nothing where no tasks folder exists', async () => {
    expect(await readDeferralRoot(root)).toBeUndefined()
  })

  it('should file live and archived stems and hold declined ones apart', async () => {
    seed(tasksDir(root), 'v1.0-live.md', 'priority.md', 'backlog.md')
    seed(archiveDir(root), 'v0.9-shipped.md', 'TASK-ARCHIVE.md')
    seed(declinedDir(root), 'v0.8-dropped.md')

    const context = await readDeferralRoot(root)

    expect(context && [...context.filed].sort()).toEqual([
      'v0.9-shipped',
      'v1.0-live',
    ])
    expect(context && [...context.declined]).toEqual(['v0.8-dropped'])
  })

  it('should read an empty board as a context filing nothing', async () => {
    seed(tasksDir(root))

    const context = await readDeferralRoot(root)

    expect(context?.filed.size).toBe(0)
  })
})
