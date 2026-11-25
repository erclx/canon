import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa, execaSync } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CLI,
  RUN_TIMEOUT_MS,
  WEB_ONLY_DEPLOY,
  initBranchRepo,
  markedCommentBody,
  writeFakeGh,
} from '@/commands/pr/fixture'

/** The web-only deploy with no path filter, so every path is one it serves. */
const DEPLOY_OF_EVERY_PATH = WEB_ONLY_DEPLOY.replace(
  "    paths:\n      - 'web/**'\n",
  '',
)

const LINES = Array.from({ length: 40 }, (_, index) => `line ${index + 1}`)

function edit(at: number, text: string): string {
  return `${LINES.map((line, index) => (index === at ? text : line)).join('\n')}\n`
}

describe('canon pr evidence --check across a rebase or a merge of the base', () => {
  let tempDir: string
  let repoRoot: string
  let forkPoint: string
  let built: string

  async function runCheck(root = repoRoot): Promise<Record<string, unknown>> {
    const result = await execa(
      process.execPath,
      [CLI, 'pr', 'evidence', '7', '--check', '--json', '--root', root],
      {
        cwd: root,
        reject: false,
        timeout: RUN_TIMEOUT_MS,
        env: { PATH: `${join(tempDir, 'bin')}:${process.env.PATH}` },
      },
    )
    return JSON.parse(result.stdout)
  }

  function git(...args: string[]): string {
    return String(
      execaSync('git', ['-C', repoRoot, ...args], {
        env: {
          GIT_AUTHOR_NAME: 't',
          GIT_AUTHOR_EMAIL: 't@t',
          GIT_COMMITTER_NAME: 't',
          GIT_COMMITTER_EMAIL: 't@t',
        },
      }).stdout,
    )
  }

  function writeDeploy(root: string, text: string): void {
    mkdirSync(join(root, '.github', 'workflows'), { recursive: true })
    writeFileSync(join(root, '.github', 'workflows', 'deploy.yml'), text)
  }

  /** Commits one file on `branch`, pushes it, and returns the commit. */
  function push(branch: string, path: string, text: string): string {
    git('checkout', '-q', branch)
    mkdirSync(join(repoRoot, path, '..'), { recursive: true })
    writeFileSync(join(repoRoot, path), text)
    git('add', path)
    git('commit', '-q', '-m', `edit ${path}`)
    git('push', '-q', '-f', 'origin', branch)
    return git('rev-parse', 'HEAD')
  }

  /** The one successful deploy run `gh run list` answers with. */
  function writeBuilt(headSha: string): void {
    writeFileSync(
      join(tempDir, 'runs.json'),
      JSON.stringify([
        {
          databaseId: 100,
          status: 'completed',
          conclusion: 'success',
          headSha,
          createdAt: '2026-11-18T00:00:00Z',
        },
      ]),
    )
  }

  /** Puts one file on both branches, so a later hunk on each side merges cleanly. */
  function seedShared(): void {
    push('main', 'web/shared.html', edit(0, 'line 1'))
    git('checkout', '-q', 'feat/x')
    git('merge', '-q', '--no-edit', 'main')
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'canon-pr-evidence-moved-'))
    repoRoot = join(tempDir, 'repo')
    mkdirSync(repoRoot)
    const commentsFile = join(tempDir, 'comments.json')
    const url = 'https://github.com/o/r/pull/7#issuecomment-100'
    writeFileSync(
      commentsFile,
      JSON.stringify({ comments: [{ url, body: markedCommentBody() }] }),
    )
    writeFileSync(join(tempDir, 'files.tsv'), 'modified\tweb/index.html\n')
    writeFakeGh(join(tempDir, 'bin'), commentsFile, join(tempDir, 'api.log'))
    initBranchRepo(repoRoot, { 'docs/guide.md': '# guide\n' })
    writeDeploy(repoRoot, WEB_ONLY_DEPLOY)
    forkPoint = git('rev-parse', 'main')
    execaSync('git', ['init', '-q', '--bare', join(tempDir, 'origin.git')])
    git('remote', 'add', 'origin', join(tempDir, 'origin.git'))
    built = push('feat/x', 'web/index.html', 'branch\n')
    push('main', 'web/main-only.html', 'main\n')
    git('checkout', '-q', 'feat/x')
    writeBuilt(built)
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should settle a preview over a rebase that left the branch diff equal', async () => {
    git('rebase', '-q', 'main')
    git('push', '-q', '-f', 'origin', 'feat/x')

    const record = await runCheck()

    expect(record).toMatchObject({
      reason: 'settled',
      previewHead: { reason: 'stale', built, servedSinceBuilt: false },
    })
  })

  it('should settle a rebase beside a change to a path the deploy does not serve', async () => {
    git('rebase', '-q', 'main')
    push('feat/x', 'docs/later.md', 'later\n')

    const record = await runCheck()

    expect(record).toMatchObject({
      reason: 'settled',
      previewHead: { servedSinceBuilt: false },
    })
  })

  it('should owe a preview over a rebase that changed a served path', async () => {
    git('rebase', '-q', 'main')
    push('feat/x', 'web/index.html', 'rewritten\n')

    const record = await runCheck()

    expect(record).toMatchObject({
      reason: 'owed',
      owed: ['preview'],
      previewHead: { servedSinceBuilt: true },
    })
  })

  it('should owe a preview over a rebase that dropped a served path', async () => {
    git('checkout', '-q', '-B', 'feat/x', 'main')
    push('feat/x', 'docs/later.md', 'later\n')

    const record = await runCheck()

    expect(record).toMatchObject({ reason: 'owed', owed: ['preview'] })
  })

  it('should owe a preview over a rebase that changed a served path git quotes', async () => {
    git('rebase', '-q', 'main')
    push('feat/x', 'web/caf\u00e9.html', 'new\n')

    const record = await runCheck()

    expect(record).toMatchObject({ reason: 'owed', owed: ['preview'] })
  })

  it('should settle an equal rebase under a deploy that serves every path', async () => {
    writeFileSync(
      join(repoRoot, '.github', 'workflows', 'deploy.yml'),
      DEPLOY_OF_EVERY_PATH,
    )
    git('rebase', '-q', 'main')
    git('push', '-q', '-f', 'origin', 'feat/x')

    const record = await runCheck()

    expect(record).toMatchObject({
      reason: 'settled',
      previewHead: { servedSinceBuilt: false },
    })
  })

  it('should settle a preview over a clean merge of the base that touched a served path', async () => {
    git('merge', '-q', '--no-edit', 'main')
    git('push', '-q', 'origin', 'feat/x')

    const record = await runCheck()

    expect(record).toMatchObject({
      reason: 'settled',
      previewHead: { servedSinceBuilt: false },
    })
  })

  it('should owe a preview over a merge followed by a commit to a served path', async () => {
    git('merge', '-q', '--no-edit', 'main')
    push('feat/x', 'web/index.html', 'more\n')

    const record = await runCheck()

    expect(record).toMatchObject({ reason: 'owed', owed: ['preview'] })
  })

  it('should read the base off the remote when the local copy trails it', async () => {
    push('main', 'web/second.html', 'second\n')
    git('checkout', '-q', 'feat/x')
    git('rebase', '-q', 'main')
    git('push', '-q', '-f', 'origin', 'feat/x')
    git('update-ref', 'refs/heads/main', forkPoint)
    git('update-ref', 'refs/remotes/origin/main', forkPoint)

    const record = await runCheck()

    expect(record).toMatchObject({ reason: 'settled' })
  })

  it('should refuse as gh-failed when the base is gone from the remote', async () => {
    git('rebase', '-q', 'main')
    git('push', '-q', '-f', 'origin', 'feat/x')
    const origin = join(tempDir, 'origin.git')
    git('-C', origin, 'update-ref', '-d', 'refs/heads/main')
    writeFileSync(join(tempDir, 'compared.txt'), 'complete\ndocs/a.md\n')

    const record = await runCheck()

    expect(record).toMatchObject({ reason: 'gh-failed' })
  })

  it('should owe a preview over a clean merge of a served path both sides wrote', async () => {
    seedShared()
    writeBuilt(push('feat/x', 'web/shared.html', edit(34, 'branch')))
    push('main', 'web/shared.html', edit(1, 'main'))
    git('checkout', '-q', 'feat/x')
    git('merge', '-q', '--no-edit', 'main')
    git('push', '-q', 'origin', 'feat/x')

    const record = await runCheck()

    expect(record).toMatchObject({
      reason: 'owed',
      owed: ['preview'],
      previewHead: { servedSinceBuilt: true },
    })
  })

  it('should settle a clean merge of a path both sides wrote that the deploy does not serve', async () => {
    push('main', 'docs/shared.md', edit(0, 'line 1'))
    git('checkout', '-q', 'feat/x')
    git('merge', '-q', '--no-edit', 'main')
    writeBuilt(push('feat/x', 'docs/shared.md', edit(34, 'branch')))
    push('main', 'docs/shared.md', edit(1, 'main'))
    git('checkout', '-q', 'feat/x')
    git('merge', '-q', '--no-edit', 'main')
    git('push', '-q', 'origin', 'feat/x')

    const record = await runCheck()

    expect(record).toMatchObject({ reason: 'settled' })
  })

  it('should settle from a clone that holds neither head nor the base tip', async () => {
    const clone = join(tempDir, 'clone')
    const from = join(tempDir, 'origin.git')
    const flags = ['--no-local', '--single-branch', '--branch', 'main']
    execaSync('git', ['clone', '-q', ...flags, from, clone])
    writeDeploy(clone, WEB_ONLY_DEPLOY)
    push('main', 'web/second.html', 'second\n')
    git('checkout', '-q', 'feat/x')
    git('rebase', '-q', 'main')
    git('push', '-q', '-f', 'origin', 'feat/x')
    push('main', 'web/third.html', 'third\n')

    const record = await runCheck(clone)

    expect(record).toMatchObject({
      reason: 'settled',
      previewHead: { reason: 'stale', built, servedSinceBuilt: false },
    })
  })
})
