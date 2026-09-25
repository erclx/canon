import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { execa, execaSync } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const CLI = join(REPO_ROOT, 'src', 'cli.ts')
const RUN_TIMEOUT_MS = 30_000

/**
 * Spawns the CLI rather than importing the action, because the refusal
 * reports through `process.exitCode` and an in-process call would set it on
 * the test runner.
 */
async function runKeyChanges(
  cwd: string,
  args: string[],
): Promise<{ readonly reason: string | undefined }> {
  const result = await execa(
    process.execPath,
    [CLI, 'pr', 'key-changes', '--json', ...args],
    { cwd, reject: false, timeout: RUN_TIMEOUT_MS },
  )
  const record = JSON.parse(result.stdout) as { reason?: string }
  return { reason: record.reason }
}

describe('canon pr key-changes --body resolution', () => {
  let cwdDir: string
  let rootDir: string

  beforeEach(async () => {
    cwdDir = await mkdtemp(join(tmpdir(), 'canon-pr-cwd-'))
    rootDir = await mkdtemp(join(tmpdir(), 'canon-pr-root-'))
  })

  afterEach(async () => {
    await Promise.all([
      rm(cwdDir, { recursive: true, force: true }),
      rm(rootDir, { recursive: true, force: true }),
    ])
  })

  it('should resolve --body against the working directory, not --root', async () => {
    await writeFile(join(cwdDir, 'body.md'), '## Key Changes\n')

    const { reason } = await runKeyChanges(cwdDir, [
      '--body',
      'body.md',
      '--root',
      rootDir,
    ])

    expect(reason).not.toBe('unreadable-body')
  })

  it('should not resolve --body against --root', async () => {
    await writeFile(join(rootDir, 'body.md'), '## Key Changes\n')

    const { reason } = await runKeyChanges(cwdDir, [
      '--body',
      'body.md',
      '--root',
      rootDir,
    ])

    expect(reason).toBe('unreadable-body')
  })
})

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

  it('should refuse a timeout that is not a positive number of minutes', async () => {
    const outcome = await runPreview(['1', '--timeout', 'soon'])

    expect(outcome).toEqual({ reason: 'bad-timeout', exit: 1 })
  })
})

describe('canon pr key-changes credits a rename source and a .gitignore addition', () => {
  let repoRoot: string

  function git(...args: string[]): string {
    return execaSync('git', ['-C', repoRoot, ...args], {
      env: {
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.com',
      },
    }).stdout
  }

  function write(path: string, body: string): void {
    const full = join(repoRoot, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, `${body}\n`)
  }

  function commit(message: string, files: Record<string, string>): void {
    for (const [path, body] of Object.entries(files)) write(path, body)
    git('add', '--all')
    git('commit', '-m', message)
  }

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'canon-pr-key-changes-'))
    git('init', '--initial-branch=main')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'Test')
    git('config', 'diff.renames', 'true')
    commit('chore: init', {
      'README.md': 'seed',
      '.gitignore': 'node_modules/',
    })
  })

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true })
  })

  it('should carry unmet through neither a move bullet nor an ignore bullet', async () => {
    const base = git('rev-parse', 'HEAD').trim()

    git('mv', 'README.md', 'GUIDE.md')
    commit('feat: rename readme and ignore captures', {
      '.gitignore': ['node_modules/', 'web/screenshots/', 'web/evidence/'].join(
        '\n',
      ),
    })

    writeFileSync(
      join(repoRoot, 'body.md'),
      [
        '## Key Changes',
        '',
        '- Move `README.md` to `GUIDE.md`.',
        '- Ignore `web/screenshots/` and `web/evidence/`.',
        '',
      ].join('\n'),
    )

    const result = await execa(
      process.execPath,
      [
        CLI,
        'pr',
        'key-changes',
        '--json',
        '--body',
        'body.md',
        '--base',
        base,
        '--root',
        repoRoot,
      ],
      { cwd: repoRoot, reject: false, timeout: RUN_TIMEOUT_MS },
    )

    const record = JSON.parse(result.stdout) as {
      unmet?: readonly { path: string }[]
    }

    expect(record.unmet).toEqual([])
  })
})

describe('canon pr evidence --checklist', () => {
  let repoRoot: string

  beforeEach(async () => {
    repoRoot = await mkdtemp(join(tmpdir(), 'canon-pr-evidence-'))
  })

  afterEach(async () => {
    await rm(repoRoot, { recursive: true, force: true })
  })

  it('should refuse before any gh read when the checklist path resolves to nothing', async () => {
    const result = await execa(
      process.execPath,
      [
        CLI,
        'pr',
        'evidence',
        '--json',
        '--checklist',
        'absent.md',
        '--root',
        repoRoot,
      ],
      { cwd: repoRoot, reject: false, timeout: RUN_TIMEOUT_MS },
    )

    const record = JSON.parse(result.stdout) as { reason?: string }

    expect(record.reason).toBe('unreadable-checklist')
  })
})

/**
 * A `gh` stand-in that answers the reads `pr evidence` and `pr local` make and
 * records the body of any `gh api` write, so the command surface runs end to
 * end without a network.
 */
function writeFakeGh(bin: string, comments: string, apiLog: string): void {
  mkdirSync(bin, { recursive: true })
  const script = [
    '#!/usr/bin/env bash',
    'case "$*" in',
    `  api*) printf '%s' "\${@: -1}" > '${apiLog}'; echo "{}" ;;`,
    '  *headRefOid*) echo "{\\"number\\":7,\\"headRefName\\":\\"feat/x\\",\\"headRefOid\\":\\"$(git rev-parse HEAD)\\",\\"mergeStateStatus\\":\\"CLEAN\\"}" ;;',
    '  *nameWithOwner*) echo "{\\"nameWithOwner\\":\\"o/r\\"}" ;;',
    `  *comments*) cat '${comments}' ;;`,
    '  *) exit 1 ;;',
    'esac',
    '',
  ].join('\n')
  writeFileSync(join(bin, 'gh'), script, { mode: 0o755 })
}

function initBranchRepo(root: string, files: Record<string, string>): void {
  const git = (...args: string[]) =>
    execaSync('git', ['-C', root, ...args], {
      env: {
        GIT_AUTHOR_NAME: 't',
        GIT_AUTHOR_EMAIL: 't@t',
        GIT_COMMITTER_NAME: 't',
        GIT_COMMITTER_EMAIL: 't@t',
      },
    })
  git('init', '-q', '-b', 'main')
  writeFileSync(join(root, 'README.md'), '# r\n')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  git('checkout', '-q', '-b', 'feat/x')
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  git('add', '.')
  git('commit', '-q', '--allow-empty', '-m', 'change')
}

describe('canon pr evidence --local', () => {
  let tempDir: string
  let repoRoot: string
  let bin: string

  async function runEvidenceCommand(
    args: string[],
  ): Promise<{ readonly reason?: string; readonly body?: string }> {
    const result = await execa(
      process.execPath,
      [CLI, 'pr', 'evidence', '7', '--json', '--root', repoRoot, ...args],
      {
        cwd: repoRoot,
        reject: false,
        timeout: RUN_TIMEOUT_MS,
        env: { PATH: `${bin}:${process.env.PATH}` },
      },
    )
    return JSON.parse(result.stdout)
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'canon-pr-local-evidence-'))
    repoRoot = join(tempDir, 'repo')
    bin = join(tempDir, 'bin')
    const commentsFile = join(tempDir, 'comments.json')
    mkdirSync(repoRoot)
    writeFileSync(commentsFile, '{"comments":[]}')
    writeFakeGh(bin, commentsFile, join(tempDir, 'api.log'))
    initBranchRepo(repoRoot, { 'docs/guide.md': '# guide\n' })
    writeFileSync(join(tempDir, 'checklist.md'), '- [ ] the hero settles\n')
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should still report no-evidence when only a local address is given', async () => {
    const record = await runEvidenceCommand([
      '--local',
      'http://localhost:5173',
    ])

    expect(record.reason).toBe('no-evidence')
  })

  it('should render a checklist and a local address together with no evidence image', async () => {
    const record = await runEvidenceCommand([
      '--local',
      'http://localhost:5173',
      '--checklist',
      join(tempDir, 'checklist.md'),
    ])

    expect(record.reason).toBe('ok')
    expect(record.body?.split('\n')[0]).toBe(
      '**Local preview:** http://localhost:5173',
    )
  })
})

describe('canon pr local', () => {
  let tempDir: string
  let repoRoot: string
  let commentsFile: string
  let apiLog: string
  let bin: string

  async function runLocal(
    args: string[],
  ): Promise<{ readonly record: { reason?: string }; readonly exit: number }> {
    const result = await execa(
      process.execPath,
      [CLI, 'pr', 'local', '--json', '--root', repoRoot, ...args],
      {
        cwd: repoRoot,
        reject: false,
        timeout: RUN_TIMEOUT_MS,
        env: { PATH: `${bin}:${process.env.PATH}` },
      },
    )
    return { record: JSON.parse(result.stdout), exit: result.exitCode ?? -1 }
  }

  function writeMarkedComment(body: string): void {
    writeFileSync(
      commentsFile,
      JSON.stringify({
        comments: [
          { url: 'https://github.com/o/r/pull/7#issuecomment-99', body },
        ],
      }),
    )
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'canon-pr-local-'))
    repoRoot = join(tempDir, 'repo')
    bin = join(tempDir, 'bin')
    commentsFile = join(tempDir, 'comments.json')
    apiLog = join(tempDir, 'api.log')
    mkdirSync(repoRoot)
    writeFileSync(commentsFile, '{"comments":[]}')
    writeFakeGh(bin, commentsFile, apiLog)
    initBranchRepo(repoRoot, {})
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should refuse as no-server when nothing listens inside the worktree', async () => {
    const outcome = await runLocal([])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'no-server' }),
      exit: 1,
    })
  })

  it('should replace the local line with the note on --remove', async () => {
    writeMarkedComment(
      '**Local preview:** http://localhost:5173\n\n<!-- pr-evidence: head=abc -->',
    )

    const outcome = await runLocal(['7', '--remove', '--note', 'gone'])

    expect(outcome.record.reason).toBe('removed')
    expect(readFileSync(apiLog, 'utf8')).toBe(
      'body=gone\n\n<!-- pr-evidence: head=abc -->',
    )
  })

  it('should report no-line and write nothing when the comment carries no local line', async () => {
    writeMarkedComment('## Evidence\n\n<!-- pr-evidence: head=abc -->')

    const outcome = await runLocal(['7', '--remove'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'no-line' }),
      exit: 0,
    })
    expect(existsSync(apiLog)).toBe(false)
  })

  it('should report no-comment when no marked comment exists', async () => {
    const outcome = await runLocal(['7', '--remove'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'no-comment' }),
      exit: 0,
    })
  })
})
