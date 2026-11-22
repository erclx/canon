import { type SpawnSyncReturns, spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const TOOLING = join(import.meta.dirname, '../../tooling')
const RUNNER = join(TOOLING, 'base/configs/scripts/verify.ts')

const STACK_SCRIPTS = {
  base: ['check:format'],
  go: ['typecheck', 'lint', 'test:run'],
  php: ['typecheck', 'lint', 'test:run'],
  python: ['typecheck', 'lint', 'test:run'],
  web: ['typecheck', 'lint', 'test:run', 'build'],
} as const

const ALL_PHASES = [
  'typecheck',
  'lint',
  'check:format',
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
  // Toolchains are probed for presence only, so a passing stub stands in.
  for (const tool of [
    'uv',
    'go',
    'golangci-lint',
    'php',
    'composer',
    'shfmt',
    'shellcheck',
  ]) {
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
    // CI is cleared unless a case sets it, since GitHub Actions sets it on
    // this repository's own run and would flip every no-canon case to bunx.
    env: {
      ...process.env,
      CI: '',
      PATH: `${bin}:${process.env.PATH}`,
      ...env,
    },
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

    it('should tell the reader to sync when no package.json exists', () => {
      writeList(stack)

      expect(runVerify().stdout).toContain('Sync the stack to write one')
    })
  },
)

describe('an undeclared base phase', () => {
  it('should be skipped under a derived list', () => {
    setUp('web', STACK_SCRIPTS.web)

    const result = runVerify()

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(
      'Skipped: check:format is not declared here, so the repository root runs it',
    )
  })

  it('should fail under the base list', () => {
    setUp('base', [])

    expect(runVerify().status).toBe(1)
  })

  it('should run when a derived folder declares it', () => {
    setUp('web', [...STACK_SCRIPTS.web, ...STACK_SCRIPTS.base])

    expect(runVerify().stdout).toContain('Format check passed')
  })
})

describe('a read-only check', () => {
  it('should fail and name bun run format when check:format exits 1', () => {
    writeList('base')
    writePackage({ 'check:format': 'exit 1' })

    const result = runVerify()

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('bun run format')
  })

  it('should never run a declared format script', () => {
    writeList('base')
    writePackage({
      'check:format': 'true',
      format: `touch ${join(fixture, 'wrote')}`,
    })

    const result = runVerify()

    expect(result.status).toBe(0)
    expect(existsSync(join(fixture, 'wrote'))).toBe(false)
  })

  it('should ignore a format entry a stale verify.json still lists', () => {
    mkdirSync(join(fixture, 'scripts'), { recursive: true })
    writeFileSync(
      join(fixture, 'scripts/verify.json'),
      JSON.stringify({ require: ['format', 'check:format'] }),
    )
    writePackage(declare(['check:format']))

    expect(runVerify().status).toBe(0)
  })
})

describe('check:shell', () => {
  it('should run where package.json declares it and no list requires it', () => {
    setUp('base', [...STACK_SCRIPTS.base, 'check:shell'])

    const result = runVerify()

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Shell check passed')
  })

  it('should pass where package.json does not declare it', () => {
    setUp('base', STACK_SCRIPTS.base)

    expect(runVerify().status).toBe(0)
  })

  it('should name the shell stack rather than the root when skipped', () => {
    setUp('base', STACK_SCRIPTS.base)

    const result = runVerify()

    expect(result.stdout).toContain('canon tooling sync shell . --write')
    expect(result.stdout).not.toContain(
      'check:shell is not declared here, so the repository root runs it',
    )
  })

  it('should fail and name the install when shfmt is absent', () => {
    setUp('base', [...STACK_SCRIPTS.base, 'check:shell'])
    rmSync(join(bin, 'shfmt'))
    linkTool('bun')

    const result = run([process.execPath, RUNNER], { PATH: bin })

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('shfmt is not installed')
    expect(result.stdout).toContain('apt-get install shfmt shellcheck')
  })

  it('should not probe for shfmt where check:shell is undeclared', () => {
    setUp('base', STACK_SCRIPTS.base)
    rmSync(join(bin, 'shfmt'))
    linkTool('bun')

    expect(run([process.execPath, RUNNER], { PATH: bin }).status).toBe(0)
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

    // bun run echoes each command, so a match after the echo is the command.
    const ran = [
      ...runVerify().stdout.matchAll(/(?<!echo )phase-([a-z:]+)$/gm),
    ].map((match) => match[1])

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

// Stands in for canon or bunx, logging each call's argv on its own line and
// printing a gate record whose root is the directory it runs in, or `root`.
const argvLog = (): string => join(fixture, 'canon-argv.log')

const writeGate = (
  name: string,
  exitCode: number,
  stages: string,
  root = '$(pwd -P)',
): void => {
  const ok = exitCode === 0 ? 'true' : 'false'
  writeFileSync(
    join(bin, name),
    [
      '#!/usr/bin/env bash',
      `echo "$*" >> ${argvLog()}`,
      `printf '{"ok":${ok},"root":"%s","stages":${stages}}\\n' "${root}"`,
      `exit ${exitCode}`,
      '',
    ].join('\n'),
    { mode: 0o755 },
  )
}

const readArgv = (): string[] =>
  existsSync(argvLog())
    ? readFileSync(argvLog(), 'utf8').trim().split('\n')
    : []

const PASSED = '[{"label":"Markdown","status":"passed"}]'

describe('canon checks', () => {
  beforeEach(() => {
    setUp('web', STACK_SCRIPTS.web)
    initRepoWithMarkdown()
  })

  it('should run the gate once, nested, for its record', () => {
    writeGate('canon', 0, PASSED)

    runVerify()

    expect(readArgv()).toEqual(['gate run --nested --json'])
  })

  it('should pass and list each stage the gate passed', () => {
    writeGate('canon', 0, PASSED)

    const result = runVerify()

    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/✓.*Markdown/)
  })

  it('should log a stage the gate skipped without a pass check', () => {
    writeGate('canon', 0, '[{"label":"Context citations","status":"skipped"}]')

    const skipped = runVerify()
      .stdout.split('\n')
      .filter((line) => line.includes('Context citations: skipped'))

    expect(skipped).toHaveLength(1)
    expect(skipped.filter((line) => line.includes('✓'))).toEqual([])
  })

  it('should fail, print the stage output, and name the failed stage', () => {
    writeGate(
      'canon',
      1,
      '[{"label":"File length","status":"failed","failure":"src/a.ts is too long","output":"src/a.ts 2400 lines"}]',
    )

    const result = runVerify()

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('src/a.ts 2400 lines')
    expect(result.stdout).toContain('File length: src/a.ts is too long')
  })

  it('should fail a nonzero exit whose record names no failed stage', () => {
    writeGate('canon', 1, PASSED)

    const result = runVerify()

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('canon gate run exited 1')
  })

  it('should skip a canon whose output is no record outside CI', () => {
    writeStub('canon', 1)

    const result = runVerify()

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('canon gate run refused')
  })

  it('should fail a canon whose output is no record under CI', () => {
    writeStub('canon', 1)

    const result = runVerify({ CI: 'true' })

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('canon gate run refused')
  })

  it('should skip a canon whose gate checked another root outside CI', () => {
    writeGate('canon', 0, PASSED, '/opt/canon')

    const result = runVerify()

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(
      'checked /opt/canon rather than this project',
    )
  })

  it('should fail a canon whose gate checked another root under CI', () => {
    writeGate('canon', 0, PASSED, '/opt/canon')

    const result = runVerify({ CI: 'true' })

    expect(result.status).toBe(1)
    expect(result.stdout).toContain(
      'checked /opt/canon rather than this project',
    )
  })
})

describe('canon resolution', () => {
  const writeStamp = (version: string): void => {
    mkdirSync(join(fixture, 'canon/config'), { recursive: true })
    writeFileSync(
      join(fixture, 'canon/config/config.json'),
      JSON.stringify({ domains: { tooling: { version } } }),
    )
  }

  // Only bun, git, bash, and the stubs are on PATH, so no global canon is.
  const runWithoutCanon = (
    env: NodeJS.ProcessEnv = {},
  ): SpawnSyncReturns<string> => {
    linkTool('bun')
    linkTool('git')
    linkTool('bash')
    return run([process.execPath, RUNNER], { PATH: bin, ...env })
  }

  beforeEach(() => {
    setUp('web', STACK_SCRIPTS.web)
    initRepoWithMarkdown()
  })

  describe('under CI', () => {
    it('should run the gate through bunx pinned to the stamp', () => {
      writeStamp('5.83.0')
      writeGate('bunx', 0, PASSED)

      const result = runWithoutCanon({ CI: 'true' })

      expect(result.status).toBe(0)
      expect(readArgv()).toEqual([
        '-y @erclx/canon@5.83.0 gate run --nested --json',
      ])
    })

    it('should fail and name the gate when bunx prints no record', () => {
      writeStamp('5.83.0')
      writeStub('bunx', 1)

      const result = runWithoutCanon({ CI: 'true' })

      expect(result.status).toBe(1)
      expect(result.stdout).toContain('canon gate run refused')
    })

    it('should fail and name canon tooling sync when no stamp exists', () => {
      writeGate('bunx', 0, PASSED)

      const result = runWithoutCanon({ CI: 'true' })

      expect(result.status).toBe(1)
      expect(result.stdout).toContain('canon tooling sync')
      expect(readArgv()).toEqual([])
    })

    it('should fail rather than pass a stamp version that is not a release', () => {
      writeStamp('latest; touch pwned')
      writeGate('bunx', 0, PASSED)

      const result = runWithoutCanon({ CI: 'true' })

      expect(result.status).toBe(1)
      expect(readArgv()).toEqual([])
    })

    it('should never call bunx when canon is on PATH', () => {
      writeStamp('5.83.0')
      writeStub('bunx', 0)
      writeGate('canon', 0, PASSED)

      const result = runWithoutCanon({ CI: 'true' })

      expect(result.status).toBe(0)
      expect(readArgv()).toEqual(['gate run --nested --json'])
    })
  })

  describe('outside CI', () => {
    it('should skip the canon checks once with the install hint when no canon is on PATH', () => {
      writeStamp('5.83.0')
      writeGate('bunx', 0, PASSED)

      const result = runWithoutCanon()

      expect(result.status).toBe(0)
      expect(
        result.stdout.match(/Skipped: no canon binary on PATH/g),
      ).toHaveLength(1)
      expect(result.stdout).toContain('bun install --global @erclx/canon')
      expect(readArgv()).toEqual([])
    })

    it('should not mark the no-canon skip with a pass check', () => {
      const result = runWithoutCanon()

      const skipLines = result.stdout
        .split('\n')
        .filter((line) => line.includes('Skipped: no canon binary on PATH'))

      expect(skipLines).toHaveLength(1)
      expect(skipLines.filter((line) => line.includes('✓'))).toEqual([])
    })
  })
})

describe('the head tag check', () => {
  const writeCheck = (body: string): void => {
    writeFileSync(join(fixture, 'scripts/check-head-meta.sh'), body)
  }

  it('should fail when the installed check exits 1', () => {
    setUp('web', STACK_SCRIPTS.web)
    writeCheck('echo "index.html: missing og:image" >&2\nexit 1\n')

    const result = runVerify()

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('Head tag check failed')
  })

  it('should pass when the installed check exits 0', () => {
    setUp('web', STACK_SCRIPTS.web)
    writeCheck('exit 0\n')

    const result = runVerify()

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Head tags passed')
  })

  it('should run no head tag stage where the check is not installed', () => {
    setUp('web', STACK_SCRIPTS.web)

    expect(runVerify().stdout).not.toContain('Head tags')
  })
})

describe('nested roots', () => {
  const NESTED = 'service'

  // A --skip base subfolder: its own runner, phase list, and package.json.
  const writeNestedRoot = (scripts: Readonly<Record<string, string>>): void => {
    const dir = join(fixture, NESTED)
    mkdirSync(join(dir, 'scripts'), { recursive: true })
    copyFileSync(RUNNER, join(dir, 'scripts/verify.ts'))
    writeFileSync(
      join(dir, 'scripts/verify.json'),
      JSON.stringify({ require: ['test:run'] }),
    )
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts }))
  }

  const track = (): void => {
    spawnSync('git', ['add', '-A'], { cwd: fixture })
  }

  beforeEach(() => {
    setUp('base', STACK_SCRIPTS.base)
    spawnSync('git', ['init', '-q'], { cwd: fixture })
    writeGate('canon', 0, PASSED)
  })

  it('should run a tracked nested root after its own phases', () => {
    writeNestedRoot({ 'test:run': 'echo nested-ran' })
    track()

    const result = runVerify()

    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/Format check passed[\s\S]*nested-ran/)
  })

  it('should fail and name the folder when a nested root fails', () => {
    writeNestedRoot({ 'test:run': 'exit 1' })
    track()

    const result = runVerify()

    expect(result.status).toBe(1)
    expect(result.stdout).toContain(`${NESTED} failed`)
    expect(result.stdout).not.toContain('Verification passed')
  })

  it('should skip a nested root git does not track', () => {
    writeNestedRoot({ 'test:run': 'exit 1' })

    expect(runVerify().status).toBe(0)
  })

  it('should discover no nested roots when itself nested', () => {
    writeNestedRoot({ 'test:run': 'exit 1' })
    track()

    expect(runVerify({ VERIFY_NESTED: 'true' }).status).toBe(0)
  })

  it('should run the nested root from its own folder', () => {
    writeNestedRoot({ 'test:run': 'pwd -P' })
    track()

    expect(runVerify().stdout).toContain(`/${NESTED}\n`)
  })
})

describe('a folder with no git repository', () => {
  it('should run as before when a nested root sits on disk', () => {
    setUp('base', STACK_SCRIPTS.base)
    mkdirSync(join(fixture, 'service/scripts'), { recursive: true })
    writeFileSync(join(fixture, 'service/scripts/verify.json'), '{}')

    const result = runVerify()

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Verification passed')
  })
})
