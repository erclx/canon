import { describe, expect, it } from 'vitest'
import { type GitRunner, readChangedPaths, readsDrivableBox } from '@/pr/lift'

const HEAD = '9b1f2c3d4e5f60718293a4b5c6d7e8f901234567'
const MOVED = '1111111111111111111111111111111111111111'

describe('readChangedPaths', () => {
  const FULL = MOVED

  function gitOf(answers: Record<string, string | undefined>): GitRunner {
    return async (args) => {
      const verb = args.find((arg) => !arg.startsWith('-')) ?? ''
      return answers[verb]
    }
  }

  it('should list the paths changed since an ancestor close', async () => {
    const git = gitOf({
      'cat-file': '',
      'rev-parse': `${FULL}\n`,
      'merge-base': `${FULL}\n`,
      diff: 'src/a.ts\nsrc/App.tsx\n',
    })

    expect(await readChangedPaths(git, '1111111', HEAD)).toEqual({
      isAncestor: true,
      paths: ['src/a.ts', 'src/App.tsx'],
    })
  })

  it('should read not an ancestor when the close was rewritten away', async () => {
    const git = gitOf({
      'cat-file': '',
      'rev-parse': `${FULL}\n`,
      'merge-base': 'ffffffffffffffffffffffffffffffffffffffff\n',
    })

    expect(await readChangedPaths(git, FULL, HEAD)).toEqual({
      isAncestor: false,
      paths: [],
    })
  })

  it('should read not an ancestor when the close does not resolve', async () => {
    const git = gitOf({ 'cat-file': '', 'rev-parse': undefined })

    expect(await readChangedPaths(git, FULL, HEAD)).toEqual({
      isAncestor: false,
      paths: [],
    })
  })

  it('should read a failed read when the head does not resolve', async () => {
    const git = gitOf({ 'cat-file': undefined })

    expect(await readChangedPaths(git, FULL, HEAD)).toBeUndefined()
  })

  it('should read a failed read when the diff fails', async () => {
    const git = gitOf({
      'cat-file': '',
      'rev-parse': `${FULL}\n`,
      'merge-base': `${FULL}\n`,
      diff: undefined,
    })

    expect(await readChangedPaths(git, FULL, HEAD)).toBeUndefined()
  })
})

describe('readsDrivableBox', () => {
  it.each([
    [{}, false],
    [{ checklist: '' }, false],
    [{ checklist: '- [ ] calm (taste)', drivable: 0 }, false],
    [{ checklist: '- [ ] opens', drivable: 1 }, true],
    [{ checklist: '- [ ] opens' }, true],
    [{ checklist: '- [ ] opens', drivable: '0' }, true],
    [{ checklist: '- [ ] opens', drivable: -1 }, true],
  ])('should read %j as binding %s', (record, expected) => {
    expect(readsDrivableBox(record)).toBe(expected)
  })
})
