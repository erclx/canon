import { execFile } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'

const SCRIPT = join(
  import.meta.dirname,
  '../../tooling/cloudflare/configs/scripts/smoke-check.sh',
)

let server: Server | undefined

// Async, since a blocking spawn would stall the server answering it.
const run = async (...args: string[]): Promise<number> => {
  try {
    await promisify(execFile)('bash', [SCRIPT, ...args], {
      env: { ...process.env, SMOKE_ATTEMPTS: '2', SMOKE_DELAY: '0' },
    })
    return 0
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? error.code
        : undefined
    return typeof code === 'number' ? code : -1
  }
}

const serve = async (status: number): Promise<string> => {
  server = createServer((_, response) => {
    response.writeHead(status).end()
  })
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return `http://127.0.0.1:${port}/health`
}

afterEach(async () => {
  await new Promise((resolve) => server?.close(resolve) ?? resolve(undefined))
  server = undefined
})

describe('smoke-check.sh', () => {
  it('passes on a healthy response', async () => {
    const url = await serve(200)

    expect(await run(url)).toBe(0)
  })

  it('fails on a server error', async () => {
    const url = await serve(500)

    expect(await run(url)).not.toBe(0)
  })

  it('fails when nothing answers', async () => {
    expect(await run('http://127.0.0.1:9/health')).not.toBe(0)
  })

  it('refuses a missing URL', async () => {
    expect(await run()).toBe(2)
  })

  it('refuses a placeholder left unfilled', async () => {
    expect(await run('REPLACE_WITH_HEALTH_URL')).toBe(2)
  })
})
