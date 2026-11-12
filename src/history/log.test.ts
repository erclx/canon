import { execaSync } from 'execa'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git/env'
import {
  classify,
  isLockOrRelease,
  parseLog,
  readGenerated,
  readLog,
  readRepository,
} from '@/history/log'

describe('classify', () => {
  it('should read the type off a conventional subject with a scope', () => {
    expect(
      classify('feat(census): count folders (#1)', 'Ann', 'a@x.dev'),
    ).toEqual({
      class: 'typed',
      type: 'feat',
    })
  })

  it('should read the type off a breaking subject with no scope', () => {
    expect(classify('fix!: drop the flag', 'Ann', 'a@x.dev')).toEqual({
      class: 'typed',
      type: 'fix',
    })
  })

  it('should class a subject with no conventional prefix as untyped', () => {
    expect(
      classify('Merge pull request #4 from a/b', 'Ann', 'a@x.dev'),
    ).toEqual({
      class: 'untyped',
    })
  })

  it('should class a release-please subject as a release even from a person', () => {
    expect(
      classify('chore(main): release 5.85.0 (#3007)', 'Ann', 'a@x.dev'),
    ).toEqual({
      class: 'release',
    })
  })

  it('should class a bot author as a bot whatever its subject', () => {
    expect(
      classify(
        'build(deps-dev): bump the bun group (#2921)',
        'dependabot[bot]',
        '49699333+dependabot[bot]@users.noreply.github.com',
      ),
    ).toEqual({ class: 'bot' })
  })
})

describe('isLockOrRelease', () => {
  it('should match a lockfile in a nested folder', () => {
    expect(isLockOrRelease('web/bun.lock')).toBe(true)
  })

  it('should match the changelog and the release manifest', () => {
    expect(isLockOrRelease('CHANGELOG.md')).toBe(true)
    expect(isLockOrRelease('.release-please-manifest.json')).toBe(true)
  })

  it('should leave a file merely named like a lock out', () => {
    expect(isLockOrRelease('src/lock.ts')).toBe(false)
  })
})

describe('parseLog', () => {
  it('should split captured log text into merges with their files', () => {
    const text =
      '\x1eaaa\x1f2026-11-12T14:35:35+01:00\x1fAnn\x1fa@x.dev\x1ffeat(x): add y (#2)\0\nsrc/a.ts\0src/b.md\0' +
      '\x1ebbb\x1f2026-11-10T09:00:00-05:00\x1fBo\x1fb@x.dev\x1fupdate readme\0\nREADME.md\0'

    expect(parseLog(text)).toEqual([
      {
        sha: 'aaa',
        date: '2026-11-12',
        subject: 'feat(x): add y (#2)',
        author: 'Ann',
        class: 'typed',
        type: 'feat',
        files: ['src/a.ts', 'src/b.md'],
      },
      {
        sha: 'bbb',
        date: '2026-11-10',
        subject: 'update readme',
        author: 'Bo',
        class: 'untyped',
        files: ['README.md'],
      },
    ])
  })

  it('should read a commit that touched no file as an empty file list', () => {
    const text =
      '\x1eccc\x1f2026-11-12T00:00:00Z\x1fAnn\x1fa@x.dev\x1fchore: empty\0'

    expect(parseLog(text)[0].files).toEqual([])
  })
})

describe('on a temporary repository', () => {
  let ROOT: string

  function git(...args: string[]): string {
    return execaSync('git', ['-C', ROOT, ...args], {
      env: gitEnv(),
      extendEnv: false,
    }).stdout
  }

  function write(path: string, body: string): void {
    const full = join(ROOT, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, body)
  }

  function commit(subject: string, date: string): void {
    git('add', '--all')
    execaSync('git', ['-C', ROOT, 'commit', '--quiet', '-m', subject], {
      env: { ...gitEnv(), GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date },
      extendEnv: false,
    })
  }

  beforeEach(() => {
    ROOT = mkdtempSync(join(tmpdir(), 'canon-history-log-'))
    git('init', '--quiet', '--initial-branch=main')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'Test')
  })

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true })
  })

  it('should read the trunk alone, carrying a merged branch as its merge commit', async () => {
    write('a.ts', 'one\n')
    commit('feat: start', '2026-11-02T10:00:00Z')
    git('checkout', '--quiet', '-b', 'topic')
    write('b.ts', 'two\n')
    commit('wip: inside the branch', '2026-11-03T10:00:00Z')
    git('checkout', '--quiet', 'main')
    execaSync(
      'git',
      [
        '-C',
        ROOT,
        'merge',
        '--quiet',
        '--no-ff',
        '-m',
        'fix: land topic',
        'topic',
      ],
      {
        env: {
          ...gitEnv(),
          GIT_COMMITTER_DATE: '2026-11-04T10:00:00Z',
          GIT_AUTHOR_DATE: '2026-11-04T10:00:00Z',
        },
        extendEnv: false,
      },
    )

    const merges = await readLog(ROOT, '2026-11-01')

    expect(merges?.map(({ subject, files }) => ({ subject, files }))).toEqual([
      { subject: 'fix: land topic', files: ['b.ts'] },
      { subject: 'feat: start', files: ['a.ts'] },
    ])
  })

  it('should leave out commits before the since date', async () => {
    write('a.ts', 'one\n')
    commit('feat: old', '2026-10-01T10:00:00Z')
    write('a.ts', 'two\n')
    commit('feat: new', '2026-11-05T10:00:00Z')

    const merges = await readLog(ROOT, '2026-11-01')

    expect(merges?.map((merge) => merge.subject)).toEqual(['feat: new'])
  })

  it('should resolve a subfolder to the top level with the head and first dates', async () => {
    write('src/a.ts', 'one\n')
    commit('feat: start', '2026-10-01T10:00:00Z')
    write('src/a.ts', 'two\n')
    commit('feat: next', '2026-11-05T10:00:00Z')

    const repository = await readRepository(join(ROOT, 'src'))

    expect(repository).toMatchObject({
      headDate: '2026-11-05',
      firstDate: '2026-10-01',
    })
    expect(repository?.head).toMatch(/^[0-9a-f]{40}$/)
  })

  it('should return undefined for a repository with no commits', async () => {
    expect(await readRepository(ROOT)).toBeUndefined()
  })

  it('should report the paths .gitattributes marks linguist-generated', async () => {
    write('.gitattributes', 'gen/** linguist-generated\n')

    const generated = await readGenerated(ROOT, ['gen/out.ts', 'src/a.ts'])

    expect([...generated]).toEqual(['gen/out.ts'])
  })
})
