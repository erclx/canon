import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { once } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { execa, execaSync, type ResultPromise } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { countEvidenceCases, renderEvidenceBody } from '@/pr/evidence'

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
        `#!/bin/sh
echo "$*" >> "$FAKE_LOG"
case "$1 $2" in
  "api repos/{owner}/{repo}/pulls/1") printf '{"number":1,"head":{"ref":"feat/x","sha":"%s"}}' "$FAKE_TIP" ;;
  "run list") printf '[{"databaseId":7,"status":"completed","conclusion":"success","headSha":"%s","createdAt":"2026-10-02T10:00:00Z"}]' "$FAKE_TIP" ;;
  *) exit 0 ;;
esac
`,
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
 *
 * The pull request's files, head, and merge base come from the repository's
 * own `main...HEAD` unless a fixture beside `apiLog` names them: `files.tsv`
 * holds `status<TAB>path` rows, `head` a sha, `merge-base` a sha, and
 * `files-fail` makes the files read fail. The rows become the files API's JSON
 * array and pass through the `--jq` filter the caller sent, so a filter that
 * mangles its own output fails here as it would against GitHub. Every files
 * read appends its arguments to `files-calls.log`.
 */
function writeFakeGh(bin: string, comments: string, apiLog: string): void {
  mkdirSync(bin, { recursive: true })
  const fx = dirname(apiLog)
  const script = [
    '#!/usr/bin/env bash',
    'set -o pipefail',
    `fx='${fx}'`,
    'f=.; p=; for a in "$@"; do [ "$p" = --jq ] && f=$a; p=$a; done',
    'case "$*" in',
    '  *graphql*|"pr "*|"repo view"*) exit 1 ;;',
    `  api*pulls/7/files*) echo "$*" >> "$fx/files-calls.log"; [ -f "$fx/files-fail" ] && exit 1; { if [ -f "$fx/files.tsv" ]; then cat "$fx/files.tsv"; else git diff --name-status --no-renames main...HEAD | sed -e 's/^A/added/' -e 's/^M/modified/' -e 's/^D/removed/'; fi; } | jq -Rn '[inputs | select(length > 0) | split("\\t") | {status: .[0], filename: .[1]}]' | jq -r "$f" ;;`,
    `  api*contents/*) a="$*"; p=\${a##*contents/}; p=\${p%%\\?*}; r=\${a##*ref=}; [ -f "$fx/img/$r-$(basename "$p")" ] && cat "$fx/img/$r-$(basename "$p")" || exit 1 ;;`,
    '  api*compare/*) if [ -f "$fx/merge-base" ]; then cat "$fx/merge-base"; else git merge-base main HEAD; fi ;;',
    `  api*issues/7/comments*) jq '[.comments[] | {html_url: .url, body}]' '${comments}' | jq -r "$f" ;;`,
    '  "api repos/{owner}/{repo}/pulls/7") if [ -f "$fx/head" ]; then h=$(cat "$fx/head"); else h=$(git rev-parse HEAD); fi; echo "{\\"number\\":7,\\"head\\":{\\"ref\\":\\"feat/x\\",\\"sha\\":\\"$h\\"},\\"base\\":{\\"ref\\":\\"main\\"},\\"mergeable_state\\":\\"clean\\"}" ;;',
    '  "api repos/{owner}/{repo}") echo "{\\"full_name\\":\\"o/r\\"}" ;;',
    `  api*) printf '%s' "\${@: -1}" > '${apiLog}'; echo "{}" ;;`,
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

  it('should render a marked body for a checklist alone with no evidence image and no local address', async () => {
    const record = await runEvidenceCommand([
      '--checklist',
      join(tempDir, 'checklist.md'),
    ])

    expect(record.reason).toBe('ok')
    expect(record.body).toContain('<!-- pr-checklist:start -->')
    expect(record.body).toContain('<!-- pr-checklist:end -->')
    expect(record.body).toContain('<!-- pr-evidence:')
  })

  it('should render a checklist and a local address together with no evidence image', async () => {
    const record = await runEvidenceCommand([
      '--local',
      'http://localhost:5173',
      '--checklist',
      join(tempDir, 'checklist.md'),
    ])

    expect(record.reason).toBe('ok')
    expect(record.body?.split('\n').slice(0, 3)).toEqual([
      '## Evidence',
      '',
      '**Local preview:** http://localhost:5173',
    ])
  })
})

/** A marked comment body carrying every field the record reports, in the shape `renderEvidenceBody` writes. */
function markedCommentBody(): string {
  return [
    '## Evidence',
    '',
    '**Preview:** https://feat-x.site.pages.dev · **Local preview:** http://localhost:5173',
    '',
    '## What to look at',
    '',
    '<!-- pr-checklist:start -->',
    '- [x] the hero settles',
    '- [ ] the footer wraps',
    '<!-- pr-checklist:end -->',
    '',
    '<!-- pr-evidence: head=abc123 -->',
  ].join('\n')
}

describe('canon pr evidence reports the marked comment', () => {
  let tempDir: string
  let repoRoot: string
  let bin: string
  let commentsFile: string

  async function runEvidenceRecord(
    files: Record<string, string>,
    args: string[] = [],
  ): Promise<Record<string, unknown>> {
    initBranchRepo(repoRoot, files)
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

  function writeComments(bodies: readonly string[]): void {
    const comments = bodies.map((body, index) => ({
      url: `https://github.com/o/r/pull/7#issuecomment-${100 + index}`,
      body,
    }))
    writeFileSync(commentsFile, JSON.stringify({ comments }))
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'canon-pr-evidence-record-'))
    repoRoot = join(tempDir, 'repo')
    bin = join(tempDir, 'bin')
    commentsFile = join(tempDir, 'comments.json')
    mkdirSync(repoRoot)
    writeFakeGh(bin, commentsFile, join(tempDir, 'api.log'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should carry the marked fields on a no-evidence record', async () => {
    writeComments([
      markedCommentBody().replace(
        /## What to look at[\s\S]*<!-- pr-checklist:end -->\n\n/,
        '',
      ),
    ])

    const record = await runEvidenceRecord({ 'docs/guide.md': '# guide\n' })

    expect(record).toMatchObject({
      reason: 'no-evidence',
      preview: 'https://feat-x.site.pages.dev',
      local: 'http://localhost:5173',
    })
  })

  describe('carried checklist', () => {
    it('should render a checklist-only branch rather than report no-evidence', async () => {
      writeComments([markedCommentBody()])

      const record = await runEvidenceRecord({ 'docs/guide.md': '# guide\n' })

      expect(record.reason).toBe('ok')
    })

    it('should clear a tick the comment earned at another head', async () => {
      writeComments([markedCommentBody()])

      const record = await runEvidenceRecord({ 'docs/guide.md': '# guide\n' })

      expect(record.body).toContain('- [ ] the hero settles')
      expect(record.body).not.toContain('- [x]')
    })

    it('should report the boxes as posted rather than as the render settles them', async () => {
      writeComments([markedCommentBody()])

      const record = await runEvidenceRecord({ 'docs/guide.md': '# guide\n' })

      expect(record.boxes).toMatchObject([
        { number: 1, isTicked: true },
        { number: 2, isTicked: false },
      ])
    })

    it('should number the boxes the posted checklist carries', async () => {
      writeComments([markedCommentBody()])

      const record = await runEvidenceRecord({ 'docs/guide.md': '# guide\n' })

      expect(record.boxes).toMatchObject([
        { number: 1, text: 'the hero settles' },
        { number: 2, text: 'the footer wraps' },
      ])
    })
  })

  it('should carry the marked fields on an ok record', async () => {
    writeComments([markedCommentBody()])

    const record = await runEvidenceRecord({
      'evidence/hero.png': 'png',
    })

    expect(record).toMatchObject({
      reason: 'ok',
      preview: 'https://feat-x.site.pages.dev',
      local: 'http://localhost:5173',
      checklist: '- [x] the hero settles\n- [ ] the footer wraps',
    })
  })

  it('should drop a carried hosted preview the deploy does not build from', async () => {
    writeComments([markedCommentBody()])

    const record = await runEvidenceRecord({
      'evidence/hero.png': 'png',
      '.github/workflows/deploy.yml': WEB_ONLY_DEPLOY,
    })

    expect(record.body).not.toContain('**Preview:**')
    expect(record.body).toContain('**Local preview:** http://localhost:5173')
  })

  it('should keep an explicit --preview on a branch the deploy does not build from', async () => {
    writeComments([markedCommentBody()])

    const record = await runEvidenceRecord(
      {
        'evidence/hero.png': 'png',
        '.github/workflows/deploy.yml': WEB_ONLY_DEPLOY,
      },
      ['--preview', 'https://manual.pages.dev'],
    )

    expect(record.body).toContain('**Preview:** https://manual.pages.dev')
  })

  it('should omit every field when no comment carries the marker', async () => {
    writeComments(['- [ ] a checklist posted on its own'])

    const record = await runEvidenceRecord({ 'docs/guide.md': '# guide\n' })

    expect(record).not.toHaveProperty('preview')
    expect(record).not.toHaveProperty('local')
    expect(record).not.toHaveProperty('checklist')
  })

  it('should refuse as gh-failed on a no-evidence branch when the thread is unreadable', async () => {
    const record = await runEvidenceRecord({ 'docs/guide.md': '# guide\n' })

    expect(record.reason).toBe('gh-failed')
  })
})

describe('canon pr evidence reads the pull request', () => {
  let tempDir: string
  let repoRoot: string
  let commentsFile: string

  async function runEvidenceRecord(
    args: string[],
  ): Promise<Record<string, unknown>> {
    const result = await execa(
      process.execPath,
      [CLI, 'pr', 'evidence', '7', '--json', '--root', repoRoot, ...args],
      {
        cwd: repoRoot,
        reject: false,
        timeout: RUN_TIMEOUT_MS,
        env: { PATH: `${join(tempDir, 'bin')}:${process.env.PATH}` },
      },
    )
    return JSON.parse(result.stdout)
  }

  function writeFixture(name: string, text: string): void {
    writeFileSync(join(tempDir, name), text)
  }

  function writeComment(body: string): void {
    writeFileSync(
      commentsFile,
      JSON.stringify({
        comments: [
          { url: 'https://github.com/o/r/pull/7#issuecomment-100', body },
        ],
      }),
    )
  }

  function bodyWithCases(): string {
    return renderEvidenceBody(
      [
        {
          state: 'dark',
          items: [
            { path: 'evidence/dark/hero.png', stem: 'hero', added: true },
          ],
        },
      ],
      'o/r',
      'base',
      'abc123',
    )
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'canon-pr-evidence-api-'))
    repoRoot = join(tempDir, 'repo')
    commentsFile = join(tempDir, 'comments.json')
    mkdirSync(repoRoot)
    writeFileSync(commentsFile, '{"comments":[]}')
    writeFakeGh(join(tempDir, 'bin'), commentsFile, join(tempDir, 'api.log'))
    initBranchRepo(repoRoot, { 'docs/guide.md': '# guide\n' })
    execaSync('git', ['-C', repoRoot, 'checkout', '-q', 'main'])
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should compare the set the pull request lists while the checkout sits on main with none', async () => {
    writeFixture(
      'files.tsv',
      'added\tevidence/dark/hero.png\nmodified\tevidence/dark/nav.png\n',
    )
    writeFixture('head', 'deadbeef')
    writeFixture('merge-base', 'cafe01')

    const record = await runEvidenceRecord(['--preview', 'https://p.dev'])

    expect(record).toMatchObject({
      reason: 'ok',
      head: 'deadbeef',
      base: 'cafe01',
    })
    expect(countEvidenceCases(String(record.body))).toBe(2)
  })

  it('should report each evidence state with its stems on the ok record', async () => {
    writeFixture(
      'files.tsv',
      'added\tevidence/dark/hero.png\nmodified\tevidence/dark/nav.png\n',
    )
    writeFixture('head', 'deadbeef')
    writeFixture('merge-base', 'cafe01')

    const record = await runEvidenceRecord(['--preview', 'https://p.dev'])

    expect(record.states).toEqual([
      {
        state: 'dark',
        items: [
          { path: 'evidence/dark/hero.png', stem: 'hero', added: true },
          { path: 'evidence/dark/nav.png', stem: 'nav', added: false },
        ],
      },
    ])
  })

  it('should pin every image link to the head the pull request reports', async () => {
    writeFixture('files.tsv', 'modified\tevidence/dark/nav.png\n')
    writeFixture('head', 'deadbeef')
    writeFixture('merge-base', 'cafe01')

    const record = await runEvidenceRecord(['--preview', 'https://p.dev'])

    expect(record.body).toContain(
      'https://github.com/o/r/blob/deadbeef/evidence/dark/nav.png?raw=true',
    )
  })

  it('should render a base image for a modified path and new for an added one', async () => {
    writeFixture(
      'files.tsv',
      'added\tevidence/dark/hero.png\nmodified\tevidence/dark/nav.png\n',
    )
    writeFixture('merge-base', 'cafe01')

    const record = await runEvidenceRecord(['--preview', 'https://p.dev'])

    expect(record.body).toContain('| hero | *(new)* |')
    expect(record.body).toContain(
      '| nav | <img src="https://github.com/o/r/blob/cafe01/evidence/dark/nav.png?raw=true" width="1000" alt="nav base"> |',
    )
  })

  describe('image widths', () => {
    function writeImage(ref: string, name: string, width: number): void {
      const bytes = Buffer.alloc(24)
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes)
      bytes.writeUInt32BE(width, 16)
      mkdirSync(join(tempDir, 'img'), { recursive: true })
      writeFileSync(join(tempDir, 'img', `${ref}-${name}`), bytes)
    }

    it('should render each image at the smaller of its own width and 1000', async () => {
      writeFixture(
        'files.tsv',
        'added\tevidence/dark/crop.png\nadded\tevidence/dark/full.png\n',
      )
      writeFixture('head', 'deadbeef')
      writeFixture('merge-base', 'cafe01')
      writeImage('deadbeef', 'crop.png', 38)
      writeImage('deadbeef', 'full.png', 2880)

      const record = await runEvidenceRecord(['--preview', 'https://p.dev'])

      expect(record.body).toContain('width="38" alt="crop head"')
      expect(record.body).toContain('width="1000" alt="full head"')
    })

    it('should read base and head widths at their own commits', async () => {
      writeFixture('files.tsv', 'modified\tevidence/dark/nav.png\n')
      writeFixture('head', 'deadbeef')
      writeFixture('merge-base', 'cafe01')
      writeImage('cafe01', 'nav.png', 38)
      writeImage('deadbeef', 'nav.png', 400)

      const record = await runEvidenceRecord(['--preview', 'https://p.dev'])

      expect(record.body).toContain('width="38" alt="nav base"')
      expect(record.body).toContain('width="400" alt="nav head"')
    })

    it('should render 1000 and keep the row when the header read fails', async () => {
      writeFixture('files.tsv', 'added\tevidence/dark/hero.png\n')
      writeFixture('head', 'deadbeef')
      writeFixture('merge-base', 'cafe01')

      const record = await runEvidenceRecord(['--preview', 'https://p.dev'])

      expect(record.body).toContain('width="1000" alt="hero head"')
      expect(record.widthUnread).toEqual(['head:evidence/dark/hero.png'])
    })

    it('should render 1000 for an image that is not a PNG', async () => {
      writeFixture('files.tsv', 'added\tevidence/dark/photo.jpg\n')
      writeFixture('head', 'deadbeef')
      writeFixture('merge-base', 'cafe01')
      writeImage('deadbeef', 'photo.jpg', 38)

      const record = await runEvidenceRecord(['--preview', 'https://p.dev'])

      expect(record.body).toContain('width="1000" alt="photo head"')
      expect(record).not.toHaveProperty('widthUnread')
    })
  })

  it('should drop a path the pull request removed', async () => {
    writeFixture(
      'files.tsv',
      'removed\tevidence/dark/gone.png\nmodified\tevidence/dark/nav.png\n',
    )

    const record = await runEvidenceRecord(['--preview', 'https://p.dev'])

    expect(countEvidenceCases(String(record.body))).toBe(1)
  })

  it('should render a renamed path as new', async () => {
    writeFixture('files.tsv', 'renamed\tevidence/dark/moved.png\n')

    const record = await runEvidenceRecord(['--preview', 'https://p.dev'])

    expect(record.body).toContain('| Case | Head |')
    expect(record.body).toContain('| moved | <img ')
    expect(record.body).not.toContain('*(new)*')
  })

  it('should render a copied path as new', async () => {
    writeFixture('files.tsv', 'copied\tevidence/dark/dup.png\n')

    const record = await runEvidenceRecord(['--preview', 'https://p.dev'])

    expect(record.body).toContain('| Case | Head |')
    expect(record.body).toContain('| dup | <img ')
    expect(record.body).not.toContain('*(new)*')
  })

  it('should refuse would-empty and print no body when a render holds no cases over a comment that does', async () => {
    writeComment(bodyWithCases())
    writeFixture('files.tsv', 'modified\tdocs/guide.md\n')

    const record = await runEvidenceRecord(['--preview', 'https://p.dev'])

    expect(record.reason).toBe('would-empty')
    expect(record).not.toHaveProperty('body')
  })

  it('should keep the marked fields on a would-empty record', async () => {
    writeComment(bodyWithCases())
    writeFixture('files.tsv', 'modified\tdocs/guide.md\n')

    const record = await runEvidenceRecord(['--preview', 'https://p.dev'])

    expect(record).toMatchObject({ commentId: 100 })
  })

  it('should still render ok over a marked comment that carries no cases', async () => {
    writeComment(
      '**Preview:** https://old.dev\n\n<!-- pr-evidence: head=abc -->',
    )
    writeFixture('files.tsv', 'modified\tdocs/guide.md\n')

    const record = await runEvidenceRecord(['--preview', 'https://p.dev'])

    expect(record.reason).toBe('ok')
  })

  it('should report no-evidence without a flag even over a comment carrying cases', async () => {
    writeComment(bodyWithCases())
    writeFixture('files.tsv', 'modified\tdocs/guide.md\n')

    const record = await runEvidenceRecord([])

    expect(record.reason).toBe('no-evidence')
  })

  it('should find a changed evidence image through the filter gh receives', async () => {
    writeFixture('files.tsv', 'modified\tevidence/dark/nav.png\n')

    const record = await runEvidenceRecord(['--preview', 'https://p.dev'])

    expect(record.reason).toBe('ok')
    expect(countEvidenceCases(String(record.body))).toBe(1)
  })

  it('should read the files through the paginated endpoint', async () => {
    writeFixture('files.tsv', 'added\tevidence/dark/hero.png\n')

    await runEvidenceRecord(['--preview', 'https://p.dev'])

    expect(readFileSync(join(tempDir, 'files-calls.log'), 'utf8')).toContain(
      '--paginate',
    )
  })

  it('should refuse rather than render a short set when the files read fails', async () => {
    writeFixture('files-fail', '')

    const record = await runEvidenceRecord(['--preview', 'https://p.dev'])

    expect(record.reason).toBe('unreadable-changes')
  })
})

/** A deploy workflow `findDeployWorkflow` resolves as `found`. */
const FENCED_DEPLOY = [
  'on:',
  '  workflow_dispatch:',
  'jobs:',
  '  deploy:',
  '    steps:',
  // biome-ignore lint/suspicious/noTemplateCurlyInString: a workflow expression, not a template
  '      - run: wrangler pages deploy dist --branch=${{ github.ref_name }}',
  '      - run: echo "canon-preview-alias: $ALIAS_URL"',
  '',
].join('\n')

/** A fenced deploy whose push trigger builds only from `web/`, in YAML the filter reader can parse. */
const WEB_ONLY_DEPLOY = [
  'on:',
  '  push:',
  '    branches: [main]',
  '    paths:',
  "      - 'web/**'",
  '  workflow_dispatch:',
  'jobs:',
  '  deploy:',
  '    steps:',
  // biome-ignore lint/suspicious/noTemplateCurlyInString: a workflow expression, not a template
  '      - run: wrangler pages deploy dist --branch=${{ github.ref_name }}',
  '      - run: |',
  '          echo "canon-preview-alias: $ALIAS_URL"',
  '',
].join('\n')

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

describe('canon pr evidence --check', () => {
  let tempDir: string
  let repoRoot: string
  let commentsFile: string

  async function runCheck(
    args: string[] = [],
  ): Promise<Record<string, unknown>> {
    const result = await execa(
      process.execPath,
      [
        CLI,
        'pr',
        'evidence',
        '7',
        '--check',
        '--json',
        '--root',
        repoRoot,
        ...args,
      ],
      {
        cwd: repoRoot,
        reject: false,
        timeout: RUN_TIMEOUT_MS,
        env: { PATH: `${join(tempDir, 'bin')}:${process.env.PATH}` },
      },
    )
    return JSON.parse(result.stdout)
  }

  function writeComment(body: string): void {
    writeFileSync(
      commentsFile,
      JSON.stringify({
        comments: [
          { url: 'https://github.com/o/r/pull/7#issuecomment-100', body },
        ],
      }),
    )
  }

  function writeDeployWorkflow(): void {
    mkdirSync(join(repoRoot, '.github', 'workflows'), { recursive: true })
    writeFileSync(
      join(repoRoot, '.github', 'workflows', 'deploy.yml'),
      FENCED_DEPLOY,
    )
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'canon-pr-evidence-check-'))
    repoRoot = join(tempDir, 'repo')
    commentsFile = join(tempDir, 'comments.json')
    mkdirSync(repoRoot)
    writeFileSync(commentsFile, '{"comments":[]}')
    writeFakeGh(join(tempDir, 'bin'), commentsFile, join(tempDir, 'api.log'))
    initBranchRepo(repoRoot, { 'docs/guide.md': '# guide\n' })
    execaSync('git', ['-C', repoRoot, 'checkout', '-q', 'main'])
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should owe evidence for a changed evidence image with no marked comment, read from a checkout on another branch', async () => {
    writeFileSync(
      join(tempDir, 'files.tsv'),
      'modified\tevidence/dark/nav.png\n',
    )

    const record = await runCheck()

    expect(record).toMatchObject({ reason: 'owed', owed: ['evidence'] })
  })

  it('should owe a preview for a marked comment with no preview line when a deploy workflow resolves', async () => {
    writeDeployWorkflow()
    writeComment('## What to look at\n\n<!-- pr-evidence: head=abc -->')

    const record = await runCheck()

    expect(record).toMatchObject({ reason: 'owed', owed: ['preview'] })
  })

  it('should owe no preview on a branch the deploy does not build from', async () => {
    mkdirSync(join(repoRoot, '.github', 'workflows'), { recursive: true })
    writeFileSync(
      join(repoRoot, '.github', 'workflows', 'deploy.yml'),
      WEB_ONLY_DEPLOY,
    )
    writeFileSync(join(tempDir, 'files.tsv'), 'modified\tsrc/canvas/a.ts\n')
    writeComment('## What to look at\n\n<!-- pr-evidence: head=abc -->')

    const record = await runCheck()

    expect(record).toMatchObject({ reason: 'settled', owed: [] })
  })

  it('should report settled for a marked comment with no preview line when no deploy workflow resolves', async () => {
    writeComment('## What to look at\n\n<!-- pr-evidence: head=abc -->')

    const record = await runCheck()

    expect(record).toMatchObject({ reason: 'settled', owed: [] })
  })

  it('should not read a local preview line as a hosted preview', async () => {
    writeDeployWorkflow()
    writeComment(
      '**Local preview:** http://localhost:5173\n\n<!-- pr-evidence: head=abc -->',
    )

    const record = await runCheck()

    expect(record).toMatchObject({ reason: 'owed', owed: ['preview'] })
  })

  it('should report settled and carry the marked fields when the comment opens with a preview', async () => {
    writeDeployWorkflow()
    writeFileSync(
      join(tempDir, 'files.tsv'),
      'modified\tevidence/dark/nav.png\n',
    )
    writeComment(markedCommentBody())

    const record = await runCheck()

    expect(record).toMatchObject({
      reason: 'settled',
      owed: [],
      preview: 'https://feat-x.site.pages.dev',
      local: 'http://localhost:5173',
      checklist: '- [x] the hero settles\n- [ ] the footer wraps',
    })
  })

  it('should report settled with no evidence image and no marked comment', async () => {
    writeDeployWorkflow()

    const record = await runCheck()

    expect(record).toMatchObject({ reason: 'settled', owed: [] })
  })

  it('should render no body and write nothing', async () => {
    writeFileSync(
      join(tempDir, 'files.tsv'),
      'modified\tevidence/dark/nav.png\n',
    )

    const record = await runCheck()

    expect(record).not.toHaveProperty('body')
    expect(existsSync(join(tempDir, 'api.log'))).toBe(false)
  })

  it.each([
    ['--preview', 'https://p.dev'],
    ['--local', 'http://localhost:5173'],
    ['--checklist', 'absent.md'],
  ])(
    'should refuse %s before any gh call and print no body',
    async (flag, value) => {
      const record = await runCheck([flag, value])

      expect(record).toMatchObject({ reason: 'check-writes' })
      expect(record).not.toHaveProperty('body')
      expect(existsSync(join(tempDir, 'files-calls.log'))).toBe(false)
    },
  )

  it('should check without the merge base the render needs', async () => {
    writeFileSync(
      join(tempDir, 'files.tsv'),
      'modified\tevidence/dark/nav.png\n',
    )
    writeFileSync(join(tempDir, 'merge-base'), '')

    const record = await runCheck()

    expect(record).toMatchObject({ reason: 'owed', owed: ['evidence'] })
  })

  it('should refuse gh-failed rather than report settled off an unread thread', async () => {
    rmSync(commentsFile)

    const record = await runCheck()

    expect(record.reason).toBe('gh-failed')
  })
})

describe('canon pr local', () => {
  let tempDir: string
  let repoRoot: string
  let commentsFile: string
  let apiLog: string
  let bin: string
  let server: ResultPromise | undefined

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
    server?.kill()
    server = undefined
    rmSync(tempDir, { recursive: true, force: true })
  })

  /**
   * Serves an HTML page from inside the worktree under the name the kernel
   * cuts Next's `next-server (vX.Y.Z)` title down to, and resolves its port.
   */
  async function serveAsNext(): Promise<number> {
    const script = [
      "require('fs').writeFileSync('/proc/self/comm', 'next-server (v1')",
      "const s = Bun.serve({ port: 0, fetch: () => new Response('<p>', { headers: { 'content-type': 'text/html' } }) })",
      'process.stdout.write(`${s.port}\\n`)',
    ].join('\n')
    const child = execa(process.execPath, ['-e', script], {
      cwd: repoRoot,
      reject: false,
      timeout: RUN_TIMEOUT_MS,
    })
    server = child
    const [chunk] = await Promise.race([
      once(child.stdout, 'data'),
      child.then(() => {
        throw new Error('the server exited before printing its port')
      }),
    ])
    return Number(String(chunk).trim())
  }

  it.runIf(existsSync('/proc/self/comm'))(
    'should report a server whose process name holds an unmatched parenthesis',
    async () => {
      const port = await serveAsNext()

      const outcome = await runLocal([])

      expect(outcome.record).toEqual(
        expect.objectContaining({
          reason: 'ok',
          url: expect.stringContaining(`:${port}`),
        }),
      )
    },
  )

  it('should refuse as no-server when nothing listens inside the worktree', async () => {
    const outcome = await runLocal([])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'no-server' }),
      exit: 1,
    })
  })

  it('should drop the address line and leave no note on --remove', async () => {
    writeMarkedComment(
      '## Evidence\n\n**Preview:** https://feat-x.site.pages.dev · **Local preview:** http://localhost:5173\n\n<!-- pr-evidence: head=abc -->',
    )

    const outcome = await runLocal(['7', '--remove'])

    expect(outcome.record.reason).toBe('removed')
    expect(readFileSync(apiLog, 'utf8')).toBe(
      'body=## Evidence\n\n<!-- pr-evidence: head=abc -->',
    )
  })

  it('should report no-line and write nothing when the comment carries no address line', async () => {
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

describe('canon pr tick', () => {
  let tempDir: string
  let repoRoot: string
  let commentsFile: string
  let apiLog: string
  let bin: string
  let tip: string

  const CHECKLIST = [
    '- [ ] the hero settles',
    '- [ ] the footer wraps',
    '- [ ] the mood is calm (taste)',
  ].join('\n')

  async function runTick(
    args: string[],
  ): Promise<{ readonly record: { reason?: string }; readonly exit: number }> {
    const result = await execa(
      process.execPath,
      [CLI, 'pr', 'tick', '7', '--json', '--root', repoRoot, ...args],
      {
        cwd: repoRoot,
        reject: false,
        timeout: RUN_TIMEOUT_MS,
        env: { PATH: `${bin}:${process.env.PATH}` },
      },
    )
    return { record: JSON.parse(result.stdout), exit: result.exitCode ?? -1 }
  }

  function writeMarkedComment(checklist: string | undefined): void {
    const body = renderEvidenceBody(
      [],
      'o/r',
      'aaaa000',
      tip,
      undefined,
      checklist,
    )
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
    tempDir = mkdtempSync(join(tmpdir(), 'canon-pr-tick-'))
    repoRoot = join(tempDir, 'repo')
    bin = join(tempDir, 'bin')
    commentsFile = join(tempDir, 'comments.json')
    apiLog = join(tempDir, 'api.log')
    mkdirSync(repoRoot)
    writeFakeGh(bin, commentsFile, apiLog)
    initBranchRepo(repoRoot, {})
    const remote = join(tempDir, 'remote.git')
    execaSync('git', ['init', '-q', '--bare', remote])
    execaSync('git', ['-C', repoRoot, 'remote', 'add', 'origin', remote])
    execaSync('git', ['-C', repoRoot, 'push', '-q', 'origin', 'feat/x'])
    tip = execaSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD']).stdout
    writeMarkedComment(CHECKLIST)
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should tick and stamp the named boxes through a PATCH', async () => {
    const outcome = await runTick(['--boxes', '1', '--head', tip.slice(0, 7)])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'ticked', head: tip }),
      exit: 0,
    })
    const written = readFileSync(apiLog, 'utf8')
    expect(written).toContain(
      `- [x] the hero settles · passed at \`${tip.slice(0, 7)}\`\n`,
    )
    expect(written).toContain('- [ ] the footer wraps\n')
  })

  it('should refuse a head that is not the remote tip and write nothing', async () => {
    const outcome = await runTick(['--boxes', '1', '--head', '1234567'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'stale-head' }),
      exit: 1,
    })
    expect(existsSync(apiLog)).toBe(false)
  })

  it('should refuse a taste box and write nothing', async () => {
    const outcome = await runTick(['--boxes', '1,3', '--head', tip])

    expect(outcome.record.reason).toBe('taste-box')
    expect(existsSync(apiLog)).toBe(false)
  })

  it('should refuse a box past the end of the checklist', async () => {
    const outcome = await runTick(['--boxes', '9', '--head', tip])

    expect(outcome.record.reason).toBe('no-box')
  })

  it('should refuse when the evidence comment carries no checklist', async () => {
    writeMarkedComment(undefined)

    const outcome = await runTick(['--boxes', '1', '--head', tip])

    expect(outcome.record.reason).toBe('no-checklist')
  })

  it('should refuse when no comment carries the marker', async () => {
    writeFileSync(commentsFile, '{"comments":[]}')

    const outcome = await runTick(['--boxes', '1', '--head', tip])

    expect(outcome.record.reason).toBe('no-comment')
  })

  it('should refuse a malformed box list', async () => {
    const outcome = await runTick(['--boxes', 'one', '--head', tip])

    expect(outcome.record.reason).toBe('bad-boxes')
  })
})

describe('canon pr frames', () => {
  let tempDir: string
  let bin: string
  let callLog: string

  /**
   * A gh that answers the frames branch as missing and refuses every write
   * with the status a token lacking write access gets, logging each call.
   */
  function writeReadOnlyGh(): void {
    mkdirSync(bin, { recursive: true })
    writeFileSync(
      join(bin, 'gh'),
      [
        '#!/usr/bin/env bash',
        `echo "$*" >> '${callLog}'`,
        'case "$*" in',
        '  "api repos/{owner}/{repo}") echo \'{"full_name":"o/r"}\' ;;',
        '  "api -X GET "*) echo "gh: Not Found (HTTP 404)" >&2; exit 1 ;;',
        '  "api -X "*) echo "gh: Resource not accessible by integration (HTTP 403)" >&2; exit 1 ;;',
        '  *) exit 1 ;;',
        'esac',
        '',
      ].join('\n'),
      { mode: 0o755 },
    )
  }

  async function runFrames(
    args: string[],
  ): Promise<{ readonly record: { reason?: string }; readonly exit: number }> {
    const result = await execa(
      process.execPath,
      [CLI, 'pr', 'frames', '--json', '--root', tempDir, ...args],
      {
        cwd: tempDir,
        reject: false,
        timeout: RUN_TIMEOUT_MS,
        env: { PATH: `${bin}:${process.env.PATH}` },
      },
    )
    return { record: JSON.parse(result.stdout), exit: result.exitCode ?? -1 }
  }

  function calls(): string[] {
    return existsSync(callLog)
      ? readFileSync(callLog, 'utf8').split('\n').filter(Boolean)
      : []
  }

  function addArgs(file: string): string[] {
    return [
      '7',
      '--add',
      join(tempDir, file),
      '--box',
      '1',
      '--head',
      'abc1234',
      '--pass',
      '20261002T154450Z',
    ]
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'canon-pr-frames-'))
    bin = join(tempDir, 'bin')
    callLog = join(tempDir, 'gh.log')
    writeReadOnlyGh()
    writeFileSync(
      join(tempDir, 'box-1.png'),
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]),
    )
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should refuse as bad-mode when no mode is passed', async () => {
    const outcome = await runFrames(['7'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'bad-mode' }),
      exit: 1,
    })
  })

  it('should refuse as bad-mode when --add and --drop are both passed', async () => {
    const outcome = await runFrames([...addArgs('box-1.png'), '--drop'])

    expect(outcome.record.reason).toBe('bad-mode')
  })

  it('should refuse as bad-mode when --prune names a pull request', async () => {
    const outcome = await runFrames(['7', '--prune', '30'])

    expect(outcome.record.reason).toBe('bad-mode')
  })

  it('should refuse as no-number when --drop names no pull request', async () => {
    const outcome = await runFrames(['--drop'])

    expect(outcome.record.reason).toBe('no-number')
  })

  it('should refuse as bad-box when --add carries no box', async () => {
    const outcome = await runFrames(['7', '--add', 'box-1.png'])

    expect(outcome.record.reason).toBe('bad-box')
  })

  it('should refuse as bad-head without calling gh when --head names no commit', async () => {
    const outcome = await runFrames([...addArgs('box-1.png'), '--head', 'main'])

    expect({ reason: outcome.record.reason, calls: calls() }).toEqual({
      reason: 'bad-head',
      calls: [],
    })
  })

  it('should refuse as bad-pass when --add carries no pass stamp', async () => {
    const outcome = await runFrames([
      '7',
      '--add',
      join(tempDir, 'box-1.png'),
      '--box',
      '1',
      '--head',
      'abc1234',
    ])

    expect(outcome.record.reason).toBe('bad-pass')
  })

  it('should refuse as bad-pass when the stamp is not compact UTC', async () => {
    const outcome = await runFrames([
      ...addArgs('box-1.png'),
      '--pass',
      '2026-10-02T15:44:50Z',
    ])

    expect(outcome.record.reason).toBe('bad-pass')
  })

  it('should refuse as bad-days when --prune is not a positive number', async () => {
    const outcome = await runFrames(['--prune', '0'])

    expect(outcome.record.reason).toBe('bad-days')
  })

  it('should refuse as unreadable-frame without calling gh when the file is not a PNG', async () => {
    writeFileSync(join(tempDir, 'notes.png'), 'text')

    const outcome = await runFrames(addArgs('notes.png'))

    expect({ outcome, calls: calls() }).toEqual({
      outcome: {
        record: expect.objectContaining({ reason: 'unreadable-frame' }),
        exit: 1,
      },
      calls: [],
    })
  })

  it('should refuse as read-only when GitHub refuses the write', async () => {
    const outcome = await runFrames(addArgs('box-1.png'))

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'read-only' }),
      exit: 1,
    })
  })

  it('should report nothing removed when --drop finds the branch missing', async () => {
    const outcome = await runFrames(['7', '--drop'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'ok', removed: [] }),
      exit: 0,
    })
  })

  it('should address no ref but the canon-frames branch', async () => {
    await runFrames(addArgs('box-1.png'))

    const refCalls = calls().filter((call) => call.includes('/git/ref'))
    expect(refCalls.every((call) => call.includes('heads/canon-frames'))).toBe(
      true,
    )
  })

  it('should list every refusal reason in the help text', async () => {
    const result = await execa(
      process.execPath,
      [CLI, 'pr', 'frames', '--help'],
      { reject: false, timeout: RUN_TIMEOUT_MS },
    )

    expect(
      [
        'bad-mode',
        'no-number',
        'bad-box',
        'bad-days',
        'unreadable-frame',
        'read-only',
        'unreadable-tip',
        'push-failed',
        'ref-conflict',
        'bad-head',
        'bad-pass',
      ].filter((reason) => !result.stdout.includes(reason)),
    ).toEqual([])
  })
})

/**
 * A `gh` standing in for the GitHub proxy a cloud session runs behind, which
 * serves REST and refuses GraphQL with a 403. Every `pr` subcommand, every
 * `repo view`, and every `graphql` call runs on GraphQL, so each one fails
 * here and a verb that reintroduces one fails the test that drives it.
 *
 * Fixtures live in `FAKE_DIR`: `pull.json` answers the single pull read,
 * `listing.json` the branch lookup, `reviews.json` the reviews read (a stream
 * of arrays stands for several pages), and `reviews-fail` makes that read 403.
 * The caller's `--jq` filter runs over each answer, as gh runs it.
 */
const PROXY_GH = `#!/usr/bin/env bash
set -o pipefail
fx="$FAKE_DIR"
echo "$*" >> "$fx/gh.log"
f=.; p=; for a in "$@"; do [ "$p" = --jq ] && f=$a; p=$a; done
case "$*" in
  *graphql*|"pr "*|"repo view"*) echo "gh: blocked by proxy (HTTP 403)" >&2; exit 1 ;;
  *"/pulls?head="*) jq -r "$f" "$fx/listing.json" ;;
  *"/pulls/7/reviews"*) [ -f "$fx/reviews-fail" ] && { echo "gh: (HTTP 403)" >&2; exit 1; }; jq -r "$f" "$fx/reviews.json" ;;
  *"/pulls/7/files"*) echo '[{"filename":"src/a.ts","status":"added"}]' | jq -r "$f" ;;
  *"/check-runs"*) echo '{"total_count":0,"check_runs":[]}' ;;
  *"/pulls/7") jq -r "$f" "$fx/pull.json" ;;
  *) exit 1 ;;
esac
`

describe('canon pr reads through REST alone', () => {
  let tempDir: string
  let repoRoot: string
  let tip: string

  function git(...args: string[]): string {
    return execaSync('git', ['-C', repoRoot, ...args], {
      env: {
        GIT_AUTHOR_NAME: 't',
        GIT_AUTHOR_EMAIL: 't@t',
        GIT_COMMITTER_NAME: 't',
        GIT_COMMITTER_EMAIL: 't@t',
      },
    }).stdout
  }

  function writeFixture(name: string, value: unknown): void {
    writeFileSync(
      join(tempDir, name),
      typeof value === 'string' ? value : JSON.stringify(value),
    )
  }

  function pullRow(overrides: Record<string, unknown> = {}) {
    return {
      number: 7,
      body: '## Key Changes\n\n- Add `src/a.ts`.\n',
      head: { ref: 'feat/x', sha: tip },
      base: { ref: 'main' },
      mergeable_state: 'clean',
      ...overrides,
    }
  }

  function markedReview(commit: string, submittedAt: string) {
    return {
      body: `## Review\n\nbody\n\n<!-- review-pr: commit=${commit} read-at=2026-10-03T10:00:00Z -->`,
      commit_id: 'f'.repeat(40),
      submitted_at: submittedAt,
    }
  }

  async function runVerb(
    verb: string,
    args: string[],
  ): Promise<Record<string, unknown>> {
    const result = await execa(
      process.execPath,
      [CLI, 'pr', verb, ...args, '--json', '--root', repoRoot],
      {
        cwd: repoRoot,
        reject: false,
        timeout: RUN_TIMEOUT_MS,
        env: {
          PATH: `${join(tempDir, 'bin')}:${process.env.PATH}`,
          FAKE_DIR: tempDir,
        },
      },
    )
    return JSON.parse(result.stdout)
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'canon-pr-rest-'))
    repoRoot = join(tempDir, 'repo')
    mkdirSync(repoRoot)
    mkdirSync(join(tempDir, 'bin'))
    writeFileSync(join(tempDir, 'bin', 'gh'), PROXY_GH, { mode: 0o755 })
    git('init', '-q', '-b', 'feat/x')
    writeFileSync(join(repoRoot, 'a.txt'), 'a')
    git('add', 'a.txt')
    git('commit', '-q', '-m', 'init')
    const bare = join(tempDir, 'origin.git')
    execaSync('git', ['init', '-q', '--bare', bare])
    git('remote', 'add', 'origin', bare)
    git('push', '-q', 'origin', 'feat/x')
    tip = git('rev-parse', 'HEAD').trim()
    writeFixture('pull.json', pullRow())
    writeFixture('listing.json', [pullRow()])
    writeFixture('reviews.json', [])
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should read the head of a named pull request', async () => {
    const record = await runVerb('head', ['7'])

    expect(record).toMatchObject({ number: 7, state: 'fresh', tip })
  })

  it('should resolve the pull request open on the checkout branch', async () => {
    const record = await runVerb('head', [])

    expect(record).toMatchObject({ number: 7, branch: 'feat/x' })
  })

  it('should refuse as ambiguous-pull when two open pull requests share the branch', async () => {
    writeFixture('listing.json', [
      pullRow(),
      pullRow({ number: 8, base: { ref: 'release' } }),
    ])

    const record = await runVerb('head', [])

    expect(record.reason).toBe('ambiguous-pull')
  })

  it('should read a dirty pull request with no run as conflicted', async () => {
    writeFixture('pull.json', pullRow({ mergeable_state: 'dirty' }))

    const record = await runVerb('checks', ['7'])

    expect(record).toMatchObject({ conflicted: true, mergeState: 'DIRTY' })
  })

  it('should not read an unknown merge state as conflicted', async () => {
    writeFixture('pull.json', pullRow({ mergeable_state: 'unknown' }))

    const record = await runVerb('checks', ['7'])

    expect(record).toMatchObject({ conflicted: false, mergeState: 'UNKNOWN' })
  })

  it('should take the covered range from the newest marker across pages', async () => {
    const pages = [
      [markedReview('aaaaaaa', '2026-10-03T09:00:00Z')],
      [markedReview('bbbbbbb', '2026-10-03T10:01:00Z')],
    ]
    writeFixture(
      'reviews.json',
      pages.map((page) => JSON.stringify(page)).join('\n'),
    )

    const record = await runVerb('review-state', ['7'])

    expect(record).toMatchObject({
      number: 7,
      state: 'open',
      commit: 'bbbbbbb',
      source: 'marker',
    })
  })

  it('should refuse rather than report a first pass when the reviews read is refused', async () => {
    writeFixture('reviews-fail', '')

    const record = await runVerb('review-state', ['7'])

    expect(record.reason).toBe('gh-failed')
  })

  it('should compare a live pull request body against its files', async () => {
    const record = await runVerb('key-changes', ['7'])

    expect(record).toMatchObject({ unmet: [] })
  })
})
