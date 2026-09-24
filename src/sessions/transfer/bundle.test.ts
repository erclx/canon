import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { $ } from 'bun'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git-env'
import {
  exportSession,
  importSession,
  type ImportOutcome,
} from '@/sessions/transfer/bundle'
import { encodeProjectPath } from '@/sessions/transfer/transcript'

const ID = '2cb831b1-b32c-4d57-80a8-d23cbc5ef81e'
const STARTED = '2026-09-01T08:00:00.000Z'

let DIR: string
let SOURCE: string
let TARGET: string
let SOURCE_PROJECTS: string
let TARGET_PROJECTS: string

async function git(cwd: string, ...args: string[]): Promise<void> {
  await $`git -C ${cwd} ${args}`.env(gitEnv()).quiet()
}

async function initRepository(path: string, origin: string): Promise<void> {
  mkdirSync(path, { recursive: true })
  await git(path, 'init', '-q', '-b', 'main')
  await git(path, 'config', 'user.email', 'test@example.com')
  await git(path, 'config', 'user.name', 'test')
  await git(path, 'commit', '-q', '--allow-empty', '-m', 'init')
  await git(path, 'remote', 'add', 'origin', origin)
}

function seedSession(): void {
  const folder = join(SOURCE_PROJECTS, encodeProjectPath(SOURCE))
  const side = join(folder, ID)
  mkdirSync(join(side, 'tool-results'), { recursive: true })
  mkdirSync(join(side, 'subagents'), { recursive: true })
  writeFileSync(
    join(folder, `${ID}.jsonl`),
    [
      { type: 'custom-title', customTitle: 'worker-canon-export' },
      { type: 'user', cwd: SOURCE, timestamp: STARTED },
    ]
      .map((line) => `${JSON.stringify(line)}\n`)
      .join(''),
  )
  writeFileSync(join(side, 'custom-title.json'), '{"title":"t"}')
  writeFileSync(join(side, 'tool-results', 'result-1.txt'), 'output')
  writeFileSync(join(side, 'subagents', 'agent-1.jsonl'), '{}\n')
}

const notLive = async (): Promise<boolean> => false

async function exportBundle(): Promise<string> {
  const outcome = await exportSession({
    id: ID,
    cwd: SOURCE,
    projects: SOURCE_PROJECTS,
    isLive: notLive,
  })
  if (!outcome.ok) throw new Error(outcome.message)
  return outcome.path
}

function importBundle(
  bundle: string,
  isLive: (id: string) => Promise<boolean> = notLive,
): Promise<ImportOutcome> {
  return importSession({
    bundle,
    root: TARGET,
    projects: TARGET_PROJECTS,
    isLive,
  })
}

async function craftBundle(entries: Record<string, string>): Promise<string> {
  const path = join(DIR, 'crafted.tar.gz')
  const archive = new Bun.Archive(entries, { compress: 'gzip' })
  writeFileSync(path, await archive.bytes())
  return path
}

beforeEach(async () => {
  DIR = mkdtempSync(join(tmpdir(), 'canon-bundle-'))
  SOURCE = join(DIR, 'source', 'canon')
  TARGET = join(DIR, 'elsewhere', 'canon')
  SOURCE_PROJECTS = join(DIR, 'source-config', 'projects')
  TARGET_PROJECTS = join(DIR, 'target-config', 'projects')

  await initRepository(SOURCE, 'git@github.com:erclx/canon.git')
  await $`git clone -q ${SOURCE} ${TARGET}`.env(gitEnv()).quiet()
  await git(
    TARGET,
    'remote',
    'set-url',
    'origin',
    'https://github.com/erclx/canon',
  )
  seedSession()
})

afterEach(() => {
  rmSync(DIR, { recursive: true, force: true })
})

describe('exportSession', () => {
  it('should write the bundle under the scratch folder by default', async () => {
    const path = await exportBundle()

    expect(path).toBe(
      join(SOURCE, '.canon', 'tmp', 'session-export', `${ID}.tar.gz`),
    )
  })

  it('should record the source repository in the manifest', async () => {
    const outcome = await exportSession({
      id: ID,
      cwd: SOURCE,
      projects: SOURCE_PROJECTS,
      isLive: notLive,
    })

    expect(outcome.ok && outcome.manifest).toMatchObject({
      sessionId: ID,
      title: 'worker-canon-export',
      cwd: SOURCE,
      root: SOURCE,
      origin: 'github.com/erclx/canon',
      branch: 'main',
      recordsHead: null,
      compacted: false,
      live: false,
      handoff: null,
      recommend: 'transcript',
    })
  })

  it('should recommend the handoff when a compact note was written since the session began', async () => {
    const compact = join(SOURCE, '.canon', 'compact')
    mkdirSync(compact, { recursive: true })
    writeFileSync(join(compact, 'handoff.md'), '# Handoff\n')

    const outcome = await exportSession({
      id: ID,
      cwd: SOURCE,
      projects: SOURCE_PROJECTS,
      isLive: notLive,
    })

    expect(outcome.ok && outcome.manifest).toMatchObject({
      handoff: '.canon/compact/handoff.md',
      handoffCommitted: false,
      recommend: 'handoff',
    })
  })

  it('should ignore a compact note older than the session', async () => {
    const compact = join(SOURCE, '.canon', 'compact')
    mkdirSync(compact, { recursive: true })
    const note = join(compact, 'old.md')
    writeFileSync(note, '# Old\n')
    const before = new Date('2026-08-01T00:00:00.000Z')
    utimesSync(note, before, before)

    const outcome = await exportSession({
      id: ID,
      cwd: SOURCE,
      projects: SOURCE_PROJECTS,
      isLive: notLive,
    })

    expect(outcome.ok && outcome.manifest.handoff).toBe(null)
  })

  it('should refuse an id no project folder holds', async () => {
    const outcome = await exportSession({
      id: '00000000-0000-0000-0000-000000000000',
      cwd: SOURCE,
      projects: SOURCE_PROJECTS,
      isLive: notLive,
    })

    expect(outcome).toMatchObject({ ok: false, reason: 'not-found' })
  })
})

describe('importSession', () => {
  it('should place the transcript and its side folder under the local encoding with paths kept', async () => {
    const outcome = await importBundle(await exportBundle())

    const folder = join(TARGET_PROJECTS, encodeProjectPath(TARGET))
    expect(outcome).toMatchObject({ ok: true, folder, behind: [] })
    expect(readFileSync(join(folder, `${ID}.jsonl`), 'utf8')).toBe(
      readFileSync(
        join(SOURCE_PROJECTS, encodeProjectPath(SOURCE), `${ID}.jsonl`),
        'utf8',
      ),
    )
    expect(existsSync(join(folder, ID, 'custom-title.json'))).toBe(true)
    expect(existsSync(join(folder, ID, 'tool-results', 'result-1.txt'))).toBe(
      true,
    )
    expect(existsSync(join(folder, ID, 'subagents', 'agent-1.jsonl'))).toBe(
      true,
    )
  })

  it('should print both resume routes', async () => {
    const outcome = await importBundle(await exportBundle())

    expect(outcome.ok && outcome.routes).toEqual([
      `cd ${TARGET} && claude --resume ${ID}`,
      `cd ${TARGET} && claude "/canon:session-resume"`,
    ])
  })

  it('should refuse when the target transcript already exists', async () => {
    const bundle = await exportBundle()
    await importBundle(bundle)

    const outcome = await importBundle(bundle)

    expect(outcome).toMatchObject({ ok: false, reason: 'exists' })
  })

  it('should refuse when another project folder already holds the id', async () => {
    const bundle = await exportBundle()
    const other = join(TARGET_PROJECTS, '-another-path')
    mkdirSync(other, { recursive: true })
    writeFileSync(join(other, `${ID}.jsonl`), '{}\n')

    const outcome = await importBundle(bundle)

    expect(outcome).toMatchObject({ ok: false, reason: 'exists' })
  })

  it('should refuse a bundle exported from another repository', async () => {
    const bundle = await exportBundle()
    await git(
      TARGET,
      'remote',
      'set-url',
      'origin',
      'git@github.com:erclx/other.git',
    )

    const outcome = await importBundle(bundle)

    expect(outcome).toMatchObject({ ok: false, reason: 'other-repository' })
  })

  it('should refuse an id that is live on this machine', async () => {
    const outcome = await importBundle(await exportBundle(), async () => true)

    expect(outcome).toMatchObject({ ok: false, reason: 'live-here' })
  })

  it('should report without refusing when the repository and the records lag the source', async () => {
    await git(SOURCE, 'commit', '-q', '--allow-empty', '-m', 'ahead')
    const records = join(SOURCE, '.canon', '.records.git')
    await $`git init -q --bare ${records}`.env(gitEnv()).quiet()
    const tree = join(SOURCE, '.canon')
    await $`git --git-dir=${records} --work-tree=${tree} -c user.email=t@e -c user.name=t commit -q --allow-empty -m records`
      .env(gitEnv())
      .quiet()

    const outcome = await importBundle(await exportBundle())

    expect(outcome.ok && outcome.behind).toEqual([
      'repository-behind',
      'records-behind',
    ])
  })

  it('should refuse a file that is not a bundle', async () => {
    const path = join(DIR, 'junk.tar.gz')
    writeFileSync(path, 'not an archive')

    const outcome = await importBundle(path)

    expect(outcome).toMatchObject({ ok: false, reason: 'not-a-bundle' })
  })

  it('should refuse a bundle carrying a path that climbs out', async () => {
    const bundle = await craftBundle({
      'manifest.json': await readManifest(await exportBundle()),
      [`session/${ID}.jsonl`]: '{}\n',
      [`session/${ID}/../../escape.txt`]: 'x',
    })

    const outcome = await importBundle(bundle)

    expect(outcome).toMatchObject({ ok: false, reason: 'not-a-bundle' })
    expect(existsSync(join(TARGET_PROJECTS, 'escape.txt'))).toBe(false)
  })

  it('should remove what it placed when a write fails partway', async () => {
    const bundle = await craftBundle({
      'manifest.json': await readManifest(await exportBundle()),
      [`session/${ID}.jsonl`]: '{}\n',
      [`session/${ID}/tool-results`]: 'a file where a folder is needed next',
      [`session/${ID}/tool-results/result-1.txt`]: 'x',
    })

    const outcome = await importBundle(bundle)

    const folder = join(TARGET_PROJECTS, encodeProjectPath(TARGET))
    expect(outcome).toMatchObject({ ok: false, reason: 'write-failed' })
    expect(existsSync(join(folder, `${ID}.jsonl`))).toBe(false)
    expect(existsSync(join(folder, ID))).toBe(false)
  })

  it('should accept the same bundle again after a partial failure was rolled back', async () => {
    const manifest = await readManifest(await exportBundle())
    await importBundle(
      await craftBundle({
        'manifest.json': manifest,
        [`session/${ID}.jsonl`]: '{}\n',
        [`session/${ID}/tool-results`]: 'x',
        [`session/${ID}/tool-results/result-1.txt`]: 'x',
      }),
    )

    const outcome = await importBundle(await exportBundle())

    expect(outcome).toMatchObject({ ok: true })
  })

  it('should refuse a bundle carrying an absolute path', async () => {
    const bundle = await craftBundle({
      'manifest.json': await readManifest(await exportBundle()),
      [`session/${ID}.jsonl`]: '{}\n',
      '/tmp/escape.txt': 'x',
    })

    const outcome = await importBundle(bundle)

    expect(outcome).toMatchObject({ ok: false, reason: 'not-a-bundle' })
  })
})

async function readManifest(bundle: string): Promise<string> {
  const archive = new Bun.Archive(readFileSync(bundle))
  const files = await archive.files()
  const manifest = files.get('manifest.json')
  if (!manifest) throw new Error('bundle carries no manifest')
  return manifest.text()
}
