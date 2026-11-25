import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PROJECT_ROOT } from '@/roots/project'

/**
 * Lints each stack's shipped TypeScript with that stack's own oxlint config, since the root lint
 * ignores `tooling/*\/configs/**` and a synced project would otherwise be the first to find the drift.
 */

const TOOLING = join(PROJECT_ROOT, 'tooling')
const OXLINT = join(PROJECT_ROOT, 'node_modules', '.bin', 'oxlint')
const TYPESCRIPT = /\.tsx?$/

function listTypeScript(dir: string, base = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return listTypeScript(full, base)
    return TYPESCRIPT.test(entry.name) ? [full.slice(base.length + 1)] : []
  })
}

const STACKS = readdirSync(TOOLING, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((stack) =>
    existsSync(join(TOOLING, stack, 'configs', '.oxlintrc.json')),
  )

describe('stack shipped TypeScript', () => {
  it.each(STACKS)('%s passes its own lint config', (stack) => {
    const configs = join(TOOLING, stack, 'configs')
    const files = listTypeScript(configs)
    expect(files.length).toBeGreaterThan(0)

    const { status, stdout, stderr } = spawnSync(
      OXLINT,
      ['-c', '.oxlintrc.json', '--max-warnings', '0', ...files],
      { cwd: configs, encoding: 'utf8' },
    )

    expect(`${stdout}${stderr}`).not.toMatch(/error|warning/i)
    expect(status).toBe(0)
  })
})
