import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const CLI = join(import.meta.dirname, '..', 'cli.ts')
const RUN_TIMEOUT_MS = 30_000

const INLINE_SCRIPT = [
  '<script is:inline>',
  ...Array.from({ length: 6 }, (_, n) => `  console.log(${n})`),
  '</script>',
  '',
].join('\n')

let target: string

beforeEach(async () => {
  target = mkdtempSync(join(tmpdir(), 'canon-code-'))
  await execa('git', ['init', '-q'], { cwd: target })
})

afterEach(() => {
  rmSync(target, { recursive: true, force: true })
})

function write(rel: string, text: string): void {
  mkdirSync(dirname(join(target, rel)), { recursive: true })
  writeFileSync(join(target, rel), text)
}

/**
 * Spawns the CLI rather than importing it, since the exit code is the
 * assertion and an in-process action would set it on the test runner.
 */
async function run(
  args: string[],
): Promise<{ exitCode: number; stdout: string }> {
  const result = await execa(process.execPath, [CLI, ...args], {
    cwd: target,
    reject: false,
    timeout: RUN_TIMEOUT_MS,
  })
  return { exitCode: result.exitCode ?? 1, stdout: result.stdout }
}

describe('code audit', () => {
  it('should exit 2 and record the block an astro file embeds', async () => {
    write('src/page.astro', `<div />\n${INLINE_SCRIPT}`)

    const result = await run(['code', 'audit', '--json'])

    expect(result.exitCode).toBe(2)
    expect(JSON.parse(result.stdout)).toMatchObject({
      files: 1,
      blocks: [
        {
          file: 'src/page.astro',
          line: 2,
          kind: 'script',
          lines: 6,
          branches: false,
        },
      ],
    })
  })

  it('should exit 0 on a tree that embeds nothing past the limit', async () => {
    write('src/a.ts', "export const a = 'b'\n")

    const result = await run(['code', 'audit', '--json'])

    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({ files: 1, blocks: [] })
  })

  it('should read only the paths it is given', async () => {
    write('src/page.astro', INLINE_SCRIPT)
    write('lib/clean.ts', "export const a = 'b'\n")

    const result = await run(['code', 'audit', 'lib', '--json'])

    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({ files: 1, blocks: [] })
  })

  it('should record a long file and function and leave the exit at 0', async () => {
    const body = '  x()\n'.repeat(120)
    write('src/long.py', 'x = 1\n'.repeat(2001))
    write('src/fn.ts', `export function big() {\n${body}}\n`)

    const result = await run(['code', 'audit', '--json'])

    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      fileLimit: 2000,
      functionCheckpoint: 100,
      longFiles: [{ file: 'src/long.py', lines: 2001 }],
      longFunctions: [{ file: 'src/fn.ts', line: 1, lines: 122, name: 'big' }],
    })
  })

  it('should read length only under the paths it is given', async () => {
    write('src/long.py', 'x = 1\n'.repeat(2001))
    write('lib/short.py', 'x = 1\n')

    const result = await run(['code', 'audit', 'lib', '--json'])

    expect(JSON.parse(result.stdout)).toMatchObject({
      longFiles: [],
      longFunctions: [],
    })
  })

  it('should refuse a path that names nothing', async () => {
    const result = await run(['code', 'audit', 'missing', '--json'])

    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({ reason: 'missing-path' })
  })

  it('should refuse a directory git does not track', async () => {
    rmSync(join(target, '.git'), { recursive: true, force: true })

    const result = await run(['code', 'audit', '--json'])

    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({ reason: 'unlisted' })
  })
})
