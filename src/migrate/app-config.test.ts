import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execaSync } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { APP_TABLES, readAppTable, readLegacyTable } from '@/config/app'
import {
  applyAppConfig,
  planAppConfig,
  scanAppConfigCitations,
} from '@/migrate/app-config'

const FIXTURES = join(import.meta.dirname, 'fixtures', 'app-config')

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-migrate-app-config-'))
  mkdirSync(join(root, 'canon', 'config'), { recursive: true })
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function write(name: string, text: string): void {
  writeFileSync(join(root, 'canon', 'config', name), text)
}

function config(name: string): string {
  return join(root, 'canon', 'config', name)
}

function planned(): Extract<
  ReturnType<typeof planAppConfig>,
  { kind: 'planned' }
> {
  const plan = planAppConfig(root)
  if (plan.kind !== 'planned') throw new Error(`refused: ${plan.message}`)
  return plan
}

function valueOf(read: ReturnType<typeof readAppTable>): unknown {
  return read.kind === 'table' ? read.value : undefined
}

describe('planAppConfig on real configs', () => {
  it.each(['frameboard', 'lichtrinh'])(
    'should move every %s table with each key reading back equal',
    (project) => {
      cpSync(join(FIXTURES, project), join(root, 'canon', 'config'), {
        recursive: true,
      })
      const before = Object.fromEntries(
        APP_TABLES.map((table) => [
          table,
          valueOf(readLegacyTable(root, table)),
        ]),
      )

      applyAppConfig(root, planned())

      const after = Object.fromEntries(
        APP_TABLES.map((table) => [table, valueOf(readAppTable(root, table))]),
      )
      expect(after).toEqual(before)
      expect(
        APP_TABLES.map((table) => readAppTable(root, table)).filter(
          (read) =>
            read.kind === 'table' && read.source !== 'canon/config/app.toml',
        ),
      ).toEqual([])
    },
  )

  it('should move frameboard in table order, keeping the comments beside their keys', () => {
    cpSync(join(FIXTURES, 'frameboard'), join(root, 'canon', 'config'), {
      recursive: true,
    })

    const plan = planned()

    expect(plan.moves).toEqual([
      { table: 'drive', from: 'canon/config/app-drive.toml' },
      { table: 'preview', from: 'canon/config/preview.json' },
      { table: 'health', from: 'canon/config/local.toml' },
      { table: 'painted', from: 'canon/config/painted.json' },
    ])
    expect(plan.text).toContain(
      '[health]\n# canon pr local probes this path before it posts a preview link.\npaths = ["/api/health"]\n',
    )
    expect(plan.text).toContain(
      'exclude = ["src/client/**/fixtures.ts", "src/client/**/*-harness.tsx"]',
    )
  })

  it('should remove each moved file and leave nothing to move on a second run', () => {
    cpSync(join(FIXTURES, 'frameboard'), join(root, 'canon', 'config'), {
      recursive: true,
    })

    applyAppConfig(root, planned())

    expect(
      ['app-drive.toml', 'local.toml', 'painted.json', 'preview.json'].filter(
        (name) => existsSync(config(name)),
      ),
    ).toEqual([])
    expect(planned().moves).toEqual([])
  })
})

describe('planAppConfig text moves', () => {
  it('should nest target tables under [drive] and leave a multi-line launch alone', () => {
    write(
      'app-drive.toml',
      [
        '# How the drive starts the app.',
        'launch = """',
        'bun run build',
        '[not-a-header]',
        '"""',
        'personas = [',
        '  ["nested"],',
        ']',
        '',
        '# The landing page.',
        '[targets.web]',
        'root = "web" # its own folder',
        '',
      ].join('\n'),
    )
    const before = valueOf(readLegacyTable(root, 'drive'))

    const plan = planned()

    expect(plan.text).toContain('[not-a-header]\n')
    expect(plan.text).toContain('  ["nested"],\n')
    expect(plan.text).toContain(
      '# The landing page.\n[drive.targets.web]\nroot = "web" # its own folder\n',
    )
    expect(
      (Bun.TOML.parse(plan.text) as Record<string, unknown>).drive,
    ).toEqual(before)
  })

  it('should rename only the top-level health key in local.toml', () => {
    write('local.toml', 'health = ["/ready"]\n\n[extra]\nhealth = 1\n')

    const plan = planned()

    expect(plan.text).toBe(
      '[health]\npaths = ["/ready"]\n\n[health.extra]\nhealth = 1\n',
    )
  })

  it('should write painted.json keys under their new names', () => {
    write(
      'painted.json',
      '{"painted":["a/**"],"unpainted":["b/**"],"reelInputs":["bun.lock"]}',
    )

    expect(planned().text).toBe(
      '[painted]\npaths = ["a/**"]\nexclude = ["b/**"]\nreel-inputs = ["bun.lock"]\n',
    )
  })

  it('should move device-classes.toml as written', () => {
    const text =
      '# Why the board is desktop.\n[device-classes]\ndefault = ["desktop"]\nwhy = "A canvas"\n'
    write('device-classes.toml', text)

    expect(planned().text).toBe(text)
  })

  it('should append to an existing app.toml, keeping its text', () => {
    write('app.toml', '# Ours.\n[drive]\nlaunch = "bun run dev"\n')
    write('preview.json', '{"writes":["data"],"port":4321}')

    expect(planned().text).toBe(
      '# Ours.\n[drive]\nlaunch = "bun run dev"\n\n[preview]\nwrites = ["data"]\nport = 4321\n',
    )
  })

  it('should keep the mode of an existing app.toml', () => {
    write('app.toml', '[drive]\nlaunch = "x"\n')
    execaSync('chmod', ['600', config('app.toml')])
    write('preview.json', '{"writes":["data"]}')

    applyAppConfig(root, planned())

    expect(
      (
        execaSync('stat', ['-c', '%a', config('app.toml')]).stdout as string
      ).trim(),
    ).toBe('600')
  })

  it('should plan nothing for a project holding no old file', () => {
    expect(planned()).toEqual({ kind: 'planned', moves: [], text: '' })
  })
})

describe('planAppConfig refusals', () => {
  it.each<[string, Record<string, string>, string]>([
    [
      'a table app.toml already holds',
      {
        'app.toml': '[preview]\nwrites = ["a"]\n',
        'preview.json': '{"writes":["b"]}',
      },
      'table-exists',
    ],
    [
      'an app.toml that does not parse',
      { 'app.toml': '[drive\n', 'preview.json': '{"writes":["b"]}' },
      'unparsable-app-config',
    ],
    [
      'an old TOML file that does not parse',
      { 'local.toml': 'health = [\n' },
      'unparsable-source',
    ],
    [
      'an old JSON file that is not an object',
      { 'preview.json': '["a"]' },
      'unparsable-source',
    ],
    [
      'a JSON null',
      { 'preview.json': '{"writes":["a"],"env":null}' },
      'unconvertible',
    ],
  ])('should refuse %s and write nothing', (_label, files, reason) => {
    for (const [name, text] of Object.entries(files)) write(name, text)

    expect(planAppConfig(root)).toMatchObject({ kind: 'refused', reason })
  })
})

describe('scanAppConfigCitations', () => {
  function git(...args: string[]): void {
    execaSync('git', ['-C', root, ...args], {
      env: {
        GIT_AUTHOR_NAME: 't',
        GIT_AUTHOR_EMAIL: 't@t',
        GIT_COMMITTER_NAME: 't',
        GIT_COMMITTER_EMAIL: 't@t',
      },
    })
  }

  it('should list each tracked line naming an old file, the old files left out', async () => {
    git('init', '-q')
    write('preview.json', '{"writes":["a"]}')
    writeFileSync(
      join(root, 'README.md'),
      '# r\n\nSee canon/config/preview.json.\n',
    )
    writeFileSync(join(root, 'notes.md'), 'nothing here\n')
    git('add', '.')

    expect(await scanAppConfigCitations(root)).toEqual([
      { path: 'README.md', line: 3 },
    ])
  })

  it('should read a tree outside git as unread rather than clean', async () => {
    expect(await scanAppConfigCitations(root)).toBeUndefined()
  })
})
