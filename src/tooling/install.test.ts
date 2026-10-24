import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installDevDependencies } from '@/tooling/install'

let target: string
let server: Server | undefined

beforeEach(() => {
  target = mkdtempSync(join(tmpdir(), 'canon-install-'))
  writeFileSync(
    join(target, 'package.json'),
    '{"name":"t","version":"0.0.0"}\n',
  )
})

afterEach(() => {
  server?.close()
  server = undefined
  rmSync(target, { recursive: true, force: true })
})

const pointAt = (port: number): void => {
  writeFileSync(
    join(target, 'bunfig.toml'),
    `[install]\nregistry = "http://127.0.0.1:${port}"\n`,
  )
}

const listen = (onConnect: (socket: import('node:net').Socket) => void) =>
  new Promise<number>((resolve) => {
    server = createServer(onConnect)
    server.listen(0, '127.0.0.1', () => {
      const address = server?.address()
      resolve(typeof address === 'object' && address ? address.port : 0)
    })
  })

describe('installDevDependencies', () => {
  it('should refuse with install-timeout when the registry never answers', async () => {
    const port = await listen(() => {})
    pointAt(port)

    const started = Date.now()
    const result = await installDevDependencies(
      ['zz-nonexistent'],
      target,
      2000,
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('install-timeout')
    expect(result.message).toContain('zz-nonexistent')
    expect(Date.now() - started).toBeLessThan(15_000)
  }, 30_000)

  it('should refuse with install-failed and name the packages when the registry refuses the connection', async () => {
    const port = await listen(() => {})
    server?.close()
    server = undefined
    pointAt(port)

    const result = await installDevDependencies(
      ['zz-nonexistent'],
      target,
      30_000,
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('install-failed')
    expect(result.message).toContain('zz-nonexistent')
  }, 40_000)

  it('should refuse with install-failed when the directory does not exist', async () => {
    const result = await installDevDependencies(
      ['zz-nonexistent'],
      join(target, 'missing'),
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('install-failed')
  })
})
