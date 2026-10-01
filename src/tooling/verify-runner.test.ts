import { type SpawnSyncReturns, spawnSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const TOOLING = join(import.meta.dirname, '../../tooling')
const RUNNER = join(TOOLING, 'base/configs/scripts/verify.ts')
const WRAPPER = join(TOOLING, 'base/configs/scripts/verify.sh')

const STACK_SCRIPTS = {
  base: ['format', 'check:format', 'check:spell', 'check:shell'],
  go: ['typecheck', 'lint', 'test:run'],
  php: ['typecheck', 'lint', 'test:run'],
  python: ['typecheck', 'lint', 'test:run'],
  web: ['typecheck', 'lint', 'test:run', 'build'],
} as const

const ALL_PHASES = [
  'typecheck',
  'lint',
  'format',
  'check:format',
  'check:spell',
  'check:shell',
  'test:run',
  'build',
] as const

type Stack = keyof typeof STACK_SCRIPTS

let fixture: string
let bin: string

beforeEach(() => {
  fixture = mkdtempSync(join(tmpdir(), 'verify-runner-'))
  bin = join(fixture, 'bin')
  mkdirSync(bin)
  // Each stack's toolchain is only probed for presence, so a stub that
  // succeeds keeps the run from stopping at the probe on a machine without it.
  for (const tool of ['uv', 'go', 'golangci-lint', 'php', 'composer']) {
    writeStub(tool, 0)
  }
  mkdirSync(join(fixture, 'vendor/bin'), { recursive: true })
  writeFileSync(join(fixture, 'vendor/bin/phpunit'), '', { mode: 0o755 })
})

afterEach(() => {
  rmSync(fixture, { force: true, recursive: true })
})

const writeStub = (name: string, exitCode: number): void => {
  writeFileSync(
    join(bin, name),
    `#!/usr/bin/env bash\necho "banned character"\nexit ${exitCode}\n`,
    { mode: 0o755 },
  )
}

const writeList = (stack: Stack): void => {
  mkdirSync(join(fixture, 'scripts'), { recursive: true })
  copyFileSync(
    join(TOOLING, stack, 'configs/scripts/verify.json'),
    join(fixture, 'scripts/verify.json'),
  )
}

const writePackage = (scripts: Readonly<Record<string, string>>): void => {
  writeFileSync(join(fixture, 'package.json'), JSON.stringify({ scripts }))
}

const declare = (keys: readonly string[]): Record<string, string> =>
  Object.fromEntries(keys.map((key) => [key, 'true']))

const setUp = (stack: Stack, keys: readonly string[]): void => {
  writeList(stack)
  writePackage(declare(keys))
}

const run = (
  command: readonly string[],
  env: NodeJS.ProcessEnv = {},
): SpawnSyncReturns<string> =>
  spawnSync(command[0], command.slice(1), {
    cwd: fixture,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, ...env },
    timeout: 20_000,
  })

const runVerify = (env: NodeJS.ProcessEnv = {}): SpawnSyncReturns<string> =>
  run([process.execPath, RUNNER], env)

// The directory holding bun can hold a global canon too, so a case that needs
// a tool absent links only the tools it keeps into the fixture bin and puts
// nothing else on PATH.
const linkTool = (name: string): void => {
  const found = spawnSync('bash', ['-c', `command -v ${name}`], {
    encoding: 'utf8',
  }).stdout.trim()
  symlinkSync(found, join(bin, name))
}

const initRepoWithMarkdown = (): void => {
  spawnSync('git', ['init', '-q'], { cwd: fixture })
  writeFileSync(join(fixture, 'note.md'), '# Note\n')
}

describe.each(['base', 'go', 'php', 'python', 'web'] as const)(
  '%s verify.json',
  (stack) => {
    it('should pass when every required script is declared', () => {
      setUp(stack, STACK_SCRIPTS[stack])

      expect(runVerify().status).toBe(0)
    })

    it('should exit 1 when one required script is undeclared', () => {
      setUp(stack, STACK_SCRIPTS[stack].slice(1))

      expect(runVerify().status).toBe(1)
    })

    it('should name the undeclared required script', () => {
      setUp(stack, STACK_SCRIPTS[stack].slice(1))

      expect(runVerify().stdout).toContain(STACK_SCRIPTS[stack][0])
    })

    it('should exit 1 when no package.json exists', () => {
      writeList(stack)

      expect(runVerify().status).toBe(1)
    })

    it('should name bun init when no package.json exists', () => {
      writeList(stack)

      expect(runVerify().stdout).toContain("Run 'bun init'")
    })
  },
)

describe('an undeclared base phase', () => {
  it('should be skipped under a derived list', () => {
    setUp('web', STACK_SCRIPTS.web)

    const result = runVerify()

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Skipped: check:spell is not declared here')
  })

  it('should fail under the base list', () => {
    setUp('base', ['format', 'check:format', 'check:shell'])

    expect(runVerify().status).toBe(1)
  })

  it('should run when a derived folder declares it', () => {
    setUp('web', [...STACK_SCRIPTS.web, ...STACK_SCRIPTS.base])

    expect(runVerify().stdout).toContain('Spell check passed')
  })
})

describe('the go list', () => {
  it('should never run a declared build', () => {
    writeList('go')
    writePackage({ ...declare(STACK_SCRIPTS.go), build: 'exit 1' })

    const result = runVerify()

    expect(result.status).toBe(0)
    expect(result.stdout).not.toContain('Build')
  })
})

describe('phase order', () => {
  it('should run every declared phase in the fixed order', () => {
    writeList('web')
    writePackage(
      Object.fromEntries(ALL_PHASES.map((key) => [key, `echo phase-${key}`])),
    )

    // bun run also echoes each command it runs, so only a line the script
    // printed ends on the phase name.
    const ran = [...runVerify().stdout.matchAll(/phase-([a-z:]+)$/gm)].map(
      (match) => match[1],
    )

    expect(ran).toEqual([...ALL_PHASES])
  })

  it('should stop at a failing phase and print its output', () => {
    writeList('web')
    writePackage({
      ...declare(STACK_SCRIPTS.web),
      lint: 'echo lint-broke && exit 1',
    })

    const result = runVerify()

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('lint-broke')
    expect(result.stdout).not.toContain('Unit tests')
  })
})

describe('a missing phase list', () => {
  it('should exit 1 and name canon tooling sync', () => {
    writePackage(declare(STACK_SCRIPTS.web))

    const result = runVerify()

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('canon tooling sync')
  })
})

describe('VERIFY_NESTED', () => {
  it('should print no closing pass line when nested', () => {
    setUp('web', STACK_SCRIPTS.web)

    expect(runVerify({ VERIFY_NESTED: 'true' }).stdout).not.toContain(
      'Verification passed',
    )
  })

  it('should print the closing pass line when not nested', () => {
    setUp('web', STACK_SCRIPTS.web)

    expect(runVerify().stdout).toContain('Verification passed')
  })
})

describe('tools and preconditions', () => {
  it('should fail and name uv when the python toolchain is absent', () => {
    setUp('python', STACK_SCRIPTS.python)
    rmSync(join(bin, 'uv'))

    const result = run([process.execPath, RUNNER], { PATH: bin })

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('uv is not installed')
  })

  it('should name the go install hint when golangci-lint is absent', () => {
    setUp('go', STACK_SCRIPTS.go)
    rmSync(join(bin, 'golangci-lint'))

    const result = run([process.execPath, RUNNER], { PATH: bin })

    expect(result.stdout).toContain('go install')
  })

  it('should name composer install when vendor/bin/phpunit is missing', () => {
    setUp('php', STACK_SCRIPTS.php)
    rmSync(join(fixture, 'vendor'), { force: true, recursive: true })

    const result = runVerify()

    expect(result.status).toBe(1)
    expect(result.stdout).toContain("Run 'composer install'")
  })
})

describe('markdown bans', () => {
  it('should fail and print the findings on exit 2', () => {
    setUp('web', STACK_SCRIPTS.web)
    initRepoWithMarkdown()
    writeStub('canon', 2)

    const result = runVerify()

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('banned character')
  })

  it('should pass on exit 0', () => {
    setUp('web', STACK_SCRIPTS.web)
    initRepoWithMarkdown()
    writeStub('canon', 0)

    const result = runVerify()

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('No banned character')
  })

  it('should log a skip on exit 1', () => {
    setUp('web', STACK_SCRIPTS.web)
    initRepoWithMarkdown()
    writeStub('canon', 1)

    const result = runVerify()

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('refused and measured nothing')
  })

  it('should fail and print the findings on exit 3', () => {
    setUp('web', STACK_SCRIPTS.web)
    initRepoWithMarkdown()
    writeStub('canon', 3)

    const result = runVerify()

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('empty ban set')
  })

  it('should skip when no canon binary is on PATH', () => {
    setUp('web', STACK_SCRIPTS.web)
    initRepoWithMarkdown()
    linkTool('bun')
    linkTool('git')

    const result = run([process.execPath, RUNNER], { PATH: bin })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Skipped: no canon binary on PATH')
  })

  it('should leave CHANGELOG.md at any depth out of the audit', () => {
    setUp('web', STACK_SCRIPTS.web)
    initRepoWithMarkdown()
    mkdirSync(join(fixture, 'pkg'))
    writeFileSync(join(fixture, 'CHANGELOG.md'), '# Log\n')
    writeFileSync(join(fixture, 'pkg/CHANGELOG.md'), '# Log\n')
    writeFileSync(
      join(bin, 'canon'),
      '#!/usr/bin/env bash\necho "audited: $*"\nexit 2\n',
      { mode: 0o755 },
    )

    expect(runVerify().stdout).not.toContain('CHANGELOG')
  })
})

describe('verify.sh', () => {
  it('should delegate to the runner', () => {
    setUp('web', STACK_SCRIPTS.web)

    const result = run(['bash', WRAPPER])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Skipped: check:spell is not declared here')
  })
})
