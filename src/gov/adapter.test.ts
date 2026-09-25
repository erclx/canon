import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createGovAdapter,
  indexSourceRules,
  rulesSourceDir,
} from '@/gov/adapter'
import { type InstalledFile, planSync } from '@/sync/engine'
import { writeChainStamp } from '@/sync/stamp'

let ROOT: string
let TOOLKIT: string
let TARGET: string

function writeFixture(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function installedFile(relToRoot: string): InstalledFile {
  const path = join(TARGET, '.claude', 'rules', 'canon', relToRoot)
  return {
    path,
    relToRoot,
    rel: join('.claude', 'rules', 'canon', relToRoot),
  }
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-gov-adapter-'))
  TOOLKIT = join(ROOT, 'toolkit')
  TARGET = join(ROOT, 'target')
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('indexSourceRules', () => {
  it('should key every rule by its filename without the extension', () => {
    writeFixture(join(TOOLKIT, 'governance/rules/core/000-const.md'), 'a')
    writeFixture(join(TOOLKIT, 'governance/rules/lang/100-ts.md'), 'b')

    const index = indexSourceRules(TOOLKIT)

    expect([...index.keys()].sort()).toEqual(['000-const', '100-ts'])
  })

  it('should resolve a rule name to its absolute source path', () => {
    writeFixture(join(TOOLKIT, 'governance/rules/core/000-const.md'), 'a')

    const index = indexSourceRules(TOOLKIT)

    expect(index.get('000-const')).toBe(
      join(TOOLKIT, 'governance/rules/core/000-const.md'),
    )
  })

  it('should keep the first match when a name repeats across subdirectories', () => {
    writeFixture(join(TOOLKIT, 'governance/rules/zeta/500-dup.md'), 'z')
    writeFixture(join(TOOLKIT, 'governance/rules/alpha/500-dup.md'), 'a')

    const index = indexSourceRules(TOOLKIT)

    expect(index.get('500-dup')).toBe(
      join(TOOLKIT, 'governance/rules/alpha/500-dup.md'),
    )
  })

  it('should return an empty index when the source tree is absent', () => {
    expect(indexSourceRules(TOOLKIT).size).toBe(0)
  })
})

describe('createGovAdapter', () => {
  it('should point the installed root at .claude/rules/canon', () => {
    const adapter = createGovAdapter(TOOLKIT)

    expect(adapter.installedRoot(TARGET)).toBe(
      join(TARGET, '.claude', 'rules', 'canon'),
    )
  })

  it('should match an installed rule to its source by name', () => {
    writeFixture(join(TOOLKIT, 'governance/rules/core/000-const.md'), 'a')
    const adapter = createGovAdapter(TOOLKIT)

    expect(adapter.locateSource(installedFile('core/000-const.md'))).toBe(
      join(TOOLKIT, 'governance/rules/core/000-const.md'),
    )
  })

  it('should match a rule that moved to a different source subdirectory', () => {
    writeFixture(join(TOOLKIT, 'governance/rules/lang/000-const.md'), 'a')
    const adapter = createGovAdapter(TOOLKIT)

    expect(adapter.locateSource(installedFile('core/000-const.md'))).toBe(
      join(TOOLKIT, 'governance/rules/lang/000-const.md'),
    )
  })

  it('should return undefined for a rule the toolkit does not ship', () => {
    writeFixture(join(TOOLKIT, 'governance/rules/core/000-const.md'), 'a')
    const adapter = createGovAdapter(TOOLKIT)

    expect(
      adapter.locateSource(installedFile('core/500-project.md')),
    ).toBeUndefined()
  })

  it('should report the retired GOV.md when the target still holds one', () => {
    writeFixture(join(TARGET, '.claude/GOV.md'), 'retired')
    const adapter = createGovAdapter(TOOLKIT)

    expect(adapter.collectRetired?.(TARGET)).toEqual([
      {
        path: join(TARGET, '.claude', 'GOV.md'),
        rel: join('.claude', 'GOV.md'),
        notice: `${join('.claude', 'GOV.md')} (retired surface, scheduled for removal)`,
      },
    ])
  })

  it('should report nothing retired when GOV.md is absent', () => {
    const adapter = createGovAdapter(TOOLKIT)

    expect(adapter.collectRetired?.(TARGET)).toEqual([])
  })

  it('should declare no project-authored subfolder, since project/ sits outside the narrowed installed root', () => {
    expect(createGovAdapter(TOOLKIT).projectSubdir).toBeUndefined()
  })

  it('should retire a rule under canon/ the toolkit no longer ships and queue its delete', () => {
    writeFixture(join(TOOLKIT, 'governance/rules/core/000-const.md'), 'a')
    const retired = join(TARGET, '.claude/rules/canon/core/505-gone.md')
    writeFixture(retired, 'shipped once\n')
    const rel = join('.claude', 'rules', 'canon', 'core', '505-gone.md')

    const plan = planSync(createGovAdapter(TOOLKIT), TARGET)

    expect(plan.entries.map((entry) => entry.state)).toEqual(['retired'])
    expect(plan.changes).toEqual([{ kind: 'delete', dest: retired, rel }])
  })

  it('should never walk a project rule under .claude/rules/project/', () => {
    writeFixture(join(TARGET, '.claude/rules/canon/core/000-const.md'), 'a')
    writeFixture(join(TOOLKIT, 'governance/rules/core/000-const.md'), 'a')
    writeFixture(join(TARGET, '.claude/rules/project/core/900-mine.md'), 'b')

    const plan = planSync(createGovAdapter(TOOLKIT), TARGET)

    expect(plan.entries.map((entry) => entry.rel)).toEqual([
      join('.claude', 'rules', 'canon', 'core', '000-const.md'),
    ])
    expect(plan.changes).toEqual([])
  })

  it('should not ship a project/ rule category, which the subfolder reserves for a target', () => {
    expect(existsSync(join(rulesSourceDir(process.cwd()), 'project'))).toBe(
      false,
    )
  })

  describe('collectMissing', () => {
    it('should name a rule the recorded chain lists that the target does not hold', async () => {
      writeFixture(join(TOOLKIT, 'governance/rules/ui/400-ui.md'), '# 400-ui\n')
      writeFixture(
        join(TOOLKIT, 'governance/rules/ui/440-capture.md'),
        '# 440-capture\n',
      )
      writeFixture(
        join(TOOLKIT, 'governance/stacks/astro.toml'),
        'extends = ""\nrules = ["400-ui", "440-capture"]\n',
      )
      writeFixture(
        join(TARGET, '.claude/rules/canon/ui/400-ui.md'),
        '# 400-ui\n',
      )
      await writeChainStamp(
        TARGET,
        { domain: 'governance', toolkitRoot: TOOLKIT },
        ['astro'],
        new Date('2026-08-26T00:00:00.000Z'),
      )

      const adapter = createGovAdapter(TOOLKIT)

      expect(adapter.collectMissing?.(TARGET)).toEqual([
        {
          path: join(
            TARGET,
            '.claude',
            'rules',
            'canon',
            'ui',
            '440-capture.md',
          ),
          rel: join('.claude', 'rules', 'canon', 'ui', '440-capture.md'),
          notice: `${join('.claude', 'rules', 'canon', 'ui', '440-capture.md')} (listed by astro, not installed. Run canon gov install astro to add it.)`,
        },
      ])
    })

    it('should report nothing when the target carries no recorded chain', () => {
      const adapter = createGovAdapter(TOOLKIT)

      expect(adapter.collectMissing?.(TARGET)).toEqual([])
    })
  })

  describe('a rule its recorded stack stopped listing', () => {
    beforeEach(async () => {
      writeFixture(
        join(TOOLKIT, 'governance/rules/framework/200-react.md'),
        '# 200-react\n',
      )
      writeFixture(
        join(TOOLKIT, 'governance/rules/framework/230-nextjs.md'),
        '# 230-nextjs\n',
      )
      writeFixture(
        join(TOOLKIT, 'governance/stacks/react.toml'),
        'extends = ""\nrules = ["200-react"]\n',
      )
      writeFixture(
        join(TARGET, '.claude/rules/canon/framework/200-react.md'),
        '# 200-react\n',
      )
      await writeChainStamp(
        TARGET,
        { domain: 'governance', toolkitRoot: TOOLKIT },
        ['react'],
        new Date('2026-09-24T00:00:00.000Z'),
      )
    })

    it('should read the installed rule as matching and queue no delete', () => {
      writeFixture(
        join(TARGET, '.claude/rules/canon/framework/230-nextjs.md'),
        '# 230-nextjs\n',
      )

      const plan = planSync(createGovAdapter(TOOLKIT), TARGET)

      expect(plan.entries).toContainEqual({
        state: 'matching',
        rel: join('.claude', 'rules', 'canon', 'framework', '230-nextjs.md'),
      })
      expect(plan.changes).toEqual([])
    })

    it('should not report the rule missing once the target deletes it', () => {
      const adapter = createGovAdapter(TOOLKIT)

      expect(adapter.collectMissing?.(TARGET)).toEqual([])
    })
  })
})
