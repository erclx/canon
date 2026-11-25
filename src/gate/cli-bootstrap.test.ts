import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { cliBootstrap } from '@/gate/cli-bootstrap'

describe('cliBootstrap', () => {
  let root: string

  const write = (path: string, content: string): void => {
    const full = join(root, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-cli-bootstrap-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('should list the entry and what it loads outside a command', () => {
    write(
      'src/cli.ts',
      "import { register } from '@/commands/take'\nimport { ui } from '@/cli/ui'\n",
    )
    write('src/commands/take.ts', "import { film } from '@/take/film'\n")
    write('src/take/film.ts', 'export const film = 1\n')
    write('src/cli/ui.ts', "import { root } from '../roots/project'\n")
    write('src/roots/project.ts', 'export const root = 1\n')

    expect(cliBootstrap(root)).toEqual([
      'src/cli.ts',
      'src/cli/ui.ts',
      'src/roots/project.ts',
    ])
  })

  it('should follow a dynamic import and an index file', () => {
    write('src/cli.ts', "const run = await import('@/cli/lazy')\n")
    write('src/cli/lazy.ts', "import { x } from '@/shared'\n")
    write('src/shared/index.ts', 'export const x = 1\n')

    expect(cliBootstrap(root)).toEqual([
      'src/cli.ts',
      'src/cli/lazy.ts',
      'src/shared/index.ts',
    ])
  })

  it('should throw when a local import does not resolve', () => {
    write('src/cli.ts', "import { a } from '@/cli/missing'\n")

    expect(() => cliBootstrap(root)).toThrow('@/cli/missing')
  })

  it('should throw when the entry cannot be read', () => {
    expect(() => cliBootstrap(root)).toThrow()
  })
})
