import { describe, expect, it } from 'vitest'
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
