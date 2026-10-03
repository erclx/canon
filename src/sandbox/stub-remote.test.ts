import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createStubRemote,
  readStubManifest,
  STUB_ANCHOR_URL,
} from '@/sandbox/stub-remote'

let dir: string
let env: NodeJS.ProcessEnv

function gh(...args: string[]): { status: number | null; stdout: string } {
  const result = spawnSync('gh', args, { env, encoding: 'utf8' })

  return { status: result.status, stdout: result.stdout }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'stub-remote-'))
  env = { ...process.env, ...createStubRemote(join(dir, 'stub')) }
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('the stub gh', () => {
  it('should answer a created pull request with a URL ending in its number', () => {
    const first = gh('pr', 'create', '--title', 'one', '--head', 'feat/a')
    const second = gh('pr', 'create', '--title', 'two', '--head', 'feat/b')

    expect([first.stdout.trim(), second.stdout.trim()]).toEqual([
      expect.stringMatching(/\/pull\/1$/),
      expect.stringMatching(/\/pull\/2$/),
    ])
  })

  it('should fail an unknown subcommand and log it', () => {
    const result = gh('release', 'create', 'v1')

    expect(result.status).not.toBe(0)
    expect(readStubManifest(join(dir, 'stub')).get('stub:gh-unknown')).toBe(
      'release create v1',
    )
  })

  it('should log every call as one line of arguments', () => {
    gh('pr', 'close', '3', '-d', '-c', 'two words')

    expect(readStubManifest(join(dir, 'stub')).get('stub:gh')).toBe(
      'pr close 3 -d -c two\\ words',
    )
  })
})

describe('the stub remote', () => {
  it('should land a push in the local bare repository rather than the URL it names', () => {
    const work = join(dir, 'work')
    const git = (...args: string[]): void => {
      execFileSync('git', args, { cwd: work, env, stdio: 'ignore' })
    }
    execFileSync('git', ['init', '-q', '-b', 'main', work], { env })
    writeFileSync(join(work, 'a.txt'), 'a')
    git('add', '.')
    git('commit', '-q', '-m', 'first', '--no-verify')

    git('push', '-q', STUB_ANCHOR_URL, 'HEAD:main')

    const refs = readStubManifest(join(dir, 'stub')).get(
      'stub:canon-sandbox:refs',
    )
    expect(refs).toMatch(/^refs\/heads\/main [0-9a-f]{40}\n {2}first$/)
  })

  it('should send any real HTTPS attempt to a dead local port', () => {
    expect(env.HTTPS_PROXY).toBe('http://127.0.0.1:9')
  })

  it('should put the stub ahead of any real gh on PATH', () => {
    const resolved = execFileSync('which', ['gh'], {
      env,
      encoding: 'utf8',
    }).trim()

    expect(readFileSync(resolved, 'utf8')).toContain('stub gh')
  })
})
