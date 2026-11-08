import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { scaffoldStack, suggestName } from '@/tooling/scaffold'

let root: string
let scratchBase: string

// A fixture root rather than the checkout, so each manifest's scaffold is a
// local shell command and no test reaches a package registry.
const seedStack = (stack: string, scaffold: string): void => {
  mkdirSync(join(root, 'tooling', stack), { recursive: true })
  writeFileSync(
    join(root, 'tooling', stack, 'manifest.toml'),
    `[stack]\nname = "${stack}"\nscaffold = "${scaffold}"\n`,
  )
}

const target = (name: string): string => join(root, 'projects', name)

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'scaffold-'))
  scratchBase = join(root, 'scratch')
  mkdirSync(scratchBase, { recursive: true })
})

afterEach(() => {
  rmSync(root, { force: true, recursive: true })
})

describe('scaffoldStack into an empty folder', () => {
  it('should move the starter and its detection marker into the target', async () => {
    seedStack(
      'node',
      'mkdir {{name}} && echo \'{\\"name\\":\\"{{name}}\\"}\' > {{name}}/package.json && mkdir {{name}}/src',
    )
    mkdirSync(target('my-app'), { recursive: true })

    const result = await scaffoldStack({
      root,
      stack: 'node',
      target: target('my-app'),
      scratchBase,
    })

    expect(result).toEqual({
      ok: true,
      stack: 'node',
      target: target('my-app'),
      name: 'my-app',
      files: ['package.json', 'src'],
    })
    expect(
      JSON.parse(readFileSync(join(target('my-app'), 'package.json'), 'utf8')),
    ).toEqual({ name: 'my-app' })
  })

  it('should create a target that does not exist yet', async () => {
    seedStack('go', 'mkdir {{name}} && cd {{name}} && touch go.mod')

    const result = await scaffoldStack({
      root,
      stack: 'go',
      target: target('svc'),
      scratchBase,
    })

    expect(result.ok).toBe(true)
    expect(existsSync(join(target('svc'), 'go.mod'))).toBe(true)
  })

  it('should treat a folder holding only .git as empty and keep its .git', async () => {
    seedStack(
      'py',
      'mkdir -p {{name}}/.git && touch {{name}}/.git/scaffold-head {{name}}/pyproject.toml',
    )
    mkdirSync(join(target('lib'), '.git'), { recursive: true })
    writeFileSync(join(target('lib'), '.git', 'HEAD'), 'ref: refs/heads/main\n')

    const result = await scaffoldStack({
      root,
      stack: 'py',
      target: target('lib'),
      scratchBase,
    })

    expect(result.ok && result.files).toEqual(['pyproject.toml'])
    expect(readdirSync(join(target('lib'), '.git'))).toEqual(['HEAD'])
  })

  it('should remove the scratch folder after a clean run', async () => {
    seedStack('go', 'mkdir {{name}} && cd {{name}} && touch go.mod')

    await scaffoldStack({
      root,
      stack: 'go',
      target: target('svc'),
      scratchBase,
    })

    expect(readdirSync(scratchBase)).toEqual([])
  })
})

describe('scaffoldStack refusals', () => {
  it('should refuse a folder holding a file and write nothing', async () => {
    seedStack('go', 'mkdir {{name}} && cd {{name}} && touch go.mod')
    mkdirSync(target('busy'), { recursive: true })
    writeFileSync(join(target('busy'), 'notes.txt'), 'keep me')

    const result = await scaffoldStack({
      root,
      stack: 'go',
      target: target('busy'),
      scratchBase,
    })

    expect(result.ok === false && result.reason).toBe('not-empty')
    expect(readdirSync(target('busy'))).toEqual(['notes.txt'])
    expect(readdirSync(scratchBase)).toEqual([])
  })

  it('should refuse a stack with no scaffold command by name', async () => {
    seedStack('base', '')

    const result = await scaffoldStack({
      root,
      stack: 'base',
      target: target('app'),
      scratchBase,
    })

    expect(result).toEqual({
      ok: false,
      reason: 'no-scaffold',
      message: "Stack 'base' has no scaffold command in its manifest.",
    })
  })

  it('should refuse a stack with no manifest', async () => {
    const result = await scaffoldStack({
      root,
      stack: 'nope',
      target: target('app'),
      scratchBase,
    })

    expect(result.ok === false && result.reason).toBe('no-manifest')
  })

  it('should refuse a folder name a package manager rejects and suggest one', async () => {
    seedStack('go', 'mkdir {{name}} && cd {{name}} && touch go.mod')

    const result = await scaffoldStack({
      root,
      stack: 'go',
      target: target('My App'),
      scratchBase,
    })

    expect(result.ok === false && result.reason).toBe('bad-name')
    expect(result.ok === false && result.suggested).toBe('my-app')
    expect(existsSync(target('My App'))).toBe(false)
  })

  it('should move nothing when the command fails midway and keep the scratch folder', async () => {
    seedStack('half', 'mkdir {{name}} && touch {{name}}/partial && exit 3')
    mkdirSync(target('app'), { recursive: true })

    const result = await scaffoldStack({
      root,
      stack: 'half',
      target: target('app'),
      scratchBase,
    })

    expect(result.ok === false && result.reason).toBe('scaffold-failed')
    expect(readdirSync(target('app'))).toEqual([])
    const scratch = result.ok === false ? result.scratch : undefined
    expect(
      scratch !== undefined && existsSync(join(scratch, 'app', 'partial')),
    ).toBe(true)
  })

  it('should refuse when the command exits 0 without producing its folder', async () => {
    seedStack('silent', 'true')

    const result = await scaffoldStack({
      root,
      stack: 'silent',
      target: target('app'),
      scratchBase,
    })

    expect(result.ok === false && result.reason).toBe('no-output')
    expect(existsSync(target('app'))).toBe(false)
  })
})

describe('suggestName', () => {
  it.each([
    ['My App', 'my-app'],
    ['.hidden', 'hidden'],
    ['Foo__Bar', 'foo__bar'],
    ['  ', 'app'],
  ])('should turn %j into %j', (input, expected) => {
    expect(suggestName(input)).toBe(expected)
  })
})
