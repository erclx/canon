import { existsSync, mkdtempSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import { afterEach, describe, expect, it } from 'vitest'

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const CLI = join(REPO_ROOT, 'src', 'cli.ts')
const RUN_TIMEOUT_MS = 30_000

/**
 * Spawns the CLI rather than importing the action, because the refusal reports
 * through `process.exitCode` and an in-process call would set it on the test
 * runner. The refusal runs ahead of every other check and returns before the
 * dynamic import, so no case here resolves a browser.
 */
async function runCapture(args: string[]): Promise<{
  readonly exitCode: number
  readonly stderr: string
}> {
  const result = await execa(process.execPath, [CLI, 'capture', ...args], {
    cwd: REPO_ROOT,
    reject: false,
    timeout: RUN_TIMEOUT_MS,
  })
  return { exitCode: result.exitCode ?? 1, stderr: result.stderr }
}

describe('canon capture', () => {
  it('should refuse a run that names no selector', async () => {
    const result = await runCapture([])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('--selector')
  })

  it('should point at help rather than naming a selector of its own', async () => {
    const result = await runCapture([])

    expect(result.stderr).toContain('canon capture --help')
    expect(result.stderr).not.toContain('.window')
  })

  it('should refuse a missing selector ahead of a missing source', async () => {
    const result = await runCapture(['no-such-directory'])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('--selector')
    expect(result.stderr).not.toContain('not found')
  })

  let server: ReturnType<typeof createServer> | undefined

  afterEach(async () => {
    if (!server) return
    await new Promise<void>((resolvePromise) =>
      server?.close(() => resolvePromise()),
    )
    server = undefined
  })

  it(
    'should treat --out as the destination file for a URL source',
    { timeout: RUN_TIMEOUT_MS },
    async () => {
      server = createServer((_request, response) => {
        response.setHeader('content-type', 'text/html')
        response.end(
          '<html><body><div class="target" style="font-family: \'DejaVu Sans Mono\'">hi</div></body></html>',
        )
      })
      await new Promise<void>((resolvePromise) =>
        server?.listen(0, resolvePromise),
      )
      const port = (server.address() as AddressInfo).port
      const outFile = join(
        mkdtempSync(join(tmpdir(), 'canon-capture-url-')),
        'shot.png',
      )

      const result = await runCapture([
        `http://127.0.0.1:${port}/`,
        '--selector',
        '.target',
        '--out',
        outFile,
      ])

      expect(result.exitCode).toBe(0)
      expect(existsSync(outFile)).toBe(true)
    },
  )

  it('should refuse a URL source with no --out destination', async () => {
    const result = await runCapture([
      'http://127.0.0.1:1',
      '--selector',
      '.target',
    ])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('--out')
    expect(result.stderr).not.toContain('not found')
  })
})
