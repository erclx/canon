import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const CLI = join(REPO_ROOT, 'src', 'cli.ts')
const RUN_TIMEOUT_MS = 30_000

let TARGET = ''
let SOURCE = ''

beforeEach(() => {
  TARGET = mkdtempSync(join(tmpdir(), 'canon-design-fonts-'))
  SOURCE = mkdtempSync(join(tmpdir(), 'canon-design-fonts-source-'))
})

afterEach(() => {
  rmSync(TARGET, { recursive: true, force: true })
  rmSync(SOURCE, { recursive: true, force: true })
})

/** Spawned, since a refusal reports through `process.exitCode`. */
async function runDesign(args: string[]): Promise<{
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}> {
  const result = await execa(process.execPath, [CLI, 'design', ...args], {
    cwd: TARGET,
    reject: false,
    timeout: RUN_TIMEOUT_MS,
    env: { CANON_NON_INTERACTIVE: '1' },
  })
  return {
    exitCode: result.exitCode ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

function fontFile(name: string, bytes: string): string {
  const path = join(SOURCE, name)
  writeFileSync(path, Buffer.from(bytes, 'binary'))
  return path
}

/** A spawn outlasts the default 5 s under a parallel run's load. */
describe('canon design fonts', { timeout: RUN_TIMEOUT_MS }, () => {
  it('should list a face add wrote as present', async () => {
    const font = fontFile('inter.woff2', 'wOF2fake')

    const added = await runDesign([
      'fonts',
      'add',
      font,
      '--family',
      'Inter',
      '--weight',
      '100 900',
      '--json',
    ])
    const listed = await runDesign(['fonts', 'list', '--json'])

    expect(added.exitCode).toBe(0)
    expect(JSON.parse(listed.stdout)).toMatchObject({
      ok: true,
      faces: [
        {
          family: 'Inter',
          weight: '100 900',
          style: 'normal',
          file: 'fonts/inter.woff2',
          present: true,
        },
      ],
    })
  })

  it('should refuse a file whose bytes are not the font its name claims', async () => {
    const font = fontFile('inter.woff2', 'not a font')

    const result = await runDesign([
      'fonts',
      'add',
      font,
      '--family',
      'Inter',
      '--json',
    ])

    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      reason: 'invalid-font',
    })
    expect(result.stderr).toContain('inter.woff2')
  })

  it('should list nothing in a target with no project folder', async () => {
    const result = await runDesign(['fonts', 'list', '--json'])

    expect(JSON.parse(result.stdout)).toEqual({ ok: true, faces: [] })
  })
})
