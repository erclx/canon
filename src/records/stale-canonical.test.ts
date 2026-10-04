import { execaSync } from 'execa'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git-env'
import {
  type CanonicalDoc,
  type CanonicalReport,
  staleCanonical,
} from '@/records/stale-canonical'

let ROOT: string

function git(args: string[], env: Record<string, string> = {}): string {
  return execaSync('git', ['-C', ROOT, ...args], {
    env: { ...gitEnv(), ...env },
    extendEnv: false,
  }).stdout
}

function writeDoc(path: string, reviewed?: string): void {
  const full = join(ROOT, path)
  mkdirSync(dirname(full), { recursive: true })
  const frontmatter =
    reviewed === undefined ? [] : ['---', `reviewed: ${reviewed}`, '---', '']
  writeFileSync(full, [...frontmatter, '# Doc', '', 'Body.', ''].join('\n'))
}

/**
 * Commits on the given day and tags that commit lightweight, which is how
 * release-please tags, so the tag's creator date is the commit date.
 */
function release(tag: string, day: string): void {
  const date = `${day}T12:00:00Z`
  git(['commit', '--allow-empty', '-q', '-m', `chore: release ${tag}`], {
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_DATE: date,
  })
  git(['tag', tag])
}

async function read(): Promise<CanonicalReport> {
  const outcome = await staleCanonical(ROOT)
  if (!outcome.ok) throw new Error(outcome.message)
  return outcome
}

async function readDoc(path: string): Promise<CanonicalDoc | undefined> {
  return (await read()).docs.find((doc) => doc.path === path)
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-stale-canonical-'))
  git(['init', '-q', '--initial-branch=main'])
  git(['config', 'user.email', 'test@example.com'])
  git(['config', 'user.name', 'Test'])
  git(['commit', '--allow-empty', '-q', '-m', 'chore: init'], {
    GIT_AUTHOR_DATE: '2026-01-01T12:00:00Z',
    GIT_COMMITTER_DATE: '2026-01-01T12:00:00Z',
  })
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('staleCanonical on a tagged history', () => {
  it('should count only the releases tagged after the reviewed date', async () => {
    writeDoc('canon/REQUIREMENTS.md', '2026-03-01')
    release('v1.0.0', '2026-02-01')
    release('v1.1.0', '2026-04-01')
    release('v1.2.0', '2026-05-01')

    const doc = await readDoc('canon/REQUIREMENTS.md')

    expect(doc).toMatchObject({
      reviewed: '2026-03-01',
      releasesSince: 2,
      latestRelease: 'v1.2.0',
    })
  })

  it('should report zero rather than null when the stamp postdates every tag', async () => {
    writeDoc('canon/ARCHITECTURE.md', '2026-06-01')
    release('v1.0.0', '2026-02-01')

    const doc = await readDoc('canon/ARCHITECTURE.md')

    expect(doc?.releasesSince).toBe(0)
  })

  it('should report an unstamped doc as never reviewed with no count', async () => {
    writeDoc('canon/REQUIREMENTS.md')
    release('v1.0.0', '2026-02-01')

    const doc = await readDoc('canon/REQUIREMENTS.md')

    expect(doc).toMatchObject({ reviewed: null, releasesSince: null })
    expect(doc?.invalidReviewed).toBeUndefined()
  })

  it('should carry a stamp that is not a date back raw rather than parse it', async () => {
    writeDoc('canon/REQUIREMENTS.md', '69720c49')
    release('v1.0.0', '2026-02-01')

    const doc = await readDoc('canon/REQUIREMENTS.md')

    expect(doc).toMatchObject({
      reviewed: null,
      invalidReviewed: '69720c49',
      releasesSince: null,
    })
  })

  it('should leave out a tag the current head has not merged', async () => {
    writeDoc('canon/REQUIREMENTS.md', '2026-03-01')
    release('v1.0.0', '2026-04-01')
    git(['checkout', '-q', '-b', 'side'])
    release('v9.0.0', '2026-05-01')
    git(['checkout', '-q', 'main'])

    const doc = await readDoc('canon/REQUIREMENTS.md')

    expect(doc).toMatchObject({ releasesSince: 1, latestRelease: 'v1.0.0' })
  })

  it('should leave out a tag that does not name a release', async () => {
    writeDoc('canon/REQUIREMENTS.md', '2026-03-01')
    release('v1.0.0', '2026-04-01')
    release('eval/seed-ablation-20260502', '2026-05-02')

    const doc = await readDoc('canon/REQUIREMENTS.md')

    expect(doc).toMatchObject({ releasesSince: 1, latestRelease: 'v1.0.0' })
  })

  it('should count a component-prefixed release tag', async () => {
    writeDoc('canon/REQUIREMENTS.md', '2026-03-01')
    release('canon-v2.1.0', '2026-04-01')

    const doc = await readDoc('canon/REQUIREMENTS.md')

    expect(doc).toMatchObject({
      releasesSince: 1,
      latestRelease: 'canon-v2.1.0',
    })
  })
})

describe('staleCanonical on the doc set', () => {
  it('should read a doc at the .claude root when canon does not hold it', async () => {
    writeDoc('.claude/ARCHITECTURE.md', '2026-03-01')

    const report = await read()

    expect(report.docs.map((doc) => doc.path)).toEqual([
      '.claude/ARCHITECTURE.md',
    ])
  })

  it('should omit a doc the project does not carry', async () => {
    writeDoc('canon/REQUIREMENTS.md')

    const report = await read()

    expect(report.docs.map((doc) => doc.path)).toEqual([
      'canon/REQUIREMENTS.md',
    ])
  })
})

describe('staleCanonical with no tags', () => {
  it('should say the history carries no tags and still count zero', async () => {
    writeDoc('canon/REQUIREMENTS.md', '2026-03-01')

    const report = await read()

    expect(report.tagged).toBe(false)
    expect(report.docs[0]).toMatchObject({
      releasesSince: 0,
      latestRelease: null,
    })
  })
})

describe('staleCanonical before the first commit', () => {
  it('should read an unborn head as a history with no tags', async () => {
    const unborn = mkdtempSync(join(tmpdir(), 'canon-stale-canonical-unborn-'))
    execaSync('git', ['-C', unborn, 'init', '-q'], {
      env: gitEnv(),
      extendEnv: false,
    })
    mkdirSync(join(unborn, 'canon'))
    writeFileSync(join(unborn, 'canon', 'REQUIREMENTS.md'), '# Requirements\n')

    const outcome = await staleCanonical(unborn)
    rmSync(unborn, { recursive: true, force: true })

    expect(outcome).toMatchObject({ ok: true, tagged: false })
  })
})

describe('staleCanonical outside a repository', () => {
  it('should refuse when the tags cannot be read', async () => {
    const bare = mkdtempSync(join(tmpdir(), 'canon-stale-canonical-bare-'))
    writeFileSync(join(bare, 'x'), '')

    const outcome = await staleCanonical(bare)
    rmSync(bare, { recursive: true, force: true })

    expect(outcome).toMatchObject({ ok: false, reason: 'unreadable-tags' })
  })
})
