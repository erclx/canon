import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  describeBranchCli,
  installCanonShim,
} from '@/sandbox/headless/branch-cli'

const checkoutRoot = resolve(import.meta.dirname, '../../..')

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-branch-cli-test-'))
})

afterEach(() => {
  rmSync(root, { force: true, recursive: true })
})

const shimDir = (): string => {
  const dir = join(root, 'shim')
  mkdirSync(dir)

  return dir
}

describe('installCanonShim', () => {
  // The release refuses every `canon sandbox` verb, so a zero exit here is the
  // checkout answering rather than whatever `canon` the PATH holds.
  it('should reach a verb the release refuses', () => {
    const dir = shimDir()
    installCanonShim(dir, process.execPath, join(checkoutRoot, 'src/cli.ts'))

    const run = spawnSync(join(dir, 'canon'), ['sandbox', '--help'], {
      encoding: 'utf8',
    })

    expect(run.status).toBe(0)
  })

  it('should pass each argument through whole', () => {
    const echo = join(root, 'echo-args.js')
    writeFileSync(
      echo,
      'console.log(JSON.stringify(process.argv.slice(2)))\n',
      'utf8',
    )
    const dir = shimDir()
    installCanonShim(dir, process.execPath, echo)

    const run = spawnSync(
      join(dir, 'canon'),
      ['plain', 'two words', "it's $HOME", ''],
      { encoding: 'utf8' },
    )

    expect(JSON.parse(run.stdout)).toEqual([
      'plain',
      'two words',
      "it's $HOME",
      '',
    ])
  })

  it('should run a CLI whose path carries a space and a quote', () => {
    const nested = join(root, "it's a dir")
    mkdirSync(nested)
    const echo = join(nested, 'echo-args.js')
    writeFileSync(echo, 'console.log("ran")\n', 'utf8')
    const dir = shimDir()
    installCanonShim(dir, process.execPath, echo)

    const run = spawnSync(join(dir, 'canon'), [], { encoding: 'utf8' })

    expect(run.stdout.trim()).toBe('ran')
  })
})

describe('describeBranchCli', () => {
  it('should name the root it was given and the commit there', () => {
    const head = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: checkoutRoot,
      encoding: 'utf8',
    }).stdout.trim()

    expect(describeBranchCli(checkoutRoot)).toEqual({
      cli: join(checkoutRoot, 'src/cli.ts'),
      head,
    })
  })

  it('should carry a null head when git cannot read the root', () => {
    expect(describeBranchCli(root)).toEqual({
      cli: join(root, 'src/cli.ts'),
      head: null,
    })
  })

  it('should carry a null head when the root does not exist', () => {
    const missing = join(root, 'gone')

    expect(describeBranchCli(missing).head).toBeNull()
  })
})
