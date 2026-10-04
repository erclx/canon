import { existsSync } from 'node:fs'
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { AUDITS } from '@/audits/catalog'
import { execa } from 'execa'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const CLI = join(REPO_ROOT, 'src', 'cli.ts')

/**
 * A linked worktree carries an empty `node_modules`, so the packages resolve
 * from an ancestor. The relocated copy sits under the temp directory and
 * reaches neither, which is why it needs the populated one named outright.
 */
function findInstalledModules(): string {
  let dir = REPO_ROOT
  while (!existsSync(join(dir, 'node_modules', 'commander'))) {
    const parent = dirname(dir)
    if (parent === dir) throw new Error('No node_modules holding commander')
    dir = parent
  }
  return join(dir, 'node_modules')
}
const SETUP_TIMEOUT_MS = 60_000
const RUN_TIMEOUT_MS = 30_000

/**
 * Carries every field `REQUIRED_FIELDS` names, so a case below fails on the
 * branch it is written for rather than on the shape validator that now runs
 * ahead of both write paths.
 */
const CONFORMING_REPORT = [
  '## Toolkit feedback',
  '',
  '### Surface',
  '',
  'CLI, canon feedback',
  '',
  '### Observed',
  '',
  'Something broke.',
  '',
  '### Proposed fix',
  '',
  'open',
  '',
].join('\n')

interface CliResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

interface RunOptions {
  readonly cwd: string
  readonly cli?: string
  readonly input?: string
  readonly emptyPath?: string
}

/**
 * Spawns the CLI as a process rather than importing it, because the exit code
 * is the assertion and an in-process action would set it on the test runner.
 * `process.execPath` is the Bun binary under `bun --bun vitest`, and naming it
 * absolutely is what lets a case blank `PATH` to hide `gh` or `yt-dlp`.
 */
async function runCli(args: string[], opts: RunOptions): Promise<CliResult> {
  const result = await execa(process.execPath, [opts.cli ?? CLI, ...args], {
    cwd: opts.cwd,
    input: opts.input ?? '',
    reject: false,
    timeout: RUN_TIMEOUT_MS,
    env: opts.emptyPath ? { PATH: opts.emptyPath } : {},
  })
  return {
    exitCode: result.exitCode ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

describe('command action exit codes', () => {
  let workDir: string
  let emptyPath: string
  let relocatedCli: string
  let namelessCli: string

  /**
   * `isToolkitSource` reads `.claude/` under `PROJECT_ROOT`, which resolves
   * from the CLI's own location rather than the working directory. Reaching
   * the two branches that guard against writing scratch into an installed
   * package therefore needs the CLI itself to sit outside the toolkit tree.
   */
  beforeAll(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'canon-exit-code-'))
    emptyPath = join(workDir, 'empty-path')
    await mkdir(emptyPath)

    const relocatedRoot = join(workDir, 'relocated')
    await cp(join(REPO_ROOT, 'src'), join(relocatedRoot, 'src'), {
      recursive: true,
    })
    await cp(
      join(REPO_ROOT, 'tsconfig.json'),
      join(relocatedRoot, 'tsconfig.json'),
    )
    await symlink(findInstalledModules(), join(relocatedRoot, 'node_modules'))
    relocatedCli = join(relocatedRoot, 'src', 'cli.ts')

    /**
     * A root a package manager owns, holding a manifest with no `name`. The
     * relocated copy above sits under no install tree, so `upgrade` refuses
     * there on the manager check and never reaches the name check this covers.
     */
    const namelessRoot = join(workDir, 'node_modules', 'nameless')
    await cp(join(relocatedRoot, 'src'), join(namelessRoot, 'src'), {
      recursive: true,
    })
    await cp(
      join(REPO_ROOT, 'tsconfig.json'),
      join(namelessRoot, 'tsconfig.json'),
    )
    await symlink(findInstalledModules(), join(namelessRoot, 'node_modules'))
    await writeFile(
      join(namelessRoot, 'package.json'),
      JSON.stringify({ version: '0.1.0' }),
      'utf8',
    )
    namelessCli = join(namelessRoot, 'src', 'cli.ts')
  }, SETUP_TIMEOUT_MS)

  afterAll(async () => {
    await rm(workDir, { recursive: true, force: true })
  })

  /**
   * Decks resolve against the working directory, so each case gets a project
   * of its own rather than sharing a slides folder another case wrote into.
   */
  async function writeDecks(
    name: string,
    decks: Record<string, Record<string, string>>,
  ): Promise<string> {
    const project = join(workDir, `${name}-project`)
    await mkdir(project)
    for (const [deck, files] of Object.entries(decks)) {
      const dir = join(project, '.canon', 'slides', deck)
      await mkdir(dir, { recursive: true })
      for (const [file, body] of Object.entries(files)) {
        await writeFile(join(dir, file), body, 'utf8')
      }
    }
    return project
  }

  it('should exit 1 when design render cannot find its source', async () => {
    const result = await runCli(
      ['design', 'render', '--source', 'absent-design.md'],
      { cwd: workDir },
    )

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('absent-design.md not found')
  })

  it('should exit 1 when slides render finds no deck', async () => {
    const project = await writeDecks('no-deck', {})

    const result = await runCli(['slides', 'render'], { cwd: project })

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('No deck under .canon/slides/')
  })

  it('should exit 1 when slides render is given no name among several decks', async () => {
    const project = await writeDecks('several', {
      alpha: { '01.html': '<p>one</p>\n' },
      beta: { '01.html': '<p>one</p>\n' },
    })

    const result = await runCli(['slides', 'render'], { cwd: project })

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('name one: alpha, beta')
  })

  it('should exit 1 when slides render names neither a deck nor a folder', async () => {
    const project = await writeDecks('unknown', {
      alpha: { '01.html': '<p>one</p>\n' },
    })

    const result = await runCli(['slides', 'render', 'absent'], {
      cwd: project,
    })

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('absent is neither a deck nor a folder')
  })

  it('should exit 1 when slides render is given a folder holding no html slides', async () => {
    const project = await writeDecks('empty-folder', {})
    const source = join(project, 'empty-deck')
    await mkdir(source)
    await writeFile(join(source, 'notes.md'), '# not a slide\n', 'utf8')

    const result = await runCli(['slides', 'render', source], {
      cwd: project,
    })

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain(`${source} holds no .html slides`)
  })

  it('should exit 1 when slides render reads a malformed deck file', async () => {
    const project = await writeDecks('malformed', {
      broken: {
        '01.html': '<p>one</p>\n',
        'deck.json': JSON.stringify({ slideNumbers: 'on' }),
      },
    })

    const result = await runCli(['slides', 'render', 'broken'], {
      cwd: project,
    })

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('slideNumbers must be true or false')
  })

  it('should exit 1 when feedback receives an empty body on stdin', async () => {
    const result = await runCli(['feedback'], { cwd: workDir, input: '   \n' })

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Empty feedback body')
  })

  it('should exit 1 when feedback has no toolkit source to write into', async () => {
    const result = await runCli(['feedback'], {
      cwd: workDir,
      cli: relocatedCli,
      input: CONFORMING_REPORT,
    })

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Local scratch needs the toolkit source')
  })

  /**
   * The validator gates both write paths, so this reaches the local one and
   * covers the flag path with it. Running `--github` here would file a real
   * issue on any machine holding an authenticated `gh`.
   */
  it('should exit 1 when feedback is missing a required field', async () => {
    const result = await runCli(['feedback'], {
      cwd: workDir,
      input: '## Toolkit feedback\n\n### Observed\n\nSomething broke.\n',
    })

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('### Surface')
  })

  it('should exit 1 when feedback --github finds neither gh nor a toolkit source', async () => {
    const result = await runCli(['feedback', '--github'], {
      cwd: workDir,
      cli: relocatedCli,
      input: CONFORMING_REPORT,
      emptyPath,
    })

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('gh is not installed')
  })

  /**
   * The only converted site behind a `process.stdin.isTTY` test, so a pipe
   * cannot reach it. `script` allocates a pty and `-e` forwards the child's
   * status, both util-linux spellings that macOS does not share. The guard
   * reads the binary rather than the platform, since a minimal Linux image
   * ships without it and an absent command reports as a failure, not a skip.
   */
  it.skipIf(process.platform !== 'linux' || Bun.which('script') === null)(
    'should exit 1 when feedback is run with a terminal on stdin',
    async () => {
      const result = await execa(
        'script',
        ['-qec', `'${process.execPath}' '${CLI}' feedback`, '/dev/null'],
        { cwd: workDir, input: '', reject: false, timeout: RUN_TIMEOUT_MS },
      )

      expect(result.exitCode).toBe(1)
      expect(result.stdout).toContain('No feedback on stdin')
    },
  )

  /**
   * A checkout is the one place `upgrade` must not run, and it is also the
   * place every contributor invokes the CLI from. The refusal lands before the
   * registry lookup, so the case asserts over no network at all.
   */
  it('should exit 1 when upgrade is run against a source checkout', async () => {
    const result = await runCli(['upgrade'], { cwd: workDir, emptyPath })

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('No package manager owns')
  })

  it('should record the refusal when upgrade is asked for JSON', async () => {
    const result = await runCli(['upgrade', '--json'], {
      cwd: workDir,
      emptyPath,
    })

    expect(JSON.parse(result.stdout).state).toBe('refused')
  })

  /**
   * The manifest name reaches a global install command, so a manifest that
   * parsed without one would install whatever sits under the placeholder. The
   * prompt defaults to yes headlessly, which leaves this refusal as the only
   * thing between a broken manifest and that install.
   */
  it('should exit 1 when upgrade finds a manifest carrying no package name', async () => {
    const result = await runCli(['upgrade'], {
      cwd: workDir,
      cli: namelessCli,
      emptyPath,
    })

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('No package name in')
  })

  it('should never name a package it could not read out of the manifest', async () => {
    const result = await runCli(['upgrade', '--json'], {
      cwd: workDir,
      cli: namelessCli,
      emptyPath,
    })

    const record = JSON.parse(result.stdout)
    expect(record.state).toBe('refused')
    expect(record.command).toBeUndefined()
  })

  it('should exit 1 when transcripts cannot find yt-dlp', async () => {
    const result = await runCli(
      ['transcripts', 'https://youtu.be/dQw4w9WgXcQ'],
      { cwd: workDir, emptyPath },
    )

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('yt-dlp not found on PATH')
  })

  /**
   * `git-pr` swallows the board-state refusals and reports every other one, so
   * a malformed argument landing in the swallowed set would lose the pull
   * request number with nothing saying so. These pin the reason rather than the
   * exit code, which the two classes share.
   */
  it('should refuse a non-numeric pull request number as bad-input', async () => {
    const result = await runCli(
      ['tasks', 'pull-request', 'not-a-number', '--plan', 'x', '--json'],
      { cwd: workDir },
    )

    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stdout).reason).toBe('bad-input')
  })

  it('should refuse an outcome call naming no position as bad-input', async () => {
    const result = await runCli(['tasks', 'outcome', '--plan', 'x', '--json'], {
      cwd: workDir,
    })

    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stdout).reason).toBe('bad-input')
  })

  it('should refuse naming both a stem and a pull request as bad-input', async () => {
    const result = await runCli(
      ['tasks', 'archive', 'v1-task', '--pull-request', '5', '--json'],
      { cwd: workDir },
    )

    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stdout).reason).toBe('bad-input')
  })

  it('should refuse naming both a task and a plan as bad-input', async () => {
    const result = await runCli(
      ['tasks', 'pull-request', '5', 'v1-task', '--plan', 'x', '--json'],
      { cwd: workDir },
    )

    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stdout).reason).toBe('bad-input')
  })
})

/**
 * Every audited verb refuses over a corpus this workDir does not carry.
 * `canon audits run` reads each `--json` record over its exit alone, so a
 * refusal that prints nothing there reaches the aggregate as unparseable
 * output rather than as a reading it can act on. These pin the parseable
 * shape rather than the wording, which is what the catalog matches on.
 */
describe('refusal records over an unmeasured corpus', () => {
  let workDir: string

  beforeAll(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'canon-refusal-record-'))
  }, SETUP_TIMEOUT_MS)

  afterAll(async () => {
    await rm(workDir, { recursive: true, force: true })
  })

  it('should record the reason when context audit finds no folder', async () => {
    const result = await runCli(['context', 'audit', '--json'], {
      cwd: workDir,
    })

    expect(result.exitCode).toBe(1)
    const record = JSON.parse(result.stdout)
    expect(record.root).toBe(workDir)
    expect(record.reason).toBe('no-folders')
  })

  it('should record the reason when markdown audit finds no git tree', async () => {
    const result = await runCli(['markdown', 'audit', '--json'], {
      cwd: workDir,
    })

    expect(result.exitCode).toBe(1)
    const record = JSON.parse(result.stdout)
    expect(record.root).toBe(workDir)
    expect(record.reason).toBe('no-git')
  })

  it('should record the reason when the skill audit finds no corpus', async () => {
    const result = await runCli(['claude', 'skills', 'audit', '--json'], {
      cwd: workDir,
    })

    expect(result.exitCode).toBe(1)
    const record = JSON.parse(result.stdout)
    expect(record.root).toBe(workDir)
    expect(record.reason).toBe('no-corpus')
  })

  it('should record the reason when comments scan is given a bad language', async () => {
    const result = await runCli(
      ['comments', 'scan', '--languages', 'cobol', '--json'],
      { cwd: workDir },
    )

    expect(result.exitCode).toBe(1)
    const record = JSON.parse(result.stdout)
    expect(record.root).toBe(workDir)
    expect(record.reason).toBe('bad-languages')
  })

  it('should record the reason when test order finds no git history', async () => {
    const result = await runCli(['gov', 'test-order', '--json'], {
      cwd: workDir,
    })

    expect(result.exitCode).toBe(1)
    const record = JSON.parse(result.stdout)
    expect(record.root).toBe(workDir)
    expect(record.reason).toBe('no-history')
  })

  /**
   * Parameterized over the catalog rather than named by hand, so a verb
   * `AUDITS` adds later inherits this case instead of the gap it exists to
   * close. Pins the shape rather than the reason, which the five cases above
   * already do for the verbs this row touches. `deps` reaches a network
   * index rather than a tree, so this offline fixture cannot pin its
   * behavior and it is left to its own suite.
   */
  it.each(
    AUDITS.filter((audit) => audit.id !== 'deps').map(
      (audit) => [audit.id, audit.argv] as const,
    ),
  )(
    'should write parseable JSON when %s runs --json here',
    async (_id, argv) => {
      const result = await runCli([...argv], { cwd: workDir })

      expect(() => JSON.parse(result.stdout)).not.toThrow()
    },
  )
})
