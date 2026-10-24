import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scanRetiredCallers } from '@/migrate/callers'

const roots: string[] = []

async function project(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'canon-callers-'))
  roots.push(root)
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await writeFile(join(root, path), content)
  }
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true })))
})

describe('scanRetiredCallers', () => {
  it('should report a spawn argument list in a script a package.json script runs', async () => {
    const root = await project({
      'package.json': JSON.stringify({
        scripts: { 'design:sync': 'bun tools/design-sync.ts' },
      }),
      'tools/design-sync.ts': [
        "import { execa } from 'execa'",
        "await execa('canon', ['canvas', 'serve'])",
      ].join('\n'),
    })

    const callers = await scanRetiredCallers(root)

    expect(callers).toEqual([
      {
        file: 'tools/design-sync.ts',
        line: 2,
        verb: 'canon canvas',
        release: '5.54.0',
        movedTo: expect.stringContaining('Frameboard'),
      },
    ])
  })

  it('should report a workflow run line', async () => {
    const root = await project({
      '.github/workflows/ci.yml': [
        'jobs:',
        '  build:',
        '    steps:',
        '      - run: canon teach up',
      ].join('\n'),
    })

    const callers = await scanRetiredCallers(root)

    expect(callers.map((c) => [c.file, c.line, c.verb])).toEqual([
      ['.github/workflows/ci.yml', 4, 'canon teach'],
    ])
  })

  it('should report a shell line, including the bunx and npx forms', async () => {
    const root = await project({
      'scripts/build.sh': [
        '#!/usr/bin/env bash',
        'bunx -y canon slides build',
        'npx canon demo record',
        'canon design render --json',
      ].join('\n'),
    })

    const callers = await scanRetiredCallers(root)

    expect(callers.map((c) => [c.line, c.verb])).toEqual([
      [2, 'canon slides'],
      [3, 'canon demo'],
      [4, 'canon design render'],
    ])
  })

  it('should report a package.json script that calls the verb itself', async () => {
    const root = await project({
      'package.json': JSON.stringify(
        { scripts: { canvas: 'canon canvas serve' } },
        null,
        2,
      ),
    })

    const callers = await scanRetiredCallers(root)

    expect(callers.map((c) => [c.file, c.line, c.verb])).toEqual([
      ['package.json', 3, 'canon canvas'],
    ])
  })

  it('should report nothing for a markdown file naming the same verb', async () => {
    const root = await project({
      'README.md': 'Run `canon canvas serve` to open the board.',
      'docs/guide.md': "execa('canon', ['canvas'])",
      'scripts/notes.md': 'canon teach up',
    })

    const callers = await scanRetiredCallers(root)

    expect(callers).toEqual([])
  })

  it('should leave a live verb and a comment line alone', async () => {
    const root = await project({
      'scripts/run.sh': [
        '# canon canvas serve was removed',
        'canon design regen',
        'canon canvases list',
      ].join('\n'),
    })

    const callers = await scanRetiredCallers(root)

    expect(callers).toEqual([])
  })

  it('should report nothing for a project with no package.json', async () => {
    const root = await project({ 'src/index.ts': 'export {}' })

    const callers = await scanRetiredCallers(root)

    expect(callers).toEqual([])
  })

  it('should report nothing for a package.json that is not JSON', async () => {
    const root = await project({ 'package.json': '{ not json' })

    const callers = await scanRetiredCallers(root)

    expect(callers).toEqual([])
  })

  it('should not follow a script path out of the project', async () => {
    const root = await project({
      'package.json': JSON.stringify({
        scripts: { x: 'bun ../outside/run.ts' },
      }),
    })

    const callers = await scanRetiredCallers(root)

    expect(callers).toEqual([])
  })
})
