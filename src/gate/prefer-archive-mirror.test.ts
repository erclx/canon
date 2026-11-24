import { type SpawnSyncReturns, spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SCRIPT = join(
  import.meta.dirname,
  '../../scripts/ci/prefer-archive-mirror.sh',
)

const EC2 = 'http://us-east-2.ec2.archive.ubuntu.com/ubuntu/\tpriority:1'
const ARCHIVE = 'http://archive.ubuntu.com/ubuntu/\tpriority:2'
const SECURITY = 'http://security.ubuntu.com/ubuntu/\tpriority:3'
const AZURE = 'http://azure.archive.ubuntu.com/ubuntu/\tpriority:1'

let fixture: string
let list: string

const writeList = (lines: string[]): void => {
  writeFileSync(list, `${lines.join('\n')}\n`)
}

const readList = (): string[] =>
  readFileSync(list, 'utf8').trimEnd().split('\n')

const run = (args: string[] = []): SpawnSyncReturns<string> =>
  spawnSync('bash', [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, APT_MIRRORS_FILE: list },
    timeout: 20_000,
  })

beforeEach(() => {
  fixture = mkdtempSync(join(tmpdir(), 'prefer-archive-mirror-'))
  list = join(fixture, 'apt-mirrors.txt')
})

afterEach(() => {
  rmSync(fixture, { force: true, recursive: true })
})

describe('prefer-archive-mirror.sh', () => {
  it('should remove the ec2 line and keep the rest in order', () => {
    writeList([EC2, ARCHIVE, SECURITY])

    const result = run()

    expect(result.status).toBe(0)
    expect(readList()).toEqual([ARCHIVE, SECURITY])
  })

  it('should print the list it leaves', () => {
    writeList([EC2, ARCHIVE])

    const result = run()

    expect(result.stdout).toContain('archive.ubuntu.com')
    expect(result.stdout).not.toContain('ec2')
  })

  it('should leave a list with no ec2 line unchanged', () => {
    writeList([AZURE, ARCHIVE, SECURITY])

    const result = run()

    expect(result.status).toBe(0)
    expect(readList()).toEqual([AZURE, ARCHIVE, SECURITY])
  })

  it('should match an ec2 line separated by spaces rather than a tab', () => {
    writeList([
      'http://eu-west-1.ec2.archive.ubuntu.com/ubuntu/ priority:1',
      ARCHIVE,
    ])

    run()

    expect(readList()).toEqual([ARCHIVE])
  })

  it('should leave a list holding only the ec2 line', () => {
    writeList([EC2])

    const result = run()

    expect(result.status).toBe(0)
    expect(readList()).toEqual([EC2])
  })

  it('should drop every line above archive.ubuntu.com with --drop-first', () => {
    writeList([AZURE, ARCHIVE, SECURITY])

    const result = run(['--drop-first'])

    expect(result.status).toBe(0)
    expect(readList()).toEqual([ARCHIVE, SECURITY])
  })

  it('should leave a list with no archive.ubuntu.com line alone with --drop-first', () => {
    writeList([AZURE, SECURITY])

    run(['--drop-first'])

    expect(readList()).toEqual([AZURE, SECURITY])
  })

  it('should not take the ec2 or azure host for archive.ubuntu.com', () => {
    writeList([EC2, AZURE, SECURITY])

    run(['--drop-first'])

    expect(readList()).toEqual([EC2, AZURE, SECURITY])
  })

  it('should exit 0 and say so when the list is missing', () => {
    const result = run()

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('No apt mirror list')
    expect(existsSync(list)).toBe(false)
  })
})
