import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type GitRunner, readBaseReading, readBaseStanding } from '@/pr/lift'

const HEAD = '9b1f2c3d4e5f60718293a4b5c6d7e8f901234567'

describe('readBaseStanding', () => {
  /** Answers by the first git argument that names the command. */
  function gitOf(answers: Record<string, string | undefined>): GitRunner {
    return async (args) => {
      const verb = args.find((arg) => !arg.startsWith('-')) ?? ''
      return answers[verb]
    }
  }

  it('should read fresh when the base moved no path the branch writes', async () => {
    const git = gitOf({
      fetch: '',
      'cat-file': '',
      'rev-parse': 'abc',
      'merge-tree': 'tree',
      'merge-base': 'fork\n',
      diff: '',
    })

    expect(await readBaseStanding(git, 1, HEAD, 'origin/main')).toBe('fresh')
  })

  it('should fetch the base before it measures against it', async () => {
    const calls: string[][] = []
    const git: GitRunner = async (args) => {
      calls.push([...args])
      return args.includes('merge-base') ? 'fork\n' : ''
    }

    await readBaseStanding(git, 1, HEAD, 'origin/main')

    expect(calls).toContainEqual(['fetch', '-q', 'origin', 'main'])
  })

  it('should read conflict when merge-tree fails on resolvable refs', async () => {
    const git = gitOf({
      fetch: '',
      'cat-file': '',
      'rev-parse': 'abc',
      'merge-tree': undefined,
    })

    expect(await readBaseStanding(git, 1, HEAD, 'origin/main')).toBe('conflict')
  })

  it('should read unknown when the head does not resolve', async () => {
    const git = gitOf({
      fetch: '',
      'cat-file': undefined,
      'rev-parse': 'abc',
    })

    expect(await readBaseStanding(git, 1, HEAD, 'origin/main')).toBe('unknown')
  })

  it('should read stale when the base changed a path the branch writes', async () => {
    const calls: string[][] = []
    const git: GitRunner = async (args) => {
      calls.push([...args])
      const verb = args.find((arg) => !arg.startsWith('-')) ?? ''
      if (verb === 'diff') {
        return args.includes('--') ? 'src/a.ts\n' : 'src/a.ts\nsrc/b.ts\n'
      }
      if (verb === 'merge-base') return 'fork\n'
      return ''
    }

    expect(await readBaseStanding(git, 1, HEAD, 'origin/main')).toBe('stale')
  })
})

describe('readBaseReading', () => {
  it('should name the branch paths the base changed on a stale base', async () => {
    const git: GitRunner = async (args) => {
      const verb = args.find((arg) => !arg.startsWith('-')) ?? ''
      if (verb === 'diff') {
        return args.includes('--') ? 'src/a.ts\n' : 'src/a.ts\nsrc/b.ts\n'
      }
      if (verb === 'merge-base') return 'fork\n'
      return ''
    }

    expect(await readBaseReading(git, 1, HEAD, 'origin/main')).toEqual({
      standing: 'stale',
      moved: ['src/a.ts'],
    })
  })

  it('should carry no path list on a fresh base', async () => {
    const git: GitRunner = async (args) =>
      args.includes('merge-base') ? 'fork\n' : ''

    expect(await readBaseReading(git, 1, HEAD, 'origin/main')).toEqual({
      standing: 'fresh',
    })
  })

  it('should read unknown and name nothing when the fetch leaves no head', async () => {
    const git: GitRunner = async (args) =>
      args[0] === 'cat-file' ? undefined : ''

    expect(await readBaseReading(git, 1, HEAD, 'origin/main')).toEqual({
      standing: 'unknown',
    })
  })

  it('should read unknown when the base fetch fails and a ref from an earlier fetch remains', async () => {
    const git: GitRunner = async (args) => {
      if (args[0] === 'fetch') {
        return args.includes('main') ? undefined : ''
      }
      return args.includes('merge-base') ? 'fork\n' : ''
    }

    expect(await readBaseReading(git, 1, HEAD, 'origin/main')).toEqual({
      standing: 'unknown',
    })
  })

  it('should keep measuring when only the head fetch fails, since the head commit settles it', async () => {
    const git: GitRunner = async (args) => {
      if (args[0] === 'fetch') {
        return args.includes('main') ? '' : undefined
      }
      return args.includes('merge-base') ? 'fork\n' : ''
    }

    expect(await readBaseReading(git, 1, HEAD, 'origin/main')).toEqual({
      standing: 'fresh',
    })
  })
})

describe('readBaseReading over stamped examples', () => {
  const STANDARD = 'claude/skills/demo/references/demo.md'
  const UNSTAMPED = 'claude/skills/demo/SKILL.md'
  const EXAMPLE = 'examples/planning/plan.md'
  const INDEX = 'examples/index.md'
  const INDEX_SOURCE = `- [Plan](planning/plan.md): a plan. Read against \`${STANDARD}\` at \`b4fbf5c0\`.\n`
  let root: string

  async function git(...args: string[]): Promise<string> {
    const result = await execa('git', args, { cwd: root })
    return String(result.stdout).trim()
  }

  const runner: GitRunner = async (args) => {
    const result = await execa('git', [...args], { cwd: root, reject: false })
    return result.exitCode === 0 ? String(result.stdout) : undefined
  }

  function refusing(verb: string): GitRunner {
    return async (args) => (args.includes(verb) ? undefined : runner(args))
  }

  async function commit(files: Record<string, string>): Promise<string> {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), text)
    }
    await git('add', '-A')
    await git('commit', '-q', '-m', 'change')
    return git('rev-parse', 'HEAD')
  }

  async function moveBase(files: Record<string, string>): Promise<void> {
    await git('checkout', '-q', 'main')
    await commit(files)
  }

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'canon-standing-'))
    await git('init', '-q', '-b', 'main')
    await git('config', 'user.email', 'test@example.com')
    await git('config', 'user.name', 'test')
    // The repository is its own remote, so a fetch reads the base it just moved.
    await git('remote', 'add', 'origin', root)
    await commit({
      [STANDARD]: '# Standard\n',
      [UNSTAMPED]: '# Skill\n',
      [INDEX]: INDEX_SOURCE,
      [EXAMPLE]: '# Plan\n',
    })
    await git('checkout', '-q', '-b', 'feat')
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('should read stale on a moved standard the index stamps', async () => {
    const head = await commit({ [EXAMPLE]: '# Plan\n\nReworked.\n' })
    await moveBase({ [STANDARD]: '# Standard\n\nReworded.\n' })

    expect(await readBaseReading(runner, 1, head, 'origin/main')).toEqual({
      standing: 'stale',
      moved: [STANDARD],
    })
  })

  it('should read stale on a stamp when the branch writes the index alone', async () => {
    const head = await commit({ [INDEX]: `# Examples\n\n${INDEX_SOURCE}` })
    await moveBase({ [STANDARD]: '# Standard\n\nReworded.\n' })

    expect(await readBaseReading(runner, 1, head, 'origin/main')).toEqual({
      standing: 'stale',
      moved: [STANDARD],
    })
  })

  it('should read the stamp from the head when the branch added the index', async () => {
    await git('checkout', '-q', 'main')
    await git('rm', '-q', '-r', 'examples')
    await git('commit', '-q', '-m', 'drop examples')
    await git('checkout', '-q', '-B', 'feat')
    const head = await commit({
      [INDEX]: INDEX_SOURCE,
      [EXAMPLE]: '# Plan\n',
    })
    await moveBase({ [STANDARD]: '# Standard\n\nReworded.\n' })

    expect(await readBaseReading(runner, 1, head, 'origin/main')).toEqual({
      standing: 'stale',
      moved: [STANDARD],
    })
  })

  it('should name a stamped standard the base renamed by the path the stamp cites', async () => {
    const head = await commit({ [EXAMPLE]: '# Plan\n\nReworked.\n' })
    await git('checkout', '-q', 'main')
    await git('mv', STANDARD, 'claude/skills/demo/references/renamed.md')
    await git('commit', '-q', '-m', 'rename')

    expect(await readBaseReading(runner, 1, head, 'origin/main')).toEqual({
      standing: 'stale',
      moved: [STANDARD],
    })
  })

  it('should stay fresh when the base moved an unstamped skill', async () => {
    const head = await commit({ [EXAMPLE]: '# Plan\n\nReworked.\n' })
    await moveBase({ [UNSTAMPED]: '# Skill\n\nReworded.\n' })

    expect(await readBaseReading(runner, 1, head, 'origin/main')).toEqual({
      standing: 'fresh',
    })
  })

  it('should stay fresh on a moved stamp when the branch writes no example', async () => {
    const head = await commit({ 'src/a.ts': 'export {}\n' })
    await moveBase({ [STANDARD]: '# Standard\n\nReworded.\n' })

    expect(await readBaseReading(runner, 1, head, 'origin/main')).toEqual({
      standing: 'fresh',
    })
  })

  it('should stay fresh when the head carries no stamp index under its own examples', async () => {
    await git('rm', '-q', INDEX)
    const head = await commit({ 'examples/demo.ts': 'export {}\n' })
    await moveBase({ [STANDARD]: '# Standard\n\nReworded.\n' })

    expect(await readBaseReading(runner, 1, head, 'origin/main')).toEqual({
      standing: 'fresh',
    })
  })

  it.each(['ls-tree', 'show'])(
    'should read unknown on an unreadable index, when git %s fails',
    async (verb) => {
      const head = await commit({ [EXAMPLE]: '# Plan\n\nReworked.\n' })

      expect(
        await readBaseReading(refusing(verb), 1, head, 'origin/main'),
      ).toEqual({ standing: 'unknown' })
    },
  )
})
