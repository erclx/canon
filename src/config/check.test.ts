import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkConfigFolder } from '@/config/check'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-config-check-'))
  mkdirSync(join(root, 'canon', 'config'), { recursive: true })
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function write(name: string, text: string): void {
  writeFileSync(join(root, 'canon', 'config', name), text)
}

function kinds(): string[] {
  return checkConfigFolder(root).map(
    (finding) => `${finding.severity} ${finding.kind} ${finding.file}`,
  )
}

describe('checkConfigFolder', () => {
  it('should find nothing when the project has no config folder', () => {
    rmSync(join(root, 'canon'), { recursive: true })

    expect(checkConfigFolder(root)).toEqual([])
  })

  it('should pass every file holding known keys of the right type', () => {
    write(
      'app.toml',
      '[drive]\nlaunch = "bun run preview"\n[preview]\nport = 4173\n',
    )
    write('context.toml', 'roots = ["src"]\ngate-length = true\n')
    write('markdown.toml', '[markdown]\ngated = ["docs/"]\n')

    expect(checkConfigFolder(root)).toEqual([])
  })

  it('should skip the files canon writes itself', () => {
    write('config.json', '{"version": "1"}')
    write('baseline.json', 'not even json')

    expect(checkConfigFolder(root)).toEqual([])
  })

  it('should fail a file that does not parse', () => {
    write('context.toml', 'roots = [\n')

    expect(kinds()).toEqual(['fail unparsable canon/config/context.toml'])
  })

  it('should fail a misspelled key', () => {
    write('context.toml', 'root = ["src"]\n')

    expect(checkConfigFolder(root)).toEqual([
      {
        file: 'canon/config/context.toml',
        kind: 'unknown-key',
        severity: 'fail',
        message: 'canon/config/context.toml: root is not a key canon reads.',
      },
    ])
  })

  it('should fail a misspelled table', () => {
    write('markdown.toml', '[markdwn]\ngated = ["docs/"]\n')

    expect(kinds()).toEqual(['fail unknown-key canon/config/markdown.toml'])
  })

  it('should name the table a key belongs under when written above every header', () => {
    write('app.toml', 'launch = "bun run preview"\n[drive]\n')

    expect(checkConfigFolder(root)[0]?.message).toContain(
      'launch is not a key canon reads, and belongs under [drive]',
    )
  })

  it('should fail a value of the wrong type, naming the key path', () => {
    write('app.toml', '[preview]\nport = "4173"\n')

    expect(checkConfigFolder(root)[0]?.message).toBe(
      'canon/config/app.toml: preview.port needs an integer.',
    )
  })

  it('should fail a list holding a value that is not a string', () => {
    write('context.toml', 'roots = ["src", 3]\n')

    expect(kinds()).toEqual(['fail wrong-type canon/config/context.toml'])
  })

  it('should judge the keys inside a named target', () => {
    write('app.toml', '[drive.targets.web]\nroot = "web"\nlanch = "x"\n')

    expect(checkConfigFolder(root)[0]?.message).toContain(
      'drive.targets.web.lanch is not a key',
    )
  })

  it('should accept a label row in the table form with a color', () => {
    write(
      'pr-labels.toml',
      '[domains]\ndocs = ["docs/"]\napp = { paths = ["src/"], color = "1f6feb" }\n',
    )

    expect(checkConfigFolder(root)).toEqual([])
  })

  it('should fail a label row that is neither a list nor a table', () => {
    write('pr-labels.toml', '[domains]\ndocs = "docs/"\n')

    expect(checkConfigFolder(root)[0]?.message).toBe(
      'canon/config/pr-labels.toml: domains.docs needs a list of strings or a table.',
    )
  })

  it('should fail an unknown key inside a label row table', () => {
    write(
      'pr-labels.toml',
      '[domains]\napp = { paths = ["src/"], colour = "1f6feb" }\n',
    )

    expect(kinds()).toEqual(['fail unknown-key canon/config/pr-labels.toml'])
  })

  it('should warn on a file canon does not read', () => {
    write('nope.toml', 'a = 1\n')

    expect(kinds()).toEqual(['warn unknown-file canon/config/nope.toml'])
  })

  it('should warn on an unmoved old file, naming the migration', () => {
    write('preview.json', '{"writes": []}')

    expect(checkConfigFolder(root)).toEqual([
      {
        file: 'canon/config/preview.json',
        kind: 'unmoved',
        severity: 'warn',
        message:
          'canon/config/preview.json moved into canon/config/app.toml. Run canon migrate app-config to move it.',
      },
    ])
  })
})
