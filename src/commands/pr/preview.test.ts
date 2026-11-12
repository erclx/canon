import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa, execaSync } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CLI,
  RUN_TIMEOUT_MS,
  WEB_ONLY_DEPLOY,
  initBranchRepo,
  writeFakeGh,
} from '@/commands/pr/fixture'

describe('canon pr preview', () => {
  let rootDir: string

  async function runPreview(
    args: string[],
  ): Promise<{ readonly reason: string | undefined; readonly exit: number }> {
    const result = await execa(
      process.execPath,
      [CLI, 'pr', 'preview', '--json', '--root', rootDir, ...args],
      { cwd: rootDir, reject: false, timeout: RUN_TIMEOUT_MS },
    )
    const record = JSON.parse(result.stdout) as { reason?: string }
    return { reason: record.reason, exit: result.exitCode ?? -1 }
  }

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'canon-pr-preview-'))
  })

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
  })

  it('should refuse as no-deploy before reading the pull request when no workflow deploys', async () => {
    const outcome = await runPreview(['1'])

    expect(outcome).toEqual({ reason: 'no-deploy', exit: 1 })
  })

  it('should refuse as unfenced when the dispatchable deploy passes no branch', async () => {
    mkdirSync(join(rootDir, '.github', 'workflows'), { recursive: true })
    await writeFile(
      join(rootDir, '.github', 'workflows', 'deploy.yml'),
      'on:\n  workflow_dispatch:\njobs:\n  d:\n    steps:\n      - run: wrangler pages deploy dist --project-name=site\n',
    )

    const outcome = await runPreview(['1'])

    expect(outcome).toEqual({ reason: 'unfenced', exit: 1 })
  })

  describe('--check against a fake gh', () => {
    let binDir: string
    let logFile: string
    let tip: string

    function git(...args: string[]): string {
      return execaSync('git', ['-C', rootDir, ...args], {
        env: {
          GIT_AUTHOR_NAME: 'Test',
          GIT_AUTHOR_EMAIL: 'test@example.com',
          GIT_COMMITTER_NAME: 'Test',
          GIT_COMMITTER_EMAIL: 'test@example.com',
        },
      }).stdout
    }

    async function runCheck(): Promise<{
      readonly reason: string | undefined
      readonly calls: string[]
    }> {
      const result = await execa(
        process.execPath,
        [CLI, 'pr', 'preview', '1', '--check', '--json', '--root', rootDir],
        {
          cwd: rootDir,
          reject: false,
          timeout: RUN_TIMEOUT_MS,
          env: {
            PATH: `${binDir}:${process.env.PATH ?? ''}`,
            FAKE_TIP: tip,
            FAKE_LOG: logFile,
          },
        },
      )
      const record = JSON.parse(result.stdout) as { reason?: string }
      const calls = readFileSync(logFile, 'utf8').split('\n').filter(Boolean)
      return { reason: record.reason, calls }
    }

    beforeEach(async () => {
      binDir = join(rootDir, 'bin')
      logFile = join(rootDir, 'gh.log')
      mkdirSync(binDir, { recursive: true })
      mkdirSync(join(rootDir, '.github', 'workflows'), { recursive: true })
      await writeFile(
        join(rootDir, '.github', 'workflows', 'deploy.yml'),
        [
          'on:',
          '  workflow_dispatch:',
          'jobs:',
          '  d:',
          '    steps:',
          // biome-ignore lint/suspicious/noTemplateCurlyInString: a workflow expression, not a template
          '      - run: wrangler pages deploy dist --project-name=site --branch=${{ github.ref_name }}',
          '      - run: echo "canon-preview-alias: $URL"',
          '',
        ].join('\n'),
      )
      await writeFile(
        join(binDir, 'gh'),
        readFileSync(
          new URL('../fixtures/gh-preview-check.sh', import.meta.url),
          'utf8',
        ),
        { mode: 0o755 },
      )
      git('init', '--initial-branch=feat/x')
      git('config', 'user.email', 'test@example.com')
      git('config', 'user.name', 'Test')
      await writeFile(join(rootDir, 'a.txt'), 'a')
      git('add', 'a.txt')
      git('commit', '-m', 'chore: init')
      const bare = join(rootDir, 'origin.git')
      execaSync('git', ['init', '--bare', bare])
      git('remote', 'add', 'origin', bare)
      git('push', 'origin', 'feat/x')
      tip = git('rev-parse', 'HEAD').trim()
    })

    it('should list runs with the workflow_dispatch event filter', async () => {
      const { calls } = await runCheck()

      const listing = calls.find((call) => call.startsWith('run list'))
      expect(listing).toContain('--event workflow_dispatch')
    })

    it('should read fresh without dispatching a workflow', async () => {
      const { reason, calls } = await runCheck()

      expect({
        reason,
        dispatched: calls.some((call) => call.startsWith('workflow run')),
      }).toEqual({ reason: 'fresh', dispatched: false })
    })
  })

  it('should refuse --check combined with --timeout before reading anything', async () => {
    const outcome = await runPreview(['1', '--check', '--timeout', '5'])

    expect(outcome).toEqual({ reason: 'check-timeout', exit: 1 })
  })

  it('should list --check and its four reasons in the help text', async () => {
    const result = await execa(
      process.execPath,
      [CLI, 'pr', 'preview', '--help'],
      {
        reject: false,
        timeout: RUN_TIMEOUT_MS,
      },
    )

    expect(result.stdout).toMatch(/--check/)
    for (const reason of ['fresh', 'stale', 'building', 'no-build']) {
      expect(result.stdout).toContain(reason)
    }
  })

  it('should refuse a timeout that is not a positive number of minutes', async () => {
    const outcome = await runPreview(['1', '--timeout', 'soon'])

    expect(outcome).toEqual({ reason: 'bad-timeout', exit: 1 })
  })
})

describe('canon pr preview against the pull request files', () => {
  let tempDir: string
  let repoRoot: string

  async function runPreviewRecord(
    args: string[] = [],
  ): Promise<Record<string, unknown>> {
    const result = await execa(
      process.execPath,
      [CLI, 'pr', 'preview', '7', '--json', '--root', repoRoot, ...args],
      {
        cwd: repoRoot,
        reject: false,
        timeout: RUN_TIMEOUT_MS,
        env: { PATH: `${join(tempDir, 'bin')}:${process.env.PATH}` },
      },
    )
    return JSON.parse(result.stdout)
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'canon-pr-preview-files-'))
    repoRoot = join(tempDir, 'repo')
    const commentsFile = join(tempDir, 'comments.json')
    mkdirSync(repoRoot)
    writeFileSync(commentsFile, '{"comments":[]}')
    writeFakeGh(join(tempDir, 'bin'), commentsFile, join(tempDir, 'api.log'))
    initBranchRepo(repoRoot, {
      '.github/workflows/deploy.yml': WEB_ONLY_DEPLOY,
    })
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should refuse as unserved when no changed path is one the deploy builds from', async () => {
    writeFileSync(join(tempDir, 'files.tsv'), 'modified\tsrc/canvas/a.ts\n')

    const record = await runPreviewRecord()

    expect(record).toMatchObject({ reason: 'unserved' })
  })

  it('should refuse --check as unserved the same way', async () => {
    writeFileSync(join(tempDir, 'files.tsv'), 'modified\tsrc/canvas/a.ts\n')

    const record = await runPreviewRecord(['--check'])

    expect(record).toMatchObject({ reason: 'unserved' })
  })

  it('should go on to the dispatch when a changed path is one the deploy builds from', async () => {
    writeFileSync(join(tempDir, 'files.tsv'), 'modified\tweb/index.html\n')

    const record = await runPreviewRecord()

    expect(record).toMatchObject({ reason: 'gh-failed' })
  })

  it('should go on to the dispatch when the only served change removes a path', async () => {
    writeFileSync(join(tempDir, 'files.tsv'), 'removed\tweb/old.html\n')

    const record = await runPreviewRecord()

    expect(record).toMatchObject({ reason: 'gh-failed' })
  })

  it('should refuse as unreadable-changes when the changed files cannot be read', async () => {
    writeFileSync(join(tempDir, 'files-fail'), '')

    const record = await runPreviewRecord()

    expect(record).toMatchObject({ reason: 'unreadable-changes' })
  })
})
