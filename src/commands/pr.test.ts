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
import { PNG } from 'pngjs'
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
    await writeFile(join(cwdDir, 'body.md'), '## Key changes\n')

    const { reason } = await runKeyChanges(cwdDir, [
      '--body',
      'body.md',
      '--root',
      rootDir,
    ])

    expect(reason).not.toBe('unreadable-body')
  })

  it('should not resolve --body against --root', async () => {
    await writeFile(join(rootDir, 'body.md'), '## Key changes\n')

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
        '## Key changes',
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

const FAKE_GH = join(import.meta.dirname, 'fixtures', 'gh.sh')

/**
 * A `gh` stand-in that answers the reads `pr evidence` and `pr local` make and
 * records the body of any `gh api` write, so the command surface runs end to
 * end without a network. The program is `fixtures/gh.sh`, and the `gh` written
 * here is a wrapper exporting the three paths it reads.
 *
 * The pull request's files, head, and merge base come from the repository's
 * own `main...HEAD` unless a fixture beside `apiLog` names them: `files.tsv`
 * holds `status<TAB>path` rows, `head` a sha, `merge-base` a sha, and
 * `files-fail` makes the files read fail. `base-tree.json` answers the base
 * branch's recursive tree read, which fails without it. The rows become the files API's JSON
 * array and pass through the `--jq` filter the caller sent, so a filter that
 * mangles its own output fails here as it would against GitHub. Every files
 * read appends its arguments to `files-calls.log`.
 */
function writeFakeGh(bin: string, comments: string, apiLog: string): void {
  mkdirSync(bin, { recursive: true })
  const quote = (value: string): string => `'${value.replaceAll("'", `'\\''`)}'`
  const wrapper = [
    '#!/usr/bin/env bash',
    `export FAKE_GH_FX=${quote(dirname(apiLog))}`,
    `export FAKE_GH_COMMENTS=${quote(comments)}`,
    `export FAKE_GH_API_LOG=${quote(apiLog)}`,
    `exec bash ${quote(FAKE_GH)} "$@"`,
    '',
  ].join('\n')
  writeFileSync(join(bin, 'gh'), wrapper, { mode: 0o755 })
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

  it('should still report no-evidence when only a reel is given', async () => {
    const record = await runEvidenceCommand(['--reel', REEL_LINK])

    expect(record.reason).toBe('no-evidence')
  })

  it('should embed a passed reel under the addresses at the head it renders', async () => {
    const record = await runEvidenceCommand([
      '--local',
      'http://localhost:5173',
      '--reel',
      REEL_LINK,
      '--checklist',
      join(tempDir, 'checklist.md'),
    ])

    expect(record.reason).toBe('ok')
    const line = record.body?.split('\n')[4]
    expect(line).toMatch(/^\*\*Reel\*\* filmed at `[0-9a-f]{7}`:<br>/)
    expect(line).toContain(`<img src="${REEL_LINK}"`)
  })
})

const REEL_LINK =
  'https://github.com/o/r/blob/canon/frames/pr-7/abc1234/20261026T120000Z/reel.webp?raw=true'

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

  it('should report the posted reel and carry it forward under its own head', async () => {
    writeComments([
      markedCommentBody().replace(
        '## What to look at',
        `**Reel** filmed at \`abc1234\`:<br><img src="${REEL_LINK}" width="960" alt="reel filmed at abc1234">\n\n## What to look at`,
      ),
    ])

    const record = await runEvidenceRecord({ 'docs/guide.md': '# guide\n' })

    expect(record).toMatchObject({
      reason: 'ok',
      reel: { link: REEL_LINK, head: 'abc1234' },
    })
    expect(record.body).toContain('**Reel** filmed at `abc1234`')
  })

  describe('skip reasons', () => {
    function withoutAddresses(extra: string[] = []): string {
      return markedCommentBody().replace(
        '**Preview:** https://feat-x.site.pages.dev · **Local preview:** http://localhost:5173\n',
        extra.map((line) => `${line}\n\n`).join(''),
      )
    }

    it('should render each passed skip under the heading', async () => {
      writeComments([withoutAddresses()])

      const record = await runEvidenceRecord({ 'docs/guide.md': '# guide\n' }, [
        '--local-skip',
        'no-server: nothing listens on this worktree',
        '--reel-skip',
        'no-server',
      ])

      expect(record.reason).toBe('ok')
      expect(String(record.body).split('\n').slice(0, 6)).toEqual([
        '## Evidence',
        '',
        '**No local preview:** no-server: nothing listens on this worktree',
        '',
        '**No reel:** no-server',
        '',
      ])
    })

    it('should carry posted skips forward when no flag is passed', async () => {
      writeComments([
        withoutAddresses([
          '**No local preview:** no-server',
          '**No reel:** no-checklist',
        ]),
      ])

      const record = await runEvidenceRecord({ 'docs/guide.md': '# guide\n' })

      expect(record.body).toContain('**No local preview:** no-server')
      expect(record.body).toContain('**No reel:** no-checklist')
    })

    it('should replace a posted skip with the address and reel a later run passes', async () => {
      writeComments([
        withoutAddresses([
          '**No local preview:** no-server',
          '**No reel:** no-server',
        ]),
      ])

      const record = await runEvidenceRecord({ 'docs/guide.md': '# guide\n' }, [
        '--local',
        'http://localhost:5173',
        '--reel',
        REEL_LINK,
      ])

      expect(record.body).toContain('**Local preview:** http://localhost:5173')
      expect(record.body).toContain('**Reel** filmed at')
      expect(record.body).not.toContain('**No ')
    })

    it('should refuse a skip flag beside --check as check-writes', async () => {
      writeComments([withoutAddresses()])

      const record = await runEvidenceRecord({ 'docs/guide.md': '# guide\n' }, [
        '--check',
        '--reel-skip',
        'no-server',
      ])

      expect(record.reason).toBe('check-writes')
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

    it('should reset the body line to unchecked naming the new head', async () => {
      writeComments([markedCommentBody()])
      writeFileSync(
        join(tempDir, 'pr-body'),
        '## Testing\n\n- [x] UI pass, 1 of 1 boxes passed at `1111111` <!-- pr-ui-pass -->\n',
      )

      await runEvidenceRecord({ 'docs/guide.md': '# guide\n' })

      const head = execaSync('git', [
        '-C',
        repoRoot,
        'rev-parse',
        'HEAD',
      ]).stdout
      expect(readFileSync(join(tempDir, 'body-write.log'), 'utf8')).toBe(
        `body=## Testing\n\n- [ ] UI pass, not run at \`${head.slice(0, 7)}\` <!-- pr-ui-pass -->`,
      )
    })

    it('should leave the body alone when the line already names this head', async () => {
      writeComments([markedCommentBody()])
      const record = await runEvidenceRecord({ 'docs/guide.md': '# guide\n' })
      const head = String(record.head).slice(0, 7)
      writeFileSync(
        join(tempDir, 'pr-body'),
        `## Testing\n\n- [x] UI pass, 1 of 1 boxes passed at \`${head}\` <!-- pr-ui-pass -->\n`,
      )
      rmSync(join(tempDir, 'body-write.log'), { force: true })

      await execa(
        process.execPath,
        [CLI, 'pr', 'evidence', '7', '--json', '--root', repoRoot],
        {
          cwd: repoRoot,
          reject: false,
          timeout: RUN_TIMEOUT_MS,
          env: { PATH: `${bin}:${process.env.PATH}` },
        },
      )

      expect(existsSync(join(tempDir, 'body-write.log'))).toBe(false)
    })

    it('should write no body line when the body carries none', async () => {
      writeComments([markedCommentBody()])
      writeFileSync(join(tempDir, 'pr-body'), '## Testing\n\n- [x] ran it\n')

      await runEvidenceRecord({ 'docs/guide.md': '# guide\n' })

      expect(existsSync(join(tempDir, 'body-write.log'))).toBe(false)
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

    expect(record.body).toContain('**hero** *(new)*')
    expect(record.body).toContain(
      '<summary>Base</summary>\n\n<img src="https://github.com/o/r/blob/cafe01/evidence/dark/nav.png?raw=true" width="1000" alt="nav base">',
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

  describe('pixel comparison', () => {
    function writePng(ref: string, name: string, gray: number): void {
      const image = new PNG({ width: 32, height: 32 })
      image.data.fill(gray)
      mkdirSync(join(tempDir, 'img'), { recursive: true })
      writeFileSync(
        join(tempDir, 'img', `${ref}-${name}`),
        PNG.sync.write(image),
      )
    }

    function firstItem(record: Record<string, unknown>): unknown {
      const states = record.states as { items: unknown[] }[]
      return states[0]?.items[0]
    }

    it('should fold a modified pair whose pixels match', async () => {
      writeFixture('files.tsv', 'modified\tevidence/dark/nav.png\n')
      writeFixture('head', 'deadbeef')
      writeFixture('merge-base', 'cafe01')
      writePng('cafe01', 'nav.png', 255)
      writePng('deadbeef', 'nav.png', 255)

      const record = await runEvidenceRecord(['--preview', 'https://p.dev'])

      expect(firstItem(record)).toMatchObject({ withinTolerance: true })
      expect(record.body).toContain('<summary>Within tolerance (1)</summary>')
    })

    it('should leave a modified pair whose pixels moved open', async () => {
      writeFixture('files.tsv', 'modified\tevidence/dark/nav.png\n')
      writeFixture('head', 'deadbeef')
      writeFixture('merge-base', 'cafe01')
      writePng('cafe01', 'nav.png', 255)
      writePng('deadbeef', 'nav.png', 0)

      const record = await runEvidenceRecord(['--preview', 'https://p.dev'])

      expect(firstItem(record)).toMatchObject({ withinTolerance: false })
      expect(record.body).not.toContain('Within tolerance')
    })

    it('should omit the verdict when the base read fails', async () => {
      writeFixture('files.tsv', 'modified\tevidence/dark/nav.png\n')
      writeFixture('head', 'deadbeef')
      writeFixture('merge-base', 'cafe01')
      writePng('deadbeef', 'nav.png', 255)

      const record = await runEvidenceRecord(['--preview', 'https://p.dev'])

      expect(firstItem(record)).not.toHaveProperty('withinTolerance')
      expect(record.widthUnread).toEqual(['base:evidence/dark/nav.png'])
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

    expect(record.body).toContain('**moved**\n\n<img ')
    expect(record.body).not.toContain('alt="moved base"')
    expect(record.body).not.toContain('*(new)*')
  })

  it('should render a copied path as new', async () => {
    writeFixture('files.tsv', 'copied\tevidence/dark/dup.png\n')

    const record = await runEvidenceRecord(['--preview', 'https://p.dev'])

    expect(record.body).toContain('**dup**\n\n<img ')
    expect(record.body).not.toContain('alt="dup base"')
    expect(record.body).not.toContain('*(new)*')
  })

  it('should refuse would-empty and print no body when a render holds no cases over a comment that does', async () => {
    writeComment(bodyWithCases())
    writeFixture('files.tsv', 'modified\tdocs/guide.md\n')

    const record = await runEvidenceRecord(['--preview', 'https://p.dev'])

    expect(record.reason).toBe('would-empty')
    expect(record).not.toHaveProperty('body')
  })

  it('should refuse would-empty over a comment posted in the table layout', async () => {
    writeComment(
      [
        '## Evidence',
        '',
        '**Base:** [`base`](https://github.com/o/r/commit/base) · **Head:** [`abc123`](https://github.com/o/r/commit/abc123)',
        '',
        '<details open>',
        '<summary>dark (1)</summary>',
        '',
        '| Case | Head |',
        '| --- | --- |',
        '| hero | <img src="https://github.com/o/r/blob/abc123/evidence/dark/hero.png?raw=true" width="1000" alt="hero head"> |',
        '',
        '</details>',
        '',
        '<!-- pr-evidence: head=abc123 -->',
      ].join('\n'),
    )
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
    ['--reel', 'https://github.com/o/r/blob/canon/frames/reel.webp?raw=true'],
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

  describe('uncaptured', () => {
    function writeBaseTree(truncated: boolean, paths: string[]): void {
      writeFileSync(
        join(tempDir, 'base-tree.json'),
        JSON.stringify({
          truncated,
          tree: paths.map((path) => ({ path, type: 'blob' })),
        }),
      )
    }

    it('should name a painted change made with no capture in a project that keeps captures', async () => {
      writeBaseTree(false, ['e2e/evidence/dark/board.png', 'src/app.tsx'])
      writeFileSync(
        join(tempDir, 'files.tsv'),
        'modified\tsrc/client/styles.css\nadded\tcanon/design/board/claim.png\n',
      )

      const record = await runCheck()

      expect(record).toMatchObject({
        reason: 'settled',
        uncaptured: ['src/client/styles.css'],
      })
    })

    it('should report an empty list once an evidence image changed beside the stylesheet', async () => {
      writeBaseTree(false, ['e2e/evidence/dark/board.png'])
      writeFileSync(
        join(tempDir, 'files.tsv'),
        'modified\tsrc/client/styles.css\nmodified\te2e/evidence/dark/board.png\n',
      )

      const record = await runCheck()

      expect(record.uncaptured).toEqual([])
    })

    it('should omit the field when the base keeps no capture', async () => {
      writeBaseTree(false, ['src/app.tsx'])
      writeFileSync(join(tempDir, 'files.tsv'), 'modified\tsrc/client/a.css\n')

      const record = await runCheck()

      expect(record).not.toHaveProperty('uncaptured')
    })

    it('should omit the field when the base tree cannot be read', async () => {
      writeFileSync(join(tempDir, 'files.tsv'), 'modified\tsrc/client/a.css\n')

      const record = await runCheck()

      expect(record).toMatchObject({ reason: 'settled' })
      expect(record).not.toHaveProperty('uncaptured')
    })

    it('should omit the field when a cut-short listing shows no capture', async () => {
      writeBaseTree(true, ['src/app.tsx'])
      writeFileSync(join(tempDir, 'files.tsv'), 'modified\tsrc/client/a.css\n')

      const record = await runCheck()

      expect(record).not.toHaveProperty('uncaptured')
    })

    it('should read a capture found before the listing was cut short', async () => {
      writeBaseTree(true, ['e2e/evidence/dark/board.png'])
      writeFileSync(join(tempDir, 'files.tsv'), 'modified\tsrc/client/a.css\n')

      const record = await runCheck()

      expect(record.uncaptured).toEqual(['src/client/a.css'])
    })

    it('should carry the field on the no-evidence render record', async () => {
      writeBaseTree(false, ['e2e/evidence/dark/board.png'])
      writeFileSync(join(tempDir, 'files.tsv'), 'modified\tsrc/client/a.css\n')

      const result = await execa(
        process.execPath,
        [CLI, 'pr', 'evidence', '7', '--json', '--root', repoRoot],
        {
          cwd: repoRoot,
          reject: false,
          timeout: RUN_TIMEOUT_MS,
          env: { PATH: `${join(tempDir, 'bin')}:${process.env.PATH}` },
        },
      )

      expect(JSON.parse(result.stdout)).toMatchObject({
        reason: 'no-evidence',
        uncaptured: ['src/client/a.css'],
      })
    })

    it('should carry the field on the ok render record', async () => {
      writeBaseTree(false, ['e2e/evidence/dark/board.png'])
      writeFileSync(join(tempDir, 'files.tsv'), 'modified\tsrc/client/a.css\n')

      const result = await execa(
        process.execPath,
        [
          CLI,
          'pr',
          'evidence',
          '7',
          '--json',
          '--root',
          repoRoot,
          '--preview',
          'https://p.dev',
        ],
        {
          cwd: repoRoot,
          reject: false,
          timeout: RUN_TIMEOUT_MS,
          env: { PATH: `${join(tempDir, 'bin')}:${process.env.PATH}` },
        },
      )

      expect(JSON.parse(result.stdout)).toMatchObject({
        reason: 'ok',
        uncaptured: ['src/client/a.css'],
      })
    })
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
    writeFileSync(join(tempDir, 'ui-reviews.json'), '[]')
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

  /**
   * Serves an HTML page at / from inside the worktree and answers the given
   * status at /api/health, declared in the worktree's local.toml.
   */
  async function serveWithHealth(status: number): Promise<number> {
    mkdirSync(join(repoRoot, 'canon', 'config'), { recursive: true })
    writeFileSync(
      join(repoRoot, 'canon', 'config', 'local.toml'),
      'health = ["/api/health"]\n',
    )
    const script = [
      'const s = Bun.serve({ port: 0, fetch: (req) => new URL(req.url).pathname === "/api/health"',
      `  ? new Response('bad gateway', { status: ${status} })`,
      "  : new Response('<p>', { headers: { 'content-type': 'text/html' } }) })",
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

  it('should refuse as unhealthy when the page answers and a declared health path answers 502', async () => {
    const port = await serveWithHealth(502)

    const outcome = await runLocal([])

    expect(outcome).toEqual({
      record: expect.objectContaining({
        reason: 'unhealthy',
        port,
        path: '/api/health',
        status: 502,
      }),
      exit: 1,
    })
  })

  it('should report the page when a declared health path answers 200', async () => {
    const port = await serveWithHealth(200)

    const outcome = await runLocal([])

    expect(outcome).toEqual({
      record: expect.objectContaining({
        reason: 'ok',
        url: `http://localhost:${port}`,
      }),
      exit: 0,
    })
  })

  it('should refuse as invalid-config when local.toml is not valid TOML', async () => {
    mkdirSync(join(repoRoot, 'canon', 'config'), { recursive: true })
    writeFileSync(join(repoRoot, 'canon', 'config', 'local.toml'), 'health = [')

    const outcome = await runLocal([])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'invalid-config' }),
      exit: 1,
    })
  })

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

  function writeReviews(
    reviews: readonly { readonly id: number; readonly body: string }[],
  ): void {
    writeFileSync(
      join(tempDir, 'ui-reviews.json'),
      JSON.stringify(
        reviews.map((review) => ({
          ...review,
          commit_id: 'abc',
          submitted_at: '2026-10-19T00:00:00Z',
        })),
      ),
    )
  }

  function uiReview(id: number, address: string) {
    return {
      id,
      body: [
        '## UI review closed',
        '',
        '0 failed · 0 need your eyes · 2 passed · 0 not driven',
        `Driven at \`38db88d\` on ${address}, rendered by agent-browser.`,
        '',
        '<!-- review-ui: head=38db88d -->',
      ].join('\n'),
    }
  }

  it('should rewrite the address in every UI review and leave a code review alone', async () => {
    writeReviews([
      uiReview(11, 'http://127.0.0.1:4211'),
      {
        id: 12,
        body: '## Review\n\nDriven at `38db88d` on http://localhost:5173, rendered by agent-browser.\n\n<!-- review-pr: head=38db88d -->',
      },
      uiReview(13, 'http://localhost:5173'),
    ])

    const outcome = await runLocal(['7', '--remove'])

    expect(outcome.record).toEqual(expect.objectContaining({ reviews: 2 }))
    expect(
      readFileSync(join(tempDir, 'review-puts.log'), 'utf8')
        .trim()
        .split('\n')
        .sort(),
    ).toEqual(['11', '13'])
    expect(readFileSync(join(tempDir, 'review-bodies.log'), 'utf8')).toContain(
      'body=## UI review closed\n\n0 failed · 0 need your eyes · 2 passed · 0 not driven\nDriven at `38db88d` on a local preview, rendered by agent-browser.',
    )
  })

  it('should leave a UI review driven on a hosted preview unedited', async () => {
    writeReviews([uiReview(11, 'https://feat-x.site.pages.dev')])

    const outcome = await runLocal(['7', '--remove'])

    expect(outcome.record).toEqual(expect.objectContaining({ reviews: 0 }))
    expect(existsSync(join(tempDir, 'review-puts.log'))).toBe(false)
  })

  it('should report reviews 0 on a thread with no review', async () => {
    const outcome = await runLocal(['7', '--remove'])

    expect(outcome.record).toEqual(expect.objectContaining({ reviews: 0 }))
  })

  it('should still drop the evidence address line when the reviews read is refused', async () => {
    writeMarkedComment(
      '## Evidence\n\n**Local preview:** http://localhost:5173\n\n<!-- pr-evidence: head=abc -->',
    )
    rmSync(join(tempDir, 'ui-reviews.json'))

    const outcome = await runLocal(['7', '--remove'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'gh-failed' }),
      exit: 1,
    })
    expect(readFileSync(apiLog, 'utf8')).toBe(
      'body=## Evidence\n\n<!-- pr-evidence: head=abc -->',
    )
  })

  it('should refuse gh-failed on a refused update after trying the rest', async () => {
    writeReviews([
      uiReview(11, 'http://127.0.0.1:4211'),
      uiReview(13, 'http://localhost:5173'),
    ])
    writeFileSync(join(tempDir, 'review-put-fail-11'), '')

    const outcome = await runLocal(['7', '--remove'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'gh-failed', reviews: 1 }),
      exit: 1,
    })
    expect(
      readFileSync(join(tempDir, 'review-puts.log'), 'utf8')
        .trim()
        .split('\n')
        .sort(),
    ).toEqual(['11', '13'])
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

  /** A CI runner carries no git identity, so every commit here names one. */
  const IDENTITY = {
    env: {
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@t',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@t',
    },
  }

  /** Commits one file on the branch and pushes it, returning the new tip. */
  function pushCommit(path: string): string {
    mkdirSync(join(repoRoot, dirname(path)), { recursive: true })
    writeFileSync(join(repoRoot, path), `${path}\n`)
    execaSync('git', ['-C', repoRoot, 'add', path])
    execaSync(
      'git',
      ['-C', repoRoot, 'commit', '-q', '-m', `add ${path}`],
      IDENTITY,
    )
    execaSync('git', ['-C', repoRoot, 'push', '-q', '-f', 'origin', 'feat/x'])
    return execaSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD']).stdout
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

  describe('count check', () => {
    const verdict = (counts: string, head: string) => ({
      body: `## UI review closed\n\n${counts}\nDriven.\n\n<!-- review-ui: head=${head} -->`,
      commit_id: head,
      submitted_at: '2026-10-19T10:00:00Z',
    })
    const TWO_PASSED = '0 failed · 1 need your eyes · 2 passed · 0 not driven'

    function postVerdict(row: ReturnType<typeof verdict>): void {
      writeFileSync(join(tempDir, 'ui-reviews.json'), JSON.stringify([row]))
    }

    it('should refuse a tick that leaves fewer ticks than the verdict passed and write nothing', async () => {
      postVerdict(verdict(TWO_PASSED, tip))

      const outcome = await runTick(['--boxes', '1', '--head', tip])

      expect(outcome).toEqual({
        record: expect.objectContaining({
          reason: 'count-mismatch',
          passed: 2,
          ticked: 1,
        }),
        exit: 1,
      })
      expect(existsSync(apiLog)).toBe(false)
    })

    it('should refuse when a box ticked at the tip has since failed, leaving more ticks than passed', async () => {
      writeMarkedComment(
        [
          `- [x] the hero settles · passed at \`${tip.slice(0, 7)}\``,
          '- [ ] the footer wraps',
          '- [ ] the mood is calm (taste)',
        ].join('\n'),
      )
      postVerdict(
        verdict('1 failed · 1 need your eyes · 1 passed · 0 not driven', tip),
      )

      const outcome = await runTick(['--boxes', '2', '--head', tip])

      expect(outcome).toEqual({
        record: expect.objectContaining({
          reason: 'count-mismatch',
          passed: 1,
          ticked: 2,
        }),
        exit: 1,
      })
      expect(existsSync(apiLog)).toBe(false)
    })

    it('should tick every box on a re-tick with the full passed list', async () => {
      postVerdict(verdict(TWO_PASSED, tip))

      const outcome = await runTick(['--boxes', '1,2', '--head', tip])

      expect(outcome).toEqual({
        record: expect.objectContaining({
          reason: 'ticked',
          countCheck: 'matched',
        }),
        exit: 0,
      })
    })

    it('should run the count check on a verdict carried to the tip', async () => {
      const driven = tip
      postVerdict(verdict(TWO_PASSED, driven))
      pushCommit('src/hero.test.ts')

      const outcome = await runTick(['--boxes', '1,2', '--head', driven])

      expect(outcome.record).toEqual(
        expect.objectContaining({ reason: 'ticked', countCheck: 'matched' }),
      )
    })

    it('should read a verdict that covers an older head as unchecked', async () => {
      postVerdict(verdict(TWO_PASSED, 'a'.repeat(40)))

      const outcome = await runTick(['--boxes', '1', '--head', tip])

      expect(outcome.record).toEqual(
        expect.objectContaining({ reason: 'ticked', countCheck: 'unchecked' }),
      )
    })

    it('should read a verdict with no count line as unchecked', async () => {
      postVerdict({
        ...verdict('', tip),
        body: `## UI review closed\n\nDone.\n\n<!-- review-ui: head=${tip} -->`,
      })

      const outcome = await runTick(['--boxes', '1', '--head', tip])

      expect(outcome.record).toEqual(
        expect.objectContaining({ reason: 'ticked', countCheck: 'unchecked' }),
      )
    })

    it('should read a thread with no UI verdict as unchecked', async () => {
      const outcome = await runTick(['--boxes', '1', '--head', tip])

      expect(outcome.record).toEqual(
        expect.objectContaining({ reason: 'ticked', countCheck: 'unchecked' }),
      )
    })
  })

  describe('body line', () => {
    const BODY = '## Summary\n\n- x\n\n## Testing\n\n- [x] ran it\n'

    it('should write the pass count into the body beside what is there', async () => {
      writeFileSync(join(tempDir, 'pr-body'), BODY)

      await runTick(['--boxes', '1,2', '--head', tip])

      const written = readFileSync(join(tempDir, 'body-write.log'), 'utf8')
      expect(written).toContain('- [x] ran it\n')
      expect(written).toContain(
        `- [x] UI pass, 2 of 2 boxes passed at \`${tip.slice(0, 7)}\`, 1 taste box left to the operator`,
      )
    })

    it('should not count a box ticked by hand or at another head as passed by this pass', async () => {
      writeFileSync(join(tempDir, 'pr-body'), BODY)
      writeMarkedComment(
        [
          '- [ ] the hero settles',
          '- [x] the footer wraps',
          '- [ ] the mood is calm (taste)',
        ].join('\n'),
      )

      await runTick(['--boxes', '1', '--head', tip])

      expect(readFileSync(join(tempDir, 'body-write.log'), 'utf8')).toContain(
        '- [ ] UI pass, 1 of 2 boxes passed',
      )
    })

    it('should leave the line unchecked while a driven box is still empty', async () => {
      writeFileSync(join(tempDir, 'pr-body'), BODY)

      await runTick(['--boxes', '1', '--head', tip])

      expect(readFileSync(join(tempDir, 'body-write.log'), 'utf8')).toContain(
        '- [ ] UI pass, 1 of 2 boxes passed',
      )
    })

    it('should report the comment as ticked and the body as refused when the body edit fails', async () => {
      writeFileSync(join(tempDir, 'pr-body'), BODY)
      writeFileSync(join(tempDir, 'body-fail'), '')

      const outcome = await runTick(['--boxes', '1', '--head', tip])

      expect(outcome).toEqual({
        record: expect.objectContaining({
          reason: 'body-refused',
          commentTicked: true,
        }),
        exit: 1,
      })
      expect(readFileSync(apiLog, 'utf8')).toContain('- [x] the hero settles')
    })

    it('should write no body line when the tick is refused', async () => {
      writeFileSync(join(tempDir, 'pr-body'), BODY)

      await runTick(['--boxes', '1,3', '--head', tip])

      expect(existsSync(join(tempDir, 'body-write.log'))).toBe(false)
    })
  })

  describe('carry', () => {
    it('should stamp the boxes at the tip across a push no box observes', async () => {
      const driven = tip
      const pushed = pushCommit('src/hero.test.ts')

      const outcome = await runTick(['--boxes', '1', '--head', driven])

      expect(outcome).toEqual({
        record: expect.objectContaining({
          reason: 'ticked',
          head: pushed,
          carriedFrom: driven,
        }),
        exit: 0,
      })
      expect(readFileSync(apiLog, 'utf8')).toContain(
        `- [x] the hero settles · passed at \`${pushed.slice(0, 7)}\`\n`,
      )
    })

    it('should refuse redrive-owed across a push to a source file and write nothing', async () => {
      const driven = tip.slice(0, 7)
      const pushed = pushCommit('src/hero.ts')

      const outcome = await runTick(['--boxes', '1', '--head', driven])

      expect(outcome).toEqual({
        record: expect.objectContaining({
          reason: 'redrive-owed',
          driven,
          head: pushed,
          drivenPaths: ['src/hero.ts'],
        }),
        exit: 1,
      })
      expect(existsSync(apiLog)).toBe(false)
    })

    it('should refuse stale-head when the driven head was rewritten away', async () => {
      const driven = pushCommit('src/hero.test.ts')
      execaSync(
        'git',
        ['-C', repoRoot, 'commit', '-q', '--amend', '-m', 'x'],
        IDENTITY,
      )
      execaSync('git', ['-C', repoRoot, 'push', '-q', '-f', 'origin', 'feat/x'])

      const outcome = await runTick(['--boxes', '1', '--head', driven])

      expect(outcome).toEqual({
        record: expect.objectContaining({ reason: 'stale-head' }),
        exit: 1,
      })
      expect(existsSync(apiLog)).toBe(false)
    })
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

  it('should refuse as bad-theme when --theme is neither dark nor light', async () => {
    const outcome = await runFrames([
      ...addArgs('box-1.png'),
      '--theme',
      'sepia',
    ])

    expect(outcome.record.reason).toBe('bad-theme')
  })

  it('should refuse as bad-theme without calling gh when --theme comes without --add', async () => {
    const outcome = await runFrames(['7', '--drop', '--theme', 'dark'])

    expect({ reason: outcome.record.reason, calls: calls() }).toEqual({
      reason: 'bad-theme',
      calls: [],
    })
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

  it('should address no ref but the canon/frames branch', async () => {
    await runFrames(addArgs('box-1.png'))

    const refCalls = calls().filter((call) => call.includes('/git/ref'))
    expect(refCalls.every((call) => call.includes('heads/canon/frames'))).toBe(
      true,
    )
  })

  it('should read only canon/frames and the legacy ref on --drop and report ok', async () => {
    const outcome = await runFrames(['7', '--drop'])

    const refCalls = calls().filter((call) => call.includes('/git/ref'))
    expect({ outcome, refCalls: refCalls.length }).toEqual({
      outcome: {
        record: expect.objectContaining({ reason: 'ok', removed: [] }),
        exit: 0,
      },
      refCalls: 2,
    })
    expect(
      refCalls.every(
        (call) =>
          call.includes('heads/canon/frames') ||
          call.includes('heads/canon-frames'),
      ),
    ).toBe(true)
  })

  it('should drain the legacy ref on --prune without a new refusal when it is missing', async () => {
    const outcome = await runFrames(['--prune', '30'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'ok', removed: [] }),
      exit: 0,
    })
  })

  it('should never read the legacy ref on --add', async () => {
    await runFrames(addArgs('box-1.png'))

    expect(calls().filter((call) => call.includes('canon-frames'))).toEqual([])
  })

  it('should refuse as bad-box when --add carries both --box and --reference', async () => {
    const outcome = await runFrames([
      ...addArgs('box-1.png'),
      '--reference',
      'home/hero',
    ])

    expect(outcome.record.reason).toBe('bad-box')
    expect(calls()).toEqual([])
  })

  it('should refuse as bad-reference when the address would escape the pass folder', async () => {
    const outcome = await runFrames([
      '7',
      '--add',
      join(tempDir, 'box-1.png'),
      '--reference',
      '../../x',
      '--pass',
      '20261002T154450Z',
    ])

    expect(outcome.record.reason).toBe('bad-reference')
    expect(calls()).toEqual([])
  })

  it('should refuse as bad-reference naming the path when a tracked reference does not exist', async () => {
    const outcome = await runFrames([
      '7',
      '--add',
      join(tempDir, 'box-1.png'),
      '--reference',
      'canon/design/button/dark.png',
      '--head',
      'abc1234',
      '--pass',
      '20261002T154450Z',
    ])

    expect({ reason: outcome.record.reason, calls: calls() }).toEqual({
      reason: 'bad-reference',
      calls: [],
    })
    expect(JSON.stringify(outcome.record)).toContain(
      'canon/design/button/dark.png',
    )
  })

  describe('a tracked reference', () => {
    const REFERENCE = 'canon/design/button/dark.png'

    function trackedArgs(add: string, reference: string): string[] {
      return [
        '7',
        '--add',
        add,
        '--reference',
        reference,
        '--head',
        'abc1234',
        '--pass',
        '20261002T154450Z',
      ]
    }

    function seedReference(): string {
      mkdirSync(join(tempDir, 'canon', 'design', 'button'), {
        recursive: true,
      })
      const file = join(tempDir, REFERENCE)
      writeFileSync(file, readFileSync(join(tempDir, 'box-1.png')))
      return file
    }

    it('should pass when --add names the tracked file itself', async () => {
      const file = seedReference()

      const outcome = await runFrames(trackedArgs(file, REFERENCE))

      expect(outcome.record.reason).toBe('read-only')
    })

    it('should resolve the png extension a reference leaves off', async () => {
      const file = seedReference()

      const outcome = await runFrames(
        trackedArgs(file, 'canon/design/button/dark'),
      )

      expect(outcome.record.reason).toBe('read-only')
    })

    it('should refuse as bad-reference when --add names a different image', async () => {
      seedReference()

      const outcome = await runFrames(
        trackedArgs(join(tempDir, 'box-1.png'), REFERENCE),
      )

      expect({ reason: outcome.record.reason, calls: calls() }).toEqual({
        reason: 'bad-reference',
        calls: [],
      })
    })

    it('should refuse as bad-reference when the path is a directory', async () => {
      mkdirSync(join(tempDir, REFERENCE), { recursive: true })

      const outcome = await runFrames(
        trackedArgs(join(tempDir, 'box-1.png'), REFERENCE),
      )

      expect(outcome.record.reason).toBe('bad-reference')
    })
  })

  it('should refuse as bad-theme when --theme rides a reference', async () => {
    const outcome = await runFrames([
      '7',
      '--add',
      join(tempDir, 'box-1.png'),
      '--reference',
      'home/hero',
      '--theme',
      'dark',
      '--pass',
      '20261002T154450Z',
    ])

    expect(outcome.record.reason).toBe('bad-theme')
  })

  it('should pass a valid reference through to the write', async () => {
    const outcome = await runFrames([
      '7',
      '--add',
      join(tempDir, 'box-1.png'),
      '--reference',
      'home/hero',
      '--head',
      'abc1234',
      '--pass',
      '20261002T154450Z',
    ])

    expect(outcome.record.reason).toBe('read-only')
  })

  describe('with --reel', () => {
    const WEBP = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1,
    ])

    function reelArgs(file: string): string[] {
      return [
        '7',
        '--reel',
        join(tempDir, file),
        '--head',
        'abc1234',
        '--pass',
        '20261002T154450Z',
      ]
    }

    it('should reach the write for a WebP reel', async () => {
      writeFileSync(join(tempDir, 'reel.webp'), WEBP)

      const outcome = await runFrames(reelArgs('reel.webp'))

      // The fake gh refuses every write, so reaching it reads as read-only.
      expect(outcome.record.reason).toBe('read-only')
    })

    it('should refuse as unreadable-reel without calling gh for a PNG or an MP4', async () => {
      writeFileSync(
        join(tempDir, 'reel.mp4'),
        new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73]),
      )

      const png = await runFrames(reelArgs('box-1.png'))
      const mp4 = await runFrames(reelArgs('reel.mp4'))

      expect({
        reasons: [png.record.reason, mp4.record.reason],
        calls: calls(),
      }).toEqual({
        reasons: ['unreadable-reel', 'unreadable-reel'],
        calls: [],
      })
    })

    it('should refuse as reel-too-large without calling gh past 10 MB', async () => {
      const big = new Uint8Array(10_000_001)
      big.set(WEBP)
      writeFileSync(join(tempDir, 'big.webp'), big)

      const outcome = await runFrames(reelArgs('big.webp'))

      expect({ outcome, calls: calls() }).toEqual({
        outcome: {
          record: expect.objectContaining({ reason: 'reel-too-large' }),
          exit: 1,
        },
        calls: [],
      })
    })

    it('should refuse as bad-box when --reel rides a --box', async () => {
      writeFileSync(join(tempDir, 'reel.webp'), WEBP)

      const outcome = await runFrames([...reelArgs('reel.webp'), '--box', '1'])

      expect(outcome.record.reason).toBe('bad-box')
    })

    it('should refuse as bad-mode when --reel and --add are both passed', async () => {
      writeFileSync(join(tempDir, 'reel.webp'), WEBP)

      const outcome = await runFrames([
        ...reelArgs('reel.webp'),
        '--add',
        join(tempDir, 'box-1.png'),
      ])

      expect(outcome.record.reason).toBe('bad-mode')
    })

    it('should refuse as bad-pass when --reel carries no pass stamp', async () => {
      writeFileSync(join(tempDir, 'reel.webp'), WEBP)

      const outcome = await runFrames([
        '7',
        '--reel',
        join(tempDir, 'reel.webp'),
      ])

      expect(outcome.record.reason).toBe('bad-pass')
    })
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
        'bad-reference',
        'bad-days',
        'unreadable-frame',
        'unreadable-reel',
        'reel-too-large',
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
 * `merge-409` makes the REST merge answer a moved head, as gh reports it.
 * The caller's `--jq` filter runs over each answer, as gh runs it.
 */
const PROXY_GH = `#!/usr/bin/env bash
set -o pipefail
fx="$FAKE_DIR"
echo "$*" >> "$fx/gh.log"
f=.; p=; for a in "$@"; do [ "$p" = --jq ] && f=$a; p=$a; done
case "$*" in
  *"/pulls/7/merge"*) [ -f "$fx/merge-409" ] && { echo '{"message":"Head branch was modified. Review and try the merge again."}'; echo "gh: Head branch was modified. Review and try the merge again. (HTTP 409)" >&2; exit 1; }; echo '{"sha":"c0ffee0000000000000000000000000000000000","merged":true,"message":"Pull Request successfully merged"}' ;;
  *markPullRequestReadyForReview*) [ -f "$fx/mutation-fail" ] && { echo "gh: blocked by proxy (HTTP 403)" >&2; exit 1; }; echo '{"data":{"markPullRequestReadyForReview":{"pullRequest":{"isDraft":false}}}}' ;;
  *graphql*|"pr "*|"repo view"*) echo "gh: blocked by proxy (HTTP 403)" >&2; exit 1 ;;
  *"/pulls?head="*) jq -r "$f" "$fx/listing.json" ;;
  *"/issues/7/comments"*) [ -f "$fx/comments.json" ] && jq -r "$f" "$fx/comments.json" || echo "[]" | jq -r "$f" ;;
  *"/pulls/7/reviews"*) [ -f "$fx/reviews-fail" ] && { echo "gh: (HTTP 403)" >&2; exit 1; }; jq -r "$f" "$fx/reviews.json" ;;
  *"/pulls/7/files"*) echo '[{"filename":"src/a.ts","status":"added"}]' | jq -r "$f" ;;
  *"/check-runs"*) [ -f "$fx/checks.json" ] && cat "$fx/checks.json" || echo '{"total_count":0,"check_runs":[]}' ;;
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
      body: '## Key changes\n\n- Add `src/a.ts`.\n',
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
      [
        markedReview('bbbbbbb', '2026-10-03T10:01:00Z'),
        {
          body: `## UI review closed\n\nall boxes\n\n<!-- review-ui: head=${tip} -->`,
          commit_id: 'f'.repeat(40),
          submitted_at: '2026-10-03T10:02:00Z',
        },
      ],
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
      head: tip,
      review: { reason: 'review-open', isCovered: false },
      ui: { state: 'closed', commit: tip, isBound: false, isCovered: true },
    })
  })

  it('should report timeout with the waited seconds when no pass covers the tip by the deadline', async () => {
    writeFixture('reviews.json', [
      markedReview('bbbbbbb', '2026-10-03T10:01:00Z'),
    ])

    const record = await runVerb('review-state', ['7', '--wait', '0'])

    expect(record).toMatchObject({
      reason: 'timeout',
      waitedSeconds: expect.any(Number),
      review: { isCovered: false },
    })
  })

  it('should refuse a review-state --wait that is not a whole number', async () => {
    const record = await runVerb('review-state', ['7', '--wait', 'soon'])

    expect(record.reason).toBe('bad-wait')
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

  describe('lift', () => {
    function stageClearPull(): void {
      git('push', '-q', 'origin', 'feat/x:main')
      git('fetch', '-q', 'origin')
      writeFixture(
        'pull.json',
        pullRow({ draft: true, state: 'open', node_id: 'PR_7' }),
      )
      writeFixture('reviews.json', [
        {
          body: `## Review closed\n\nclean\n\n<!-- review-pr: commit=${tip} read-at=2026-10-12T10:00:00Z -->`,
          commit_id: tip,
          submitted_at: '2026-10-12T10:01:00Z',
        },
      ])
      writeFixture('checks.json', {
        total_count: 1,
        check_runs: [
          {
            head_sha: tip,
            status: 'completed',
            conclusion: 'success',
            name: 'check',
            id: 1,
          },
        ],
      })
    }

    async function runLift(
      args: string[],
    ): Promise<{ record: Record<string, unknown>; exit: number }> {
      const result = await execa(
        process.execPath,
        [CLI, 'pr', 'lift', ...args, '--json', '--root', repoRoot],
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
      return { record: JSON.parse(result.stdout), exit: result.exitCode ?? -1 }
    }

    function mutationCalls(): number {
      return readFileSync(join(tempDir, 'gh.log'), 'utf8')
        .split('\n')
        .filter((line) => line.includes('markPullRequestReadyForReview')).length
    }

    it('should lift the mark when every gate reads clear, over REST and one mutation', async () => {
      stageClearPull()

      const { record, exit } = await runLift(['7'])

      expect(record).toMatchObject({ reason: 'lifted', isLifted: true })
      expect(exit).toBe(0)
      expect(mutationCalls()).toBe(1)
    })

    it('should report every gate under --check and call no mutation', async () => {
      stageClearPull()

      const { record, exit } = await runLift(['7', '--check'])

      expect(record).toMatchObject({ reason: 'clear', isLifted: false })
      expect(exit).toBe(0)
      expect(mutationCalls()).toBe(0)
    })

    it('should refuse gh-failed on a blocked mutation rather than reporting a lift', async () => {
      stageClearPull()
      writeFixture('mutation-fail', '')

      const { record, exit } = await runLift(['7'])

      expect(record).toMatchObject({ reason: 'gh-failed', isLifted: false })
      expect(exit).toBe(1)
    })

    it('should refuse an open review and call no mutation', async () => {
      stageClearPull()
      writeFixture('reviews.json', [
        {
          body: `## Review\n\n1 finding\n\n<!-- review-pr: commit=${tip} read-at=2026-10-12T10:00:00Z -->`,
          commit_id: tip,
          submitted_at: '2026-10-12T10:01:00Z',
        },
      ])

      const { record, exit } = await runLift(['7'])

      expect(record).toMatchObject({ reason: 'review-open' })
      expect(exit).toBe(1)
      expect(mutationCalls()).toBe(0)
    })

    it('should refuse a --wait that is not a whole number', async () => {
      stageClearPull()

      const { record } = await runLift(['7', '--wait', 'soon'])

      expect(record.reason).toBe('bad-wait')
    })
  })

  describe('merge', () => {
    function stageReadyPull(): void {
      writeFixture(
        'pull.json',
        pullRow({
          draft: false,
          state: 'open',
          title: 'feat(pr): add a merge verb',
          body: '## Summary\n\n- Merge one pull request\n\n## Key changes\n\n- Add `src/a.ts`\n\n## Testing\n\n- [x] check\n',
        }),
      )
      writeFixture('checks.json', {
        total_count: 1,
        check_runs: [
          {
            head_sha: tip,
            status: 'completed',
            conclusion: 'success',
            name: 'check',
            id: 1,
          },
        ],
      })
    }

    async function runMerge(
      args: string[],
    ): Promise<{ record: Record<string, unknown>; exit: number }> {
      const result = await execa(
        process.execPath,
        [CLI, 'pr', 'merge', ...args, '--json', '--root', repoRoot],
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
      return { record: JSON.parse(result.stdout), exit: result.exitCode ?? -1 }
    }

    /** The log from the merge call on, since its multiline message spans lines. */
    function mergeCall(): string | undefined {
      const log = readFileSync(join(tempDir, 'gh.log'), 'utf8')
      const at = log.indexOf('-X PUT repos/{owner}/{repo}/pulls/7/merge')
      return at === -1 ? undefined : log.slice(at)
    }

    it('should squash-merge over REST pinned to the head it read', async () => {
      stageReadyPull()

      const { record, exit } = await runMerge(['7'])

      expect(record).toMatchObject({
        reason: 'merged',
        number: 7,
        title: 'feat(pr): add a merge verb (#7)',
        description:
          '## Summary\n\n- Merge one pull request\n\n## Key changes\n\n- Add `src/a.ts`',
        sha: 'c0ffee0000000000000000000000000000000000',
      })
      expect(exit).toBe(0)
      const call = mergeCall()
      expect(call).toContain(`sha=${tip}`)
      expect(call).toContain('merge_method=squash')
      expect(call).toContain('commit_title=feat(pr): add a merge verb (#7)')
    })

    it('should call no merge under --dry-run and exit 0', async () => {
      stageReadyPull()

      const { record, exit } = await runMerge(['7', '--dry-run'])

      expect(record).toMatchObject({
        reason: 'dry-run',
        title: 'feat(pr): add a merge verb (#7)',
      })
      expect(exit).toBe(0)
      expect(mergeCall()).toBeUndefined()
    })

    it('should refuse head-moved when the merge answers 409', async () => {
      stageReadyPull()
      writeFixture('merge-409', '')

      const { record, exit } = await runMerge(['7'])

      expect(record).toMatchObject({ reason: 'head-moved' })
      expect(record.sha).toBeUndefined()
      expect(exit).toBe(1)
    })
  })
})

describe('canon pr drive-copy', () => {
  let tempDir: string
  let repoRoot: string

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

  function writeRepoFile(path: string, text: string): void {
    mkdirSync(dirname(join(repoRoot, path)), { recursive: true })
    writeFileSync(join(repoRoot, path), text)
  }

  function writePull(headRef: string): void {
    writeFileSync(
      join(tempDir, 'pull.json'),
      JSON.stringify({
        number: 7,
        head: { ref: headRef, sha: 'a'.repeat(40) },
      }),
    )
  }

  async function runDriveCopy(args: string[]): Promise<{
    readonly record: Record<string, unknown>
    readonly exit: number
  }> {
    const result = await execa(
      process.execPath,
      [CLI, 'pr', 'drive-copy', ...args, '--json', '--root', repoRoot],
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
    return { record: JSON.parse(result.stdout), exit: result.exitCode ?? -1 }
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'canon-pr-drive-copy-'))
    repoRoot = join(tempDir, 'repo')
    mkdirSync(repoRoot)
    mkdirSync(join(tempDir, 'bin'))
    writeFileSync(join(tempDir, 'bin', 'gh'), PROXY_GH, { mode: 0o755 })
    git('init', '-q', '-b', 'feat/x')
    writeRepoFile('.gitignore', '.canon/\n')
    writeRepoFile('board/frames.json', '{"x":0}')
    git('add', '.')
    git('commit', '-q', '-m', 'init')
    writePull('feat/x')
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should report no-config and copy nothing when the project declares no preview', async () => {
    const outcome = await runDriveCopy(['7'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'no-config' }),
      exit: 0,
    })
    expect(existsSync(join(repoRoot, '.canon/tmp/pr/review-ui/x'))).toBe(false)
  })

  it('should copy the declared folders under the branch slug and name the variable', async () => {
    writeRepoFile('canon/config/preview.json', '{"writes":["board"]}')

    const outcome = await runDriveCopy(['7'])

    expect(outcome.record).toMatchObject({
      reason: 'copied',
      env: 'CANON_PREVIEW_ROOT',
      copyRoot: expect.stringMatching(/\.canon\/tmp\/pr\/review-ui\/x\/board$/),
    })
    expect(
      readFileSync(
        join(repoRoot, '.canon/tmp/pr/review-ui/x/board/board/frames.json'),
        'utf8',
      ),
    ).toBe('{"x":0}')
  })

  it('should keep a declared keep path and a root-level file through a --baseline rebuild', async () => {
    writeRepoFile(
      'canon/config/preview.json',
      '{"writes":["board"],"keep":["board/.run"]}',
    )
    const first = await runDriveCopy(['7', '--baseline'])
    const copyRoot = String(first.record.copyRoot)
    mkdirSync(join(copyRoot, 'board/.run'), { recursive: true })
    writeFileSync(join(copyRoot, 'board/.run/address.json'), '{"pid":1}')
    writeFileSync(join(copyRoot, 'server-state.json'), '{}')
    writeFileSync(join(copyRoot, 'board/dragged.json'), '{}')

    await runDriveCopy(['7', '--baseline'])

    expect(
      readFileSync(join(copyRoot, 'board/.run/address.json'), 'utf8'),
    ).toBe('{"pid":1}')
    expect(existsSync(join(copyRoot, 'server-state.json'))).toBe(true)
    expect(existsSync(join(copyRoot, 'board/dragged.json'))).toBe(false)
  })

  it('should land the worker, named by no number, on the copy the reviewer rebuilds', async () => {
    writeRepoFile('canon/config/preview.json', '{"writes":["board"]}')

    const worker = await runDriveCopy([])
    const reviewer = await runDriveCopy(['7'])

    expect(worker.record.copyRoot).toBe(reviewer.record.copyRoot)
  })

  it('should exit with the changed path when a drive wrote a tracked file after the baseline', async () => {
    await runDriveCopy(['7', '--baseline'])
    writeRepoFile('board/frames.json', '{"x":40}')

    const outcome = await runDriveCopy(['7', '--check'])

    expect(outcome).toEqual({
      record: expect.objectContaining({
        reason: 'changed',
        paths: ['board/frames.json'],
      }),
      exit: 1,
    })
  })

  it('should read clean when nothing changed since the baseline', async () => {
    writeRepoFile('board/frames.json', '{"worker":1}')
    await runDriveCopy(['7', '--baseline'])

    const outcome = await runDriveCopy(['7', '--check'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'clean' }),
      exit: 0,
    })
  })

  it('should refuse --check with no baseline recorded', async () => {
    const outcome = await runDriveCopy(['7', '--check'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'no-baseline' }),
      exit: 1,
    })
  })

  it('should refuse as no-worktree when no local worktree holds the branch', async () => {
    writePull('feat/cloud')

    const outcome = await runDriveCopy(['7', '--baseline'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'no-worktree' }),
      exit: 1,
    })
  })
})

describe('canon pr close', () => {
  const REASON =
    'Closing unmerged. Base should stay stack-neutral, so each project adds rows for its own stack.'

  interface CloseRun {
    readonly record: {
      readonly reason?: string
      readonly branch?: string
      readonly commentUrl?: string
    }
    readonly exit: number
    readonly calls: string[]
  }

  let root: string
  let logFile: string

  async function runClose(
    args: string[],
    fake: { readonly head?: string } = {},
  ): Promise<CloseRun> {
    const bin = join(root, 'bin')
    mkdirSync(bin, { recursive: true })
    writeFileSync(
      join(bin, 'gh'),
      `#!/bin/sh
echo "$*" >> "$FAKE_LOG"
case "$*" in
  *"-X POST"*) printf 'https://example.test/c/1' ;;
  *"-X PATCH"*) exit 0 ;;
  *"-X DELETE"*) exit 0 ;;
  *pulls/7*) printf '{"number":7,"state":"open","head":{"ref":"%s","repo":{"full_name":"o/r"}},"base":{"repo":{"full_name":"o/r"}}}' "$FAKE_HEAD" ;;
  *) exit 1 ;;
esac
`,
      { mode: 0o755 },
    )
    const result = await execa(
      process.execPath,
      [CLI, 'pr', 'close', '7', '--json', '--root', root, ...args],
      {
        cwd: root,
        reject: false,
        timeout: RUN_TIMEOUT_MS,
        env: {
          PATH: `${bin}:${process.env.PATH ?? ''}`,
          FAKE_LOG: logFile,
          FAKE_HEAD: fake.head ?? 'feat/x',
        },
      },
    )
    const calls = existsSync(logFile)
      ? readFileSync(logFile, 'utf8').split('\n').filter(Boolean)
      : []
    return {
      record: JSON.parse(result.stdout),
      exit: result.exitCode ?? -1,
      calls,
    }
  }

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'canon-pr-close-'))
    logFile = join(root, 'gh.log')
    execaSync('git', ['-C', root, 'init', '-q', '--initial-branch=feat/x'])
    writeFileSync(join(root, 'reason.md'), `${REASON}\n`)
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('should post the reason, close, and delete the branch', async () => {
    const run = await runClose(['--reason-file', 'reason.md'])

    expect(run.record).toMatchObject({ reason: 'closed', branch: 'deleted' })
    expect(run.exit).toBe(0)
    const writes = run.calls.filter((call) => call.includes(' -X '))
    expect(writes.map((call) => /-X (\w+)/.exec(call)?.[1])).toEqual([
      'POST',
      'PATCH',
      'DELETE',
    ])
  })

  it('should refuse without a reason file and call nothing', async () => {
    const run = await runClose([])

    expect(run.record.reason).toBe('no-reason')
    expect(run.exit).toBe(1)
    expect(run.calls).toEqual([])
  })

  it('should refuse a reason file that does not exist', async () => {
    const run = await runClose(['--reason-file', 'missing.md'])

    expect(run.record.reason).toBe('reason-unreadable')
    expect(run.exit).toBe(1)
    expect(run.calls).toEqual([])
  })

  it('should refuse a pull request whose head is not the current branch', async () => {
    const run = await runClose(['--reason-file', 'reason.md'], {
      head: 'feat/other',
    })

    expect(run.record.reason).toBe('head-mismatch')
    expect(run.calls.some((call) => call.includes(' -X '))).toBe(false)
  })

  it('should close another branch named through --head', async () => {
    const run = await runClose(
      ['--reason-file', 'reason.md', '--head', 'feat/other'],
      { head: 'feat/other' },
    )

    expect(run.record.reason).toBe('closed')
  })

  it('should keep the branch under --keep-branch', async () => {
    const run = await runClose(['--reason-file', 'reason.md', '--keep-branch'])

    expect(run.record.branch).toBe('kept')
    expect(run.calls.some((call) => call.includes('-X DELETE'))).toBe(false)
  })

  it('should refuse an overloaded reason before any call', async () => {
    writeFileSync(join(root, 'reason.md'), 'One.\n\nTwo.\n\nThree.\n')

    const run = await runClose(['--reason-file', 'reason.md'])

    expect(run.record.reason).toBe('reason-unpublishable')
    expect(run.calls).toEqual([])
  })
})
