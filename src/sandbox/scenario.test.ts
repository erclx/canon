import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  armNames,
  listScenarioFiles,
  loadScenario,
  resolveScenarioFile,
  type ScenarioDefinition,
  stageScenarioInProcess,
} from '@/sandbox/scenario'

let root: string
let tree: string
let modules: number

function write(path: string, content: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), content)
}

/** A module on disk, under a fresh name so the loader's cache never answers for an earlier test. */
function scenarioModule(body: string): string {
  modules += 1
  const path = `sandbox/cat/command-${modules}.ts`
  write(path, body)

  return join(root, path)
}

function definitionOf(arms: ScenarioDefinition['arms']): ScenarioDefinition {
  return { arms }
}

function stage(
  definition: ScenarioDefinition,
  env: NodeJS.ProcessEnv = {},
): ReturnType<typeof stageScenarioInProcess> {
  return stageScenarioInProcess(definition, {
    root,
    dir: tree,
    env: { ...process.env, CANON_NON_INTERACTIVE: '1', ...env },
    arm: undefined,
  })
}

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'sandbox-scenario-')))
  tree = join(root, 'tree')
  mkdirSync(tree)
  modules = 0
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
})

afterEach(() => {
  vi.restoreAllMocks()
  rmSync(root, { recursive: true, force: true })
})

describe('loadScenario', () => {
  it('should read the arm names in declaration order', () => {
    const file = scenarioModule(
      'export default { arms: { second: () => {}, first: () => {} } }\n',
    )

    expect(armNames(loadScenario(file))).toEqual(['second', 'first'])
  })

  it('should route no arm for a scenario holding only the default arm', () => {
    const file = scenarioModule(
      'export default { arms: { default: () => {} } }\n',
    )

    expect(armNames(loadScenario(file))).toEqual([])
  })

  it('should refuse a module declaring no arms', () => {
    const file = scenarioModule('export default { arms: {} }\n')

    expect(() => loadScenario(file)).toThrow('declares no arms')
  })

  it('should refuse a config value that is not a string', () => {
    const file = scenarioModule(
      'export default { config: { FLAG: true }, arms: { default: () => {} } }\n',
    )

    expect(() => loadScenario(file)).toThrow('not a string')
  })
})

describe('listScenarioFiles', () => {
  it('should list each stem once with its form', () => {
    write('sandbox/cat/alpha.sh', '')
    write('sandbox/cat/beta.ts', '')
    write('sandbox/cat/notes.md', '')

    const { scenarios } = listScenarioFiles(join(root, 'sandbox', 'cat'))

    expect(scenarios.map((s) => [s.command, s.kind])).toEqual([
      ['alpha', 'sh'],
      ['beta', 'ts'],
    ])
  })

  it('should report a stem present in both forms rather than list it', () => {
    write('sandbox/cat/both.sh', '')
    write('sandbox/cat/both.ts', '')

    const listing = listScenarioFiles(join(root, 'sandbox', 'cat'))

    expect(listing).toEqual({ scenarios: [], ambiguous: ['both'] })
  })
})

describe('resolveScenarioFile', () => {
  it('should refuse a stem present in both forms', () => {
    write('sandbox/cat/both.sh', '')
    write('sandbox/cat/both.ts', '')

    const resolved = resolveScenarioFile(join(root, 'sandbox'), 'cat', 'both')

    expect(resolved).toEqual({ ok: false, reason: 'ambiguous' })
  })
})

describe('stageScenarioInProcess', () => {
  it('should run the arm SANDBOX_SCENARIO names', async () => {
    const ran: string[] = []
    const definition = definitionOf({
      first: () => {
        ran.push('first')
      },
      second: (ctx) => {
        ran.push(`second:${ctx.arm}`)
      },
    })

    await stage(definition, { SANDBOX_SCENARIO: 'second' })

    expect(ran).toEqual(['second:second'])
  })

  it('should run the first arm for a headless caller naming none', async () => {
    const ran: string[] = []
    const definition = definitionOf({
      first: () => {
        ran.push('first')
      },
      second: () => {
        ran.push('second')
      },
    })

    await stage(definition, { SANDBOX_SCENARIO: '' })

    expect(ran).toEqual(['first'])
  })

  it('should refuse an unknown arm without running any', async () => {
    const definition = definitionOf({ only: () => {}, other: () => {} })

    const outcome = await stage(definition, { SANDBOX_SCENARIO: 'missing' })

    expect(outcome).toEqual({ status: 1, ending: 'exited' })
  })

  it('should run every command with the tree as its working directory', async () => {
    let cwd = ''
    const definition = definitionOf({
      default: (ctx) => {
        ctx.git('init', '-q')
        cwd = ctx.read('pwd', []).trim()
      },
    })

    await stage(definition)

    expect([cwd, existsSync(join(tree, '.git'))]).toEqual([tree, true])
  })

  it('should end on the status of a failing command', async () => {
    const definition = definitionOf({
      default: (ctx) => {
        ctx.run('sh', ['-c', 'exit 3'])
      },
    })

    const outcome = await stage(definition)

    expect(outcome).toEqual({ status: 3, ending: 'exited' })
  })

  it('should end a throwing arm as a failed stage', async () => {
    const definition = definitionOf({
      default: () => {
        throw new Error('boom')
      },
    })

    const outcome = await stage(definition)

    expect(outcome).toEqual({ status: 1, ending: 'exited' })
  })

  it('should end an arm that execs a verb as replaced', async () => {
    const definition = definitionOf({
      default: (ctx) => ctx.exec('sh', ['-c', 'exit 4']),
    })

    const outcome = await stage(definition)

    expect(outcome).toEqual({ status: 4, ending: 'replaced' })
  })

  it('should stage create fixtures and append to a file the tree holds', async () => {
    write('sandbox/fixtures/cat/cmd/arm/01/create/a.txt.fixture', 'created\n')
    write('sandbox/fixtures/cat/cmd/arm/01/append/b.txt.fixture', 'more\n')
    writeFileSync(join(tree, 'b.txt'), 'base\n')
    const definition = definitionOf({
      default: (ctx) => ctx.fixtures('cat', 'cmd', 'arm', '01'),
    })

    await stage(definition)

    expect([
      readFileSync(join(tree, 'a.txt'), 'utf8'),
      readFileSync(join(tree, 'b.txt'), 'utf8'),
    ]).toEqual(['created\n', 'base\nmore\n'])
  })

  it('should refuse an append fixture whose target the tree lacks', async () => {
    write('sandbox/fixtures/cat/cmd/arm/01/append/b.txt.fixture', 'more\n')
    const definition = definitionOf({
      default: (ctx) => ctx.fixtures('cat', 'cmd', 'arm', '01'),
    })

    const outcome = await stage(definition)

    expect([outcome.status, existsSync(join(tree, 'b.txt'))]).toEqual([
      1,
      false,
    ])
  })

  it('should set the sandbox author from the environment', async () => {
    execFileSync('git', ['init', '-q'], { cwd: tree })
    const definition = definitionOf({ default: (ctx) => ctx.identity() })

    await stage(definition, {
      SANDBOX_GIT_NAME: 'Arm Author',
      SANDBOX_GIT_EMAIL: 'arm@example.com',
    })

    const name = execFileSync('git', ['config', 'user.name'], {
      cwd: tree,
      encoding: 'utf8',
    }).trim()
    expect(name).toBe('Arm Author')
  })
})
