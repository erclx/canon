import { execaSync } from 'execa'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git-env'
import {
  baseBands,
  buildToolingReport,
  type CheckReport,
  countStates,
  hasDrift,
  installedStampDomains,
  isManagedTarget,
  parseNewSkills,
  parseUpstream,
  readInstalledRules,
  readNewRules,
  selectNewRules,
  type ToolingReport,
  uncoveredDomains,
} from '@/sync/check'
import type { ScanEntry } from '@/sync/engine'
import { emptyReverseReport } from '@/sync/reverse'
import { readStamp, type Stamp, stampPath } from '@/sync/stamp'

let TARGET: string

function buildReport(
  entries: readonly ScanEntry[],
  overrides: Partial<CheckReport> = {},
): CheckReport {
  return {
    covers: ['governance'],
    stampAtLegacyPath: false,
    managed: true,
    domains: [
      {
        domain: 'governance',
        stamped: true,
        counts: countStates(entries),
        entries,
        historyUnavailable: false,
        upstream: [],
      },
    ],
    tooling: unmeasuredTooling(),
    seeds: { entries: [], historyUnavailable: false },
    superseded: [],
    unmigrated: [],
    newSkills: [],
    newRules: [],
    reverse: emptyReverseReport(),
    skew: {
      state: 'current',
      name: '@erclx/canon',
      installed: '0.0.0',
      latest: '0.0.0',
    },
    ...overrides,
  }
}

function unmeasuredTooling(): ToolingReport {
  return {
    measured: false,
    chain: [],
    counts: {
      configs: 0,
      seeds: 0,
      scripts: 0,
      deps: 0,
      gitignore: 0,
    },
    changes: 0,
  }
}

beforeEach(() => {
  TARGET = mkdtempSync(join(tmpdir(), 'canon-check-'))
})

afterEach(() => {
  rmSync(TARGET, { recursive: true, force: true })
})

describe('buildToolingReport', () => {
  let TOOLKIT: string

  /** A stack carrying one config, which is the smallest thing `scan` can compare. */
  function writeStack(name: string, extend?: string): void {
    const dir = join(TOOLKIT, 'tooling', name)
    mkdirSync(join(dir, 'configs'), { recursive: true })
    writeFileSync(
      join(dir, 'manifest.toml'),
      extend === undefined ? '[stack]\n' : `[stack]\nextends = "${extend}"\n`,
    )
    writeFileSync(join(dir, 'configs', `${name}.config.json`), `${name}\n`)
  }

  function stampChain(chain: readonly string[]): Stamp | undefined {
    mkdirSync(dirname(stampPath(TARGET)), { recursive: true })
    writeFileSync(
      stampPath(TARGET),
      JSON.stringify({
        covers: ['tooling'],
        domains: {
          tooling: { commit: 'abc1234', syncedAt: 'then', files: {}, chain },
        },
      }),
    )
    return readStamp(TARGET)
  }

  beforeEach(() => {
    TOOLKIT = mkdtempSync(join(tmpdir(), 'canon-check-toolkit-'))
  })

  afterEach(() => {
    rmSync(TOOLKIT, { recursive: true, force: true })
  })

  it('should report unmeasured when no stamp exists', () => {
    const report = buildToolingReport(TOOLKIT, TARGET, undefined)

    expect(report.measured).toBe(false)
    expect(report.chain).toEqual([])
  })

  it('should report unmeasured when the stamp covers other domains only', () => {
    mkdirSync(dirname(stampPath(TARGET)), { recursive: true })
    writeFileSync(
      stampPath(TARGET),
      JSON.stringify({
        covers: ['snippets'],
        domains: { snippets: { syncedAt: 'then', files: {} } },
      }),
    )

    expect(
      buildToolingReport(TOOLKIT, TARGET, readStamp(TARGET)).measured,
    ).toBe(false)
  })

  it('should report unmeasured when the toolkit no longer ships the chain', () => {
    const stamp = stampChain(['retired-stack'])

    expect(buildToolingReport(TOOLKIT, TARGET, stamp).measured).toBe(false)
  })

  /**
   * The render reads the chain to decide which of the two unmeasured causes to
   * name. Dropping it here would report a recorded chain as none recorded.
   */
  it('should keep the recorded chain when the toolkit no longer ships it', () => {
    const stamp = stampChain(['retired-stack'])

    expect(buildToolingReport(TOOLKIT, TARGET, stamp).chain).toEqual([
      'retired-stack',
    ])
  })

  it('should report measured with no changes when the target matches', () => {
    writeStack('base')
    writeFileSync(join(TARGET, 'base.config.json'), 'base\n')

    const report = buildToolingReport(TOOLKIT, TARGET, stampChain(['base']))

    expect(report.measured).toBe(true)
    expect(report.changes).toBe(0)
    expect(report.counts.configs).toBe(0)
  })

  it('should count a config the target is missing', () => {
    writeStack('base')

    const report = buildToolingReport(TOOLKIT, TARGET, stampChain(['base']))

    expect(report.measured).toBe(true)
    expect(report.counts.configs).toBe(1)
    expect(report.changes).toBe(1)
  })

  it('should carry the anchor the install recorded', () => {
    writeStack('base')

    const report = buildToolingReport(TOOLKIT, TARGET, stampChain(['base']))

    expect(report.commit).toBe('abc1234')
    expect(report.syncedAt).toBe('then')
  })

  /**
   * The recorded chain is the truth of what was installed. Re-resolving from
   * the leaf would pull `base` back in and report its config as missing, which
   * is drift against a layer the run deliberately skipped.
   */
  it('should scan only the recorded stacks, not the leaf extends chain', () => {
    writeStack('base')
    writeStack('vite-react', 'base')
    writeFileSync(join(TARGET, 'vite-react.config.json'), 'vite-react\n')

    const report = buildToolingReport(
      TOOLKIT,
      TARGET,
      stampChain(['vite-react']),
    )

    expect(report.chain).toEqual(['vite-react'])
    expect(report.counts.configs).toBe(0)
  })
})

describe('installedStampDomains', () => {
  it('should return nothing for a target with no installed domains', () => {
    expect(installedStampDomains(TARGET)).toEqual([])
  })

  it('should report only the domains present on disk', () => {
    mkdirSync(join(TARGET, '.claude/rules/canon'), { recursive: true })

    expect(installedStampDomains(TARGET)).toEqual(['governance'])
  })
})

describe('isManagedTarget', () => {
  const rootLayout = [
    {
      domain: 'governance' as const,
      rootPath: 'governance',
      installPath: join('.claude', 'rules'),
      files: 9,
    },
  ]

  it('should report an empty directory as unmanaged', () => {
    expect(isManagedTarget(TARGET, [])).toBe(false)
  })

  it('should report a target carrying .claude as managed', () => {
    mkdirSync(join(TARGET, '.claude'), { recursive: true })

    expect(isManagedTarget(TARGET, [])).toBe(true)
  })

  it('should report a target carrying only CLAUDE.md as managed', () => {
    writeFileSync(join(TARGET, 'CLAUDE.md'), '# Project\n')

    expect(isManagedTarget(TARGET, [])).toBe(true)
  })

  it('should not read a nested .claude as the target being managed', () => {
    mkdirSync(join(TARGET, 'packages', 'web', '.claude'), { recursive: true })

    expect(isManagedTarget(TARGET, [])).toBe(false)
  })

  it('should report a root-layout target with no marker as managed', () => {
    expect(isManagedTarget(TARGET, rootLayout)).toBe(true)
  })
})

describe('countStates', () => {
  it('should count each state separately', () => {
    const counts = countStates([
      { state: 'matching', rel: 'a.md' },
      { state: 'stale', rel: 'b.md' },
      { state: 'stale', rel: 'c.md' },
      { state: 'customized', rel: 'd.md' },
      { state: 'drifted', rel: 'e.md' },
      { state: 'orphaned', rel: 'f.md' },
      { state: 'stranded', rel: 'g.md' },
      { state: 'missing', rel: 'h.md' },
      { state: 'retired', rel: 'i.md' },
      { state: 'renamed', rel: 'j.md' },
    ])

    expect(counts).toEqual({
      matching: 1,
      stale: 2,
      customized: 1,
      drifted: 1,
      orphaned: 1,
      stranded: 1,
      missing: 1,
      retired: 1,
      renamed: 1,
    })
  })

  it('should return zeroes for an empty scan', () => {
    expect(countStates([])).toEqual({
      matching: 0,
      stale: 0,
      customized: 0,
      drifted: 0,
      orphaned: 0,
      stranded: 0,
      missing: 0,
      retired: 0,
      renamed: 0,
    })
  })
})

describe('hasDrift', () => {
  it('should report no drift when every file matches', () => {
    expect(hasDrift(buildReport([{ state: 'matching', rel: 'a.md' }]))).toBe(
      false,
    )
  })

  it('should report drift for a stale file', () => {
    expect(hasDrift(buildReport([{ state: 'stale', rel: 'a.md' }]))).toBe(true)
  })

  it('should not report drift for a project-authored file', () => {
    expect(hasDrift(buildReport([{ state: 'orphaned', rel: 'a.md' }]))).toBe(
      false,
    )
  })

  it('should not report drift for a rule the stack lists and the tree lacks', () => {
    expect(hasDrift(buildReport([{ state: 'missing', rel: 'a.md' }]))).toBe(
      false,
    )
  })

  it('should report drift for a stranded file', () => {
    expect(hasDrift(buildReport([{ state: 'stranded', rel: 'a.md' }]))).toBe(
      true,
    )
  })

  it('should report drift for a file the toolkit no longer ships', () => {
    expect(hasDrift(buildReport([{ state: 'retired', rel: 'a.md' }]))).toBe(
      true,
    )
  })

  it('should report drift for a file the toolkit renamed', () => {
    expect(hasDrift(buildReport([{ state: 'renamed', rel: 'a.md' }]))).toBe(
      true,
    )
  })

  it('should report drift for a customized file', () => {
    expect(hasDrift(buildReport([{ state: 'customized', rel: 'a.md' }]))).toBe(
      true,
    )
  })

  it('should not report drift for a binary behind the published version', () => {
    const report = buildReport([{ state: 'matching', rel: 'a.md' }], {
      skew: {
        state: 'behind',
        name: '@erclx/canon',
        installed: '0.109.0',
        latest: '0.110.0',
      },
    })

    expect(hasDrift(report)).toBe(false)
  })

  it('should not report drift when the registry could not be reached', () => {
    const report = buildReport([{ state: 'matching', rel: 'a.md' }], {
      skew: {
        state: 'unknown',
        name: '@erclx/canon',
        installed: '0.110.0',
        reason: 'Registry lookup failed: offline',
      },
    })

    expect(hasDrift(report)).toBe(false)
  })

  it('should report drift for an unmigrated domain', () => {
    const report = buildReport([{ state: 'matching', rel: 'a.md' }], {
      unmigrated: [
        {
          domain: 'governance',
          rootPath: 'governance',
          installPath: join('.claude', 'rules'),
          files: 9,
        },
      ],
    })

    expect(hasDrift(report)).toBe(true)
  })

  it('should not report drift for a superseded artifact', () => {
    const report = buildReport([{ state: 'matching', rel: 'a.md' }], {
      superseded: [
        {
          rel: join('.claude', 'TASKS.md'),
          replacedBy: join('.claude', 'tasks'),
        },
      ],
    })

    expect(hasDrift(report)).toBe(false)
  })

  it('should not report drift for a seed the project edited', () => {
    const report = buildReport([{ state: 'matching', rel: 'a.md' }], {
      seeds: {
        entries: [{ state: 'drifted', rel: 'CLAUDE.md' }],
        historyUnavailable: false,
      },
    })

    expect(hasDrift(report)).toBe(false)
  })
})

describe('parseUpstream', () => {
  it('should split each line into a sha and a subject', () => {
    const log =
      '96bca86 feat(plans): archive shipped plans\n31bb7c2 refactor: move fixtures'

    expect(parseUpstream(log)).toEqual([
      { sha: '96bca86', subject: 'feat(plans): archive shipped plans' },
      { sha: '31bb7c2', subject: 'refactor: move fixtures' },
    ])
  })

  it('should return nothing for an empty log', () => {
    expect(parseUpstream('')).toEqual([])
  })

  it('should skip a line carrying no subject', () => {
    expect(parseUpstream('96bca86')).toEqual([])
  })
})

describe('parseNewSkills', () => {
  it('should name a skill from its added SKILL.md', () => {
    const paths =
      'claude/skills/git-ship/SKILL.md\nclaude/skills/git-ship/README.md'

    expect(parseNewSkills(paths)).toEqual(['git-ship'])
  })

  it('should ignore support files added to an existing skill', () => {
    expect(parseNewSkills('claude/skills/git-ship/reference.md')).toEqual([])
  })

  it('should sort and deduplicate skill names', () => {
    const paths = [
      'claude/skills/zebra/SKILL.md',
      'claude/skills/alpha/SKILL.md',
      'claude/skills/alpha/SKILL.md',
    ].join('\n')

    expect(parseNewSkills(paths)).toEqual(['alpha', 'zebra'])
  })

  it('should return nothing when no skills were added', () => {
    expect(parseNewSkills('')).toEqual([])
  })
})

describe('readInstalledRules', () => {
  function install(rel: string): void {
    const full = join(TARGET, '.claude', 'rules', 'canon', rel)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, '# rule\n')
  }

  it('should name every rule the target holds', () => {
    install(join('core', '000-constitution.md'))
    install(join('ui', '400-ui.md'))

    expect([...readInstalledRules(TARGET).held].sort()).toEqual([
      '000-constitution',
      '400-ui',
    ])
  })

  it('should name the band folder each rule sits in', () => {
    install(join('core', '000-constitution.md'))
    install(join('lang', '100-typescript.md'))

    expect([...readInstalledRules(TARGET).bands].sort()).toEqual([
      'core',
      'lang',
    ])
  })

  it('should record no band for a rule installed flat', () => {
    install('900-local.md')

    const { held, bands } = readInstalledRules(TARGET)

    expect(held.has('900-local')).toBe(true)
    expect([...bands]).toEqual([])
  })

  it('should read nothing from a target with no rules directory', () => {
    const { held, bands } = readInstalledRules(TARGET)

    expect([...held]).toEqual([])
    expect([...bands]).toEqual([])
  })
})

describe('selectNewRules', () => {
  const held = new Set(['000-constitution'])
  const bands = new Set(['core', 'claude'])

  it('should name a rule added under a band the target carries', () => {
    const paths = 'governance/rules/core/080-observability.md'

    expect(selectNewRules(paths, held, bands)).toEqual(['080-observability'])
  })

  it('should drop a rule added under a band the target never installed', () => {
    const paths = 'governance/rules/ui/450-motion.md'

    expect(selectNewRules(paths, held, bands)).toEqual([])
  })

  it('should name a rule added flat at the source root', () => {
    expect(
      selectNewRules('governance/rules/900-loose.md', held, bands),
    ).toEqual(['900-loose'])
  })

  it('should drop a rule the target already holds under another band', () => {
    const paths = 'governance/rules/claude/000-constitution.md'

    expect(selectNewRules(paths, held, bands)).toEqual([])
  })

  it('should ignore an added path outside the rules source', () => {
    const paths = 'governance/stacks/react.toml'

    expect(selectNewRules(paths, held, bands)).toEqual([])
  })

  it('should sort and deduplicate rule names', () => {
    const paths = [
      'governance/rules/core/090-zebra.md',
      'governance/rules/claude/010-alpha.md',
      'governance/rules/core/090-zebra.md',
    ].join('\n')

    expect(selectNewRules(paths, held, bands)).toEqual([
      '010-alpha',
      '090-zebra',
    ])
  })

  it('should return nothing when no rules were added', () => {
    expect(selectNewRules('', held, bands)).toEqual([])
  })
})

describe('readNewRules', () => {
  let TOOLKIT: string

  function git(...args: string[]): string {
    return execaSync('git', ['-C', TOOLKIT, ...args], {
      env: gitEnv(),
      extendEnv: false,
    }).stdout
  }

  /** Commits one rule into the toolkit and returns the revision it landed at. */
  function authorRule(rel: string, message: string): string {
    const path = join('governance', 'rules', rel)
    const full = join(TOOLKIT, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, '# rule\n')
    git('add', '--', path)
    git('commit', '-m', message)

    return git('rev-parse', '--short', 'HEAD').trim()
  }

  /** A stamp naming only the anchor, so the diff-and-bands fallback runs. */
  function commitStamp(commit: string): Stamp {
    return {
      covers: ['governance'],
      domains: { governance: { syncedAt: 'irrelevant', files: {}, commit } },
    }
  }

  /** A stamp naming only the chain, so the anchor never enters the read. */
  function chainStamp(chain: readonly string[]): Stamp {
    return {
      covers: ['governance'],
      domains: { governance: { syncedAt: 'irrelevant', files: {}, chain } },
    }
  }

  /** A stamp naming both, for a chain that fails to resolve and falls through. */
  function chainAndCommitStamp(
    chain: readonly string[],
    commit: string,
  ): Stamp {
    return {
      covers: ['governance'],
      domains: {
        governance: { syncedAt: 'irrelevant', files: {}, chain, commit },
      },
    }
  }

  function writeStack(name: string, body: string): void {
    const path = join('governance', 'stacks', `${name}.toml`)
    const full = join(TOOLKIT, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, body)
  }

  function install(rel: string): void {
    const full = join(TARGET, '.claude', 'rules', 'canon', rel)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, '# rule\n')
  }

  /** The stack every other stack extends, naming the folders it takes whole. */
  function writeBaseStack(...bands: string[]): void {
    const path = join('governance', 'stacks', 'base.toml')
    const full = join(TOOLKIT, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, `extends = ""\nrules = ${JSON.stringify(bands)}\n`)
    git('add', '--', path)
    git('commit', '-m', 'record base stack')
  }

  beforeEach(() => {
    TOOLKIT = mkdtempSync(join(tmpdir(), 'canon-check-rules-'))
    git('init', '--initial-branch=main')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'Test')
  })

  afterEach(() => {
    rmSync(TOOLKIT, { recursive: true, force: true })
  })

  it('should name a rule authored after the anchor', async () => {
    const anchor = authorRule(join('core', '000-constitution.md'), 'base')
    authorRule(join('core', '080-observability.md'), 'add observability')
    install(join('core', '000-constitution.md'))

    await expect(
      readNewRules(TOOLKIT, TARGET, commitStamp(anchor)),
    ).resolves.toEqual(['080-observability'])
  })

  it('should ignore a rule authored before the anchor', async () => {
    authorRule(join('core', '000-constitution.md'), 'base')
    const anchor = authorRule(join('core', '010-testing.md'), 'add testing')
    install(join('core', '000-constitution.md'))

    await expect(
      readNewRules(TOOLKIT, TARGET, commitStamp(anchor)),
    ).resolves.toEqual([])
  })

  it('should ignore a rule outside the bands the target carries', async () => {
    const anchor = authorRule(join('core', '000-constitution.md'), 'base')
    authorRule(join('ui', '400-ui.md'), 'add ui')
    install(join('core', '000-constitution.md'))

    await expect(
      readNewRules(TOOLKIT, TARGET, commitStamp(anchor)),
    ).resolves.toEqual([])
  })

  it('should omit the new name of a rule the target holds under its old one', async () => {
    const anchor = authorRule(join('core', '000-constitution.md'), 'base')
    authorRule(join('core', '510-new.md'), 'rename 505-old to 510-new')
    writeFileSync(
      join(TOOLKIT, 'governance', 'renames.toml'),
      '[renamed]\n"505-old" = "510-new"\n',
    )
    install(join('core', '000-constitution.md'))
    install(join('core', '505-old.md'))

    await expect(
      readNewRules(TOOLKIT, TARGET, commitStamp(anchor)),
    ).resolves.toEqual([])
  })

  it('should report nothing when the target carries no anchor', async () => {
    authorRule(join('core', '000-constitution.md'), 'base')
    authorRule(join('core', '080-observability.md'), 'add observability')
    install(join('core', '000-constitution.md'))

    await expect(readNewRules(TOOLKIT, TARGET, undefined)).resolves.toEqual([])
  })

  it('should report nothing when the anchor names an unknown revision', async () => {
    authorRule(join('core', '000-constitution.md'), 'base')
    install(join('core', '000-constitution.md'))

    await expect(
      readNewRules(TOOLKIT, TARGET, commitStamp('1234567')),
    ).resolves.toEqual([])
  })

  /**
   * The band exists in no installed tree, so the target's own folders are no
   * evidence at all and the base stack file is the only thing that entitles it.
   */
  it('should name a rule under a new band the base stack takes whole', async () => {
    const anchor = authorRule(join('core', '000-constitution.md'), 'base rule')
    authorRule(join('security', '600-secrets.md'), 'add secrets')
    writeBaseStack('core', 'claude', 'security')
    install(join('core', '000-constitution.md'))

    await expect(
      readNewRules(TOOLKIT, TARGET, commitStamp(anchor)),
    ).resolves.toEqual(['600-secrets'])
  })

  it('should ignore a new band no stack file takes whole', async () => {
    const anchor = authorRule(join('core', '000-constitution.md'), 'base rule')
    authorRule(join('security', '600-secrets.md'), 'add secrets')
    writeBaseStack('core', 'claude')
    install(join('core', '000-constitution.md'))

    await expect(
      readNewRules(TOOLKIT, TARGET, commitStamp(anchor)),
    ).resolves.toEqual([])
  })

  /**
   * The reproduction this row exists for: a rule shipped and joined a stack
   * before the target's recorded anchor, which the diff-and-bands fallback
   * above can never see since its window only opens after the anchor.
   */
  it('should name a rule the recorded chain lists that predates the anchor', async () => {
    writeStack('astro', 'extends = ""\nrules = ["400-ui", "440-capture"]\n')
    authorRule(join('ui', '400-ui.md'), 'add ui')
    const anchor = authorRule(join('ui', '440-capture.md'), 'add capture')
    install(join('ui', '400-ui.md'))

    await expect(
      readNewRules(TOOLKIT, TARGET, chainStamp(['astro'])),
    ).resolves.toEqual(['440-capture'])

    // The same target read through the anchor-bound fallback misses it, which
    // is the defect a recorded chain exists to close.
    await expect(
      readNewRules(TOOLKIT, TARGET, commitStamp(anchor)),
    ).resolves.toEqual([])
  })

  it('should name nothing when the target already holds everything the chain lists', async () => {
    writeStack('astro', 'extends = ""\nrules = ["400-ui"]\n')
    authorRule(join('ui', '400-ui.md'), 'add ui')
    install(join('ui', '400-ui.md'))

    await expect(
      readNewRules(TOOLKIT, TARGET, chainStamp(['astro'])),
    ).resolves.toEqual([])
  })

  it('should read nothing for a recorded chain naming a stack the toolkit no longer ships, and no anchor to fall back on', async () => {
    authorRule(join('ui', '400-ui.md'), 'add ui')

    await expect(
      readNewRules(TOOLKIT, TARGET, chainStamp(['retired-stack'])),
    ).resolves.toEqual([])
  })

  /**
   * A stack the toolkit retired or renamed between install and this read must
   * not silently report nothing when an anchor is available to fall back on,
   * since that empty list would read identically to a target holding
   * everything, the exact defect a recorded chain exists to close.
   */
  it('should fall through to the anchor-bound path when the recorded chain no longer resolves', async () => {
    const anchor = authorRule(join('core', '000-constitution.md'), 'base rule')
    authorRule(join('security', '600-secrets.md'), 'add secrets')
    writeBaseStack('core', 'claude', 'security')
    install(join('core', '000-constitution.md'))

    await expect(
      readNewRules(
        TOOLKIT,
        TARGET,
        chainAndCommitStamp(['retired-stack'], anchor),
      ),
    ).resolves.toEqual(['600-secrets'])
  })
})

describe('baseBands', () => {
  let TOOLKIT: string

  function writeStack(body: string): void {
    const full = join(TOOLKIT, 'governance', 'stacks', 'base.toml')
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, body)
  }

  function writeRule(rel: string): void {
    const full = join(TOOLKIT, 'governance', 'rules', rel)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, '# rule\n')
  }

  beforeEach(() => {
    TOOLKIT = mkdtempSync(join(tmpdir(), 'canon-check-bands-'))
  })

  afterEach(() => {
    rmSync(TOOLKIT, { recursive: true, force: true })
  })

  it('should name every folder the base stack takes whole', () => {
    writeRule(join('core', '000-constitution.md'))
    writeRule(join('claude', '500-prose.md'))
    writeStack('extends = ""\nrules = ["core", "claude"]\n')

    expect([...baseBands(TOOLKIT)].sort()).toEqual(['claude', 'core'])
  })

  it('should drop an entry naming a rule rather than a folder', () => {
    writeRule(join('core', '000-constitution.md'))
    writeRule(join('lang', '100-typescript.md'))
    writeStack('extends = ""\nrules = ["core", "100-typescript"]\n')

    expect([...baseBands(TOOLKIT)]).toEqual(['core'])
  })

  it('should read nothing from a toolkit with no base stack', () => {
    expect([...baseBands(TOOLKIT)]).toEqual([])
  })
})

describe('uncoveredDomains', () => {
  it('should name a scanned domain the stamp does not cover', () => {
    const report = buildReport([], { covers: [] })

    expect(uncoveredDomains(report)).toContain('governance')
  })

  it('should name nothing the stamp already covers', () => {
    const report = buildReport([], { covers: ['governance'] })

    expect(uncoveredDomains(report)).not.toContain('governance')
  })

  it('should stay quiet about an opt-in domain the target never installed', () => {
    const report = buildReport([], { covers: [] })

    expect(uncoveredDomains(report)).not.toContain('design')
  })

  it('should name an opt-in domain the target installed and never stamped', () => {
    const report = buildReport([], {
      covers: [],
      domains: [
        {
          domain: 'design',
          stamped: false,
          counts: countStates([]),
          entries: [],
          historyUnavailable: false,
          upstream: [],
        },
      ],
    })

    expect(uncoveredDomains(report)).toContain('design')
  })

  it('should leave an unmigrated domain to the relocation rather than a sync', () => {
    const report = buildReport([], {
      covers: [],
      unmigrated: [
        {
          domain: 'governance',
          rootPath: 'rules',
          installPath: join('.claude', 'rules'),
          files: 1,
        },
      ],
    })

    expect(uncoveredDomains(report)).not.toContain('governance')
  })
})
