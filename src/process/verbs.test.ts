import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runCli } from '@/process/harness'

interface GovStack {
  readonly name: string
  readonly rules: readonly string[]
}

let target: string

beforeEach(() => {
  target = mkdtempSync(join(tmpdir(), 'canon-verbs-'))
})

afterEach(() => {
  rmSync(target, { recursive: true, force: true })
})

function installedRuleFiles(root: string): string[] {
  return [
    ...new Bun.Glob('**/*.md').scanSync({
      cwd: join(root, '.claude', 'rules'),
      onlyFiles: true,
    }),
  ].sort()
}

function baseStack(root: string): GovStack {
  const catalog = runCli(['gov', 'list', '--json', '--stacks'], { cwd: root })
  const stacks = (catalog.json as { stacks: GovStack[] }).stacks
  const base = stacks.find((stack) => stack.name === 'base')
  if (!base) throw new Error('base stack missing from the catalog')
  return base
}

describe('gov install', () => {
  it('should exit 0 and write every rule the base stack names', () => {
    const base = baseStack(target)

    const run = runCli(['gov', 'install', 'base', target], { cwd: target })

    expect(run.status).toBe(0)
    expect(installedRuleFiles(target)).toHaveLength(base.rules.length)
  })

  it('should write the behavior rule at its group path', () => {
    runCli(['gov', 'install', 'base', target], { cwd: target })

    expect(
      readFileSync(
        join(target, '.claude/rules/canon/claude/565-behavior.md'),
        'utf8',
      ),
    ).toContain('# Behavior standards')
  })
})

describe('gov sync', () => {
  beforeEach(() => {
    runCli(['gov', 'install', 'base', target], { cwd: target })
  })

  it('should replace a local edit to an installed rule', () => {
    const path = join(target, '.claude/rules/canon/claude/565-behavior.md')
    writeFileSync(path, `${readFileSync(path, 'utf8')}\n<!-- local edit -->\n`)

    const run = runCli(['gov', 'sync', target], { cwd: target })

    expect(run.status).toBe(0)
    expect(readFileSync(path, 'utf8')).not.toContain('<!-- local edit -->')
  })
})

describe('tooling sync', () => {
  it('should replace a local edit once --write is passed', () => {
    const path = join(target, '.editorconfig')
    writeFileSync(path, '# a project owns this line\n')

    const run = runCli(['tooling', 'sync', 'base', target, '--write'], {
      cwd: target,
    })

    expect(run.status).toBe(0)
    expect(readFileSync(path, 'utf8')).not.toBe('# a project owns this line\n')
  })

  it('should leave the local edit in place and exit 1 without --write', () => {
    const path = join(target, '.editorconfig')
    writeFileSync(path, '# a project owns this line\n')

    const run = runCli(['tooling', 'sync', 'base', target], { cwd: target })

    expect(run.status).toBe(1)
    expect(readFileSync(path, 'utf8')).toBe('# a project owns this line\n')
  })
})

describe('tasks archive', () => {
  const stem = 'v99.0-process-tier-fixture'

  beforeEach(async () => {
    const dir = join(target, '.claude', 'tasks')
    await mkdir(dir, { recursive: true })
    await writeFile(
      join(dir, `${stem}.md`),
      [
        '---',
        `title: '${stem}: A fixture task'`,
        'description: Exists only for the process tier to archive.',
        '---',
        '',
        `# ${stem}: A fixture task`,
        '',
        '## Outcomes',
        '',
        '- [x] Outcome: it shipped',
        '',
      ].join('\n'),
    )
  })

  it('should move the task file into the archive folder and report it in the record', () => {
    const run = runCli(['tasks', 'archive', stem, '--root', target, '--json'], {
      cwd: target,
    })

    expect(run.status).toBe(0)
    expect(run.json).toMatchObject({ ok: true, task: stem })
    expect(() =>
      readFileSync(join(target, '.claude/tasks', `${stem}.md`)),
    ).toThrow()
    expect(
      readFileSync(join(target, '.claude/tasks/archive', `${stem}.md`), 'utf8'),
    ).toContain('A fixture task')
  })
})

describe('a list --json verb', () => {
  it('should carry the base stack in a machine-readable record', () => {
    const run = runCli(['gov', 'list', '--json', '--stacks'], { cwd: target })

    expect(run.status).toBe(0)
    expect(run.json).toMatchObject({
      stacks: expect.arrayContaining([
        expect.objectContaining({ name: 'base' }),
      ]),
    })
  })
})

/**
 * The gate is the one verb here whose stages are not run from a case, and the
 * decisive reason is recursion: its last stage runs `bun run test`, so a case
 * spawning the gate spawns the suite that spawns the case. Two more sit behind
 * it, since every stage reads this checkout by design and the first one writes
 * to it, so pointing the run at a per-case directory would measure the wrong
 * tree or reformat the repository under the suite. What the tier answers
 * instead is the question an in-process call cannot: whether the entry point
 * the two package scripts now name is registered in the binary at all.
 *
 * The stages themselves are driven end to end twice on every branch, by the
 * `pre-push` hook and by `bun run check:ci` on the pull request.
 */
describe('gate run', () => {
  it('should be registered under a group of its own', () => {
    const run = runCli(['gate', '--help'], { cwd: target })

    expect(run.status).toBe(0)
    expect(run.stdout).toContain('run')
  })

  it('should carry both flags the package scripts pass it', () => {
    const run = runCli(['gate', 'run', '--help'], { cwd: target })

    expect(run.status).toBe(0)
    expect(run.stdout).toContain('--all')
    expect(run.stdout).toContain('--no-write')
  })

  it('should state what each exit code means', () => {
    const run = runCli(['gate', 'run', '--help'], { cwd: target })

    expect(run.stdout).toContain('could not measure its input under CI')
  })

  it('should refuse a subcommand it does not register', () => {
    const run = runCli(['gate', 'bogus'], { cwd: target })

    expect(run.status).not.toBe(0)
  })
})
