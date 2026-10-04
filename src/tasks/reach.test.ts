import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recordDir } from '@/roots/record'
import { planReach, type ReachOutcome, readDeclarations } from '@/tasks/reach'
import { orderingPath } from '@/tasks/validate'

const changed = vi.hoisted(() => vi.fn())
const base = vi.hoisted(() => vi.fn())

vi.mock('@/git/files', () => ({
  listChangedFiles: changed,
  resolveBaseRef: base,
}))

let ROOT: string

function plan(entries: readonly string[]): string {
  return [
    '# Feature: A plan under test',
    '',
    '**Files to touch:**',
    '',
    ...entries.map((entry) => `- ${entry}`),
    '',
  ].join('\n')
}

async function writePlan(
  slug: string,
  entries: readonly string[],
): Promise<void> {
  const dir = recordDir(ROOT, 'plans')
  mkdirSync(dir, { recursive: true })
  await writeFile(join(dir, `feature-${slug}.md`), plan(entries), 'utf8')
}

async function writeBoard(rows: readonly string[]): Promise<void> {
  const body = [
    '# Tasks',
    '',
    '## Run now',
    '',
    '| Task | Touches | Plan |',
    '| ---- | ------- | ---- |',
    ...rows,
    '',
  ].join('\n')

  mkdirSync(recordDir(ROOT, 'tasks'), { recursive: true })
  await writeFile(orderingPath(ROOT), body, 'utf8')
}

function assertOk(
  outcome: ReachOutcome,
): asserts outcome is Extract<ReachOutcome, { ok: true }> {
  expect(outcome.ok).toBe(true)
}

function assertRefused(
  outcome: ReachOutcome,
): asserts outcome is Extract<ReachOutcome, { ok: false }> {
  expect(outcome.ok).toBe(false)
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'plan-reach-'))
  mkdirSync(join(ROOT, '.canon', 'plans'), { recursive: true })
  mkdirSync(join(ROOT, '.canon', 'tasks'), { recursive: true })
  base.mockResolvedValue('abc123')
  changed.mockResolvedValue([])
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
  vi.clearAllMocks()
})

describe('readDeclarations', () => {
  it('should read the path an entry leads with', () => {
    expect(readDeclarations(plan(['`src/a.ts`: the thing.']))).toEqual([
      'src/a.ts',
    ])
  })

  it('should drop a path cited inside the reason behind the colon', () => {
    const entries = [
      '`sandbox/a.sh`: moved by hand, which `src/gate/measures.ts` now fails on.',
    ]

    expect(readDeclarations(plan(entries))).toEqual(['sandbox/a.sh'])
  })

  it('should read both sides of a rename stated ahead of the colon', () => {
    const entries = ['`a/old.sh` → `a/new.sh`: moved with `git mv`.']

    expect(readDeclarations(plan(entries))).toEqual(['a/old.sh', 'a/new.sh'])
  })

  it('should read a subject carrying a parenthetical after the path', () => {
    expect(readDeclarations(plan(['`src/a.ts` (new): resolves it.']))).toEqual([
      'src/a.ts',
    ])
  })

  it('should ignore a colon sitting inside a backticked span', () => {
    const entries = ['`docs/a.md`: expect `canon:docs-sync` to reach it.']

    expect(readDeclarations(plan(entries))).toEqual(['docs/a.md'])
  })

  it('should take the whole entry as its subject when no colon follows', () => {
    const entries = ['`src/a.ts` is the module this branch adds']

    expect(readDeclarations(plan(entries))).toEqual(['src/a.ts'])
  })

  it('should drop a span naming no file', () => {
    const entries = ['`canon:git-ship` and `src/a.ts`: the pair.']

    expect(readDeclarations(plan(entries))).toEqual(['src/a.ts'])
  })

  it('should read nothing from a plan carrying no such section', () => {
    expect(readDeclarations('# Feature: bare\n\nnothing here.\n')).toEqual([])
  })

  it('should read nothing from a section stating None identified', () => {
    expect(readDeclarations(plan(['None identified.']))).toEqual([])
  })
})

describe('planReach', () => {
  it('should report a written path its own plan never declared', async () => {
    await writePlan('mine', ['`src/a.ts`: the thing.'])
    changed.mockResolvedValue(['src/a.ts', 'src/b.ts'])

    const outcome = await planReach(ROOT, 'mine')

    assertOk(outcome)
    expect(outcome.undeclared).toEqual(['src/b.ts'])
  })

  it('should treat a declared folder as covering the files under it', async () => {
    await writePlan('mine', ['`src/tasks/`: the whole folder.'])
    changed.mockResolvedValue(['src/tasks/reach.ts'])

    const outcome = await planReach(ROOT, 'mine')

    assertOk(outcome)
    expect(outcome.undeclared).toEqual([])
  })

  it('should not read a declared file as covering its folder siblings', async () => {
    await writePlan('mine', ['`src/tasks/reach.ts`: one file.'])
    changed.mockResolvedValue(['src/tasks/other.ts'])

    const outcome = await planReach(ROOT, 'mine')

    assertOk(outcome)
    expect(outcome.undeclared).toEqual(['src/tasks/other.ts'])
  })

  it('should report a path another live plan declares', async () => {
    await writePlan('mine', ['`src/a.ts`: mine.'])
    await writePlan('theirs', ['`src/b.ts`: theirs.'])
    changed.mockResolvedValue(['src/a.ts', 'src/b.ts'])

    const outcome = await planReach(ROOT, 'mine')

    assertOk(outcome)
    expect(outcome.claimed).toEqual([
      {
        path: 'src/b.ts',
        holders: [
          {
            name: 'feature-theirs',
            source: 'plan',
            declaration: 'src/b.ts',
            rowed: false,
          },
        ],
      },
    ])
  })

  it('should not report its own plan as claiming what it declared', async () => {
    await writePlan('mine', ['`src/a.ts`: mine.'])
    changed.mockResolvedValue(['src/a.ts'])

    const outcome = await planReach(ROOT, 'mine')

    assertOk(outcome)
    expect(outcome.claimed).toEqual([])
  })

  it('should report a path a Run now row holds', async () => {
    await writePlan('mine', ['`src/a.ts`: mine.'])
    await writeBoard([
      '| [t1](t1.md) | `src/b.ts` | [t1](../plans/feature-theirs.md) |',
    ])
    changed.mockResolvedValue(['src/b.ts'])

    const outcome = await planReach(ROOT, 'mine')

    assertOk(outcome)
    expect(outcome.claimed).toEqual([
      {
        path: 'src/b.ts',
        holders: [{ name: 't1', source: 'row', declaration: 'src/b.ts' }],
      },
    ])
  })

  it('should report one claim when a plan and its row hold the same path', async () => {
    await writePlan('mine', ['`src/a.ts`: mine.'])
    await writePlan('theirs', ['`src/b.ts`: theirs.'])
    await writeBoard([
      '| [t1](t1.md) | `src/b.ts` | [t1](../plans/feature-theirs.md) |',
    ])
    changed.mockResolvedValue(['src/b.ts'])

    const outcome = await planReach(ROOT, 'mine')

    assertOk(outcome)
    expect(outcome.claimed).toHaveLength(1)
    expect(outcome.claimed[0]?.holders.map((held) => held.source)).toEqual([
      'plan',
      'row',
    ])
  })

  it('should mark a holding plan that carries a dispatch row', async () => {
    await writePlan('mine', ['`src/a.ts`: mine.'])
    await writePlan('theirs', ['`src/b.ts`: theirs.'])
    await writeBoard([
      '| [t1](t1.md) | `src/c.ts` | [t1](../plans/feature-theirs.md) |',
    ])
    changed.mockResolvedValue(['src/b.ts'])

    const outcome = await planReach(ROOT, 'mine')

    assertOk(outcome)
    expect(outcome.claimed[0]?.holders[0]?.rowed).toBe(true)
  })

  it('should mark a holding plan that carries no dispatch row', async () => {
    await writePlan('mine', ['`src/a.ts`: mine.'])
    await writePlan('theirs', ['`src/b.ts`: theirs.'])
    await writeBoard([
      '| [t1](t1.md) | `src/c.ts` | [t1](../plans/feature-other.md) |',
    ])
    changed.mockResolvedValue(['src/b.ts'])

    const outcome = await planReach(ROOT, 'mine')

    assertOk(outcome)
    expect(outcome.claimed[0]?.holders[0]?.rowed).toBe(false)
  })

  it('should report one claim per path when two plans hold it', async () => {
    await writePlan('mine', ['`src/a.ts`: mine.'])
    await writePlan('theirs', ['`src/b.ts`: theirs.'])
    await writePlan('others', ['`src/b.ts`: also theirs.'])
    changed.mockResolvedValue(['src/b.ts'])

    const outcome = await planReach(ROOT, 'mine')

    assertOk(outcome)
    expect(outcome.claimed).toHaveLength(1)
    expect(outcome.claimed[0]?.holders).toHaveLength(2)
  })

  it('should skip the Run now row pointing at the branch own plan', async () => {
    await writePlan('mine', ['`src/a.ts`: mine.'])
    await writeBoard([
      '| [t1](t1.md) | `src/a.ts` | [t1](../plans/feature-mine.md) |',
    ])
    changed.mockResolvedValue(['src/a.ts'])

    const outcome = await planReach(ROOT, 'mine')

    assertOk(outcome)
    expect(outcome.claimed).toEqual([])
  })

  it('should report a plan claim with no board on disk', async () => {
    await writePlan('mine', ['`src/a.ts`: mine.'])
    await writePlan('theirs', ['`src/b.ts`: theirs.'])
    changed.mockResolvedValue(['src/b.ts'])

    const outcome = await planReach(ROOT, 'mine')

    assertOk(outcome)
    expect(outcome.claimed).toHaveLength(1)
    expect(outcome.board).toBe(false)
    expect(outcome.rows).toBe(0)
  })

  it('should count the live plans it compared against', async () => {
    await writePlan('mine', ['`src/a.ts`: mine.'])
    await writePlan('theirs', ['`src/b.ts`: theirs.'])
    changed.mockResolvedValue(['src/a.ts'])

    const outcome = await planReach(ROOT, 'mine')

    assertOk(outcome)
    expect(outcome.plans).toBe(1)
  })

  it('should resolve a plan named by a board-relative path', async () => {
    await writePlan('mine', ['`src/a.ts`: mine.'])
    changed.mockResolvedValue(['src/a.ts'])

    const outcome = await planReach(ROOT, '../plans/feature-mine.md')

    assertOk(outcome)
    expect(outcome.plan).toBe('.canon/plans/feature-mine.md')
  })

  it('should pass a named base ref through to the resolver', async () => {
    await writePlan('mine', ['`src/a.ts`: mine.'])

    await planReach(ROOT, 'mine', { ref: 'origin/release' })

    expect(base).toHaveBeenCalledWith(ROOT, 'origin/release')
  })

  it('should read the range at the repo it was given', async () => {
    await writePlan('mine', ['`src/a.ts`: mine.'])

    await planReach(ROOT, 'mine', { repo: '/elsewhere' })

    expect(base).toHaveBeenCalledWith('/elsewhere', undefined)
    expect(changed).toHaveBeenCalledWith('/elsewhere', 'abc123')
  })

  it('should read the records at the root while the range comes from the repo', async () => {
    await writePlan('mine', ['`src/a.ts`: mine.'])
    await writePlan('theirs', ['`src/b.ts`: theirs.'])
    changed.mockResolvedValue(['src/b.ts'])

    const outcome = await planReach(ROOT, 'mine', { repo: '/elsewhere' })

    assertOk(outcome)
    expect(outcome.claimed).toHaveLength(1)
  })

  it('should refuse a reference naming no plan', async () => {
    const outcome = await planReach(ROOT, 'absent')

    assertRefused(outcome)
    expect(outcome.reason).toBe('no-plan')
  })

  it('should refuse an empty reference as bad input', async () => {
    const outcome = await planReach(ROOT, '   ')

    assertRefused(outcome)
    expect(outcome.reason).toBe('bad-input')
  })

  it('should refuse a base no ref resolves against', async () => {
    await writePlan('mine', ['`src/a.ts`: mine.'])
    base.mockResolvedValue(undefined)

    const outcome = await planReach(ROOT, 'mine')

    assertRefused(outcome)
    expect(outcome.reason).toBe('no-base')
  })

  it('should refuse a changed set git could not read', async () => {
    await writePlan('mine', ['`src/a.ts`: mine.'])
    changed.mockResolvedValue(undefined)

    const outcome = await planReach(ROOT, 'mine')

    assertRefused(outcome)
    expect(outcome.reason).toBe('no-diff')
  })
})
