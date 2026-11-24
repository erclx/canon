import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa, execaSync } from 'execa'
import { PNG } from 'pngjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { countEvidenceCases, renderEvidenceBody } from '@/pr/evidence'
import {
  CLI,
  REEL_LINK,
  RUN_TIMEOUT_MS,
  WEB_ONLY_DEPLOY,
  initBranchRepo,
  markedCommentBody,
  writeFakeGh,
} from '@/commands/pr/fixture'

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

  it('should render a reel alone with no evidence image and no checklist', async () => {
    const record = await runEvidenceCommand(['--reel', REEL_LINK])

    expect(record.reason).toBe('ok')
    expect(record.body).toContain('<!-- pr-evidence:')
    expect(record.body).toMatch(/\*\*Reel\*\* filmed at `[0-9a-f]{7}`:<br>/)
    expect(record.body).toContain(`<img src="${REEL_LINK}"`)
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

  it('should put the passed coverage on its own line under the reel', async () => {
    const record = await runEvidenceCommand([
      '--reel',
      REEL_LINK,
      '--reel-covers',
      'Board, Search; left out: Settings',
    ])

    const lines = record.body?.split('\n') ?? []
    const reelAt = lines.findIndex((line) => line.startsWith('**Reel** '))
    expect(lines.slice(reelAt + 1, reelAt + 3)).toEqual([
      '',
      '**Reel covers:** Board, Search; left out: Settings',
    ])
  })

  it('should write no coverage line for a reel passed without --reel-covers', async () => {
    const record = await runEvidenceCommand(['--reel', REEL_LINK])

    expect(record.body).toContain('**Reel** filmed at')
    expect(record.body).not.toContain('**Reel covers:**')
  })

  describe('a reel per width', () => {
    const NARROW = REEL_LINK.replace('reel.webp', 'reel-390.webp')
    const WIDE = REEL_LINK.replace('reel.webp', 'reel-1280.webp')

    it('should post one reel line per --reel in the order passed, pairing each --reel-covers by position', async () => {
      const record = await runEvidenceCommand([
        '--reel',
        NARROW,
        '--reel-covers',
        'filmed: Board · left out: none',
        '--reel',
        WIDE,
        '--reel-covers',
        'filmed: Sheet · left out: none',
      ])

      const lines = (record.body?.split('\n') ?? []).filter(
        (line) => line.startsWith('**Reel') && line !== '',
      )
      expect(lines).toEqual([
        expect.stringContaining(`<img src="${NARROW}" width="390"`),
        '**Reel covers:** filmed: Board · left out: none',
        expect.stringContaining(`<img src="${WIDE}" width="960"`),
        '**Reel covers:** filmed: Sheet · left out: none',
      ])
    })

    it('should refuse as reel-covers-unpaired when covers outnumber reels', async () => {
      const record = await runEvidenceCommand([
        '--reel',
        NARROW,
        '--reel-covers',
        'filmed: Board',
        '--reel-covers',
        'filmed: Sheet',
      ])

      expect(record).toMatchObject({ reason: 'reel-covers-unpaired' })
      expect(record).not.toHaveProperty('body')
    })

    it('should refuse as reel-covers-unpaired for a coverage line with no reel', async () => {
      const record = await runEvidenceCommand([
        '--reel-covers',
        'filmed: Board',
      ])

      expect(record).toMatchObject({ reason: 'reel-covers-unpaired' })
    })

    it('should refuse as reel-width-repeated for two reels at one width', async () => {
      const record = await runEvidenceCommand([
        '--reel',
        NARROW,
        '--reel',
        NARROW,
      ])

      expect(record).toMatchObject({ reason: 'reel-width-repeated' })
    })

    it('should write a skip naming a width on its own line beside one naming every width', async () => {
      const record = await runEvidenceCommand([
        '--checklist',
        join(tempDir, 'checklist.md'),
        '--reel-skip',
        '390=no-visible-change: desktop only',
        '--reel-skip',
        'wrong-state: beat 1',
      ])

      expect(record.body).toContain('**No reel:** wrong-state: beat 1')
      expect(record.body).toContain(
        '**No reel at 390:** no-visible-change: desktop only',
      )
    })
  })
})

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

  it('should report every posted reel as reels, keeping the first as reel', async () => {
    const narrow = REEL_LINK.replace('reel.webp', 'reel-390.webp')
    writeComments([
      markedCommentBody().replace(
        '## What to look at',
        [
          `**Reel** filmed at \`abc1234\`:<br><img src="${narrow}" width="390" alt="reel filmed at abc1234">`,
          '',
          `**Reel** filmed at \`abc1234\`:<br><img src="${REEL_LINK}" width="960" alt="reel filmed at abc1234">`,
          '',
          '## What to look at',
        ].join('\n'),
      ),
    ])

    const record = await runEvidenceRecord({ 'docs/guide.md': '# guide\n' })

    expect(record).toMatchObject({
      reel: { link: narrow, head: 'abc1234', width: 390 },
      reels: [
        { link: narrow, head: 'abc1234', width: 390 },
        { link: REEL_LINK, head: 'abc1234', width: 1280 },
      ],
    })
  })

  it('should carry the posted coverage line forward with its reel', async () => {
    writeComments([
      markedCommentBody().replace(
        '## What to look at',
        `**Reel** filmed at \`abc1234\`:<br><img src="${REEL_LINK}" width="960" alt="reel filmed at abc1234">\n\n**Reel covers:** Board; left out: none\n\n## What to look at`,
      ),
    ])

    const record = await runEvidenceRecord({ 'docs/guide.md': '# guide\n' })

    expect(record).toMatchObject({
      reel: {
        link: REEL_LINK,
        head: 'abc1234',
        covers: 'Board; left out: none',
      },
    })
    expect(record.body).toContain('**Reel covers:** Board; left out: none')
  })

  it('should drop the posted coverage line when a new reel replaces its reel', async () => {
    writeComments([
      markedCommentBody().replace(
        '## What to look at',
        `**Reel** filmed at \`abc1234\`:<br><img src="${REEL_LINK}" width="960" alt="reel filmed at abc1234">\n\n**Reel covers:** Board; left out: none\n\n## What to look at`,
      ),
    ])

    const record = await runEvidenceRecord({ 'docs/guide.md': '# guide\n' }, [
      '--reel',
      REEL_LINK,
    ])

    expect(record.body).toContain('**Reel** filmed at')
    expect(record.body).not.toContain('**Reel covers:**')
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

    it('should drop a carried local address when a local skip is passed', async () => {
      writeComments([markedCommentBody()])

      const record = await runEvidenceRecord({ 'docs/guide.md': '# guide\n' }, [
        '--local-skip',
        'no-server',
      ])

      expect(record.body).toContain('**No local preview:** no-server')
      expect(record.body).not.toContain('http://localhost:5173')
      expect(record.body).toContain(
        '**Preview:** https://feat-x.site.pages.dev',
      )
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

    it('should drop the carried checklist under --no-checklist rather than skip', async () => {
      writeComments([markedCommentBody()])

      const record = await runEvidenceRecord({ 'docs/guide.md': '# guide\n' }, [
        '--no-checklist',
      ])

      expect(record.reason).toBe('ok')
      expect(record.commentId).toBe(100)
      expect(record.body).not.toContain('<!-- pr-checklist:start -->')
      expect(record).not.toHaveProperty('checklist')
      expect(record).not.toHaveProperty('drivable')
    })

    it('should let the last of --checklist and --no-checklist win', async () => {
      writeComments([markedCommentBody()])
      writeFileSync(join(tempDir, 'checklist.md'), '- [ ] the nav wraps\n')

      const record = await runEvidenceRecord({ 'docs/guide.md': '# guide\n' }, [
        '--no-checklist',
        '--checklist',
        join(tempDir, 'checklist.md'),
      ])

      expect(record.body).toContain('- [ ] the nav wraps')
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
      drivable: 2,
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

  it('should name the head the newest successful deploy built beside a carried preview', async () => {
    writeComments([markedCommentBody()])
    writeFileSync(
      join(tempDir, 'runs.json'),
      JSON.stringify([
        {
          databaseId: 7,
          status: 'completed',
          conclusion: 'success',
          headSha: 'da60d8794da60d8794da60d8794da60d8794da60',
          createdAt: '2026-11-18T00:18:00Z',
        },
      ]),
    )

    const record = await runEvidenceRecord({
      'evidence/hero.png': 'png',
      'web/index.html': '<p>hi</p>\n',
      '.github/workflows/deploy.yml': WEB_ONLY_DEPLOY,
    })

    expect(record.body).toContain(
      '**Preview:** https://feat-x.site.pages.dev · **Preview built at:** `da60d87`',
    )
  })

  it('should post a carried preview naming no built head when the deploy runs cannot be listed', async () => {
    writeComments([markedCommentBody()])

    const record = await runEvidenceRecord({
      'evidence/hero.png': 'png',
      'web/index.html': '<p>hi</p>\n',
      '.github/workflows/deploy.yml': WEB_ONLY_DEPLOY,
    })

    expect(record.reason).toBe('ok')
    expect(record.body).toContain('**Preview:** https://feat-x.site.pages.dev')
    expect(record.body).not.toContain('Preview built at')
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

    describe('a renamed image', () => {
      function writeRename(baseGray: number, headGray: number): void {
        writeFixture(
          'files.tsv',
          'renamed\tevidence/dark/moved.png\tevidence/moved-dark.png\n',
        )
        writeFixture('head', 'deadbeef')
        writeFixture('merge-base', 'cafe01')
        writePng('cafe01', 'moved-dark.png', baseGray)
        writePng('deadbeef', 'moved.png', headGray)
      }

      it('should count a byte-identical rename on one line and list no case for it', async () => {
        writeRename(255, 255)

        const record = await runEvidenceRecord(['--preview', 'https://p.dev'])

        expect(firstItem(record)).toMatchObject({
          basePath: 'evidence/moved-dark.png',
          identical: true,
        })
        expect(record.body).toContain('**Moved unchanged:** 1 image')
        expect(countEvidenceCases(String(record.body))).toBe(0)
      })

      it('should fold a rename whose bytes differ within tolerance, with its base from the old path', async () => {
        writeRename(255, 254)

        const record = await runEvidenceRecord(['--preview', 'https://p.dev'])

        expect(firstItem(record)).toMatchObject({
          withinTolerance: true,
          identical: false,
        })
        expect(record.body).toContain('<summary>Within tolerance (1)</summary>')
        expect(record.body).toContain('/blob/cafe01/evidence/moved-dark.png')
        expect(record.body).not.toContain('Moved unchanged')
      })

      it('should leave a rename with edits open, pairing head with the old path', async () => {
        writeRename(255, 0)

        const record = await runEvidenceRecord(['--preview', 'https://p.dev'])

        expect(firstItem(record)).toMatchObject({ withinTolerance: false })
        expect(record.body).toContain('<summary>dark (1)</summary>')
        expect(record.body).toContain('/blob/cafe01/evidence/moved-dark.png')
        expect(record.body).not.toContain('*(new)*')
      })
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

  it('should render a renamed path with an empty previous filename as new', async () => {
    writeFixture('files.tsv', 'renamed\tevidence/dark/moved.png\t\n')

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

  /** Pushes the branch to a bare origin, so the check reads its tip off the remote, and returns that tip. */
  function pushBranch(): string {
    const origin = join(tempDir, 'origin.git')
    execaSync('git', ['init', '-q', '--bare', origin])
    execaSync('git', ['-C', repoRoot, 'remote', 'add', 'origin', origin])
    execaSync('git', ['-C', repoRoot, 'push', '-q', 'origin', 'feat/x'])
    return execaSync('git', ['-C', repoRoot, 'rev-parse', 'feat/x']).stdout
  }

  /** The deploy dispatch runs `gh run list` answers with, newest first by `createdAt`. */
  function writeRuns(
    rows: readonly {
      headSha: string
      status?: string
      conclusion?: string
      createdAt?: string
    }[],
  ): void {
    writeFileSync(
      join(tempDir, 'runs.json'),
      JSON.stringify(
        rows.map((row, index) => ({
          databaseId: 100 + index,
          status: row.status ?? 'completed',
          conclusion: row.conclusion ?? 'success',
          headSha: row.headSha,
          createdAt: row.createdAt ?? '2026-11-18T00:00:00Z',
        })),
      ),
    )
  }

  describe('with a carried preview read against the tip', () => {
    const BUILT = 'da60d8794da60d8794da60d8794da60d8794da60'
    let tip: string

    function writeCompared(lines: readonly string[]): void {
      writeFileSync(join(tempDir, 'compared.txt'), `${lines.join('\n')}\n`)
    }

    beforeEach(() => {
      mkdirSync(join(repoRoot, '.github', 'workflows'), { recursive: true })
      writeFileSync(
        join(repoRoot, '.github', 'workflows', 'deploy.yml'),
        WEB_ONLY_DEPLOY,
      )
      writeFileSync(join(tempDir, 'files.tsv'), 'modified\tweb/index.html\n')
      writeComment(markedCommentBody())
      tip = pushBranch()
    })

    it('should settle a preview built at the tip and name the build', async () => {
      writeRuns([{ headSha: tip }])

      const record = await runCheck()

      expect(record).toMatchObject({
        reason: 'settled',
        owed: [],
        previewHead: { reason: 'fresh', built: tip, tip, runId: 100 },
      })
    })

    it('should owe a preview built before a served path changed', async () => {
      writeRuns([{ headSha: BUILT }])
      writeCompared(['complete', 'web/index.html', 'docs/guide.md'])

      const record = await runCheck()

      expect(record).toMatchObject({
        reason: 'owed',
        owed: ['preview'],
        previewHead: {
          reason: 'stale',
          built: BUILT,
          tip,
          servedSinceBuilt: true,
        },
      })
    })

    it('should settle a preview built before a push touching no served path', async () => {
      writeRuns([{ headSha: BUILT }])
      writeCompared(['complete', 'assets/evidence/dark/hero.png', 'docs/a.md'])

      const record = await runCheck()

      expect(record).toMatchObject({
        reason: 'settled',
        previewHead: { reason: 'stale', servedSinceBuilt: false },
      })
    })

    it('should owe a stale preview whose compare listing GitHub cut short', async () => {
      writeRuns([{ headSha: BUILT }])
      writeCompared(['truncated'])

      const record = await runCheck()

      expect(record).toMatchObject({
        reason: 'owed',
        previewHead: { reason: 'stale', servedSinceBuilt: true },
      })
    })

    it('should owe a preview while a deploy of the tip is still building', async () => {
      writeRuns([
        {
          headSha: tip,
          status: 'in_progress',
          conclusion: '',
          createdAt: '2026-11-18T01:00:00Z',
        },
        { headSha: BUILT },
      ])

      const record = await runCheck()

      expect(record).toMatchObject({
        reason: 'owed',
        owed: ['preview'],
        previewHead: { reason: 'building', built: BUILT, tip },
      })
    })

    it('should owe a carried preview no deploy of the branch built', async () => {
      writeRuns([{ headSha: BUILT, conclusion: 'failure' }])

      const record = await runCheck()

      expect(record).toMatchObject({
        reason: 'owed',
        previewHead: { reason: 'no-build', tip },
      })
    })

    it('should refuse as gh-failed when the deploy runs cannot be listed', async () => {
      const record = await runCheck()

      expect(record).toMatchObject({ reason: 'gh-failed' })
    })

    it('should refuse as gh-failed when the changes since the build cannot be listed', async () => {
      writeRuns([{ headSha: BUILT }])

      const record = await runCheck()

      expect(record).toMatchObject({ reason: 'gh-failed' })
    })

    it('should read no built head when the comment carries no hosted preview', async () => {
      writeComment('## What to look at\n\n<!-- pr-evidence: head=abc -->')

      const record = await runCheck()

      expect(record).toMatchObject({ reason: 'owed', owed: ['preview'] })
      expect(record).not.toHaveProperty('previewHead')
    })
  })

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
    writeRuns([{ headSha: pushBranch() }])

    const record = await runCheck()

    expect(record).toMatchObject({
      reason: 'settled',
      owed: [],
      preview: 'https://feat-x.site.pages.dev',
      local: 'http://localhost:5173',
      checklist: '- [x] the hero settles\n- [ ] the footer wraps',
      drivable: 2,
    })
  })

  it('should report settled with no evidence image and no marked comment', async () => {
    writeDeployWorkflow()

    const record = await runCheck()

    expect(record).toMatchObject({ reason: 'settled', owed: [] })
  })

  it('should carry the reel skip line the marked comment holds as reelSkip', async () => {
    writeComment(
      '**No reel:** target-missing: beat 2: no match\n\n## What to look at\n\n<!-- pr-evidence: head=abc -->',
    )

    const record = await runCheck()

    expect(record).toMatchObject({
      reason: 'settled',
      reelSkip: 'target-missing: beat 2: no match',
    })
  })

  it('should read the reel skip unchanged beside a reel coverage line', async () => {
    writeComment(
      '**Reel** filmed at `abc1234`:<br><img src="https://x/reel.webp" width="960" alt="reel filmed at abc1234">\n\n**Reel covers:** Board; left out: Settings\n\n**No reel:** wrong-state: beat 1\n\n## What to look at\n\n<!-- pr-evidence: head=abc -->',
    )

    const record = await runCheck()

    expect(record).toMatchObject({ reelSkip: 'wrong-state: beat 1' })
  })

  it('should carry the per-width reel skip lines the marked comment holds as reelSkips', async () => {
    writeComment(
      '**No reel:** deferred: behind #1\n\n**No reel at 390:** no-visible-change\n\n**No reel at 1280:** wrong-state: beat 1\n\n## What to look at\n\n<!-- pr-evidence: head=abc -->',
    )

    const record = await runCheck()

    expect(record).toMatchObject({
      reelSkip: 'deferred: behind #1',
      reelSkips: [
        { width: 390, skip: 'no-visible-change' },
        { width: 1280, skip: 'wrong-state: beat 1' },
      ],
    })
  })

  it('should omit reelSkip when the marked comment holds no reel skip line', async () => {
    writeComment('## What to look at\n\n<!-- pr-evidence: head=abc -->')

    const record = await runCheck()

    expect(record).not.toHaveProperty('reelSkip')
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
    ['--reel-covers', 'Board; left out: none'],
  ])(
    'should refuse %s before any gh call and print no body',
    async (flag, value) => {
      const record = await runCheck([flag, value])

      expect(record).toMatchObject({ reason: 'check-writes' })
      expect(record).not.toHaveProperty('body')
      expect(existsSync(join(tempDir, 'files-calls.log'))).toBe(false)
    },
  )

  it('should refuse --no-checklist before any gh call', async () => {
    const record = await runCheck(['--no-checklist'])

    expect(record).toMatchObject({ reason: 'check-writes' })
    expect(existsSync(join(tempDir, 'files-calls.log'))).toBe(false)
  })

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

    it('should report an empty list when the only painted change is a deletion', async () => {
      writeBaseTree(false, ['e2e/evidence/dark/board.png'])
      writeFileSync(
        join(tempDir, 'files.tsv'),
        'removed\tsrc/client/old-styles.css\n',
      )

      const record = await runCheck()

      expect(record.uncaptured).toEqual([])
    })

    it('should name only the modified painted path beside a deleted one', async () => {
      writeBaseTree(false, ['e2e/evidence/dark/board.png'])
      writeFileSync(
        join(tempDir, 'files.tsv'),
        'removed\tsrc/client/old-styles.css\nmodified\tsrc/client/styles.css\n',
      )

      const record = await runCheck()

      expect(record.uncaptured).toEqual(['src/client/styles.css'])
    })

    it('should not let a deleted evidence image clear a modified painted path', async () => {
      writeBaseTree(false, ['e2e/evidence/dark/board.png'])
      writeFileSync(
        join(tempDir, 'files.tsv'),
        'removed\te2e/evidence/dark/stale.png\nmodified\tsrc/client/styles.css\n',
      )

      const record = await runCheck()

      expect(record.uncaptured).toEqual(['src/client/styles.css'])
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

    it('should open the comment on an uncaptured path with no other evidence news', async () => {
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

      const record = JSON.parse(result.stdout)
      expect(record).toMatchObject({
        reason: 'ok',
        uncaptured: ['src/client/a.css'],
      })
      expect(record.body).toContain('**Uncaptured:** `src/client/a.css`')
    })

    describe('beside a reel filmed at an earlier head', () => {
      function commitOnBranch(path: string, text: string): void {
        const git = (...args: string[]) =>
          execaSync('git', ['-C', repoRoot, ...args], {
            env: {
              GIT_AUTHOR_NAME: 't',
              GIT_AUTHOR_EMAIL: 't@t',
              GIT_COMMITTER_NAME: 't',
              GIT_COMMITTER_EMAIL: 't@t',
            },
          })
        mkdirSync(join(repoRoot, path, '..'), { recursive: true })
        writeFileSync(join(repoRoot, path), text)
        git('add', '.')
        git('commit', '-q', '-m', `edit ${path}`)
      }

      function writeReelCommentAt(head: string): void {
        const short = head.slice(0, 7)
        writeComment(
          `## Evidence\n\n**Reel** filmed at \`${short}\`:<br><img src="${REEL_LINK}" width="960" alt="reel filmed at ${short}">\n\n## What to look at\n\n<!-- pr-evidence: head=${short} -->`,
        )
      }

      async function renderAtHead(): Promise<Record<string, unknown>> {
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
        return JSON.parse(result.stdout)
      }

      beforeEach(() => {
        writeBaseTree(false, ['e2e/evidence/dark/board.png'])
        writeFileSync(
          join(tempDir, 'files.tsv'),
          'modified\tsrc/client/a.css\n',
        )
        execaSync('git', ['-C', repoRoot, 'checkout', '-q', 'feat/x'])
        writeReelCommentAt(
          execaSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD']).stdout,
        )
      })

      it('should drop the uncaptured line when the gap changed only markdown', async () => {
        commitOnBranch('docs/guide.md', '# guide, reworded\n')

        const record = await renderAtHead()

        expect(record.reason).toBe('ok')
        expect(record.body).toContain('**Reel** filmed at')
        expect(record.body).not.toContain('Uncaptured')
      })

      it('should keep the uncaptured line when the gap changed a source path', async () => {
        commitOnBranch('src/client/a.css', 'a { color: red }\n')

        const record = await renderAtHead()

        expect(record.body).toContain('**Uncaptured:** `src/client/a.css`')
      })

      it('should keep the uncaptured field raw on a carried reel', async () => {
        commitOnBranch('docs/guide.md', '# guide, reworded\n')

        const record = await renderAtHead()

        expect(record.uncaptured).toEqual(['src/client/a.css'])
      })
    })

    it('should still skip as no-evidence when the base keeps no capture', async () => {
      writeBaseTree(false, ['src/app.tsx'])
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

      const record = JSON.parse(result.stdout)
      expect(record.reason).toBe('no-evidence')
      expect(record).not.toHaveProperty('uncaptured')
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
