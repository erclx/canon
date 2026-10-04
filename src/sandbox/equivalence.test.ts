import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildManifest,
  classifyArm,
  diffManifests,
  enumerateArms,
  MASKS,
  parseArmNames,
  runEquivalence,
  type Mask,
} from '@/sandbox/equivalence'

let root: string

function write(path: string, body: string): void {
  const full = join(root, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, body)
}

function scenario(category: string, command: string, body: string): void {
  write(`sandbox/${category}/${command}.sh`, body)
}

function initRepo(dir: string, subject: string): void {
  mkdirSync(dir, { recursive: true })
  const run = (...args: string[]): void => {
    execFileSync('git', args, { cwd: dir, stdio: 'ignore' })
  }
  run('init', '-q', '-b', 'main')
  writeFileSync(join(dir, 'a.txt'), 'a')
  run('add', '.')
  run(
    '-c',
    'user.name=t',
    '-c',
    'user.email=t@t',
    'commit',
    '-q',
    '-m',
    subject,
  )
}

function tree(name: string): string {
  const dir = join(root, name)
  mkdirSync(dir, { recursive: true })

  return dir
}

function differing(
  a: string,
  b: string,
  masks: readonly Mask[] = [],
): string[] {
  return diffManifests('x:y', buildManifest(a), buildManifest(b), masks).differs
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-equivalence-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('parseArmNames', () => {
  it('should read the arms after the prompt', () => {
    const source = '  select_or_route_scenario "Which?" "full" "small"\n'

    expect(parseArmNames(source)).toEqual(['full', 'small'])
  })

  it('should join a call continued across lines', () => {
    const source = 'select_or_route_scenario "Which?" "one" \\\n  "two"\n'

    expect(parseArmNames(source)).toEqual(['one', 'two'])
  })

  it('should find no arms in a scenario that routes none', () => {
    expect(parseArmNames('stage_setup() { :; }\n')).toEqual([])
  })
})

describe('enumerateArms', () => {
  it('should treat a scenario with no routing call as one arm-less provision', () => {
    scenario('claude', 'plain', 'stage_setup() { :; }\n')

    const { arms } = enumerateArms(root, [])

    expect(arms).toEqual([
      { category: 'claude', command: 'plain', anchor: false },
    ])
  })

  it('should tag a scenario defining use_anchor as anchor', () => {
    scenario(
      'git',
      'ship',
      'use_anchor() {\n  :\n}\nselect_or_route_scenario "Q" "a"\n',
    )

    const { arms } = enumerateArms(root, ['git'])

    expect(arms.map((a) => a.anchor)).toEqual([true])
  })

  it('should keep an arm named with a hyphen apart from the arm-less provision', () => {
    scenario('claude', 'odd', 'select_or_route_scenario "Q" "-" "two words"\n')
    scenario('claude', 'plain', 'stage_setup() { :; }\n')

    const { arms } = enumerateArms(root, [])

    expect(arms.map((a) => a.arm)).toEqual(['-', 'two words', undefined])
  })

  it('should read a TypeScript scenario arms and anchor off its module', () => {
    write(
      'sandbox/git/pr.ts',
      'export default { anchor: true, arms: { one: () => {}, two: () => {} } }\n',
    )

    const { arms } = enumerateArms(root, ['git'])

    expect(arms).toEqual([
      { category: 'git', command: 'pr', arm: 'one', anchor: true },
      { category: 'git', command: 'pr', arm: 'two', anchor: true },
    ])
  })

  it('should report a stem present in both forms', () => {
    scenario('git', 'pr', 'stage_setup() { :; }\n')
    write(
      'sandbox/git/pr.ts',
      'export default { arms: { default: () => {} } }\n',
    )

    const { arms, errors } = enumerateArms(root, [])

    expect([arms, errors]).toEqual([[], ['git:pr exists as both .sh and .ts']])
  })

  it('should narrow to one arm when the target names it', () => {
    scenario('claude', 'docs', 'select_or_route_scenario "Q" "a" "b"\n')

    const { arms } = enumerateArms(root, ['claude:docs/b'])

    expect(arms.map((a) => a.arm)).toEqual(['b'])
  })

  it('should report a declared arm the enumeration lacks', () => {
    scenario('claude', 'docs', 'select_or_route_scenario "Q" "a"\n')
    write('sandbox/fixtures/claude/docs/ghost/expect.toml', "paths = ['x']\n")

    const { errors } = enumerateArms(root, [])

    expect(errors).toEqual([
      'claude:docs declares arm "ghost" that enumeration lacks',
    ])
  })
})

describe('buildManifest', () => {
  it('should hold a file as its mode and hash', () => {
    const dir = tree('a')
    writeFileSync(join(dir, 'f'), 'x')

    expect(buildManifest(dir).get('file:f')).toMatch(/^644 [0-9a-f]{64}$/)
  })

  it('should hold a symlink as its target', () => {
    const dir = tree('a')
    symlinkSync('elsewhere', join(dir, 'l'))

    expect(buildManifest(dir).get('link:l')).toBe('elsewhere')
  })

  it('should leave a nested repository object file out', () => {
    const dir = tree('a')
    initRepo(join(dir, 'inner'), 'first')

    const keys = [...buildManifest(dir).keys()]

    expect(keys.filter((k) => k.includes('.git/'))).toEqual([])
  })
})

describe('the four deliberate differences', () => {
  it('should report a one-byte change', () => {
    const a = tree('a')
    const b = tree('b')
    writeFileSync(join(a, 'f'), 'abc')
    writeFileSync(join(b, 'f'), 'abd')

    expect(differing(a, b)).toEqual(['file:f'])
  })

  it('should report a mode-only change', () => {
    const a = tree('a')
    const b = tree('b')
    writeFileSync(join(a, 'f'), 'abc')
    writeFileSync(join(b, 'f'), 'abc')
    chmodSync(join(b, 'f'), 0o755)

    expect(differing(a, b)).toEqual(['file:f'])
  })

  it('should report a nested repository commit subject', () => {
    const a = tree('a')
    const b = tree('b')
    initRepo(join(a, 'inner'), 'one')
    initRepo(join(b, 'inner'), 'two')

    expect(differing(a, b)).toEqual(['git:inner:log'])
  })

  it('should report a narration line through the log key', () => {
    const a = new Map([['log', 'step one\nstep two']])
    const b = new Map([['log', 'step one\nstep 2']])

    expect(diffManifests('x:y', a, b, []).differs).toEqual(['log'])
  })
})

describe('diffManifests', () => {
  it('should count a path on one side only as a difference', () => {
    const a = new Map([['file:f', '644 aa']])

    expect(diffManifests('x:y', a, new Map(), []).differs).toEqual(['file:f'])
  })

  it('should hide a masked key and report that it fired', () => {
    const a = new Map([['file:m', '644 aa']])
    const b = new Map([['file:m', '644 bb']])
    const masks: Mask[] = [{ key: /^file:m$/, reason: 'test' }]

    expect(diffManifests('x:y', a, b, masks)).toEqual({
      differs: [],
      masked: [{ key: 'file:m', reason: 'test' }],
    })
  })

  it('should scope a mask to its arm', () => {
    const a = new Map([['file:m', '644 aa']])
    const b = new Map([['file:m', '644 bb']])
    const masks: Mask[] = [
      { arm: 'other:arm', key: /^file:m$/, reason: 'test' },
    ]

    expect(diffManifests('x:y', a, b, masks).differs).toEqual(['file:m'])
  })

  it('should rewrite a masked pattern and still compare the rest of the key', () => {
    const a = new Map([['log', 'pid 1 step one']])
    const b = new Map([['log', 'pid 2 step one']])
    const masks: Mask[] = [
      { key: /^log$/, replace: /pid \d+/g, reason: 'test' },
    ]

    expect(diffManifests('x:y', a, b, masks)).toEqual({
      differs: [],
      masked: [{ key: 'log', reason: 'test' }],
    })
  })

  it('should name the mask that fired when two share a key', () => {
    const a = new Map([['log', 'pid 1 fetched [3]']])
    const b = new Map([['log', 'pid 1 fetched [0]']])
    const masks: Mask[] = [
      { key: /^log$/, replace: /pid \d+/g, reason: 'pid' },
      { key: /^log$/, replace: /\[\d+\]/g, reason: 'fetch count' },
    ]

    expect(diffManifests('x:y', a, b, masks).masked).toEqual([
      { key: 'log', reason: 'fetch count' },
    ])
  })

  it('should still report a difference outside a rewritten pattern', () => {
    const a = new Map([['log', 'pid 1 step one']])
    const b = new Map([['log', 'pid 2 step two']])
    const masks: Mask[] = [
      { key: /^log$/, replace: /pid \d+/g, reason: 'test' },
    ]

    expect(diffManifests('x:y', a, b, masks).differs).toEqual(['log'])
  })

  it('should drop a masked file from the index it is staged in', () => {
    const a = new Map([
      ['file:m', '644 aa'],
      ['git:.:index', '100644 111 0\tm\n100644 333 0\tn'],
    ])
    const b = new Map([
      ['file:m', '644 bb'],
      ['git:.:index', '100644 222 0\tm\n100644 333 0\tn'],
    ])
    const masks: Mask[] = [{ key: /^file:m$/, reason: 'test' }]

    expect(diffManifests('x:y', a, b, masks).differs).toEqual([])
  })

  it('should give every shipped mask a reason', () => {
    expect(MASKS.every((m) => m.reason.length > 0)).toBe(true)
  })
})

describe('classifyArm', () => {
  it('should read matching clean runs as identical', () => {
    expect(classifyArm(0, 0, []).state).toBe('identical')
  })

  it('should read a base that fails and a head that succeeds as differs', () => {
    expect(classifyArm(1, 0, [])).toEqual({
      state: 'differs',
      differs: ['exit'],
    })
  })

  it('should read a head that fails and a base that succeeds as differs', () => {
    expect(classifyArm(0, 1, []).state).toBe('differs')
  })

  it('should read the same failure on both sides as red-on-base', () => {
    expect(classifyArm(1, 1, []).state).toBe('red-on-base')
  })

  it('should keep a manifest difference when both sides fail', () => {
    expect(classifyArm(1, 1, ['file:f']).state).toBe('differs')
  })
})

/** Process ids whose working directory sits under `dir`, read from `/proc`. */
function processesUnder(dir: string): number[] {
  return readdirSync('/proc')
    .filter((name) => /^\d+$/.test(name))
    .filter((pid) => {
      try {
        return readlinkSync(`/proc/${pid}/cwd`).startsWith(dir)
      } catch {
        return false
      }
    })
    .map(Number)
}

describe('runEquivalence', () => {
  it.skipIf(!existsSync('/proc'))(
    'should leave no process running under the kept output after a run',
    async () => {
      const out = join(root, 'kept')

      await runEquivalence({
        root: process.cwd(),
        targets: ['claude:git-worktree/cleanup'],
        base: 'HEAD',
        includeAnchor: false,
        useMasks: true,
        out,
      })

      expect(processesUnder(out)).toEqual([])
    },
    240_000,
  )

  it('should leave no fake session record in the operator config folder', async () => {
    const sessions = join(
      process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude'),
      'sessions',
    )
    const records = (): string[] =>
      existsSync(sessions)
        ? readdirSync(sessions).filter((n) => n.startsWith('sandbox-occupant-'))
        : []
    const before = records()

    await runEquivalence({
      root: process.cwd(),
      targets: ['claude:git-worktree/cleanup'],
      base: 'HEAD',
      includeAnchor: false,
      useMasks: true,
    })

    expect(records()).toEqual(before)
  }, 240_000)

  it('should never find the toolkit different from itself on one real arm', async () => {
    const record = await runEquivalence({
      root: process.cwd(),
      targets: ['claude:plan-feature/full'],
      base: 'HEAD',
      includeAnchor: false,
      useMasks: true,
    })

    // A machine without the tools the arm needs reads it red on both sides, which
    // is still no difference, so the claim holds wherever the test runs.
    expect(record.arms.map((a) => [a.arm, a.differs])).toEqual([
      ['claude:plan-feature/full', []],
    ])
  }, 240_000)
})
