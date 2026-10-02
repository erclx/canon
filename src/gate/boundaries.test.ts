import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  capabilitySeeding,
  ignoreParity,
  pluginBoundary,
  seedIndependence,
  skillPaths,
} from '@/gate/boundaries'
import type { Measure, MeasureContext, MeasureReport } from '@/gate/measures'

let root: string

const refuse = () => {
  throw new Error('a boundary measure reads the tree and runs nothing')
}

const raw = (check: Measure): Promise<MeasureReport> =>
  check({ root, ci: false, run: refuse, cli: refuse } as MeasureContext)

/**
 * The report as a reader sees a failing stage: the borrowed output lines, then
 * the stage's one-line failure. A passing or unmeasured report comes back as it
 * was, so a case asserting an absent failure reads the same either way.
 */
const measure = async (check: Measure): Promise<MeasureReport> => {
  const report = await raw(check)
  if (report.failure === undefined) return report
  const lines = report.emissions.map((emission) => emission.text)
  return { ...report, failure: [...lines, report.failure].join('\n') }
}

describe('a failing measure', () => {
  const seedMd = (body: string): void =>
    write('tooling/claude/seeds/.claude/rules/a.md', body)

  it('should keep its failure to one line and carry the detail as output', async () => {
    seedMd('Run canon sync now.\n')

    const report = await raw(seedIndependence)

    expect(report.failure).toBe('Seed prose cites the toolkit CLI.')
    expect(report.emissions).toEqual([
      {
        kind: 'output',
        text: expect.stringContaining('rules/a.md:1:Run canon sync now.'),
      },
    ])
  })

  it('should carry the header and the remediation sentence in that output', async () => {
    write('claude/skills/a/SKILL.md', 'wiki/index.md\n')

    const report = await raw(skillPaths)

    expect(report.failure).toBe('Shipped skills reference a repo-local path.')
    expect(report.emissions[0]?.text).toContain(
      'Shipped skills reference a repo-local path that does not exist in a target project:',
    )
  })
})

const write = (path: string, body = ''): void => {
  const full = join(root, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, body)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-boundaries-'))
})

afterEach(() => {
  rmSync(root, { force: true, recursive: true })
})

describe('ignoreParity', () => {
  const writeGitignore = (...lines: string[]): void =>
    write('.gitignore', `${lines.join('\n')}\n`)

  const writeManifest = (body: string): void =>
    write('tooling/claude/manifest.toml', body)

  const writeManifestEntries = (...entries: string[]): void => {
    const array = entries.map((entry) => `"${entry}"`).join(', ')
    writeManifest(
      `[stack]\nname = "claude"\n\n[gitignore]\n"# Claude" = [${array}]\n`,
    )
  }

  it('should pass when both lists name the same claude paths', async () => {
    writeGitignore('# Claude', '.claude/plans/')
    writeManifestEntries('.claude/plans/')

    const report = await measure(ignoreParity)

    expect(report.failure).toBeUndefined()
    expect(report.unmeasured).toBeUndefined()
  })

  it('should read a pattern and an entry that differ only in the trailing slash as one path', async () => {
    writeGitignore('# Claude', '.claude/.tmp')
    writeManifestEntries('.claude/.tmp/')

    expect((await measure(ignoreParity)).failure).toBeUndefined()
  })

  it('should fail on a claude path this repository ignores and the manifest omits', async () => {
    writeGitignore('# Claude', '.claude/proposals/')
    writeManifestEntries('.claude/plans/')

    expect((await measure(ignoreParity)).failure).toContain(
      '.claude/proposals is ignored here and absent from the manifest',
    )
  })

  it('should fail on an entry the manifest ships and this repository tracks', async () => {
    writeGitignore('node_modules/', '# Claude')
    writeManifestEntries('.claude/plans/')

    expect((await measure(ignoreParity)).failure).toContain(
      '.claude/plans is shipped by the manifest and absent from .gitignore',
    )
  })

  it('should keep the header sentence and the remediation sentence', async () => {
    writeGitignore('# Claude', '.claude/proposals/')
    writeManifestEntries('.claude/plans/')

    const failure = (await measure(ignoreParity)).failure

    expect(failure).toContain(
      "The ignore set a target receives disagrees with this repository's own:",
    )
    expect(failure).toContain(
      'The two lists are compared exactly, and nothing here records an exception.',
    )
  })

  it('should ignore a pattern outside .claude/, which the claude manifest says nothing about', async () => {
    writeGitignore('node_modules/', '.env', '# Claude', '.claude/plans/')
    writeManifestEntries('.claude/plans/')

    expect((await measure(ignoreParity)).failure).toBeUndefined()
  })

  it('should count a claude path filed under a header of its own as present', async () => {
    writeGitignore('# Claude', '', '# Teaching workspace', '.claude/teach/')
    writeManifestEntries('.claude/teach/')

    expect((await measure(ignoreParity)).failure).toBeUndefined()
  })

  it('should read the array when a formatter has wrapped it across lines', async () => {
    writeGitignore('# Claude', '.claude/plans/')
    writeManifest(
      [
        '[stack]',
        'name = "claude"',
        '',
        '[gitignore]',
        '"# Claude" = [',
        '  ".claude/plans/",',
        ']',
        '',
      ].join('\n'),
    )

    expect((await measure(ignoreParity)).failure).toBeUndefined()
  })

  it('should read .canon as a bare root', async () => {
    writeGitignore('# Claude', '.canon/', '.claude/plans/')
    writeManifestEntries('.claude/plans/')

    expect((await measure(ignoreParity)).failure).toContain(
      '.canon is ignored here and absent from the manifest',
    )
  })

  it('should read .canon as a prefix', async () => {
    writeGitignore('# Claude', '.canon/tmp/', '.claude/plans/')
    writeManifestEntries('.claude/plans/')

    expect((await measure(ignoreParity)).failure).toContain(
      '.canon/tmp is ignored here and absent from the manifest',
    )
  })

  it('should drop trailing whitespace and skip a comment with a leading space', async () => {
    writeGitignore('# Claude', '.claude/plans/  ', ' # a note', '.env')
    writeManifestEntries('.claude/plans/')

    expect((await measure(ignoreParity)).failure).toBeUndefined()
  })

  it('should report unmeasured for a manifest whose gitignore table carries no claude array', async () => {
    writeGitignore('# Claude')
    writeManifest('[stack]\nname = "claude"\n')

    expect((await measure(ignoreParity)).unmeasured).toContain(
      'ignore parity unverifiable',
    )
  })

  it('should report unmeasured for a .gitignore that names no pattern', async () => {
    writeGitignore('# Claude')
    writeManifestEntries('.claude/plans/')

    expect((await measure(ignoreParity)).unmeasured).toContain(
      'No patterns read from .gitignore',
    )
  })

  it('should report unmeasured for a tree with no .gitignore rather than report parity', async () => {
    writeManifestEntries('.claude/plans/')

    expect((await measure(ignoreParity)).unmeasured).toContain(
      'ignore parity unverifiable',
    )
  })

  it('should report unmeasured for a tree with no claude manifest rather than report parity', async () => {
    writeGitignore('# Claude')

    expect((await measure(ignoreParity)).unmeasured).toContain(
      'ignore parity unverifiable',
    )
  })
})

describe('capabilitySeeding', () => {
  const writeSettings = (commands: string[]): void =>
    write(
      'tooling/claude/seeds/.claude/settings.json',
      JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              matcher: 'Bash',
              hooks: commands.map((command) => ({ type: 'command', command })),
            },
          ],
        },
      }),
    )

  const hook = (dir: string, name: string, body = '#!/usr/bin/env bash\n') =>
    write(`${dir}/${name}`, body)

  beforeEach(() => {
    mkdirSync(join(root, 'tooling'), { recursive: true })
  })

  it('should pass when a hook reaches its seed', async () => {
    hook('.claude/hooks', 'index-reminder.sh')
    hook('tooling/claude/seeds/.claude/hooks', 'index-reminder.sh')
    writeSettings(['.claude/hooks/index-reminder.sh'])

    const report = await measure(capabilitySeeding)

    expect(report.failure).toBeUndefined()
    expect(report.unmeasured).toBeUndefined()
  })

  it('should fail on a hook reaching no seed with no canon-no-seed reason', async () => {
    hook('.claude/hooks', 'orphaned-source.sh')

    expect((await measure(capabilitySeeding)).failure).toContain(
      'Hooks: .claude/hooks/orphaned-source.sh reaches no seed or config and carries no canon-no-seed: reason',
    )
  })

  it('should keep the header sentence and the remediation sentence', async () => {
    hook('.claude/hooks', 'orphaned-source.sh')

    const failure = (await measure(capabilitySeeding)).failure

    expect(failure).toContain(
      'A capability reaches one side of the seed or config boundary and not the other:',
    )
    expect(failure).toContain(
      'Seed or configure the capability, or mark the source line with # canon-no-seed: <reason>.',
    )
  })

  it('should pass on a hook reaching no seed that carries a canon-no-seed reason', async () => {
    hook(
      '.claude/hooks',
      'checkout-only.sh',
      '#!/usr/bin/env bash\n# canon-no-seed: calls a toolkit-internal library never shipped\n',
    )

    expect((await measure(capabilitySeeding)).failure).toBeUndefined()
  })

  it('should pass when a workflow reaches any stack config', async () => {
    hook('.github/workflows', 'verify.yml', 'name: Verify\n')
    hook(
      'tooling/web/configs/.github/workflows',
      'verify.yml',
      'name: Verify\n',
    )

    expect((await measure(capabilitySeeding)).failure).toBeUndefined()
  })

  it('should pass when a workflow reaches a stack seed', async () => {
    hook('.github/workflows', 'verify.yml', 'name: Verify\n')
    hook('tooling/base/seeds/.github/workflows', 'verify.yml', 'name: Verify\n')

    expect((await measure(capabilitySeeding)).failure).toBeUndefined()
  })

  it('should fail when a workflow reaches no stack config', async () => {
    hook('.github/workflows', 'release.yml', 'name: Release\n')

    expect((await measure(capabilitySeeding)).failure).toContain(
      'Workflows: .github/workflows/release.yml reaches no seed or config',
    )
  })

  it('should pass when a husky hook reaches its base config', async () => {
    hook('.husky', 'pre-push', '#!/usr/bin/env sh\n')
    hook('tooling/base/configs/.husky', 'pre-push', '#!/usr/bin/env sh\n')

    expect((await measure(capabilitySeeding)).failure).toBeUndefined()
  })

  it('should not read a husky directory as an unseeded capability', async () => {
    hook('.husky', 'pre-push', '#!/usr/bin/env sh\n')
    hook('tooling/base/configs/.husky', 'pre-push', '#!/usr/bin/env sh\n')
    hook('.husky/_', 'husky.sh')
    hook('.husky', '.hidden')

    expect((await measure(capabilitySeeding)).failure).toBeUndefined()
  })

  it('should fail on a seeded hook wired into no command', async () => {
    hook('.claude/hooks', 'unwired.sh')
    hook('tooling/claude/seeds/.claude/hooks', 'unwired.sh')
    writeSettings(['.claude/hooks/other.sh'])

    expect((await measure(capabilitySeeding)).failure).toContain(
      'Seed settings: unwired.sh is seeded and wired into no command',
    )
  })

  it('should not pass an unwired hook whose name is a substring of a wired one', async () => {
    hook('.claude/hooks', 'log.sh')
    hook('.claude/hooks', 'pr-create-log.sh')
    hook('tooling/claude/seeds/.claude/hooks', 'log.sh')
    hook('tooling/claude/seeds/.claude/hooks', 'pr-create-log.sh')
    writeSettings(['.claude/hooks/pr-create-log.sh'])

    const failure = (await measure(capabilitySeeding)).failure

    expect(failure).toContain(
      'Seed settings: log.sh is seeded and wired into no command',
    )
    expect(failure).not.toContain(
      'pr-create-log.sh is seeded and wired into no command',
    )
  })

  it('should read a command wired at any depth of settings.json', async () => {
    hook('.claude/hooks', 'deep.sh')
    hook('tooling/claude/seeds/.claude/hooks', 'deep.sh')
    write(
      'tooling/claude/seeds/.claude/settings.json',
      JSON.stringify({
        a: { b: [{ c: { command: 'bash .claude/hooks/deep.sh' } }] },
      }),
    )

    expect((await measure(capabilitySeeding)).failure).toBeUndefined()
  })

  it('should fail on a seeded hook whose source here is gone', async () => {
    hook('tooling/claude/seeds/.claude/hooks', 'orphaned-seed.sh')
    writeSettings(['.claude/hooks/orphaned-seed.sh'])

    expect((await measure(capabilitySeeding)).failure).toContain(
      'Hooks: tooling/claude/seeds/.claude/hooks/orphaned-seed.sh is seeded or configured with no source at .claude/hooks/orphaned-seed.sh',
    )
  })

  it('should fail on a configured workflow whose source here is gone', async () => {
    hook('tooling/web/configs/.github/workflows', 'orphaned.yml', 'name: O\n')

    expect((await measure(capabilitySeeding)).failure).toContain(
      'Workflows: tooling/web/configs/.github/workflows/orphaned.yml is seeded or configured with no source at .github/workflows/orphaned.yml',
    )
  })

  it('should fail on a seeded workflow whose source here is gone', async () => {
    hook('tooling/base/seeds/.github/workflows', 'orphaned.yml', 'name: O\n')

    expect((await measure(capabilitySeeding)).failure).toContain(
      'Workflows: tooling/base/seeds/.github/workflows/orphaned.yml is seeded or configured with no source at .github/workflows/orphaned.yml',
    )
  })

  it('should pass a target-only workflow that carries a canon-no-seed reason', async () => {
    hook(
      'tooling/web/configs/.github/workflows',
      'deploy.yml',
      'name: Deploy\n# canon-no-seed: stack-specific job with no root counterpart by design\n',
    )

    expect((await measure(capabilitySeeding)).failure).toBeUndefined()
  })

  it('should report seeded hooks with no settings.json', async () => {
    hook('.claude/hooks', 'a.sh')
    hook('tooling/claude/seeds/.claude/hooks', 'a.sh')

    expect((await measure(capabilitySeeding)).failure).toContain(
      'Seed settings: no settings.json at tooling/claude/seeds/.claude/settings.json',
    )
  })

  it('should fail on a seeded settings.json that does not parse', async () => {
    hook('.claude/hooks', 'a.sh')
    hook('tooling/claude/seeds/.claude/hooks', 'a.sh')
    write('tooling/claude/seeds/.claude/settings.json', '{ not json')

    const report = await measure(capabilitySeeding)

    expect(report.unmeasured).toBeUndefined()
    expect(report.failure).toContain(
      'Seed settings: tooling/claude/seeds/.claude/settings.json is not valid JSON',
    )
  })

  it('should report unmeasured for a tree with no tooling root rather than report clean', async () => {
    rmSync(join(root, 'tooling'), { force: true, recursive: true })

    expect((await measure(capabilitySeeding)).unmeasured).toContain(
      'capability seeding unverifiable',
    )
  })
})

describe('pluginBoundary', () => {
  beforeEach(() => {
    mkdirSync(join(root, 'internal'), { recursive: true })
    write('internal/secret.md', 'internal\n')
  })

  it('should pass when nothing under claude/ resolves into internal/', async () => {
    write('claude/skills/a/SKILL.md', 'body\n')

    const report = await measure(pluginBoundary)

    expect(report.failure).toBeUndefined()
    expect(report.unmeasured).toBeUndefined()
  })

  it('should report a directory symlink resolving into internal/', async () => {
    write('claude/skills/a/SKILL.md', 'body\n')
    symlinkSync(join(root, 'internal'), join(root, 'claude/skills/leak'))

    const failure = (await measure(pluginBoundary)).failure

    expect(failure).toContain(
      'claude/skills/leak/secret.md -> internal/secret.md',
    )
    expect(failure).toContain('Plugin ships toolkit-internal content:')
  })

  it('should report a file symlink under claude/standards resolving into internal/', async () => {
    write('claude/skills/a/SKILL.md', 'body\n')
    mkdirSync(join(root, 'claude/standards'), { recursive: true })
    symlinkSync(
      join(root, 'internal/secret.md'),
      join(root, 'claude/standards/secret.md'),
    )

    expect((await measure(pluginBoundary)).failure).toContain(
      'claude/standards/secret.md -> internal/secret.md',
    )
  })

  it('should terminate on a symlink loop under claude/', async () => {
    write('claude/skills/a/SKILL.md', 'body\n')
    symlinkSync(join(root, 'claude'), join(root, 'claude/skills/loop'))

    expect((await measure(pluginBoundary)).failure).toBeUndefined()
  })

  it('should step over a broken symlink', async () => {
    write('claude/skills/a/SKILL.md', 'body\n')
    symlinkSync(join(root, 'missing'), join(root, 'claude/skills/broken'))

    expect((await measure(pluginBoundary)).failure).toBeUndefined()
  })

  it('should report unmeasured for a tree with no plugin root', async () => {
    expect((await measure(pluginBoundary)).unmeasured).toContain(
      'boundary unverifiable',
    )
  })

  it('should report unmeasured for a plugin root holding no file', async () => {
    mkdirSync(join(root, 'claude/skills'), { recursive: true })

    expect((await measure(pluginBoundary)).unmeasured).toContain(
      'boundary unverifiable',
    )
  })
})

describe('seedIndependence', () => {
  const seedMd = (name: string, body: string): void =>
    write(`tooling/claude/seeds/.claude/${name}`, body)

  it('should pass on prose naming the surface root with a slash', async () => {
    seedMd('rules/a.md', 'Read canon/context/index.md first.\n')

    const report = await measure(seedIndependence)

    expect(report.failure).toBeUndefined()
    expect(report.unmeasured).toBeUndefined()
  })

  it('should report a bare mention as path:line:text', async () => {
    seedMd('rules/a.md', 'fine\nRun canon sync now.\n')

    expect((await measure(seedIndependence)).failure).toContain(
      '  tooling/claude/seeds/.claude/rules/a.md:2:Run canon sync now.',
    )
  })

  it('should report the token at the end of a line', async () => {
    seedMd('rules/a.md', 'Install canon\n')

    expect((await measure(seedIndependence)).failure).toContain(
      'rules/a.md:1:Install canon',
    )
  })

  it('should keep the header sentence and the remediation sentence', async () => {
    seedMd('rules/a.md', 'canon\n')

    const failure = (await measure(seedIndependence)).failure

    expect(failure).toContain('Seed prose cites the toolkit CLI:')
    expect(failure).toContain(
      'A scaffolded project may not have canon installed.',
    )
  })

  it('should leave a hook that calls the binary outside the walk', async () => {
    seedMd('rules/a.md', 'fine\n')
    seedMd('hooks/a.sh', 'canon index\n')

    expect((await measure(seedIndependence)).failure).toBeUndefined()
  })

  it('should walk markdown in a canon-only seed root', async () => {
    write('tooling/web/seeds/canon/a.md', 'canon sync\n')

    expect((await measure(seedIndependence)).failure).toContain(
      'tooling/web/seeds/canon/a.md:1:canon sync',
    )
  })

  it('should report unmeasured where no seed root exists', async () => {
    mkdirSync(join(root, 'tooling/base/seeds/.github'), { recursive: true })

    expect((await measure(seedIndependence)).unmeasured).toContain(
      'No seed root carries',
    )
  })

  it('should report unmeasured where the roots carry no markdown', async () => {
    seedMd('hooks/a.sh', 'canon index\n')

    expect((await measure(seedIndependence)).unmeasured).toContain(
      'carry no markdown',
    )
  })

  it('should report unmeasured where there is no tooling root', async () => {
    expect((await measure(seedIndependence)).unmeasured).toContain(
      'seed independence unverifiable',
    )
  })
})

describe('skillPaths', () => {
  const skill = (body: string): void => write('claude/skills/a/SKILL.md', body)

  it('should pass on a skill citing a target-side wiki path', async () => {
    skill('Read .claude/wiki/page.md for more.\n')

    const report = await measure(skillPaths)

    expect(report.failure).toBeUndefined()
    expect(report.unmeasured).toBeUndefined()
  })

  it('should report a wiki path after a space', async () => {
    skill('See wiki/claude/page.md.\n')

    expect((await measure(skillPaths)).failure).toContain(
      'claude/skills/a/SKILL.md:1:See wiki/claude/page.md.',
    )
  })

  it('should report a bare wiki path at line start', async () => {
    skill('ok\nwiki/index.md\n')

    expect((await measure(skillPaths)).failure).toContain(
      'claude/skills/a/SKILL.md:2:wiki/index.md',
    )
  })

  it('should keep the header sentence and the remediation sentence', async () => {
    skill('wiki/index.md\n')

    const failure = (await measure(skillPaths)).failure

    expect(failure).toContain(
      'Shipped skills reference a repo-local path that does not exist in a target project:',
    )
    expect(failure).toContain(
      'Reach supporting prose through a canon docs command, a standard cited at the flat root, or inlined text.',
    )
  })

  it('should report unmeasured where there is no skills folder', async () => {
    expect((await measure(skillPaths)).unmeasured).toContain(
      'no skill was read',
    )
  })
})
