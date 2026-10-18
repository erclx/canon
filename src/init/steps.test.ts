import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GATED_CONFIG_REL } from '@/markdown/gated'
import { type InitFlags, parseSkip } from '@/init/plan'
import type { DomainStep } from '@/init/run'
import { buildSteps } from '@/init/steps'

function flags(overrides: Partial<InitFlags> = {}): InitFlags {
  return {
    skip: parseSkip(undefined),
    ...overrides,
  }
}

/** Records the argv each step would spawn instead of spawning it. */
function recorder(): {
  readonly calls: string[][]
  readonly child: (args: readonly string[]) => () => Promise<boolean>
} {
  const calls: string[][] = []

  return {
    calls,
    child: (args) => {
      calls.push([...args])
      return async () => true
    },
  }
}

function steps(overrides: Partial<InitFlags> = {}): DomainStep[] {
  return buildSteps('../app', '/abs/app', flags(overrides), recorder().child)
}

function labels(list: readonly DomainStep[]): string[] {
  return list.map((step) => step.label)
}

describe('buildSteps', () => {
  it('should install governance when no flags are given', () => {
    const governance = steps().find((step) => step.label === 'Governance')

    expect(governance?.kind).toBe('run')
  })

  it('should install the default stack when none is named', () => {
    const { calls, child } = recorder()

    buildSteps('../app', '/abs/app', flags(), child)

    expect(calls).toContainEqual(['gov', 'install', 'base', '/abs/app'])
  })

  it('should install the named stack over the default', () => {
    const { calls, child } = recorder()

    buildSteps('../app', '/abs/app', flags({ stack: 'astro' }), child)

    expect(calls).toContainEqual(['gov', 'install', 'astro', '/abs/app'])
  })

  it('should layer the extra rules onto the stack', () => {
    const { calls, child } = recorder()

    buildSteps(
      '../app',
      '/abs/app',
      flags({ stack: 'astro', add: 'shadcn' }),
      child,
    )

    expect(calls).toContainEqual([
      'gov',
      'install',
      'astro',
      '--add',
      'shadcn',
      '/abs/app',
    ])
  })

  it('should treat an empty stack as unnamed rather than as a way to decline', () => {
    const { calls, child } = recorder()

    buildSteps('../app', '/abs/app', flags({ stack: '' }), child)

    expect(calls).toContainEqual(['gov', 'install', 'base', '/abs/app'])
  })

  it('should announce governance as a skip rather than dropping it', () => {
    const governance = steps({ skip: parseSkip('governance') }).find(
      (step) => step.label === 'Governance',
    )

    expect(governance?.kind).toBe('skip')
  })

  it('should name the recovery command in the skip notice', () => {
    const governance = steps({ skip: parseSkip('governance') }).find(
      (step) => step.label === 'Governance',
    )

    expect(governance).toMatchObject({
      kind: 'skip',
      notice:
        "Skipped: --skip governance. Run 'canon gov install base ../app' to install rules.",
    })
  })

  it('should name the stack the caller asked for in the skip notice', () => {
    const governance = steps({
      stack: 'astro',
      skip: parseSkip('governance'),
    }).find((step) => step.label === 'Governance')

    expect(governance).toMatchObject({
      kind: 'skip',
      notice:
        "Skipped: --skip governance. Run 'canon gov install astro ../app' to install rules.",
    })
  })

  it('should carry the extra rules into the skip recovery command', () => {
    const governance = steps({
      stack: 'astro',
      add: 'shadcn',
      skip: parseSkip('governance'),
    }).find((step) => step.label === 'Governance')

    expect(governance).toMatchObject({
      kind: 'skip',
      notice:
        "Skipped: --skip governance. Run 'canon gov install astro --add shadcn ../app' to install rules.",
    })
  })

  it('should not spawn a governance install when it is skipped', () => {
    const { calls, child } = recorder()

    buildSteps(
      '../app',
      '/abs/app',
      flags({ skip: parseSkip('governance') }),
      child,
    )

    expect(calls.map(([command]) => command)).not.toContain('gov')
  })

  it('should order the domains so base tooling seeds the rest', () => {
    expect(labels(steps())).toEqual([
      'Base tooling',
      'Claude workflow',
      'Governance',
      'Markdown gating',
      'Records backup',
    ])
  })

  it('should drop a skipped domain from the list entirely', () => {
    expect(labels(steps({ skip: parseSkip('records') }))).toEqual([
      'Base tooling',
      'Claude workflow',
      'Governance',
      'Markdown gating',
    ])
  })

  it('should announce records backup as a skip by default', () => {
    const records = steps().find((step) => step.label === 'Records backup')

    expect(records?.kind).toBe('skip')
  })

  it('should name the one-time setup command in the records notice', () => {
    const records = steps().find((step) => step.label === 'Records backup')

    expect(records).toMatchObject({
      kind: 'skip',
      notice: expect.stringContaining("Run 'canon records push'"),
    })
  })

  it('should drop the records step entirely when skipped', () => {
    expect(labels(steps({ skip: parseSkip('records') }))).not.toContain(
      'Records backup',
    )
  })

  it('should spawn no standards install, since the corpus reaches no target', () => {
    const recorded = recorder()
    buildSteps('../app', '/abs/app', flags(), recorded.child)

    expect(recorded.calls.map(([verb]) => verb)).not.toContain('standards')
  })

  it('should spawn no snippets install, since the corpus reaches no target', () => {
    const recorded = recorder()
    buildSteps('../app', '/abs/app', flags(), recorded.child)

    expect(recorded.calls.map(([verb]) => verb)).not.toContain('snippets')
  })
})

describe('Markdown gating step', () => {
  let target: string

  beforeEach(async () => {
    target = mkdtempSync(join(tmpdir(), 'canon-init-gating-'))
    await execa('git', ['init', '-q'], { cwd: target })
  })

  afterEach(() => {
    rmSync(target, { recursive: true, force: true })
  })

  function gatingStep(): DomainStep | undefined {
    return buildSteps(target, target, flags(), recorder().child).find(
      (step) => step.label === 'Markdown gating',
    )
  }

  async function runStep(): Promise<boolean> {
    const step = gatingStep()
    if (step?.kind !== 'run') throw new Error('No markdown gating run step')
    return step.run()
  }

  it('should gate a clean root and leave a failing one out', async () => {
    writeFileSync(join(target, 'README.md'), '# App\n\nShort.\n')
    mkdirSync(join(target, 'docs'))
    writeFileSync(
      join(target, 'docs', 'guide.md'),
      `# Guide\n\n${'A sentence long enough to count here. '.repeat(12)}\n`,
    )

    expect(await runStep()).toBe(true)

    const config = readFileSync(join(target, GATED_CONFIG_REL), 'utf8')
    expect(config).toContain('"README.md"')
    expect(config).not.toContain('"docs/"')
  })

  it('should keep an existing config untouched', async () => {
    mkdirSync(join(target, 'canon', 'config'), { recursive: true })
    writeFileSync(
      join(target, GATED_CONFIG_REL),
      '[markdown]\ngated = ["wiki/"]\n',
    )

    expect(await runStep()).toBe(true)
    expect(readFileSync(join(target, GATED_CONFIG_REL), 'utf8')).toBe(
      '[markdown]\ngated = ["wiki/"]\n',
    )
  })

  it('should skip rather than fail outside a repository, writing no config', async () => {
    const bare = mkdtempSync(join(tmpdir(), 'canon-init-bare-'))
    try {
      const step = buildSteps(bare, bare, flags(), recorder().child).find(
        (each) => each.label === 'Markdown gating',
      )
      if (step?.kind !== 'run') throw new Error('No markdown gating run step')

      expect(await step.run()).toBe(true)
      expect(existsSync(join(bare, GATED_CONFIG_REL))).toBe(false)
    } finally {
      rmSync(bare, { recursive: true, force: true })
    }
  })
})
