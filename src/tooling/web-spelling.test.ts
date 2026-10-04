import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PROJECT_ROOT } from '@/roots/project'

// A word the web layer's own configs introduce must reach a seed dictionary,
// or every child stack scaffolded from it fails Spelling on first `check`.
// The real binary runs over a copy of the layer's configs, so the seeds are
// judged the way a target judges them.
const BASE_SEEDS = join(PROJECT_ROOT, 'tooling', 'base', 'seeds')
const WEB_SEEDS = join(PROJECT_ROOT, 'tooling', 'web', 'seeds')
const WEB_CONFIGS = join(PROJECT_ROOT, 'tooling', 'web', 'configs')
const CSPELL = join(PROJECT_ROOT, 'node_modules', '.bin', 'cspell')
const DICTIONARIES = ['project-terms.txt', 'tech-stack.txt']

let target: string

function scaffoldTarget(): string {
  const dir = mkdtempSync(join(tmpdir(), 'web-spelling-'))
  copyFileSync(join(BASE_SEEDS, 'cspell.json'), join(dir, 'cspell.json'))
  mkdirSync(join(dir, '.cspell'))
  cpSync(WEB_CONFIGS, dir, { recursive: true })
  return dir
}

function writeDictionaries(seeds: string[]): void {
  for (const name of DICTIONARIES) {
    const words = seeds
      .map((seed) => join(seed, '.cspell', name))
      .filter((path) => existsSync(path))
      .map((path) => readFileSync(path, 'utf8'))
    writeFileSync(join(target, '.cspell', name), words.join('\n'))
  }
}

// The globs the base manifest's `check:spell` script passes.
function spellCheck(): number | null {
  return spawnSync(
    CSPELL,
    ['**', '.*/**', '.*', '--no-progress', '--no-summary'],
    { cwd: target, encoding: 'utf8' },
  ).status
}

describe('web layer spelling', () => {
  beforeEach(() => {
    target = scaffoldTarget()
  })

  afterEach(() => {
    rmSync(target, { force: true, recursive: true })
  })

  it('should spell clean against the base and web seeds', () => {
    writeDictionaries([BASE_SEEDS, WEB_SEEDS])

    expect(spellCheck()).toBe(0)
  })

  it('should fail against empty dictionaries', () => {
    writeDictionaries([])

    expect(spellCheck()).not.toBe(0)
  })
})
