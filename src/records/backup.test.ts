import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  truncateSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { $ } from 'bun'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git-env'
import {
  BACKED_FOLDERS,
  EXCLUDED_ENTRIES,
  projectBranch,
  pullRecords,
  pushRecords,
} from '@/records/backup'
import { MAX_RECORD_BYTES } from '@/records/push-guard'

let ROOT: string
let ORIGIN: string

const RECORDS_GIT_DIR = join('.claude', '.records.git')

/**
 * `gitEnv()` is what keeps these fixtures off the repository under test. The
 * pre-push hook exports `GIT_DIR` and `GIT_WORK_TREE`, and both take precedence
 * over `-C` and `--git-dir`, so a bare call here resolves against this
 * repository and the suite fails only when run from a hook.
 */
async function git(args: string[]): Promise<string> {
  const result = await $`git ${args}`.env(gitEnv()).quiet().nothrow()
  return result.stdout.toString().trim()
}

function recordsGit(root: string, args: string[]): Promise<string> {
  return git(['--git-dir', join(root, RECORDS_GIT_DIR), ...args])
}

/**
 * A git project holding one record in each backed folder, with no records
 * history yet.
 *
 * The `git init` is what a real root always carries. Both verbs read the
 * project's own remotes to clear the shared-origin gate and refuse when that
 * read fails, so a bare directory exercises the refusal rather than the flow.
 */
async function makeProject(): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), 'canon-backup-'))
  for (const folder of BACKED_FOLDERS) {
    mkdirSync(join(root, '.claude', folder), { recursive: true })
    writeFileSync(join(root, '.claude', folder, 'entry.md'), `# ${folder}\n`)
  }
  await git(['init', '--quiet', root])
  return root
}

/** Every path the records origin holds on a project's branch, newline-joined. */
async function trackedOnOrigin(root: string): Promise<string> {
  const branch = await projectBranch(root)
  return git(['-C', ORIGIN, 'ls-tree', '-r', '--name-only', branch])
}

async function makeRecordsRepo(root: string, origin: string): Promise<void> {
  await recordsGit(root, ['init'])
  await recordsGit(root, ['remote', 'add', 'origin', origin])
}

const CANON_ROOTS: string[] = []

function writeCanonRecord(root: string, path: string, text: string): void {
  const full = join(root, '.canon', path)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, text)
}

function canonRecordsGit(root: string, args: string[]): Promise<string> {
  const tree = join(root, '.canon')
  return git([
    '-C',
    tree,
    '--git-dir',
    join(tree, '.records.git'),
    '--work-tree',
    tree,
    ...args,
  ])
}

/**
 * A git project at the `.canon` root holding `records`, keyed by path under
 * that root, with a records history pointed at `ORIGIN` and nothing committed.
 */
async function makeCanonProject(
  records: Record<string, string>,
): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), 'canon-backup-canon-'))
  CANON_ROOTS.push(root)
  for (const [path, text] of Object.entries(records)) {
    writeCanonRecord(root, path, text)
  }
  await git(['init', '--quiet', root])

  const gitDir = join(root, '.canon', '.records.git')
  await git(['--git-dir', gitDir, 'init'])
  await git(['--git-dir', gitDir, 'remote', 'add', 'origin', ORIGIN])
  return root
}

/** The log, the index, and the object count, which a refused push must leave alone. */
async function recordsState(root: string): Promise<string[]> {
  return Promise.all([
    recordsGit(root, ['log', '--oneline']),
    recordsGit(root, ['ls-files']),
    recordsGit(root, ['count-objects', '-v']),
  ])
}

/**
 * Runs `verb` with the process sitting inside the records work tree, which is
 * where a session in a linked worktree under `.claude/worktrees/<name>/`
 * stands and the one place neither verb could reach.
 *
 * A plain subdirectory reproduces that exactly, since what decides both cases
 * is git deriving a pathspec prefix from the current directory. Provisioning a
 * real worktree would cost the fixture without changing what is measured.
 */
async function fromInsideWorkTree<T>(
  root: string,
  verb: () => Promise<T>,
): Promise<T> {
  const nested = join(root, '.claude', 'worktrees', 'feature')
  mkdirSync(nested, { recursive: true })
  const origin = process.cwd()

  try {
    process.chdir(nested)
    return await verb()
  } finally {
    process.chdir(origin)
  }
}

beforeEach(async () => {
  ROOT = await makeProject()
  ORIGIN = mkdtempSync(join(tmpdir(), 'canon-backup-origin-'))
  await git(['init', '--bare', ORIGIN])
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
  rmSync(ORIGIN, { recursive: true, force: true })
  for (const root of CANON_ROOTS.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('BACKED_FOLDERS', () => {
  // One line per record surface is what the list is for, and an archive named
  // beside the folder it archives is what used to cost a second. Both halves
  // are asserted because either alone passes on the other's failure: a nested
  // path satisfies the suffix test, and a sibling named `archive` satisfies
  // the segment test.
  it('should name only top-level record folders', () => {
    expect(BACKED_FOLDERS.filter((folder) => folder.includes('/'))).toEqual([])
  })

  it('should carry no archive as a sibling of what it archives', () => {
    expect(
      BACKED_FOLDERS.filter((folder) => folder.endsWith('-archive')),
    ).toEqual([])
  })

  // This is the legacy `.claude`-root allowlist now, read only for a project
  // that has not moved to `.canon/` yet. A `.canon` root reads its own
  // directory listing less EXCLUDED_ENTRIES instead, asserted below.
  it('should name exactly the record folders a legacy .claude root carries', () => {
    expect([...BACKED_FOLDERS]).toEqual([
      'diagrams',
      'groundwork',
      'intake',
      'memory',
      'plans',
      'proposals',
      'review',
      'tasks',
      'teach',
      'transcripts',
      'walkthroughs',
    ])
  })
})

describe('EXCLUDED_ENTRIES', () => {
  it('should name exactly the top-level .canon entries a push never carries', () => {
    expect([...EXCLUDED_ENTRIES]).toEqual([
      'tmp',
      'ordinal-locks',
      '.records.git',
    ])
  })
})

describe('projectBranch', () => {
  it('should reduce the project origin the way remoteIdentity reduces one', async () => {
    await git([
      '-C',
      ROOT,
      'remote',
      'add',
      'origin',
      'git@github.com:Owner/Repo.git',
    ])

    expect(await projectBranch(ROOT)).toBe('github.com/owner/repo')
  })

  it('should fall back to the project directory basename with no origin', async () => {
    expect(await projectBranch(ROOT)).toBe(
      basename(resolve(ROOT)).toLowerCase(),
    )
  })

  it('should keep an underscore in the origin identity rather than dashing it out', async () => {
    await git([
      '-C',
      ROOT,
      'remote',
      'add',
      'origin',
      'git@github.com:owner/my_repo.git',
    ])

    expect(await projectBranch(ROOT)).toBe('github.com/owner/my_repo')
  })

  it('should build the push and pull ref path from it rather than a literal main', async () => {
    await git([
      '-C',
      ROOT,
      'remote',
      'add',
      'origin',
      'https://example.test/owner/other.git',
    ])
    await makeRecordsRepo(ROOT, ORIGIN)

    const outcome = await pushRecords(ROOT)

    expect(outcome.ok).toBe(true)
    const branches = await git(['-C', ORIGIN, 'branch', '--list'])
    expect(branches).toContain('example.test/owner/other')
    expect(branches.split('\n')).not.toContain('main')
  })
})

describe('pushRecords', () => {
  it('should name the setup command when no records history exists', async () => {
    const outcome = await pushRecords(ROOT)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('no-repository')
    expect(outcome.message).toContain('git --git-dir=')
  })

  it('should refuse when the records history has no origin', async () => {
    await recordsGit(ROOT, ['init'])

    const outcome = await pushRecords(ROOT)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('no-remote')
  })

  it('should refuse when the project remotes cannot be read', async () => {
    const bare = mkdtempSync(join(tmpdir(), 'canon-backup-bare-'))
    mkdirSync(join(bare, '.claude'), { recursive: true })
    await makeRecordsRepo(bare, ORIGIN)

    const outcome = await pushRecords(bare)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('remote-unreadable')

    const pushed = await git(['-C', ORIGIN, 'branch', '--list'])
    expect(pushed).toBe('')

    rmSync(bare, { recursive: true, force: true })
  })

  it('should refuse when the records origin is also a remote of the project', async () => {
    await git(['-C', ROOT, 'remote', 'add', 'origin', `${ORIGIN}.git`])
    await makeRecordsRepo(ROOT, ORIGIN)

    const outcome = await pushRecords(ROOT)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('remote-shared')
  })

  it('should refuse a project remote spelled with the other transport', async () => {
    await git([
      '-C',
      ROOT,
      'remote',
      'add',
      'origin',
      'https://github.com/owner/repo.git',
    ])
    await recordsGit(ROOT, ['init'])
    await recordsGit(ROOT, [
      'remote',
      'add',
      'origin',
      'git@github.com:owner/repo.git',
    ])

    const outcome = await pushRecords(ROOT)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('remote-shared')
  })

  it('should carry a backed folder deleted in full since the last push', async () => {
    await makeRecordsRepo(ROOT, ORIGIN)
    await pushRecords(ROOT)
    rmSync(join(ROOT, '.claude', 'intake'), { recursive: true, force: true })

    const outcome = await pushRecords(ROOT)

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.changed).toBe(1)

    const tracked = await trackedOnOrigin(ROOT)
    expect(tracked).not.toContain('intake/')
  })

  // The archives moved inside the records they archive, which takes a name off
  // the backed list rather than off the disk. A pathspec built from that list
  // alone never mentions the old name again, so its deletion never stages, the
  // remote keeps it, and a pull restores it beside the folder that replaced it.
  it('should carry a folder that left the backed list since the last push', async () => {
    const retired = join(ROOT, '.claude', 'plans-archive')
    mkdirSync(retired, { recursive: true })
    writeFileSync(join(retired, 'entry.md'), '# retired\n')
    await makeRecordsRepo(ROOT, ORIGIN)
    await pushRecords(ROOT)

    // Asserted before the removal, because a name the pathspec never carries
    // reaches the remote on no push and passes the absence test below having
    // proved nothing.
    expect(await trackedOnOrigin(ROOT)).toContain('plans-archive/entry.md')

    rmSync(retired, { recursive: true, force: true })
    const outcome = await pushRecords(ROOT)

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.changed).toBe(1)
    expect(await trackedOnOrigin(ROOT)).not.toContain('plans-archive/')
  })

  it('should commit every backed folder and push it to the records origin', async () => {
    await makeRecordsRepo(ROOT, ORIGIN)

    const outcome = await pushRecords(ROOT)

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.changed).toBe(BACKED_FOLDERS.length)
    expect(outcome.pushed).toBe(true)

    const tracked = await trackedOnOrigin(ROOT)
    expect(tracked.split('\n').sort()).toEqual(
      BACKED_FOLDERS.map((folder) => `${folder}/entry.md`).sort(),
    )
  })

  it('should carry no path outside the backed folders', async () => {
    mkdirSync(join(ROOT, '.claude', 'skills'), { recursive: true })
    writeFileSync(join(ROOT, '.claude', 'skills', 'a.md'), 'shipped\n')
    writeFileSync(join(ROOT, '.claude', 'ARCHITECTURE.md'), 'shipped\n')
    mkdirSync(join(ROOT, '.claude', '.tmp'), { recursive: true })
    writeFileSync(join(ROOT, '.claude', '.tmp', 'scratch.md'), 'scratch\n')
    await makeRecordsRepo(ROOT, ORIGIN)

    await pushRecords(ROOT)

    const tracked = await trackedOnOrigin(ROOT)
    expect(tracked).not.toContain('skills/')
    expect(tracked).not.toContain('ARCHITECTURE.md')
    expect(tracked).not.toContain('.tmp/')
  })

  // The `.canon` counterpart of the allowlist test above: nothing bounds the
  // folder set from outside any more, so a new top-level directory is carried
  // and named as first seen, while the two excluded folder names are not.
  it('should carry a new .canon folder as first seen, excluding tmp and ordinal-locks', async () => {
    const canonRoot = await makeCanonProject({
      'memory/entry.md': '# memory\n',
      'tmp/scratch.md': 'scratch\n',
    })
    mkdirSync(join(canonRoot, '.canon', 'ordinal-locks', '01'), {
      recursive: true,
    })

    const outcome = await pushRecords(canonRoot)

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.firstSeen).toEqual(['memory'])

    const tracked = await trackedOnOrigin(canonRoot)
    expect(tracked).toContain('memory/entry.md')
    expect(tracked).not.toContain('tmp/')
    expect(tracked).not.toContain('ordinal-locks/')
  })

  // An older binary put `tmp` into the records index, and folding the index
  // into the scope re-admitted it on every later push through `add -f`,
  // whatever the exclusion list said. The name leaves the history once and
  // then stays out.
  it('should drop an excluded name the records index still tracks, once', async () => {
    const canonRoot = await makeCanonProject({
      'memory/entry.md': '# memory\n',
      'tmp/old/notes.md': 'old scratch\n',
    })
    await canonRecordsGit(canonRoot, ['add', '-f', '--', 'memory', 'tmp'])
    await canonRecordsGit(canonRoot, [
      '-c',
      'user.name=t',
      '-c',
      'user.email=t@t',
      'commit',
      '--quiet',
      '-m',
      'older binary',
    ])
    writeCanonRecord(canonRoot, 'tmp/new-slug/backup.md', 'new scratch\n')

    const outcome = await pushRecords(canonRoot)

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.dropped).toEqual(['tmp'])
    expect(await trackedOnOrigin(canonRoot)).not.toContain('tmp/')

    const second = await pushRecords(canonRoot)

    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.dropped).toEqual([])
    expect(second.changed).toBe(0)
  })

  it('should name a new file under a tracked folder as added, not first seen', async () => {
    const canonRoot = await makeCanonProject({
      'memory/entry.md': '# memory\n',
    })
    await pushRecords(canonRoot)
    writeCanonRecord(canonRoot, 'memory/second.md', '# second\n')

    const outcome = await pushRecords(canonRoot)

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.added).toEqual(['memory/second.md'])
    expect(outcome.firstSeen).toEqual([])
  })

  it('should refuse the whole push on an oversized record, staging nothing', async () => {
    await makeRecordsRepo(ROOT, ORIGIN)
    await pushRecords(ROOT)
    const before = await recordsState(ROOT)
    const big = join(ROOT, '.claude', 'groundwork', 'backup.tar')
    writeFileSync(big, '')
    truncateSync(big, MAX_RECORD_BYTES + 1)
    writeFileSync(join(ROOT, '.claude', 'memory', 'fine.md'), '# fine\n')

    const outcome = await pushRecords(ROOT)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('unsafe-payload')
    expect(outcome.blocked?.map((finding) => finding.path)).toEqual([
      'groundwork/backup.tar',
    ])
    expect(await recordsState(ROOT)).toEqual(before)
  })

  it('should refuse the whole push on a record carrying a credential', async () => {
    await makeRecordsRepo(ROOT, ORIGIN)
    await pushRecords(ROOT)
    const before = await recordsState(ROOT)
    writeFileSync(
      join(ROOT, '.claude', 'plans', '.env'),
      `TOKEN=ghp_${'a'.repeat(36)}\n`,
    )

    const outcome = await pushRecords(ROOT)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('unsafe-payload')
    expect(outcome.blocked).toEqual([
      {
        path: 'plans/.env',
        cause: 'credential',
        detail: 'GitHub token at line 1',
      },
    ])
    expect(outcome.message).toContain('plans/.env')
    expect(await recordsState(ROOT)).toEqual(before)
  })

  it('should undo its own root commit when the push is rejected', async () => {
    await makeRecordsRepo(ROOT, join(ORIGIN, 'missing'))

    const outcome = await pushRecords(ROOT)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.message).toContain('undone')
    expect(
      await recordsGit(ROOT, ['rev-parse', '--verify', '--quiet', 'HEAD']),
    ).toBe('')
    expect(await recordsGit(ROOT, ['ls-files'])).toBe('')

    await recordsGit(ROOT, ['remote', 'set-url', 'origin', ORIGIN])
    const retried = await pushRecords(ROOT)

    expect(retried.ok).toBe(true)
    if (!retried.ok) return
    expect(retried.changed).toBe(BACKED_FOLDERS.length)
    expect(retried.pushed).toBe(true)
  })

  it('should undo a later commit when the push is rejected', async () => {
    await makeRecordsRepo(ROOT, ORIGIN)
    await pushRecords(ROOT)
    const priorHead = await recordsGit(ROOT, ['rev-parse', 'HEAD'])
    writeFileSync(join(ROOT, '.claude', 'memory', 'later.md'), '# later\n')
    await recordsGit(ROOT, [
      'remote',
      'set-url',
      'origin',
      join(ORIGIN, 'missing'),
    ])

    const outcome = await pushRecords(ROOT)

    expect(outcome.ok).toBe(false)
    expect(await recordsGit(ROOT, ['rev-parse', 'HEAD'])).toBe(priorHead)

    await recordsGit(ROOT, ['remote', 'set-url', 'origin', ORIGIN])
    const retried = await pushRecords(ROOT)

    expect(retried.ok).toBe(true)
    if (!retried.ok) return
    expect(retried.changed).toBe(1)
    expect(await trackedOnOrigin(ROOT)).toContain('memory/later.md')
  })

  it('should commit nothing on a second push that changed no record', async () => {
    await makeRecordsRepo(ROOT, ORIGIN)
    await pushRecords(ROOT)

    const outcome = await pushRecords(ROOT)

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.changed).toBe(0)
    expect(outcome.pushed).toBe(true)

    const log = await recordsGit(ROOT, ['log', '--oneline'])
    expect(log.split('\n')).toHaveLength(1)
  })

  it('should carry a record deleted since the last push', async () => {
    await makeRecordsRepo(ROOT, ORIGIN)
    await pushRecords(ROOT)
    rmSync(join(ROOT, '.claude', 'memory', 'entry.md'))

    const outcome = await pushRecords(ROOT)

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.changed).toBe(1)

    const tracked = await trackedOnOrigin(ROOT)
    expect(tracked).not.toContain('memory/entry.md')
  })

  // Every worker runs from inside the work tree, so the folder set staged there
  // and the folder set staged from the root are the same claim the verb makes
  // everywhere else.
  it('should stage the same folders when run from inside the work tree', async () => {
    await makeRecordsRepo(ROOT, ORIGIN)

    const outcome = await fromInsideWorkTree(ROOT, () => pushRecords(ROOT))

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.changed).toBe(BACKED_FOLDERS.length)
    expect(outcome.pushed).toBe(true)
    expect((await trackedOnOrigin(ROOT)).split('\n').sort()).toEqual(
      BACKED_FOLDERS.map((folder) => `${folder}/entry.md`).sort(),
    )
  })

  it('should leave the project working tree untouched', async () => {
    await makeRecordsRepo(ROOT, ORIGIN)

    await pushRecords(ROOT)

    const status = await git(['-C', ROOT, 'status', '--porcelain'])
    expect(status).toContain('.claude/')
    expect(await git(['-C', ROOT, 'log', '--oneline'])).toBe('')
  })
})

describe('pullRecords', () => {
  it('should refuse when the records origin carries no branch yet', async () => {
    await makeRecordsRepo(ROOT, ORIGIN)

    const outcome = await pullRecords(ROOT)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('no-remote-records')
  })

  it('should refuse rather than discard a local record that never reached the remote', async () => {
    await makeRecordsRepo(ROOT, ORIGIN)
    await pushRecords(ROOT)
    writeFileSync(
      join(ROOT, '.claude', 'memory', 'unpushed.md'),
      'local only\n',
    )

    const outcome = await pullRecords(ROOT)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('local-changes')
    expect(
      readFileSync(join(ROOT, '.claude', 'memory', 'unpushed.md'), 'utf8'),
    ).toBe('local only\n')
  })

  it('should refuse when a local commit has not reached the records origin', async () => {
    await makeRecordsRepo(ROOT, ORIGIN)
    await pushRecords(ROOT)
    writeFileSync(join(ROOT, '.claude', 'plans', 'later.md'), 'later\n')
    await recordsGit(ROOT, [
      '--work-tree',
      join(ROOT, '.claude'),
      'add',
      '-A',
      '-f',
      '--',
      'plans',
    ])
    await recordsGit(ROOT, [
      '--work-tree',
      join(ROOT, '.claude'),
      '-c',
      'user.name=t',
      '-c',
      'user.email=t@t',
      'commit',
      '--quiet',
      '-m',
      'local',
    ])

    const outcome = await pullRecords(ROOT)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('local-ahead')
  })

  it('should refuse when a backed folder was deleted in full without being pushed', async () => {
    await makeRecordsRepo(ROOT, ORIGIN)
    await pushRecords(ROOT)
    rmSync(join(ROOT, '.claude', 'intake'), { recursive: true, force: true })

    const outcome = await pullRecords(ROOT)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('local-changes')
  })

  it('should refuse when a record was deleted locally without being pushed', async () => {
    await makeRecordsRepo(ROOT, ORIGIN)
    await pushRecords(ROOT)
    rmSync(join(ROOT, '.claude', 'memory', 'entry.md'))

    const outcome = await pullRecords(ROOT)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('local-changes')
  })

  // The push half of this fails loudly and the pull half fails quietly, which
  // is the worse of the two. `git status` tolerates a pathspec matching
  // nothing, so from inside the work tree the gate that refuses rather than
  // discarding an unpushed record reads clean and the reset behind it takes
  // the file.
  it('should still refuse an unpushed record when run from inside the work tree', async () => {
    await makeRecordsRepo(ROOT, ORIGIN)
    await pushRecords(ROOT)
    const unpushed = join(ROOT, '.claude', 'memory', 'unpushed.md')
    writeFileSync(unpushed, 'local only\n')

    const outcome = await fromInsideWorkTree(ROOT, () => pullRecords(ROOT))

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('local-changes')
    expect(readFileSync(unpushed, 'utf8')).toBe('local only\n')
  })

  it('should write the records the remote carries onto a machine holding none', async () => {
    // A second machine holding the same project resolves the same branch only
    // because both clones name the same project origin. Two clones with no
    // origin at all would each fall back to their own directory basename and
    // never agree, which this shared remote is what rules out here.
    await git([
      '-C',
      ROOT,
      'remote',
      'add',
      'origin',
      'https://example.test/owner/repo.git',
    ])
    await makeRecordsRepo(ROOT, ORIGIN)
    await pushRecords(ROOT)

    const fresh = mkdtempSync(join(tmpdir(), 'canon-backup-fresh-'))
    mkdirSync(join(fresh, '.claude'), { recursive: true })
    await git(['init', '--quiet', fresh])
    await git([
      '-C',
      fresh,
      'remote',
      'add',
      'origin',
      'https://example.test/owner/repo.git',
    ])
    await makeRecordsRepo(fresh, ORIGIN)

    const outcome = await pullRecords(fresh)

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.files).toBe(BACKED_FOLDERS.length)
    expect(
      readFileSync(join(fresh, '.claude', 'memory', 'entry.md'), 'utf8'),
    ).toBe('# memory\n')

    rmSync(fresh, { recursive: true, force: true })
  })

  it('should refuse when no records history exists', async () => {
    const outcome = await pullRecords(ROOT)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('no-repository')
  })
})

describe('a tree whose records sit under both roots', () => {
  /** Moves every backed folder but one, which is what a failed move leaves. */
  function halfMigrate(root: string, leaveBehind: string): void {
    for (const folder of BACKED_FOLDERS) {
      if (folder === leaveBehind) continue
      mkdirSync(join(root, '.canon'), { recursive: true })
      renameSync(join(root, '.claude', folder), join(root, '.canon', folder))
    }
  }

  it('should refuse a push rather than stage the stranded folder as deleted', async () => {
    await makeRecordsRepo(ROOT, ORIGIN)
    halfMigrate(ROOT, 'memory')

    const outcome = await pushRecords(ROOT)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('split-roots')
    expect(outcome.message).toContain(join('.claude', 'memory'))
  })

  it('should refuse a pull on the same reading', async () => {
    await makeRecordsRepo(ROOT, ORIGIN)
    halfMigrate(ROOT, 'plans')

    const outcome = await pullRecords(ROOT)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('split-roots')
  })

  it('should refuse ahead of the remote gates, which a half-moved tree fails later', async () => {
    halfMigrate(ROOT, 'tasks')

    const outcome = await pushRecords(ROOT)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('split-roots')
  })

  it('should name every stranded folder rather than the first', async () => {
    mkdirSync(join(ROOT, '.canon', 'plans'), { recursive: true })

    const outcome = await pushRecords(ROOT)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    for (const folder of BACKED_FOLDERS) {
      expect(outcome.message).toContain(join('.claude', folder))
    }
  })

  it('should let a fully moved tree through to the ordinary gates', async () => {
    halfMigrate(ROOT, '')

    const outcome = await pushRecords(ROOT)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('no-repository')
  })
})
