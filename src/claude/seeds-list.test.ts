import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listSeeds, readSeedContents } from '@/claude/seeds-list'

let root: string

function seedFile(relPath: string, body: string): void {
  const path = join(root, 'tooling', 'claude', 'seeds', relPath)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, body)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-seeds-list-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('listSeeds', () => {
  it('should map each seed to its name, source, and install target', () => {
    seedFile(join('canon', 'ARCHITECTURE.md'), 'Architecture')

    expect(listSeeds(root)).toEqual([
      {
        name: 'ARCHITECTURE.md',
        source: join('tooling', 'claude', 'seeds', 'canon', 'ARCHITECTURE.md'),
        target: join('canon', 'ARCHITECTURE.md'),
        src: join(
          root,
          'tooling',
          'claude',
          'seeds',
          'canon',
          'ARCHITECTURE.md',
        ),
      },
    ])
  })

  it('should list the context seed the bash listing never reported', () => {
    seedFile(join('canon', 'context', 'index.md'), 'Context')

    expect(listSeeds(root).map((entry) => entry.target)).toEqual([
      join('canon', 'context', 'index.md'),
    ])
  })

  it('should list hooks, decisions, diagrams, tasks, and wireframes alongside the claude root level', () => {
    seedFile(join('.claude', 'settings.json'), '{}')
    seedFile(join('.claude', 'hooks', 'scratch-guard.sh'), 'Hook')
    seedFile(join('canon', 'decisions', 'index.md'), 'Decisions')
    seedFile(join('.claude', 'diagrams', 'index.md'), 'Diagrams')
    seedFile(join('.claude', 'tasks', 'index.md'), 'Tasks')
    seedFile(join('canon', 'wireframes', 'index.md'), 'Wireframes')

    expect(listSeeds(root).map((entry) => entry.name)).toEqual([
      'settings.json',
      'hooks/scratch-guard.sh',
      'decisions/index.md',
      'diagrams/index.md',
      'tasks/index.md',
      'wireframes/index.md',
    ])
  })

  it('should place the project-level CLAUDE.md last', () => {
    seedFile(join('canon', 'ARCHITECTURE.md'), 'Architecture')
    seedFile('CLAUDE.md', 'Project')

    expect(listSeeds(root).map((entry) => entry.target)).toEqual([
      join('canon', 'ARCHITECTURE.md'),
      'CLAUDE.md',
    ])
  })

  it('should return an empty list when no seeds directory exists', () => {
    expect(listSeeds(root)).toEqual([])
  })
})

describe('readSeedContents', () => {
  it('should attach each seed body and drop the absolute source path', async () => {
    seedFile(join('.claude', 'tasks', 'index.md'), 'Tasks body')

    expect(await readSeedContents(listSeeds(root))).toEqual([
      {
        name: 'tasks/index.md',
        source: join(
          'tooling',
          'claude',
          'seeds',
          '.claude',
          'tasks',
          'index.md',
        ),
        target: join('.canon', 'tasks', 'index.md'),
        content: 'Tasks body',
      },
    ])
  })
})
