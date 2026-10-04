import { execaSync } from 'execa'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { auditLabels } from '@/labels/audit'
import { MAP_REL } from '@/labels/map'

const MAP = `
[domains]
cli = ["src/"]

[declined]
release-managed = ["CHANGELOG.md"]
`

function write(root: string, path: string, text: string): void {
  const full = join(root, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, text)
}

/**
 * Runs git against the fixture with the ambient environment dropped.
 *
 * Every read here goes through this rather than a bare `execaSync`. A git hook
 * exports `GIT_DIR` into the processes it runs and that variable takes
 * precedence over `-C`, so a bare call reads whichever repository invoked the
 * suite and the fixture's own history never comes back.
 */
function git(root: string, args: string[]): string {
  return execaSync('git', ['-C', root, ...args], {
    extendEnv: false,
    env: {},
  }).stdout.trimEnd()
}

describe('auditLabels', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-label-audit-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('should refuse a project that declares no map', async () => {
    await expect(auditLabels(root)).resolves.toEqual({
      kind: 'refused',
      reason: 'no-map',
    })
  })

  it('should read a changed set the caller supplies without touching git', async () => {
    write(root, MAP_REL, MAP)

    const report = await auditLabels(root, {
      paths: ['src/cli.ts', 'CHANGELOG.md', 'infra/main.tf'],
    })

    expect(report).toEqual({
      kind: 'measured',
      changed: ['src/cli.ts', 'CHANGELOG.md', 'infra/main.tf'],
      coverage: {
        labels: ['cli'],
        declined: [{ path: 'CHANGELOG.md', reason: 'release-managed' }],
        uncovered: ['infra/main.tf'],
      },
    })
  })

  describe('against a repository', () => {
    beforeEach(() => {
      git(root, ['init', '--initial-branch=main'])
      git(root, ['config', 'user.email', 'test@example.com'])
      git(root, ['config', 'user.name', 'Test'])
      write(root, MAP_REL, MAP)
      write(root, 'src/cli.ts', 'export const a = 1\n')
      git(root, ['add', '-A'])
      git(root, ['commit', '-m', 'first'])
    })

    it('should read the branch range when the caller names no set', async () => {
      const base = git(root, ['rev-parse', 'HEAD'])
      git(root, ['checkout', '-b', 'feat/x'])
      write(root, 'infra/main.tf', 'resource {}\n')
      write(root, 'src/cli/ui.ts', 'export const b = 2\n')

      const report = await auditLabels(root)

      expect(report.kind === 'measured' && report.base).toBe(base)
      expect(report.kind === 'measured' && report.coverage.uncovered).toEqual([
        'infra/main.tf',
      ])
      expect(report.kind === 'measured' && report.coverage.labels).toEqual([
        'cli',
      ])
    })

    it('should read a base the caller names', async () => {
      write(root, 'infra/main.tf', 'resource {}\n')

      const report = await auditLabels(root, { base: 'HEAD' })

      expect(report.kind === 'measured' && report.coverage.uncovered).toEqual([
        'infra/main.tf',
      ])
    })

    it('should separate a named ref that resolves to nothing from a missing trunk', async () => {
      await expect(auditLabels(root, { base: 'no-such-ref' })).resolves.toEqual(
        { kind: 'refused', reason: 'bad-base' },
      )
    })
  })
})
