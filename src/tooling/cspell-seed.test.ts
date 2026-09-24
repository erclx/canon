import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PROJECT_ROOT } from '@/project-root'

// cspell reads `ignorePaths` relative to the config's own folder with glob
// semantics of its own, so the seed is checked by the real binary rather than
// by matching the pattern string.
const SEED = join(PROJECT_ROOT, 'tooling', 'base', 'seeds', 'cspell.json')
const CSPELL = join(PROJECT_ROOT, 'node_modules', '.bin', 'cspell')
const UNKNOWN_WORD = 'WCAG'

let target: string

function scaffoldTarget(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cspell-seed-'))
  copyFileSync(SEED, join(dir, 'cspell.json'))
  mkdirSync(join(dir, '.cspell'))
  writeFileSync(join(dir, '.cspell', 'project-terms.txt'), '')
  writeFileSync(join(dir, '.cspell', 'tech-stack.txt'), '')
  return dir
}

function writeRule(subdir: string): void {
  const dir = join(target, '.claude', 'rules', subdir)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'rule.md'), `# Rule\n\n- Meet ${UNKNOWN_WORD} AA.\n`)
}

// The globs the base manifest's `check:spell` script passes, so the fixture
// reads every file a target's own run reads, the seed config included.
function spellCheck(): number | null {
  return spawnSync(
    CSPELL,
    ['**', '.*/**', '.*', '--no-progress', '--no-summary'],
    { cwd: target, encoding: 'utf8' },
  ).status
}

describe('base cspell seed', () => {
  beforeEach(() => {
    target = scaffoldTarget()
  })

  afterEach(() => {
    rmSync(target, { force: true, recursive: true })
  })

  it('should skip rules the toolkit installs under .claude/rules/canon/', () => {
    writeRule('canon/ui')

    expect(spellCheck()).toBe(0)
  })

  it('should check rules the target writes under .claude/rules/project/', () => {
    writeRule('project/ui')

    expect(spellCheck()).not.toBe(0)
  })
})
