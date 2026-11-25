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
import { dirname, join } from 'node:path'
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

  it('should fail naming the runner when a tracked root is gone on disk', () => {
    writeNestedRoot({ 'test:run': 'true' })
    track()
    rmSync(join(fixture, NESTED), { force: true, recursive: true })

    const result = runVerify()

    expect(result.status).toBe(1)
    expect(result.stdout).toContain(`No ${NESTED}/scripts/verify.ts here`)
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

// Stubs and logs stay out of git, so neither reads as a change.
const testLog = (): string => join(bin, 'tests.log')

const runGit = (...args: readonly string[]): SpawnSyncReturns<string> =>
  spawnSync(
    'git',
    [
      '-c',
      'user.name=fixture',
      '-c',
      'user.email=fixture@example.com',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    { cwd: fixture, encoding: 'utf8' },
  )

const writeSource = (path: string, body = ''): void => {
  mkdirSync(dirname(join(fixture, path)), { recursive: true })
  writeFileSync(join(fixture, path), body)
}

const commit = (): void => {
  runGit('add', '-A')
  runGit('commit', '-q', '--no-verify', '-m', 'change')
}

const pushTrunk = (name = 'main'): void => {
  runGit('update-ref', `refs/remotes/origin/${name}`, 'HEAD')
}

const initProject = (): void => {
  runGit('init', '-q')
  mkdirSync(join(fixture, '.git/info'), { recursive: true })
  writeFileSync(
    join(fixture, '.git/info/exclude'),
    '/bin/\n/vendor/\n/canon-argv.log\n',
  )
}

const writeTestRunner = (exitCode = 0): void => {
  writeFileSync(
    join(bin, 'log-tests'),
    `#!/usr/bin/env bash\nprintf '%s\\n' "$@" >> ${testLog()}\nexit ${exitCode}\n`,
    { mode: 0o755 },
  )
}

const readTests = (): string[] =>
  existsSync(testLog())
    ? readFileSync(testLog(), 'utf8').trim().split('\n')
    : []

const runChanged = (
  env: NodeJS.ProcessEnv = {},
  ...flags: readonly string[]
): SpawnSyncReturns<string> =>
  run([process.execPath, RUNNER, '--changed', ...flags], env)

const WEB_CHANGED = {
  ...declare(STACK_SCRIPTS.web),
  'test:run': 'exit 1',
  build: 'exit 1',
  'test:changed': 'log-tests',
}

const setUpChanged = (files: readonly string[] = []): void => {
  writeList('web')
  writePackage(WEB_CHANGED)
  writeTestRunner()
  writeGate('canon', 0, PASSED)
  initProject()
  for (const file of files) writeSource(file)
  commit()
  pushTrunk()
}

describe('changed mode', () => {
  it('should run no build and no full suite', () => {
    setUpChanged(['src/cart.ts', 'src/cart.test.ts'])
    writeSource('src/cart.ts', 'edited')

    const result = runChanged()

    expect(result.status).toBe(0)
    expect(result.stdout).not.toContain('Build passed')
    expect(result.stdout).not.toContain('Unit tests passed')
  })

  it('should run the whole-tree checks and the gate', () => {
    setUpChanged()

    const result = runChanged()

    expect(result.stdout).toContain('Typecheck passed')
    expect(result.stdout).toContain('Lint passed')
    expect(readArgv()).toContain('gate run --nested --json')
  })

  it('should fail when a test beside a changed file fails', () => {
    setUpChanged(['src/cart.ts', 'src/cart.test.ts'])
    writeTestRunner(1)
    writeSource('src/cart.ts', 'edited')

    const result = runChanged()

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('Tied tests failed')
  })

  it('should run neither check that reads the build', () => {
    setUpChanged()
    writeSource('scripts/check-head-meta.sh', 'exit 1\n')
    writeSource('scripts/check-card-exclusion.sh', 'exit 1\n')

    expect(runChanged().status).toBe(0)
  })

  it('should skip the tests with a reason when test:changed is undeclared', () => {
    setUpChanged(['src/cart.ts', 'src/cart.test.ts'])
    writePackage(declare(STACK_SCRIPTS.web))
    writeSource('src/cart.ts', 'edited')

    const result = runChanged()

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(
      'Skipped: test:changed is not declared here',
    )
  })

  it('should say no test is tied when the change reaches none', () => {
    setUpChanged(['src/cart.ts'])
    writeSource('src/cart.ts', 'edited')

    const result = runChanged()

    expect(result.stdout).toContain('Skipped: no test is tied to the change')
    expect(readTests()).toEqual([])
  })

  it('should close by naming what it left to CI', () => {
    setUpChanged()

    const result = runChanged()

    expect(result.stdout).toContain('left to CI')
    expect(result.stdout).not.toContain('Verification passed')
  })
})

describe('the tie rule', () => {
  it.each([
    ['a .test. file beside its source', 'src/cart.ts', 'src/cart.test.ts'],
    ['a .spec. file beside its source', 'src/cart.tsx', 'src/cart.spec.tsx'],
    ['a _test file beside its source', 'pkg/cart.py', 'pkg/cart_test.py'],
    ['a test_ file in another folder', 'app/tax.py', 'tests/test_tax.py'],
    ['a test beside a stylesheet', 'src/a.module.css', 'src/a.test.tsx'],
    ['a path a shell expands', 'app/(a)/$id x.ts', 'app/(a)/$id x.test.ts'],
  ])('should tie %s', (_case, source, test) => {
    setUpChanged([source, test])
    writeSource(source, 'edited')

    runChanged()

    expect(readTests()).toEqual([test])
  })

  it.each([
    ['a same-named test in another folder', 'src/a.ts', 'lib/a.test.ts'],
    ['a test whose stem only starts the same', 'src/a.ts', 'src/ab.test.ts'],
    ['a snapshot', 'src/a.ts', 'src/a.test.ts.snap'],
    ['a data file carrying a marker', 'src/a.ts', 'src/a.spec.yaml'],
  ])('should not tie %s', (_case, source, other) => {
    setUpChanged([source, other])
    writeSource(source, 'edited')

    runChanged()

    expect(readTests()).toEqual([])
  })

  it('should tie a test that itself changed', () => {
    setUpChanged(['src/cart.ts', 'src/cart.test.ts'])
    writeSource('src/cart.test.ts', 'edited')

    runChanged()

    expect(readTests()).toEqual(['src/cart.test.ts'])
  })

  it('should tie the test of a deleted source', () => {
    setUpChanged(['src/cart.ts', 'src/cart.test.ts'])
    rmSync(join(fixture, 'src/cart.ts'))

    runChanged()

    expect(readTests()).toEqual(['src/cart.test.ts'])
  })

  it('should leave out a deleted test', () => {
    setUpChanged(['src/cart.ts', 'src/cart.test.ts'])
    rmSync(join(fixture, 'src/cart.test.ts'))

    runChanged()

    expect(readTests()).toEqual([])
  })

  it('should tie the test of an untracked source', () => {
    setUpChanged()
    writeSource('src/cart.ts')
    writeSource('src/cart.test.ts')

    runChanged()

    expect(readTests()).toEqual(['src/cart.test.ts'])
  })

  it('should tie the test of a source committed since the trunk', () => {
    setUpChanged(['src/cart.ts', 'src/cart.test.ts'])
    writeSource('src/cart.ts', 'edited')
    commit()

    runChanged()

    expect(readTests()).toEqual(['src/cart.test.ts'])
  })

  it('should leave out a file only the trunk changed', () => {
    setUpChanged(['src/cart.ts', 'src/cart.test.ts'])
    writeSource('src/cart.ts', 'trunk moved')
    commit()
    pushTrunk()
    runGit('reset', '-q', '--hard', 'HEAD~1')

    const result = runChanged()

    expect(result.stdout).toContain('Skipped: no test is tied to the change')
  })

  const changeTests = (count: number): void => {
    setUpChanged()
    Array.from({ length: count }, (_, i) => writeSource(`src/t${i}.test.ts`))
  }

  it('should run 40 tied files', () => {
    changeTests(40)

    runChanged()

    expect(readTests()).toHaveLength(40)
  })

  it('should leave the tests to CI past 40 tied files', () => {
    changeTests(41)

    const result = runChanged()

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('past the 40 run here')
    expect(readTests()).toEqual([])
  })
})

describe('the trunk', () => {
  it('should read a trunk named master', () => {
    setUpChanged(['src/cart.ts', 'src/cart.test.ts'])
    runGit('update-ref', '-d', 'refs/remotes/origin/main')
    pushTrunk('master')
    writeSource('src/cart.ts', 'edited')

    runChanged()

    expect(readTests()).toEqual(['src/cart.test.ts'])
  })

  it('should read origin/HEAD ahead of origin/main', () => {
    setUpChanged(['src/cart.ts', 'src/cart.test.ts'])
    writeSource('src/cart.ts', 'edited')
    commit()
    pushTrunk('trunk')
    runGit(
      'symbolic-ref',
      'refs/remotes/origin/HEAD',
      'refs/remotes/origin/trunk',
    )

    const result = runChanged()

    expect(result.stdout).toContain('Skipped: no test is tied to the change')
  })

  it('should refuse with a fetch hint when no trunk resolves', () => {
    setUpChanged()
    runGit('update-ref', '-d', 'refs/remotes/origin/main')

    const result = runChanged()

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('git fetch origin')
  })

  it('should refuse when origin holds other branches and no trunk', () => {
    setUpChanged()
    runGit('remote', 'add', 'origin', 'https://example.com/a.git')
    runGit('update-ref', '-d', 'refs/remotes/origin/main')
    pushTrunk('feature')

    const result = runChanged()

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('git fetch origin')
  })

  it('should refuse when the trunk shares no history', () => {
    setUpChanged()
    runGit('checkout', '-q', '--orphan', 'other')
    writeSource('src/other.ts')
    commit()

    const result = runChanged()

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('No merge base with origin/main')
  })

  it('should refuse outside a git repository', () => {
    setUp('web', STACK_SCRIPTS.web)

    const result = runChanged()

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('Not a git repository')
  })

  it('should run every phase on a first push, where origin has no branch', () => {
    setUpChanged()
    runGit('remote', 'add', 'origin', 'https://example.com/a.git')
    runGit('update-ref', '-d', 'refs/remotes/origin/main')
    writePackage({ ...WEB_CHANGED, 'test:run': 'true', build: 'true' })

    const result = runChanged()

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('so every phase runs')
    expect(result.stdout).toContain('Unit tests passed')
    expect(result.stdout).toContain('Build passed')
  })
})

describe('the flags', () => {
  it('should refuse an unknown flag with the usage', () => {
    setUpChanged()

    const result = runChanged({}, '--fast')

    expect(result.status).toBe(2)
    expect(result.stderr).toContain('Usage: bun scripts/verify.ts')
  })

  it('should refuse --force without --changed', () => {
    setUpChanged()

    expect(run([process.execPath, RUNNER, '--force']).status).toBe(2)
  })
})

describe('changed mode in a nested root', () => {
  const writeService = (scripts: Readonly<Record<string, string>>): void => {
    writeSource('service/package.json', JSON.stringify({ scripts }))
    writeSource(
      'service/scripts/verify.json',
      JSON.stringify({ require: ['test:run'] }),
    )
    copyFileSync(RUNNER, join(fixture, 'service/scripts/verify.ts'))
    commit()
  }

  beforeEach(() => {
    setUpChanged(['service/cart.ts', 'service/cart.test.ts'])
  })

  it('should run its own tied tests and no full suite', () => {
    writeService({ 'test:run': 'exit 1', 'test:changed': 'log-tests' })
    writeSource('service/cart.ts', 'edited')

    const result = runChanged()

    expect(result.status).toBe(0)
    expect(readTests()).toEqual(['cart.test.ts'])
  })

  it('should skip its tests when it declares no test:changed', () => {
    writeService({ 'test:run': 'exit 1' })

    const result = runChanged()

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(
      'Skipped: test:changed is not declared here',
    )
  })

  it('should read its own folder under a hook that exports GIT_DIR', () => {
    writeService({ 'test:run': 'exit 1', 'test:changed': 'log-tests' })
    writeSource('service/cart.ts', 'edited')

    runChanged({ GIT_DIR: join(fixture, '.git') })

    expect(readTests()).toEqual(['cart.test.ts'])
  })

  it('should run in full under a plain check', () => {
    writePackage(declare(STACK_SCRIPTS.web))
    writeService({ 'test:run': 'exit 1', 'test:changed': 'log-tests' })

    const result = runVerify({ VERIFY_CHANGED: 'true' })

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('service failed')
  })
})
