import { execaSync } from 'execa'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BASELINE_REL } from '@/audits/baseline'
import { CLIENT_COMMAND_MARKER } from '@/client-commands'
import { gitEnv } from '@/git-env'
import type { CommandResult, MeasureContext } from '@/gate/measures'
import {
  architectureRecord,
  auditSet,
  auditsBaselineRel,
  captureStamps,
  clientCommandCitations,
  documentCeiling,
  readmeCitations,
  rawFieldFileReference,
  recordIdempotence,
  SANDBOX_ASSERTED_FLOOR,
  SANDBOX_UNDECLARED_CEILING,
  sandboxCoverage,
  shippedReferences,
  skillProvenance,
  visualPathGlobs,
} from '@/gate/measures'
import { REFERENCE_MARKER } from '@/shipped/references'
import { README_PARAPHRASE_MARKER } from '@/web/readme-citations'

describe('auditsBaselineRel', () => {
  it('should agree with the path audits/baseline.ts writes when the project has not moved', () => {
    const root = mkdtempSync(join(tmpdir(), 'canon-measures-'))
    try {
      expect(auditsBaselineRel(root)).toBe(BASELINE_REL)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('captureStamps', () => {
  let root: string

  const refuse = () => {
    throw new Error('captureStamps runs no command')
  }

  const context = (): MeasureContext => ({
    root,
    ci: false,
    run: refuse,
    cli: refuse,
  })

  /**
   * A whole capture set whose stamp agrees with both files beside it, which is
   * what a tree looks like directly after `canon capture assets/captures --out
   * assets/evidence` wrote all three. The markup lands under `assets/captures/`
   * and the image and stamp under `assets/evidence/`, so a set spans two
   * folders here the way it does in the tree.
   */
  const writeSet = (base: string, markup: string): void => {
    const html = `<html>${markup}</html>`
    const png = `${base} image bytes`
    writeFileSync(join(root, 'assets', 'captures', `${base}.html`), html)
    writeFileSync(join(root, 'assets', 'evidence', `${base}.png`), png)
    writeFileSync(
      join(root, 'assets', 'evidence', `${base}.stamp`),
      [
        `source: ${base}.html`,
        `source-sha256: ${digest(html)}`,
        `image-sha256: ${digest(png)}`,
        '',
      ].join('\n'),
    )
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-capture-stamps-'))
    mkdirSync(join(root, 'assets'))
    mkdirSync(join(root, 'assets', 'captures'))
    mkdirSync(join(root, 'assets', 'evidence'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('reports nothing where a tree carries no capture at all', async () => {
    const report = await captureStamps(context())

    expect(report).toEqual({ emissions: [] })
  })

  it('reports nothing where every set agrees with its stamp', async () => {
    writeSet('hero', 'hero')
    writeSet('install', 'install')

    const report = await captureStamps(context())

    expect(report).toEqual({ emissions: [] })
  })

  it('catches markup edited after the capture that stamped it', async () => {
    writeSet('hero', 'hero')
    writeFileSync(
      join(root, 'assets', 'captures', 'hero.html'),
      '<html>moved</html>',
    )

    const report = await captureStamps(context())

    expect(report.failure).toBeDefined()
    expect(report.emissions[0]?.text).toContain(
      'assets/captures/hero.html hashes to',
    )
  })

  it('covers the install set as well as the hero one', async () => {
    writeSet('hero', 'hero')
    writeSet('install', 'install')
    writeFileSync(join(root, 'assets', 'evidence', 'install.png'), 'replaced')

    const report = await captureStamps(context())

    expect(report.failure).toBeDefined()
    expect(report.emissions[0]?.text).toContain(
      'assets/evidence/install.png hashes to',
    )
  })

  it('names what a half-written set is missing rather than reading its stamp', async () => {
    writeSet('install', 'install')
    rmSync(join(root, 'assets', 'evidence', 'install.stamp'))

    const report = await captureStamps(context())

    expect(report.emissions[0]?.text).toBe(
      'Missing from the install set: assets/evidence/install.stamp',
    )
  })

  it('stays silent on one absent set while reading the other', async () => {
    writeSet('hero', 'hero')

    const report = await captureStamps(context())

    expect(report).toEqual({ emissions: [] })
  })

  it('reads a frame added later, since the bases come off the folder', async () => {
    writeSet('hero', 'hero')
    writeSet('release', 'release')
    writeFileSync(
      join(root, 'assets', 'captures', 'release.html'),
      '<html>moved</html>',
    )

    const report = await captureStamps(context())

    expect(report.failure).toBeDefined()
    expect(report.emissions[0]?.text).toContain(
      'assets/captures/release.html hashes to',
    )
  })

  it('leaves an image that is not a capture source alone', async () => {
    writeSet('hero', 'hero')
    writeFileSync(join(root, 'assets', 'logo.png'), 'not a capture')

    const report = await captureStamps(context())

    expect(report).toEqual({ emissions: [] })
  })

  it('reads bases from the markup folder rather than the output folder', async () => {
    writeFileSync(join(root, 'assets', 'stray.html'), '<html>stray</html>')

    const report = await captureStamps(context())

    expect(report).toEqual({ emissions: [] })
  })

  it('names the markup under captures when a set is missing only its image', async () => {
    writeSet('hero', 'hero')
    rmSync(join(root, 'assets', 'evidence', 'hero.png'))

    const report = await captureStamps(context())

    expect(report.emissions[0]?.text).toBe(
      'Missing from the hero set: assets/evidence/hero.png',
    )
  })
})

describe('auditSet', () => {
  it('should invoke audits run scoped to tracked and per-machine, excluding upstream', async () => {
    const seen: string[][] = []

    await auditSet({
      root: '/nowhere',
      ci: false,
      run: async () => {
        throw new Error('auditSet reads the CLI and nothing else')
      },
      cli: async (argv) => {
        seen.push([...argv])
        return {
          exitCode: 0,
          stdout: `${JSON.stringify({
            summary: { grown: 0, facts: 0, unmeasured: 0 },
          })}\n`,
          stderr: '',
          all: '',
        }
      },
    })

    expect(seen).toEqual([
      [
        'audits',
        'run',
        '--corpus',
        'tracked',
        '--corpus',
        'per-machine',
        '--json',
      ],
    ])
  })
})

describe('recordIdempotence', () => {
  const refuse = () => {
    throw new Error('recordIdempotence reads the CLI and nothing else')
  }

  const context = (result: Partial<CommandResult>): MeasureContext => ({
    root: '/nowhere',
    ci: false,
    run: refuse,
    cli: async () => ({
      exitCode: 0,
      stdout: '',
      stderr: '',
      all: '',
      ...result,
    }),
  })

  /**
   * What the verb writes on a tree it could read. Exit `2` is a plan drawn and
   * left unwritten, which is every reading but the one with nothing to do.
   */
  const planned = (
    moves: readonly unknown[],
    rewritten: number,
    paths: readonly unknown[] = [],
  ): Partial<CommandResult> => ({
    exitCode: moves.length === 0 && rewritten === 0 ? 0 : 2,
    stdout: `${JSON.stringify({ moves, rewritten, paths })}\n`,
  })

  const cited = [
    { path: 'canon/context/development/scratch.md', rewritten: 1 },
    { path: 'canon/context/sandbox/authoring.md', rewritten: 1 },
  ]

  it('passes where the records have moved and a re-run would rewrite nothing', async () => {
    const report = await recordIdempotence(context(planned([], 0)))

    expect(report.failure).toBeUndefined()
    expect(report.unmeasured).toBeUndefined()
    expect(report.emissions[0]?.text).toContain('rewrites nothing')
  })

  it('fails where the records have moved and a citation still names the old root', async () => {
    const report = await recordIdempotence(context(planned([], 2)))

    expect(report.failure).toContain('2 citation(s) still name the old root')
    expect(report.failure).toContain('canon-keep-record-root')
  })

  it('names each file the sweep would rewrite, so the count is actionable', async () => {
    const report = await recordIdempotence(context(planned([], 2, cited)))

    expect(report.emissions.map((emission) => emission.text)).toEqual([
      'canon/context/development/scratch.md (1)',
      'canon/context/sandbox/authoring.md (1)',
    ])
  })

  it('keeps the finding where the payload names no path to list', async () => {
    const report = await recordIdempotence(
      context({ exitCode: 2, stdout: '{"moves":[],"rewritten":2}\n' }),
    )

    expect(report.failure).toContain('2 citation(s)')
    expect(report.emissions).toEqual([])
  })

  it('reports without failing where the folders have yet to move', async () => {
    const move = { from: '.claude/memory', to: '.canon/memory' }

    const report = await recordIdempotence(context(planned([move], 14)))

    expect(report.failure).toBeUndefined()
    expect(report.emissions[0]?.text).toContain('1 record folder(s)')
    expect(report.emissions[0]?.text).toContain('14 citation(s)')
  })

  it('reads a refusal exit as unmeasured rather than as a pass', async () => {
    const report = await recordIdempotence(context({ exitCode: 1 }))

    expect(report.failure).toBeUndefined()
    expect(report.unmeasured).toContain('exit 1')
  })

  it('reads a payload carrying no plan as unmeasured', async () => {
    const report = await recordIdempotence(
      context({ exitCode: 2, stdout: 'not a record\n' }),
    )

    expect(report.failure).toBeUndefined()
    expect(report.unmeasured).toContain('carried no plan')
  })
})

describe('shippedReferences', () => {
  let root: string

  const refuse = () => {
    throw new Error('shippedReferences runs no command')
  }

  const context = (): MeasureContext => ({
    root,
    ci: false,
    run: refuse,
    cli: refuse,
  })

  const write = (path: string, content: string): void => {
    const full = join(root, path)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content)
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-shipped-references-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('reads a corpus carrying no reference as a pass', async () => {
    write('claude/skills/alpha/SKILL.md', 'The count reads low.\n')
    write(
      'docs/agents/alpha.md',
      'Qualified as `anthropics/claude-code#58345`.\n',
    )

    const report = await shippedReferences(context())

    expect(report.failure).toBeUndefined()
    expect(report.unmeasured).toBeUndefined()
    expect(report.emissions[0]?.text).toContain('No unresolvable reference')
  })

  it('fails on a same-repository citation whether or not it is qualified', async () => {
    write('docs/agents/alpha.md', 'Measured on `erclx/canon#1299`.\n')

    const report = await shippedReferences(context())

    expect(report.failure).toContain('One reference')
    expect(report.emissions).toHaveLength(1)
    expect(report.emissions[0]?.text).toContain('erclx/canon#1299')
    expect(report.emissions[0]?.text).toContain("this repository's own history")
  })

  it('fails on a bare reference and names the file and line', async () => {
    write('claude/skills/alpha/SKILL.md', 'first\nsee #1307 for the poll\n')

    const report = await shippedReferences(context())

    expect(report.failure).toContain('One reference')
    expect(report.emissions).toHaveLength(1)
    expect(report.emissions[0]?.text).toContain(
      'claude/skills/alpha/SKILL.md:2',
    )
    expect(report.emissions[0]?.text).toContain('#1307')
  })

  it('emits every hit before failing, so one push repairs the whole set', async () => {
    write('claude/skills/alpha/SKILL.md', 'on `#1299` against `5653721`\n')
    write('docs/agents/alpha.md', 'measured at `6c273324`\n')

    const report = await shippedReferences(context())

    expect(report.failure).toContain('3 references')
    expect(report.emissions).toHaveLength(3)
  })

  it('reads a tree carrying none of the corpora as unmeasured', async () => {
    write('src/design/base.css', '--ink: #191512;\n')

    const report = await shippedReferences(context())

    expect(report.failure).toBeUndefined()
    expect(report.emissions).toEqual([])
    expect(report.unmeasured).toContain('no shipped file was read')
  })

  it('passes over a tree the files field negates', async () => {
    write('scripts/sandbox/claude/review.sh', '# see #1307\n')
    write('scripts/lib/worktree.sh', 'resolve the root\n')

    const report = await shippedReferences(context())

    expect(report.failure).toBeUndefined()
    expect(report.emissions[0]?.text).toContain('No unresolvable reference')
  })

  it('reaches a seed behind a dotted segment, which is half of what tooling ships', async () => {
    write('tooling/base/seeds/.claude/context/ci.md', 'landed in #1250\n')

    const report = await shippedReferences(context())

    expect(report.emissions).toHaveLength(1)
    expect(report.emissions[0]?.text).toContain(
      'tooling/base/seeds/.claude/context/ci.md:1',
    )
  })

  it('passes over a marked illustration', async () => {
    write(
      'standards/publish.md',
      `Write \`#123\` there. <!-- ${REFERENCE_MARKER}: illustrates the form this section defines -->\n`,
    )

    const report = await shippedReferences(context())

    expect(report.failure).toBeUndefined()
  })

  it('fails on a docs path that resolves against the checkout, threading root through', async () => {
    write('docs/agents/real.md', 'placeholder\n')
    write(
      'claude/skills/alpha/SKILL.md',
      'Read `docs/agents/real.md` for the reference shape.\n',
    )

    const report = await shippedReferences(context())

    expect(report.failure).toContain('One reference')
    expect(report.emissions[0]?.text).toContain('docs/agents/real.md')
    expect(report.emissions[0]?.text).toContain('registry install')
  })

  it("passes a docs path that names a target's own tree rather than this checkout's", async () => {
    write(
      'claude/skills/alpha/SKILL.md',
      'Write the fixture to `docs/retry.md`.\n',
    )

    const report = await shippedReferences(context())

    expect(report.failure).toBeUndefined()
  })

  it('fails on a bare phase-label-shaped token', async () => {
    write(
      'claude/skills/alpha/SKILL.md',
      'Named the task `v28.1-trigger-escalation` for tracking.\n',
    )

    const report = await shippedReferences(context())

    expect(report.failure).toContain('One reference')
    expect(report.emissions[0]?.text).toContain('v28.1')
    expect(report.emissions[0]?.text).toContain('no target holds')
  })

  it('fails on a bare rule path cited from a skill body', async () => {
    write(
      'claude/skills/alpha/SKILL.md',
      "Write scratch to `.claude/rules/canon/core/055-scratch.md`'s location.\n",
    )

    const report = await shippedReferences(context())

    expect(report.failure).toContain('One reference')
    expect(report.emissions).toHaveLength(1)
    expect(report.emissions[0]?.text).toContain(
      'claude/skills/alpha/SKILL.md:1',
    )
    expect(report.emissions[0]?.text).toContain(
      '.claude/rules/canon/core/055-scratch.md',
    )
    expect(report.emissions[0]?.text).toContain('canon gov sync')
  })
})

describe('clientCommandCitations', () => {
  let root: string

  const refuse = () => {
    throw new Error('clientCommandCitations runs no command')
  }

  const context = (): MeasureContext => ({
    root,
    ci: false,
    run: refuse,
    cli: refuse,
  })

  const git = (...args: string[]): string =>
    execaSync('git', ['-C', root, ...args], {
      env: gitEnv(),
      extendEnv: false,
    }).stdout

  const commit = (path: string, content: string): void => {
    const full = join(root, path)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content)
    git('add', '--all')
    git('commit', '-m', `add ${path}`)
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-client-commands-'))
    git('init', '--initial-branch=main')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'Test')
    commit('README.md', 'seed\n')
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('passes a tree quoting the canonical form', async () => {
    commit(
      'docs/agents/worktrees.md',
      'Removal there goes through `claude rm <id>`.\n',
    )

    const report = await clientCommandCitations(context())

    expect(report.failure).toBeUndefined()
    expect(report.emissions[0]?.text).toContain('No client command')
  })

  it('fails on a wrong argument and names the file and line', async () => {
    commit(
      'src/commands/worktrees.ts',
      // canon-allow-client-command: fixture for a wrong argument, not a real citation
      "first\ngoes through: claude rm '${name}'\n",
    )

    const report = await clientCommandCitations(context())

    expect(report.failure).toContain('One tracked citation')
    expect(report.emissions).toHaveLength(1)
    expect(report.emissions[0]?.text).toContain('src/commands/worktrees.ts:2')
  })

  it('passes a marked line carrying the wrong argument on purpose', async () => {
    commit(
      'src/commands/worktrees.ts',
      `goes through: claude rm '\${name}' <!-- ${CLIENT_COMMAND_MARKER}: illustrates the wrong form on purpose -->\n`,
    )

    const report = await clientCommandCitations(context())

    expect(report.failure).toBeUndefined()
  })

  it('reports the shipped table left empty as a failure rather than a clean tree', async () => {
    // canon-allow-client-command: fixture for a wrong argument, not a real citation
    commit('src/commands/worktrees.ts', "goes through: claude rm '${name}'\n")

    const report = await clientCommandCitations(context(), [])

    expect(report.failure).toContain('table is empty')
  })
})

describe('readmeCitations', () => {
  let root: string

  const refuse = () => {
    throw new Error('readmeCitations runs no command')
  }

  const context = (): MeasureContext => ({
    root,
    ci: false,
    run: refuse,
    cli: refuse,
  })

  const write = (path: string, content: string): void => {
    const full = join(root, path)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content)
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-readme-citations-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('reports unmeasured when copy.ts is absent', async () => {
    write('README.md', 'canon keeps one authoritative copy.\n')

    const report = await readmeCitations(context())

    expect(report.failure).toBeUndefined()
    expect(report.unmeasured).toContain('is absent')
  })

  it('reports unmeasured when README.md is absent', async () => {
    write(
      'web/src/content/copy.ts',
      '// README.md: "authoritative copy"\nexport const hero = {}\n',
    )

    const report = await readmeCitations(context())

    expect(report.unmeasured).toContain('is absent')
  })

  it('passes when every quoted phrase still appears in README.md', async () => {
    write(
      'README.md',
      'canon keeps one authoritative copy for every project.\n',
    )
    write(
      'web/src/content/copy.ts',
      '// README.md: "keeps one authoritative copy"\nexport const hero = {}\n',
    )

    const report = await readmeCitations(context())

    expect(report.failure).toBeUndefined()
    expect(report.emissions[0]?.text).toContain(
      'verified against the current text',
    )
  })

  it('fails when a quoted phrase drifted out of README.md', async () => {
    write('README.md', 'canon does something else now.\n')
    write(
      'web/src/content/copy.ts',
      '// README.md: "keeps one authoritative copy"\nexport const hero = {}\n',
    )

    const report = await readmeCitations(context())

    expect(report.failure).toContain('One README.md citation')
    expect(report.emissions[0]?.text).toContain('no longer appears')
  })

  it('fails on a leftover bare line-number citation', async () => {
    write('README.md', 'canon keeps one authoritative copy.\n')
    write(
      'web/src/content/copy.ts',
      "// README.md:23, the reader's problem\nexport const hero = {}\n",
    )

    const report = await readmeCitations(context())

    expect(report.failure).toContain('One README.md citation')
    expect(report.emissions[0]?.text).toContain('bare line number')
  })

  it('passes a paraphrase marked with a reason and no quoted phrase', async () => {
    write('README.md', 'canon lists six domains across the corpus.\n')
    write(
      'web/src/content/copy.ts',
      `// README.md: ${README_PARAPHRASE_MARKER}: condensed from a bullet list\nexport const catalog = {}\n`,
    )

    const report = await readmeCitations(context())

    expect(report.failure).toBeUndefined()
  })
})

describe('sandboxCoverage', () => {
  const context = (
    scenario: Partial<CommandResult>,
    skills?: Partial<CommandResult>,
  ): MeasureContext => ({
    root: '/nowhere',
    ci: false,
    run: () => {
      throw new Error('sandboxCoverage reads the CLI and nothing else')
    },
    cli: async (argv) => {
      const base = { exitCode: 0, stdout: '', stderr: '', all: '' }
      return argv.includes('--skills')
        ? { ...base, ...skills }
        : { ...base, ...scenario }
    },
  })

  const scenarioReport = (
    total: number,
    armed: number,
  ): Partial<CommandResult> => ({
    stdout: `${JSON.stringify({ totalScenarios: total, armedScenarios: armed })}\n`,
  })

  const skillCensus = (
    totalSkills: number,
    asserted: number,
  ): Partial<CommandResult> => ({
    stdout: `${JSON.stringify({ totalSkills, asserted })}\n`,
  })

  const cleanScenario = scenarioReport(77, 77 - SANDBOX_UNDECLARED_CEILING)

  it('passes at or above both the undeclared ceiling and the asserted floor', async () => {
    const report = await sandboxCoverage(
      context(cleanScenario, skillCensus(78, SANDBOX_ASSERTED_FLOOR)),
    )

    expect(report.failure).toBeUndefined()
    expect(report.unmeasured).toBeUndefined()
    expect(report.emissions).toHaveLength(2)
  })

  it('fails on a scenario-coverage failure exactly as today', async () => {
    const report = await sandboxCoverage(
      context(scenarioReport(77, 77 - SANDBOX_UNDECLARED_CEILING - 1)),
    )

    expect(report.failure).toContain('over the ceiling')
  })

  it('fails when the skills call reports asserted under the floor', async () => {
    const report = await sandboxCoverage(
      context(cleanScenario, skillCensus(78, SANDBOX_ASSERTED_FLOOR - 1)),
    )

    expect(report.failure).toContain('under the floor')
    expect(report.failure).toContain(String(SANDBOX_ASSERTED_FLOOR))
  })

  it('reads an unmeasured result when the skills call exits non-zero', async () => {
    const report = await sandboxCoverage(
      context(cleanScenario, { exitCode: 1 }),
    )

    expect(report.failure).toBeUndefined()
    expect(report.unmeasured).toContain('exit 1')
  })
})

function digest(content: string): string {
  return new Bun.CryptoHasher('sha256').update(content).digest('hex')
}

describe('visualPathGlobs', () => {
  let root: string

  const refuse = () => {
    throw new Error('visualPathGlobs runs no command')
  }

  const context = (): MeasureContext => ({
    root,
    ci: false,
    run: refuse,
    cli: refuse,
  })

  const write = (path: string, content: string): void => {
    const full = join(root, path)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content)
  }

  const deploy = (paths: readonly string[]): string =>
    [
      'on:',
      '  push:',
      '    paths:',
      ...paths.map((path) => `      - '${path}'`),
    ].join('\n')

  const visual = (paths: readonly string[]): string =>
    [
      'on:',
      '  pull_request:',
      '    paths:',
      ...paths.map((path) => `      - '${path}'`),
    ].join('\n')

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-visual-path-globs-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('reports unmeasured when deploy-site.yml is absent', async () => {
    write('.github/workflows/pr-visual-checks.yml', visual(['web/**']))

    const report = await visualPathGlobs(context())

    expect(report.failure).toBeUndefined()
    expect(report.unmeasured).toContain('is absent')
  })

  it('reports unmeasured when pr-visual-checks.yml is absent', async () => {
    write('.github/workflows/deploy-site.yml', deploy(['web/**']))

    const report = await visualPathGlobs(context())

    expect(report.unmeasured).toContain('is absent')
  })

  it('passes when the two glob lists agree', async () => {
    const paths = ['web/**', 'assets/**']
    write('.github/workflows/deploy-site.yml', deploy(paths))
    write('.github/workflows/pr-visual-checks.yml', visual(paths))

    const report = await visualPathGlobs(context())

    expect(report.failure).toBeUndefined()
    expect(report.emissions[0]?.text).toContain('agree')
  })

  it('fails when a glob was added to one file and not the other', async () => {
    write(
      '.github/workflows/deploy-site.yml',
      deploy(['web/**', 'assets/**', 'src/design/**']),
    )
    write(
      '.github/workflows/pr-visual-checks.yml',
      visual(['web/**', 'assets/**']),
    )

    const report = await visualPathGlobs(context())

    expect(report.failure).toContain('carry different path globs')
    expect(report.emissions.map((e) => e.text).join('\n')).toContain(
      'src/design/**',
    )
  })

  it('passes when the visual workflow adds only a declared visual-only glob', async () => {
    const shared = ['web/**', 'assets/**']
    write('.github/workflows/deploy-site.yml', deploy(shared))
    write(
      '.github/workflows/pr-visual-checks.yml',
      visual([...shared, 'tooling/web/configs/e2e/**']),
    )

    const report = await visualPathGlobs(context())

    expect(report.failure).toBeUndefined()
    expect(report.emissions[0]?.text).toContain('agree')
    expect(report.emissions[0]?.text).toContain('tooling/web/configs/e2e/**')
  })

  it('fails when the visual workflow adds an undeclared visual-only glob', async () => {
    const shared = ['web/**', 'assets/**']
    write('.github/workflows/deploy-site.yml', deploy(shared))
    write(
      '.github/workflows/pr-visual-checks.yml',
      visual([...shared, 'tooling/**']),
    )

    const report = await visualPathGlobs(context())

    expect(report.failure).toContain('carry different path globs')
  })

  it('fails when the deploy workflow carries a declared visual-only glob', async () => {
    const shared = ['web/**', 'assets/**']
    write(
      '.github/workflows/deploy-site.yml',
      deploy([...shared, 'tooling/web/configs/e2e/**']),
    )
    write('.github/workflows/pr-visual-checks.yml', visual(shared))

    const report = await visualPathGlobs(context())

    expect(report.failure).toContain('carry different path globs')
  })

  it('fails when both workflows carry a declared visual-only glob', async () => {
    const paths = ['web/**', 'assets/**', 'tooling/web/configs/e2e/**']
    write('.github/workflows/deploy-site.yml', deploy(paths))
    write('.github/workflows/pr-visual-checks.yml', visual(paths))

    const report = await visualPathGlobs(context())

    expect(report.failure).toContain('carry different path globs')
    expect(report.emissions.map((e) => e.text).join('\n')).toContain(
      'tooling/web/configs/e2e/**',
    )
  })
})

describe('architectureRecord', () => {
  let root: string

  const refuse = () => {
    throw new Error('architectureRecord reads the record and runs nothing')
  }

  const context = (): MeasureContext => ({
    root,
    ci: false,
    run: refuse,
    cli: refuse,
  })

  const writeRecord = (source: string): void => {
    mkdirSync(join(root, 'canon'), { recursive: true })
    writeFileSync(join(root, 'canon', 'ARCHITECTURE.md'), source)
  }

  const decisions = (count: number): string =>
    Array.from(
      { length: count },
      (_, index) => `### Decision ${index}\n\nReasoning.\n`,
    ).join('\n')

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-architecture-record-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('passes a record holding no more entries than its cap', async () => {
    writeRecord(`# Architecture\n\nAt most 2 decisions.\n\n${decisions(2)}`)

    const report = await architectureRecord(context())

    expect(report.failure).toBeUndefined()
  })

  it('fails a record holding more entries than its cap', async () => {
    writeRecord(`# Architecture\n\nAt most 2 decisions.\n\n${decisions(3)}`)

    const report = await architectureRecord(context())

    expect(report.failure).toContain('3 decisions against a cap of 2')
  })

  it('fails a record longer than the ceiling it derives', async () => {
    writeRecord(
      `# Architecture\n\nA 2-line frame plus 1 line a decision.\n\n${decisions(1)}`,
    )

    const report = await architectureRecord(context())

    expect(report.failure).toContain('against a ceiling of 3')
  })

  it('passes a project carrying no record', async () => {
    const report = await architectureRecord(context())

    expect(report.failure).toBeUndefined()
    expect(report.unmeasured).toBeUndefined()
  })
})

describe('skillProvenance', () => {
  let root: string

  const refuse = () => {
    throw new Error('skillProvenance reads the corpus and runs nothing')
  }

  const context = (): MeasureContext => ({
    root,
    ci: false,
    run: refuse,
    cli: refuse,
  })

  const writeSkill = (body: string): void => {
    const dir = join(root, 'claude', 'skills', 'git-commit')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'SKILL.md'),
      `---\nname: git-commit\ndescription: Commits.\n---\n\n# Git commit\n\n${body}`,
    )
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-skill-provenance-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('passes a corpus carrying no date', async () => {
    writeSkill('State the current rule.\n')

    const report = await skillProvenance(context())

    expect(report.failure).toBeUndefined()
    expect(report.unmeasured).toBeUndefined()
  })

  it('fails a body carrying a date in prose, naming the path and line', async () => {
    writeSkill('A worker lost its branch on 2026-08-27.\n')

    const report = await skillProvenance(context())

    expect(report.failure).toContain(
      `${join('claude', 'skills', 'git-commit', 'SKILL.md')} line 8: 2026-08-27`,
    )
  })

  it('passes a date inside a fenced block', async () => {
    writeSkill('```yaml\ncreated: 2026-08-27\n```\n')

    const report = await skillProvenance(context())

    expect(report.failure).toBeUndefined()
  })

  it('reports a project carrying no skill corpus as unmeasured', async () => {
    const report = await skillProvenance(context())

    expect(report.failure).toBeUndefined()
    expect(report.unmeasured).toContain('no skill corpus')
  })
})

describe('documentCeiling', () => {
  let root: string

  const refuse = () => {
    throw new Error('documentCeiling reads the corpus and runs nothing')
  }

  const context = (): MeasureContext => ({
    root,
    ci: false,
    run: refuse,
    cli: refuse,
  })

  const git = (...args: string[]): string =>
    execaSync('git', ['-C', root, ...args], {
      env: gitEnv(),
      extendEnv: false,
    }).stdout

  const write = (path: string, lineCount: number, head = ''): void => {
    const full = join(root, path)
    mkdirSync(join(full, '..'), { recursive: true })
    const body = Array.from(
      { length: lineCount },
      (_, index) => `Line ${index + 1}.`,
    ).join('\n')
    writeFileSync(full, `${head}${body}\n`)
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-document-ceiling-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  describe('in a repository', () => {
    beforeEach(() => {
      git('init', '--initial-branch=main')
    })

    it('reports only the count where every document sits under the ceiling', async () => {
      write('docs/guide.md', 300)

      const report = await documentCeiling(context())

      expect(report.failure).toBeUndefined()
      expect(report.emissions).toEqual([
        {
          kind: 'info',
          text: 'No document past the 300-line ceiling across 1 markdown file',
        },
      ])
    })

    it('warns on a document past the ceiling and never fails', async () => {
      write('docs/guide.md', 301)

      const report = await documentCeiling(context())

      expect(report.failure).toBeUndefined()
      expect(report.emissions).toContainEqual({
        kind: 'warn',
        text: 'docs/guide.md  301 rendered lines',
      })
    })

    it('leaves an exempt document unwarned', async () => {
      write(
        'scripts/record.md',
        400,
        '<!-- canon-length-exempt: a verbatim run record -->\n\n',
      )

      const report = await documentCeiling(context())

      expect(
        report.emissions.filter((emission) => emission.kind === 'warn'),
      ).toEqual([])
    })
  })

  it('reads a tree git cannot list as unmeasured', async () => {
    write('docs/guide.md', 400)

    const report = await documentCeiling(context())

    expect(report.unmeasured).toBeDefined()
  })
})

describe('rawFieldFileReference', () => {
  let root: string

  const refuse = () => {
    throw new Error('rawFieldFileReference runs no command')
  }

  const context = (): MeasureContext => ({
    root,
    ci: false,
    run: refuse,
    cli: refuse,
  })

  const write = (path: string, content: string): void => {
    const full = join(root, path)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content)
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-raw-field-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('fails on a -f body=@ file reference and names the file and line', async () => {
    write(
      'claude/skills/alpha/SKILL.md',
      'first\ngh api -X PATCH repos/o/r/issues/comments/1 -f body=@x/body.md\n',
    )

    const report = await rawFieldFileReference(context())

    expect(report.failure).toContain('One raw-field')
    expect(report.emissions).toHaveLength(1)
    expect(report.emissions[0]?.text).toContain(
      'claude/skills/alpha/SKILL.md:2',
    )
    expect(report.emissions[0]?.text).toContain('-F')
  })

  it('fails on a --raw-field file reference', async () => {
    write('docs/agents/alpha.md', 'gh api x --raw-field body=@x/body.md\n')

    const report = await rawFieldFileReference(context())

    expect(report.failure).toContain('One raw-field')
  })

  it('passes a -F body=@ file reference', async () => {
    write('claude/skills/alpha/SKILL.md', 'gh api x -F body=@x/body.md\n')

    const report = await rawFieldFileReference(context())

    expect(report.failure).toBeUndefined()
    expect(report.emissions[0]?.text).toContain('No raw-field')
  })

  it('passes a -f body with a literal string', async () => {
    write('claude/skills/alpha/SKILL.md', 'gh api x -f body="literal text"\n')

    const report = await rawFieldFileReference(context())

    expect(report.failure).toBeUndefined()
  })

  it('reads a tree carrying none of the corpora as unmeasured', async () => {
    write('src/alpha.ts', 'gh api x -f body=@x\n')

    const report = await rawFieldFileReference(context())

    expect(report.failure).toBeUndefined()
    expect(report.emissions).toEqual([])
    expect(report.unmeasured).toContain('no shipped file was read')
  })
})
