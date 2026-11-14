import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const CLI = join(REPO_ROOT, 'src', 'cli.ts')
const SETUP_TIMEOUT_MS = 60_000
const RUN_TIMEOUT_MS = 30_000
const RULE_PATH = '.claude/rules/code-comments.md'

const RULE = [
  '# Code comment standards',
  '',
  '## Degradation vocabulary',
  '',
  '- Markers: `TODO`',
  '',
].join('\n')

interface ScanRecord {
  readonly path: string
  readonly vocabulary: { readonly source: string } | null
}

let REPO: string
let SCRATCH: string

async function scan(cwd: string, ...args: string[]): Promise<ScanRecord> {
  const { stdout } = await execa(
    'bun',
    [CLI, 'comments', 'scan', ...args, '--json'],
    {
      cwd,
      reject: false,
    },
  )
  const line = stdout.split('\n').findLast((row) => row.startsWith('{'))
  return JSON.parse(line ?? '{}') as ScanRecord
}

beforeAll(async () => {
  REPO = await realpath(await mkdtemp(join(tmpdir(), 'canon-comments-repo-')))
  SCRATCH = await realpath(
    await mkdtemp(join(tmpdir(), 'canon-comments-scratch-')),
  )

  await mkdir(join(REPO, '.claude', 'rules'), { recursive: true })
  await mkdir(join(REPO, 'src'), { recursive: true })
  await writeFile(join(REPO, RULE_PATH), RULE)
  await writeFile(
    join(REPO, 'src', 'a.ts'),
    '// TODO later\nexport const a = 1\n',
  )
  await execa('git', ['init', '-q'], { cwd: REPO })

  await mkdir(join(SCRATCH, 'src'), { recursive: true })
  await writeFile(join(SCRATCH, 'src', 'a.ts'), 'export const a = 1\n')
}, SETUP_TIMEOUT_MS)

afterAll(async () => {
  await rm(REPO, { recursive: true, force: true })
  await rm(SCRATCH, { recursive: true, force: true })
})

describe('canon comments scan vocabulary root', () => {
  it(
    'should load the sweep when a path argument sits inside the repository',
    async () => {
      const record = await scan(REPO, 'src')

      expect(record.vocabulary?.source).toBe(RULE_PATH)
    },
    RUN_TIMEOUT_MS,
  )

  it(
    'should report the same source for a path scan as for a bare scan',
    async () => {
      const bare = await scan(REPO)
      const withPath = await scan(REPO, 'src')

      expect(withPath.vocabulary?.source).toBe(bare.vocabulary?.source)
    },
    RUN_TIMEOUT_MS,
  )

  it(
    'should load the scanned repository rules, not the working directory ones, for an outside path',
    async () => {
      const record = await scan(SCRATCH, join(REPO, 'src'))

      expect(record.vocabulary?.source).toBe(RULE_PATH)
    },
    RUN_TIMEOUT_MS,
  )

  it(
    'should keep the scanned path in the record and skip the sweep outside any repository',
    async () => {
      const target = join(SCRATCH, 'src')
      const record = await scan(REPO, target)

      expect(record.path).toBe(target)
      expect(record.vocabulary).toBeNull()
    },
    RUN_TIMEOUT_MS,
  )
})

describe('canon comments scan block record', () => {
  let TREE: string

  beforeAll(async () => {
    TREE = await realpath(await mkdtemp(join(tmpdir(), 'canon-comments-caps-')))
    const git = (...args: string[]) =>
      execa('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
        cwd: TREE,
      })
    const inBody = Array.from({ length: 11 }, (_, i) => `  // line ${i}`)
    await git('init', '-q')
    await writeFile(
      join(TREE, 'a.ts'),
      ['function a() {', ...inBody, '  return 1', '}', ''].join('\n'),
    )
    await git('add', '.')
    await git('commit', '-qm', 'one')
    await writeFile(join(TREE, 'b.ts'), 'export const b = 1\n')
    await git('add', '.')
    await git('commit', '-qm', 'two')
  }, SETUP_TIMEOUT_MS)

  afterAll(async () => {
    await rm(TREE, { recursive: true, force: true })
  })

  it(
    'should carry the caps and the block lists on the snapshot and not on a trend point',
    async () => {
      const record = (await scan(
        TREE,
        '--since',
        'HEAD~1',
        '--languages',
        'ts',
      )) as unknown as {
        headBlockCap: number
        bodyBlockCap: number
        snapshot: Record<string, unknown>[]
        trend: { languages: Record<string, unknown>[] }[]
      }

      expect([record.headBlockCap, record.bodyBlockCap]).toEqual([12, 2])
      expect(Object.keys(record)).not.toContain('fileLongBlockCap')
      expect(Object.keys(record)).not.toContain('longBlockFloor')
      expect(record.snapshot[0]?.headBlocks).toEqual([])
      expect(record.snapshot[0]?.bodyBlocks).toEqual([
        { file: 'a.ts', line: 2, lines: 11 },
      ])
      expect(record.trend.length).toBeGreaterThan(0)
      for (const point of record.trend) {
        expect(Object.keys(point.languages[0] ?? {})).not.toContain('blocks')
        expect(Object.keys(point.languages[0] ?? {})).not.toContain(
          'bodyBlocks',
        )
      }
    },
    RUN_TIMEOUT_MS,
  )
})

describe('canon comments scan python', () => {
  let TREE: string

  beforeAll(async () => {
    TREE = await realpath(await mkdtemp(join(tmpdir(), 'canon-comments-py-')))
    const docstring = [
      'def a():',
      '    """Summary.',
      '',
      '    More.',
      '    """',
      '    return 1',
      '',
    ]
    await writeFile(join(TREE, 'a.py'), docstring.join('\n'))
    await writeFile(join(TREE, 'b.py'), '# open\nx = (\n')
  }, SETUP_TIMEOUT_MS)

  afterAll(async () => {
    await rm(TREE, { recursive: true, force: true })
  })

  it(
    'should accept py and carry its entry with the file the reader refused',
    async () => {
      const record = (await scan(TREE, '--languages', 'py')) as unknown as {
        snapshot: Record<string, unknown>[]
      }

      expect(record.snapshot).toHaveLength(1)
      expect(record.snapshot[0]).toMatchObject({
        language: 'py',
        files: 2,
        commentLines: 5,
        docBlocks: 1,
        inlineComments: 1,
        unreadFiles: [{ file: 'b.py', line: 2, reason: 'unclosed-bracket' }],
      })
    },
    RUN_TIMEOUT_MS,
  )

  it(
    'should read py in the default language set',
    async () => {
      const record = (await scan(TREE)) as unknown as {
        snapshot: { language: string }[]
      }

      expect(record.snapshot.map((entry) => entry.language)).toEqual([
        'ts',
        'sh',
        'py',
      ])
    },
    RUN_TIMEOUT_MS,
  )
})
