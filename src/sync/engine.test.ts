import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { execaSync } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git-env'
import {
  applyChanges,
  listInstalled,
  planSync,
  runDomainSync,
  type SyncAdapter,
} from '@/sync/engine'
import { hashContent, readStamp, type StampDomain } from '@/sync/stamp'
import { readInstalled } from '@/version/installed'

let ROOT: string
let SOURCE: string
let TARGET: string

function writeFixture(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function createAdapter(overrides: Partial<SyncAdapter> = {}): SyncAdapter {
  return {
    banner: 'canon test sync',
    label: 'rules',
    missingMessage: 'Nothing installed',
    unit: 'changes',
    installedRoot: (target: string) => join(target, '.claude', 'rules'),
    locateSource: (file) => join(SOURCE, file.relToRoot),
    ...overrides,
  }
}

function writeStampFixture(
  domain: StampDomain,
  hashes: Record<string, string>,
): void {
  writeFixture(
    join(TARGET, '.claude/canon/config.json'),
    JSON.stringify({
      covers: [domain],
      domains: {
        [domain]: {
          commit: 'abc1234',
          syncedAt: '2026-07-30T12:00:00.000Z',
          files: hashes,
        },
      },
    }),
  )
}

const STAMPED_RULE = '.claude/rules/core/000-const.md'

let PREVIOUS_NON_INTERACTIVE: string | undefined

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-engine-'))
  SOURCE = join(ROOT, 'source')
  TARGET = join(ROOT, 'target')
  PREVIOUS_NON_INTERACTIVE = process.env.CANON_NON_INTERACTIVE
  process.env.CANON_NON_INTERACTIVE = '1'
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
  if (PREVIOUS_NON_INTERACTIVE === undefined) {
    delete process.env.CANON_NON_INTERACTIVE
  } else {
    process.env.CANON_NON_INTERACTIVE = PREVIOUS_NON_INTERACTIVE
  }
})

describe('listInstalled', () => {
  it('should sort entries by path across nested directories', () => {
    writeFixture(join(TARGET, '.claude/rules/lang/100-ts.md'), 'a')
    writeFixture(join(TARGET, '.claude/rules/core/000-const.md'), 'b')

    const files = listInstalled(join(TARGET, '.claude/rules'), TARGET)

    expect(files.map((file) => file.relToRoot)).toEqual([
      'core/000-const.md',
      'lang/100-ts.md',
    ])
  })

  it('should include files inside dot directories', () => {
    writeFixture(join(TARGET, '.claude/rules/.hidden/900-x.md'), 'a')

    const files = listInstalled(join(TARGET, '.claude/rules'), TARGET)

    expect(files.map((file) => file.relToRoot)).toEqual(['.hidden/900-x.md'])
  })

  it('should report paths relative to the target', () => {
    writeFixture(join(TARGET, '.claude/rules/core/000-const.md'), 'a')

    const files = listInstalled(join(TARGET, '.claude/rules'), TARGET)

    expect(files[0].rel).toBe(join('.claude', 'rules', 'core', '000-const.md'))
  })

  it('should return an empty list when the root is absent', () => {
    expect(listInstalled(join(TARGET, '.claude/rules'), TARGET)).toEqual([])
  })
})

describe('planSync', () => {
  it('should classify an identical file as matching with no change', () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'same\n')
    writeFixture(join(TARGET, '.claude/rules/core/000-const.md'), 'same\n')

    const plan = planSync(createAdapter(), TARGET)

    expect(plan.entries[0].state).toBe('matching')
    expect(plan.changes).toEqual([])
  })

  it('should classify a differing file as drifted and queue a copy', () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'new\n')
    writeFixture(join(TARGET, '.claude/rules/core/000-const.md'), 'old\n')

    const plan = planSync(createAdapter(), TARGET)

    expect(plan.entries[0].state).toBe('drifted')
    expect(plan.changes).toEqual([
      {
        kind: 'copy',
        source: join(SOURCE, 'core/000-const.md'),
        dest: join(TARGET, '.claude/rules/core/000-const.md'),
        rel: join('.claude', 'rules', 'core', '000-const.md'),
      },
    ])
  })

  it('should leave a file with no source untouched', () => {
    writeFixture(join(TARGET, '.claude/rules/core/500-project.md'), 'local\n')

    const plan = planSync(createAdapter(), TARGET)

    expect(plan.entries[0].state).toBe('orphaned')
    expect(plan.changes).toEqual([])
  })

  it('should treat an undefined source lookup as orphaned', () => {
    writeFixture(join(TARGET, '.claude/rules/core/500-project.md'), 'local\n')

    const plan = planSync(
      createAdapter({ locateSource: () => undefined }),
      TARGET,
    )

    expect(plan.entries[0].state).toBe('orphaned')
  })

  it('should drop an excluded entry from the report entirely', () => {
    writeFixture(join(SOURCE, 'index.md'), 'source\n')
    writeFixture(join(TARGET, '.claude/rules/index.md'), 'stale\n')

    const plan = planSync(
      createAdapter({
        isExcluded: (file) => file.relToRoot === 'index.md',
      }),
      TARGET,
    )

    expect(plan.entries).toEqual([])
    expect(plan.changes).toEqual([])
  })

  it('should keep classifying entries the exclusion does not match', () => {
    writeFixture(join(SOURCE, 'index.md'), 'source\n')
    writeFixture(join(TARGET, '.claude/rules/index.md'), 'stale\n')
    writeFixture(join(SOURCE, 'core/000-const.md'), 'new\n')
    writeFixture(join(TARGET, '.claude/rules/core/000-const.md'), 'old\n')

    const plan = planSync(
      createAdapter({
        isExcluded: (file) => file.relToRoot === 'index.md',
      }),
      TARGET,
    )

    expect(plan.entries.map((entry) => entry.state)).toEqual(['drifted'])
  })

  it('should orphan a file under the declared project subfolder', () => {
    writeFixture(join(TARGET, '.claude/rules/project/900-local.md'), 'mine\n')

    const plan = planSync(createAdapter({ projectSubdir: 'project' }), TARGET)

    expect(plan.entries[0].state).toBe('orphaned')
  })

  it('should orphan a project subfolder file by location even with a matching source', () => {
    writeFixture(join(SOURCE, 'project/000-const.md'), 'same\n')
    writeFixture(join(TARGET, '.claude/rules/project/000-const.md'), 'same\n')

    const plan = planSync(createAdapter({ projectSubdir: 'project' }), TARGET)

    expect(plan.entries[0].state).toBe('orphaned')
    expect(plan.changes).toEqual([])
  })

  it('should keep the name inference for a file at the flat root', () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'same\n')
    writeFixture(join(TARGET, '.claude/rules/core/000-const.md'), 'same\n')

    const plan = planSync(createAdapter({ projectSubdir: 'project' }), TARGET)

    expect(plan.entries[0].state).toBe('matching')
  })

  it('should name the project subfolder for an orphan sitting outside it', () => {
    writeFixture(
      join(TARGET, '.claude/rules/claude/561-self-check.md'),
      'mine\n',
    )

    const plan = planSync(createAdapter({ projectSubdir: 'project' }), TARGET)

    expect(plan.entries[0].notice).toBe(
      `${join('.claude', 'rules', 'claude', '561-self-check.md')} (not in toolkit source, skipping. Move it to ${join('.claude', 'rules', 'project', 'claude', '561-self-check.md')} if the project authored it.)`,
    )
  })

  it('should queue no change for an orphan sitting outside the project subfolder', () => {
    writeFixture(
      join(TARGET, '.claude/rules/claude/561-self-check.md'),
      'mine\n',
    )

    const plan = planSync(createAdapter({ projectSubdir: 'project' }), TARGET)

    expect(plan.entries[0].state).toBe('orphaned')
    expect(plan.changes).toEqual([])
  })

  it('should leave an orphan unnamed when the adapter declares no project subfolder', () => {
    writeFixture(
      join(TARGET, '.claude/rules/claude/561-self-check.md'),
      'mine\n',
    )

    const plan = planSync(createAdapter(), TARGET)

    expect(plan.entries[0].notice).toBeUndefined()
  })

  it('should leave an orphan already under the project subfolder unnamed', () => {
    writeFixture(
      join(TARGET, '.claude/rules/project/claude/900-local.md'),
      'mine\n',
    )

    const plan = planSync(createAdapter({ projectSubdir: 'project' }), TARGET)

    expect(plan.entries[0].notice).toBeUndefined()
  })

  it('should queue a delete for each retired surface', () => {
    writeFixture(join(TARGET, '.claude/GOV.md'), 'retired\n')

    const plan = planSync(
      createAdapter({
        collectRetired: (target) => [
          {
            path: join(target, '.claude/GOV.md'),
            rel: join('.claude', 'GOV.md'),
            notice: 'retired',
          },
        ],
      }),
      TARGET,
    )

    expect(plan.changes).toEqual([
      {
        kind: 'delete',
        dest: join(TARGET, '.claude/GOV.md'),
        rel: join('.claude', 'GOV.md'),
      },
    ])
  })

  it('should order retired deletes after file copies', () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'new\n')
    writeFixture(join(TARGET, '.claude/rules/core/000-const.md'), 'old\n')
    writeFixture(join(TARGET, '.claude/GOV.md'), 'retired\n')

    const plan = planSync(
      createAdapter({
        collectRetired: (target) => [
          {
            path: join(target, '.claude/GOV.md'),
            rel: join('.claude', 'GOV.md'),
            notice: 'retired',
          },
        ],
      }),
      TARGET,
    )

    expect(plan.changes.map((change) => change.kind)).toEqual([
      'copy',
      'delete',
    ])
  })

  it('should add a missing entry for each entitled surface the walk did not find, carrying the adapter notice', () => {
    const plan = planSync(
      createAdapter({
        collectMissing: () => [
          {
            path: join(TARGET, '.claude/rules/ui/440-capture.md'),
            rel: join('.claude', 'rules', 'ui', '440-capture.md'),
            notice: 'listed by astro, not installed',
          },
        ],
      }),
      TARGET,
    )

    expect(plan.entries).toEqual([
      {
        state: 'missing',
        rel: join('.claude', 'rules', 'ui', '440-capture.md'),
        notice: 'listed by astro, not installed',
      },
    ])
  })

  it('should queue no change for a missing entry, since installing stays a separate command', () => {
    const plan = planSync(
      createAdapter({
        collectMissing: () => [
          {
            path: join(TARGET, '.claude/rules/ui/440-capture.md'),
            rel: join('.claude', 'rules', 'ui', '440-capture.md'),
            notice: 'listed by astro, not installed',
          },
        ],
      }),
      TARGET,
    )

    expect(plan.changes).toEqual([])
  })
})

describe('planSync on a root the toolkit owns', () => {
  const RETIRED_RULE = join('.claude', 'rules', 'core', '505-gone.md')
  const owning = (): SyncAdapter =>
    createAdapter({
      ownsInstalledRoot: true,
      stamp: { domain: 'governance', toolkitRoot: ROOT },
    })

  function writeStampVersion(version: string): void {
    writeFixture(
      join(TARGET, '.claude/canon/config.json'),
      JSON.stringify({
        covers: ['governance'],
        domains: {
          governance: { version, syncedAt: 'then', files: {} },
        },
      }),
    )
  }

  it('should classify a file with no source as retired', () => {
    writeFixture(join(TARGET, RETIRED_RULE), 'shipped once\n')

    const plan = planSync(owning(), TARGET)

    expect(plan.entries).toEqual([
      {
        state: 'retired',
        rel: RETIRED_RULE,
        notice: `${RETIRED_RULE} (no longer shipped by the toolkit, removing)`,
      },
    ])
  })

  it('should queue a delete for a retired file', () => {
    writeFixture(join(TARGET, RETIRED_RULE), 'shipped once\n')

    const plan = planSync(owning(), TARGET)

    expect(plan.changes).toEqual([
      { kind: 'delete', dest: join(TARGET, RETIRED_RULE), rel: RETIRED_RULE },
    ])
  })

  it('should delete an edited file with no source the same as an untouched one', () => {
    writeFixture(join(TARGET, RETIRED_RULE), 'edited by the project\n')
    writeStampFixture('governance', {
      [RETIRED_RULE]: hashContent('shipped once\n'),
    })

    const plan = planSync(owning(), TARGET)

    expect(plan.changes.map((change) => change.kind)).toEqual(['delete'])
  })

  it('should keep a file with no source orphaned when the adapter does not own the root', () => {
    writeFixture(join(TARGET, RETIRED_RULE), 'shipped once\n')

    const plan = planSync(createAdapter(), TARGET)

    expect(plan.entries[0].state).toBe('orphaned')
    expect(plan.changes).toEqual([])
  })

  it('should keep a file orphaned when a newer binary installed the domain', () => {
    writeFixture(join(TARGET, RETIRED_RULE), 'shipped later\n')
    writeStampVersion('999.0.0')

    const plan = planSync(owning(), TARGET)

    expect(plan.entries).toEqual([
      {
        state: 'orphaned',
        rel: RETIRED_RULE,
        notice: `${RETIRED_RULE} (installed by canon 999.0.0, newer than this ${readInstalled().version}. Upgrade canon to sync it.)`,
      },
    ])
    expect(plan.changes).toEqual([])
  })

  it('should retire a file when an older binary installed the domain', () => {
    writeFixture(join(TARGET, RETIRED_RULE), 'shipped once\n')
    writeStampVersion('0.0.1')

    const plan = planSync(owning(), TARGET)

    expect(plan.entries[0].state).toBe('retired')
  })
})

describe('planSync attribution', () => {
  const stamped = (): SyncAdapter =>
    createAdapter({ stamp: { domain: 'governance', toolkitRoot: ROOT } })

  it('should classify a difference matching the stamp as stale', () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'upstream\n')
    writeFixture(join(TARGET, STAMPED_RULE), 'installed\n')
    writeStampFixture('governance', {
      [STAMPED_RULE]: hashContent('installed\n'),
    })

    const plan = planSync(stamped(), TARGET)

    expect(plan.entries[0].state).toBe('stale')
  })

  it('should classify a difference from the stamp as customized', () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'upstream\n')
    writeFixture(join(TARGET, STAMPED_RULE), 'edited by the project\n')
    writeStampFixture('governance', {
      [STAMPED_RULE]: hashContent('installed\n'),
    })

    const plan = planSync(stamped(), TARGET)

    expect(plan.entries[0].state).toBe('customized')
  })

  it('should queue a copy for a stale file the same as an unattributed one', () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'upstream\n')
    writeFixture(join(TARGET, STAMPED_RULE), 'installed\n')
    writeStampFixture('governance', {
      [STAMPED_RULE]: hashContent('installed\n'),
    })

    const plan = planSync(stamped(), TARGET)

    expect(plan.changes.map((change) => change.kind)).toEqual(['copy'])
  })

  it('should fall back to drifted for a file the stamp does not cover', () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'upstream\n')
    writeFixture(join(TARGET, STAMPED_RULE), 'installed\n')
    writeStampFixture('governance', {})

    const plan = planSync(stamped(), TARGET)

    expect(plan.entries[0].state).toBe('drifted')
  })

  it('should ignore a stamp written for another domain', () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'upstream\n')
    writeFixture(join(TARGET, STAMPED_RULE), 'installed\n')
    writeStampFixture('tooling', {
      [STAMPED_RULE]: hashContent('installed\n'),
    })

    const plan = planSync(stamped(), TARGET)

    expect(plan.entries[0].state).toBe('drifted')
  })

  it('should report a stamped file outside the install root as stranded', () => {
    writeFixture(join(TARGET, 'rules/core/000-const.md'), 'installed\n')
    writeStampFixture('governance', {
      'rules/core/000-const.md': hashContent('installed\n'),
    })

    const plan = planSync(stamped(), TARGET)

    expect(plan.entries).toEqual([
      { state: 'stranded', rel: join('rules', 'core', '000-const.md') },
    ])
  })

  it('should keep a project-authored file orphaned rather than stranded', () => {
    writeFixture(join(TARGET, '.claude/rules/core/900-local.md'), 'mine\n')
    writeStampFixture('governance', {})

    const plan = planSync(stamped(), TARGET)

    expect(plan.entries).toEqual([
      {
        state: 'orphaned',
        rel: join('.claude', 'rules', 'core', '900-local.md'),
      },
    ])
  })

  it('should drop a stamped key that escapes the target', () => {
    writeFixture(join(ROOT, 'outside.md'), 'elsewhere\n')
    writeStampFixture('governance', {
      '../outside.md': hashContent('elsewhere\n'),
    })

    const plan = planSync(stamped(), TARGET)

    expect(plan.entries).toEqual([])
  })

  it('should leave a relocated file alone rather than queueing a delete', () => {
    writeFixture(join(TARGET, 'rules/core/000-const.md'), 'installed\n')
    writeStampFixture('governance', {
      'rules/core/000-const.md': hashContent('installed\n'),
    })

    const plan = planSync(stamped(), TARGET)

    expect(plan.changes).toEqual([])
  })

  it('should skip a stamped path the project has deleted', () => {
    writeStampFixture('governance', {
      'rules/core/000-const.md': hashContent('installed\n'),
    })

    const plan = planSync(stamped(), TARGET)

    expect(plan.entries).toEqual([])
  })

  it('should not report a stamped path twice when the walk already saw it', () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'same\n')
    writeFixture(join(TARGET, STAMPED_RULE), 'same\n')
    writeStampFixture('governance', { [STAMPED_RULE]: hashContent('same\n') })

    const plan = planSync(stamped(), TARGET)

    expect(plan.entries).toEqual([
      {
        state: 'matching',
        rel: join('.claude', 'rules', 'core', '000-const.md'),
      },
    ])
  })

  it('should stay unattributed when the adapter declares no stamp domain', () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'upstream\n')
    writeFixture(join(TARGET, STAMPED_RULE), 'installed\n')
    writeStampFixture('governance', {
      [STAMPED_RULE]: hashContent('installed\n'),
    })

    const plan = planSync(createAdapter(), TARGET)

    expect(plan.entries[0].state).toBe('drifted')
  })

  it('should report history as unavailable outside a git checkout', () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'upstream\n')
    writeFixture(join(TARGET, STAMPED_RULE), 'installed\n')

    const plan = planSync(stamped(), TARGET)

    expect(plan.historyUnavailable).toBe(true)
  })

  it('should leave history available when nothing needs attributing', () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'same\n')
    writeFixture(join(TARGET, STAMPED_RULE), 'same\n')

    const plan = planSync(stamped(), TARGET)

    expect(plan.historyUnavailable).toBe(false)
  })
})

describe('planSync attribution without a stamp', () => {
  const stamped = (): SyncAdapter =>
    createAdapter({ stamp: { domain: 'governance', toolkitRoot: ROOT } })

  function git(...args: string[]): string {
    return execaSync('git', ['-C', ROOT, ...args], {
      env: gitEnv(),
      extendEnv: false,
    }).stdout
  }

  function publish(content: string, message: string): string {
    writeFixture(join(SOURCE, 'core/000-const.md'), content)
    git('add', '--all')
    git('commit', '-m', message)

    return git('rev-parse', 'HEAD').trim()
  }

  beforeEach(() => {
    git('init', '--initial-branch=main')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'Test')
  })

  it('should recover stale from history when the stamp covers nothing', () => {
    const released = publish('installed\n', 'publish v1')
    publish('upstream\n', 'publish v2')
    writeFixture(join(TARGET, STAMPED_RULE), 'installed\n')

    const plan = planSync(stamped(), TARGET)

    expect(plan.entries[0].state).toBe('stale')
    expect(plan.entries[0].since).toBe(released)
  })

  it('should keep a file matching no published version unattributed', () => {
    publish('installed\n', 'publish v1')
    publish('upstream\n', 'publish v2')
    writeFixture(join(TARGET, STAMPED_RULE), 'edited by the project\n')

    const plan = planSync(stamped(), TARGET)

    expect(plan.entries[0].state).toBe('drifted')
    expect(plan.entries[0].since).toBeUndefined()
  })

  it('should report history as available once it has been read', () => {
    publish('installed\n', 'publish v1')
    publish('upstream\n', 'publish v2')
    writeFixture(join(TARGET, STAMPED_RULE), 'edited by the project\n')

    const plan = planSync(stamped(), TARGET)

    expect(plan.historyUnavailable).toBe(false)
  })

  it('should still queue the copy that closes a recovered drift', () => {
    publish('installed\n', 'publish v1')
    publish('upstream\n', 'publish v2')
    writeFixture(join(TARGET, STAMPED_RULE), 'installed\n')

    const plan = planSync(stamped(), TARGET)

    expect(plan.changes.map((change) => change.kind)).toEqual(['copy'])
  })

  it('should let a refusing domain apply once every file is recovered', async () => {
    publish('installed\n', 'publish v1')
    publish('upstream\n', 'publish v2')
    const dest = join(TARGET, STAMPED_RULE)
    writeFixture(dest, 'installed\n')

    const code = await runDomainSync(
      createAdapter({
        stamp: { domain: 'governance', toolkitRoot: ROOT },
        nonInteractive: { kind: 'refuse', message: 'refused', hint: 'run it' },
      }),
      TARGET,
      { protectedRoot: '/nowhere' },
    )

    expect(code).toBe(0)
    expect(readFileSync(dest, 'utf8')).toBe('upstream\n')
  })

  it('should keep refusing when a file resists attribution', async () => {
    publish('installed\n', 'publish v1')
    publish('upstream\n', 'publish v2')
    const dest = join(TARGET, STAMPED_RULE)
    writeFixture(dest, 'edited by the project\n')

    const code = await runDomainSync(
      createAdapter({
        stamp: { domain: 'governance', toolkitRoot: ROOT },
        nonInteractive: { kind: 'refuse', message: 'refused', hint: 'run it' },
      }),
      TARGET,
      { protectedRoot: '/nowhere' },
    )

    expect(code).toBe(0)
    expect(readFileSync(dest, 'utf8')).toBe('edited by the project\n')
  })
})

describe('applyChanges', () => {
  it('should overwrite a drifted destination with its source', async () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'new\n')
    writeFixture(join(TARGET, '.claude/rules/core/000-const.md'), 'old\n')
    const plan = planSync(createAdapter(), TARGET)

    await applyChanges(plan.changes)

    expect(
      readFileSync(join(TARGET, '.claude/rules/core/000-const.md'), 'utf8'),
    ).toBe('new\n')
  })

  it('should create missing parent directories for a copy', async () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'new\n')
    const dest = join(TARGET, '.claude/rules/core/000-const.md')

    await applyChanges([
      {
        kind: 'copy',
        source: join(SOURCE, 'core/000-const.md'),
        dest,
        rel: 'x',
      },
    ])

    expect(readFileSync(dest, 'utf8')).toBe('new\n')
  })

  it('should leave an existing destination mode alone', async () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'new\n')
    const dest = join(TARGET, '.claude/rules/core/000-const.md')
    writeFixture(dest, 'old\n')
    chmodSync(dest, 0o600)

    await applyChanges(planSync(createAdapter(), TARGET).changes)

    expect(statSync(dest).mode & 0o777).toBe(0o600)
  })

  it('should not strip an executable bit the destination carries', async () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'new\n')
    const dest = join(TARGET, '.claude/rules/core/000-const.md')
    writeFixture(dest, 'old\n')
    chmodSync(dest, 0o755)

    await applyChanges(planSync(createAdapter(), TARGET).changes)

    expect(statSync(dest).mode & 0o777).toBe(0o755)
  })

  it('should remove a retired surface', async () => {
    const path = join(TARGET, '.claude/GOV.md')
    writeFixture(path, 'retired\n')

    await applyChanges([{ kind: 'delete', dest: path, rel: 'x' }])

    expect(existsSync(path)).toBe(false)
  })

  it('should ignore a delete whose target is already gone', async () => {
    const path = join(TARGET, '.claude/GOV.md')

    await expect(
      applyChanges([{ kind: 'delete', dest: path, rel: 'x' }]),
    ).resolves.toBeUndefined()
  })
})

describe('runDomainSync', () => {
  const options = { protectedRoot: '/nowhere' }

  it('should apply drift in a headless run when no policy is set', async () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'new\n')
    const dest = join(TARGET, '.claude/rules/core/000-const.md')
    writeFixture(dest, 'old\n')

    const code = await runDomainSync(createAdapter(), TARGET, options)

    expect(code).toBe(0)
    expect(readFileSync(dest, 'utf8')).toBe('new\n')
  })

  it('should write nothing in a headless run when the policy refuses', async () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'new\n')
    const dest = join(TARGET, '.claude/rules/core/000-const.md')
    writeFixture(dest, 'old\n')

    const code = await runDomainSync(
      createAdapter({
        nonInteractive: { kind: 'refuse', message: 'refused', hint: 'run it' },
      }),
      TARGET,
      options,
    )

    expect(code).toBe(0)
    expect(readFileSync(dest, 'utf8')).toBe('old\n')
  })

  it('should skip the completion hook when the policy refuses', async () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'new\n')
    writeFixture(join(TARGET, '.claude/rules/core/000-const.md'), 'old\n')
    let fired = false

    await runDomainSync(
      createAdapter({
        nonInteractive: { kind: 'refuse', message: 'refused', hint: 'run it' },
        onComplete: async () => {
          fired = true
        },
      }),
      TARGET,
      options,
    )

    expect(fired).toBe(false)
  })

  it('should run the completion hook when there are no changes', async () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'same\n')
    writeFixture(join(TARGET, '.claude/rules/core/000-const.md'), 'same\n')
    let fired = false

    const code = await runDomainSync(
      createAdapter({
        onComplete: async () => {
          fired = true
        },
      }),
      TARGET,
      options,
    )

    expect(code).toBe(0)
    expect(fired).toBe(true)
  })

  it('should run the completion hook after applying changes', async () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'new\n')
    const dest = join(TARGET, '.claude/rules/core/000-const.md')
    writeFixture(dest, 'old\n')
    let contentAtHook = ''

    await runDomainSync(
      createAdapter({
        onComplete: async () => {
          contentAtHook = readFileSync(dest, 'utf8')
        },
      }),
      TARGET,
      options,
    )

    expect(contentAtHook).toBe('new\n')
  })

  it('should leave a misplaced project-authored file on disk', async () => {
    const dest = join(TARGET, '.claude/rules/claude/561-self-check.md')
    writeFixture(dest, 'mine\n')

    const code = await runDomainSync(
      createAdapter({ projectSubdir: 'project' }),
      TARGET,
      options,
    )

    expect(code).toBe(0)
    expect(readFileSync(dest, 'utf8')).toBe('mine\n')
    expect(existsSync(join(TARGET, '.claude/rules/project'))).toBe(false)
  })

  it('should refuse to run against the protected root', async () => {
    mkdirSync(TARGET, { recursive: true })

    const code = await runDomainSync(createAdapter(), TARGET, {
      protectedRoot: TARGET,
    })

    expect(code).toBe(1)
  })

  it('should apply stale drift headlessly even when the policy refuses', async () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'upstream\n')
    const dest = join(TARGET, STAMPED_RULE)
    writeFixture(dest, 'installed\n')
    writeStampFixture('governance', {
      [STAMPED_RULE]: hashContent('installed\n'),
    })

    const code = await runDomainSync(
      createAdapter({
        stamp: { domain: 'governance', toolkitRoot: ROOT },
        nonInteractive: { kind: 'refuse', message: 'refused', hint: 'run it' },
      }),
      TARGET,
      options,
    )

    expect(code).toBe(0)
    expect(readFileSync(dest, 'utf8')).toBe('upstream\n')
  })

  it('should still refuse headlessly when a file is customized', async () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'upstream\n')
    const dest = join(TARGET, STAMPED_RULE)
    writeFixture(dest, 'edited by the project\n')
    writeStampFixture('governance', {
      [STAMPED_RULE]: hashContent('installed\n'),
    })

    const code = await runDomainSync(
      createAdapter({
        stamp: { domain: 'governance', toolkitRoot: ROOT },
        nonInteractive: { kind: 'refuse', message: 'refused', hint: 'run it' },
      }),
      TARGET,
      options,
    )

    expect(code).toBe(0)
    expect(readFileSync(dest, 'utf8')).toBe('edited by the project\n')
  })

  it('should stamp what it installed after applying changes', async () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'upstream\n')
    writeFixture(join(TARGET, STAMPED_RULE), 'old\n')

    await runDomainSync(
      createAdapter({ stamp: { domain: 'governance', toolkitRoot: ROOT } }),
      TARGET,
      options,
    )

    expect(readStamp(TARGET)?.domains.governance?.files).toEqual({
      [STAMPED_RULE]: hashContent('upstream\n'),
    })
  })

  it('should stamp on a run that found nothing to change', async () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'same\n')
    writeFixture(join(TARGET, STAMPED_RULE), 'same\n')

    await runDomainSync(
      createAdapter({ stamp: { domain: 'governance', toolkitRoot: ROOT } }),
      TARGET,
      options,
    )

    expect(readStamp(TARGET)?.domains.governance?.files).toEqual({
      [STAMPED_RULE]: hashContent('same\n'),
    })
  })

  it('should drop a file the toolkit stopped shipping from the stamp', async () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'same\n')
    writeFixture(join(TARGET, STAMPED_RULE), 'same\n')
    const adapter = createAdapter({
      stamp: { domain: 'governance', toolkitRoot: ROOT },
      projectSubdir: 'project',
    })

    await runDomainSync(adapter, TARGET, options)
    rmSync(join(SOURCE, 'core/000-const.md'))
    await runDomainSync(adapter, TARGET, options)

    expect(readStamp(TARGET)?.domains.governance?.files).toEqual({})
  })

  it('should keep project-authored files out of the stamp', async () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'same\n')
    writeFixture(join(TARGET, STAMPED_RULE), 'same\n')
    writeFixture(join(TARGET, '.claude/rules/core/900-local.md'), 'mine\n')

    await runDomainSync(
      createAdapter({ stamp: { domain: 'governance', toolkitRoot: ROOT } }),
      TARGET,
      options,
    )

    expect(readStamp(TARGET)?.domains.governance?.files).toEqual({
      [STAMPED_RULE]: hashContent('same\n'),
    })
  })

  it('should keep a project subfolder file out of the stamp even with a matching source', async () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'same\n')
    writeFixture(join(TARGET, STAMPED_RULE), 'same\n')
    writeFixture(join(SOURCE, 'project/000-const.md'), 'same\n')
    writeFixture(join(TARGET, '.claude/rules/project/000-const.md'), 'same\n')

    await runDomainSync(
      createAdapter({
        stamp: { domain: 'governance', toolkitRoot: ROOT },
        projectSubdir: 'project',
      }),
      TARGET,
      options,
    )

    expect(readStamp(TARGET)?.domains.governance?.files).toEqual({
      [STAMPED_RULE]: hashContent('same\n'),
    })
  })

  it('should write no stamp when the adapter declares no stamp domain', async () => {
    writeFixture(join(SOURCE, 'core/000-const.md'), 'same\n')
    writeFixture(join(TARGET, STAMPED_RULE), 'same\n')

    await runDomainSync(createAdapter(), TARGET, options)

    expect(readStamp(TARGET)).toBeUndefined()
  })
})
