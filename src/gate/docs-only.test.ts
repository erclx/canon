import { type SpawnSyncReturns, spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SCRIPT = join(import.meta.dirname, '../../scripts/ci/docs-only.sh')

const GIT_ENV = {
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_AUTHOR_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'test',
}

let repo: string
let output: string
let base: string

const git = (...args: string[]): string =>
  spawnSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, ...GIT_ENV },
  }).stdout.trim()

const writeFile = (path: string, content: string): void => {
  mkdirSync(dirname(join(repo, path)), { recursive: true })
  writeFileSync(join(repo, path), content)
}

const commit = (): void => {
  git('add', '-A')
  git('commit', '--allow-empty', '-q', '-m', 'change')
}

const runScript = (args: string[]): SpawnSyncReturns<string> =>
  spawnSync('bash', [SCRIPT, ...args], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_OUTPUT: output },
  })

const readOutput = (): string => readFileSync(output, 'utf8').trim()

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'docs-only-'))
  output = join(repo, '..', `${repo.split('/').pop()}.output`)
  git('init', '-q')
  writeFile('README.md', 'readme\n')
  writeFile('src/cli.ts', 'export {}\n')
  commit()
  base = git('rev-parse', 'HEAD')
})

afterEach(() => {
  rmSync(repo, { force: true, recursive: true })
  rmSync(output, { force: true })
})

describe('docs-only.sh', () => {
  it('should print code=false when every changed file is Markdown', () => {
    writeFile('README.md', 'changed\n')
    writeFile('docs/guide.md', 'new\n')
    commit()

    const result = runScript([base])

    expect(result.status).toBe(0)
    expect(readOutput()).toBe('code=false')
  })

  it('should print code=true when one changed file is not Markdown', () => {
    writeFile('README.md', 'changed\n')
    writeFile('docs/guide.md', 'new\n')
    writeFile('src/cli.ts', 'export const x = 1\n')
    commit()

    const result = runScript([base])

    expect(result.status).toBe(0)
    expect(readOutput()).toBe('code=true')
  })

  it('should print code=true when a code file is renamed to Markdown', () => {
    git('mv', 'src/cli.ts', 'src/cli.md')
    commit()

    const result = runScript([base])

    expect(result.status).toBe(0)
    expect(readOutput()).toBe('code=true')
  })

  it('should print code=true when the diff is empty', () => {
    commit()

    const result = runScript([base])

    expect(result.status).toBe(0)
    expect(readOutput()).toBe('code=true')
  })

  it('should print code=true when git diff fails', () => {
    writeFile('README.md', 'changed\n')
    commit()

    const result = runScript(['0000000000000000000000000000000000000000'])

    expect(result.status).toBe(0)
    expect(readOutput()).toBe('code=true')
  })

  it('should print code=true when no base is named', () => {
    writeFile('README.md', 'changed\n')
    commit()

    const result = runScript([])

    expect(result.status).toBe(0)
    expect(readOutput()).toBe('code=true')
  })
})
