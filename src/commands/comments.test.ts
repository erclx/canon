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
