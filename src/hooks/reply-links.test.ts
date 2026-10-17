import { execa } from 'execa'
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git/env'
import { findMissingReplyLinks, formatMissing } from '@/hooks/reply-links'

const CLI = join(import.meta.dirname, '../cli.ts')

const ROOT = '/main'

/** Resolves true only for the paths a case lists, as a fake disk. */
const disk =
  (...present: string[]) =>
  (path: string): boolean =>
    present.includes(path)

const destinations = (reply: string, ...present: string[]): string[] =>
  findMissingReplyLinks(reply, ROOT, disk(...present)).map(
    (missing) => missing.destination,
  )

describe('findMissingReplyLinks', () => {
  it('should return a link whose path is on no disk', () => {
    expect(destinations('See [it](src/gone.ts).')).toEqual(['src/gone.ts'])
  })

  it('should pass a link whose path exists under the root', () => {
    expect(destinations('See [it](src/real.ts).', '/main/src/real.ts')).toEqual(
      [],
    )
  })

  it('should check an absolute destination as given', () => {
    expect(
      destinations('[a](/main/a.md) [b](/main/b.md)', '/main/a.md'),
    ).toEqual(['/main/b.md'])
  })

  describe('skips', () => {
    it.each([
      ['a placeholder', '[x](<path>)'],
      ['a glob', '[x](docs/*.md)'],
      ['a url', '[x](https://example.com)'],
      ['a mailto', '[x](mailto:a@b.c)'],
      ['an anchor', '[x](#heading)'],
      ['an empty destination', '[x]()'],
    ])('should skip %s', (_, reply) => {
      expect(destinations(reply)).toEqual([])
    })

    it('should skip a link inside a fenced block', () => {
      expect(destinations('```md\n[x](src/gone.ts)\n```')).toEqual([])
    })

    it('should skip a link inside an inline code span', () => {
      expect(destinations('Write `[x](src/gone.ts)` verbatim.')).toEqual([])
    })

    it('should skip a destination with a malformed percent escape', () => {
      expect(destinations('[x](src/100%.ts)')).toEqual([])
    })
  })

  describe('tails', () => {
    it.each([
      [':42', '[x](src/real.ts:42)'],
      [':42-50', '[x](src/real.ts:42-50)'],
      [':42:7', '[x](src/real.ts:42:7)'],
      ['#L42', '[x](src/real.ts#L42)'],
    ])('should strip a %s tail before the existence test', (_, reply) => {
      expect(destinations(reply, '/main/src/real.ts')).toEqual([])
    })
  })

  it('should decode a percent escape and keep parentheses and spaces', () => {
    const reply = '[x](notes/a%20b.md) [y](notes/c_(1).md)'

    expect(
      destinations(reply, '/main/notes/a b.md', '/main/notes/c_(1).md'),
    ).toEqual([])
  })

  it('should resolve a relative records path against the injected root', () => {
    const reply = '[plan](.canon/plans/feature-x.md)'

    expect(destinations(reply, '/main/.canon/plans/feature-x.md')).toEqual([])
    expect(destinations(reply, '/elsewhere/.canon/plans/feature-x.md')).toEqual(
      ['.canon/plans/feature-x.md'],
    )
  })

  it('should suggest the main-root path for a worktree records link', () => {
    const link = '/main/.claude/worktrees/w/.canon/plans/feature-x.md'

    const [missing] = findMissingReplyLinks(
      `[plan](${link})`,
      ROOT,
      disk('/main/.canon/plans/feature-x.md'),
    )

    expect(missing?.suggestion).toBe('/main/.canon/plans/feature-x.md')
  })

  it('should offer no suggestion when the main-root path is missing too', () => {
    const [missing] = findMissingReplyLinks(
      '[plan](/main/.claude/worktrees/w/.canon/plans/feature-x.md)',
      ROOT,
      disk(),
    )

    expect(missing?.suggestion).toBeUndefined()
  })

  it('should stat each distinct path once', () => {
    const seen: string[] = []
    const reply = Array.from({ length: 100 }, () => '[x](src/gone.ts)').join(
      ' ',
    )

    const missing = findMissingReplyLinks(reply, ROOT, (path) => {
      seen.push(path)
      return false
    })

    expect(seen).toEqual(['/main/src/gone.ts'])
    expect(missing).toHaveLength(1)
  })

  it('should return nothing for a reply with no link', () => {
    expect(destinations('Plain text with `code` and (parens).')).toEqual([])
  })
})

describe('formatMissing', () => {
  it('should name each destination and point a relocated one at its file', () => {
    const text = formatMissing([
      { destination: 'src/gone.ts', path: '/main/src/gone.ts' },
      {
        destination: '/main/.claude/worktrees/w/.canon/a.md',
        path: '/main/.claude/worktrees/w/.canon/a.md',
        suggestion: '/main/.canon/a.md',
      },
    ])

    expect(text).toContain('- src/gone.ts\n')
    expect(text).toContain('(the file is at /main/.canon/a.md)')
    expect(text).toContain('absolute path for a file inside a linked worktree')
  })
})

describe('canon hooks reply-links', () => {
  let base: string
  let main: string
  let linked: string

  const git = (cwd: string, ...args: string[]) =>
    execa('git', ['-C', cwd, ...args], { env: gitEnv(), extendEnv: false })

  const verb = (reply: string, ...args: string[]) =>
    execa('bun', [CLI, 'hooks', 'reply-links', ...args], {
      cwd: linked,
      input: reply,
      reject: false,
    })

  beforeAll(async () => {
    base = realpathSync(mkdtempSync(join(tmpdir(), 'reply-links-')))
    main = join(base, 'main')
    linked = join(base, 'linked')
    mkdirSync(main)
    await git(main, 'init', '-q', '-b', 'main')
    await git(
      main,
      '-c',
      'user.name=t',
      '-c',
      'user.email=t@t',
      'commit',
      '-q',
      '--allow-empty',
      '-m',
      'init',
    )
    await git(main, 'worktree', 'add', '-q', '-b', 'feat/x', linked)
    mkdirSync(join(main, '.canon/plans'), { recursive: true })
    writeFileSync(join(main, '.canon/plans/feature-x.md'), '# Plan\n')
  })

  afterAll(() => {
    rmSync(base, { force: true, recursive: true })
  })

  it('should resolve a records link against the main root from a linked worktree', async () => {
    const result = await verb('[plan](.canon/plans/feature-x.md)')

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('')
  })

  it('should exit 1 and name a missing path on stderr', async () => {
    const result = await verb('[it](src/gone.ts)')

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('- src/gone.ts')
  })

  it('should write the findings as a record under --json', async () => {
    const result = await verb('[it](src/gone.ts)', '--json')

    const record = JSON.parse(result.stdout)
    expect(record.ok).toBe(false)
    expect(record.missing).toEqual([
      { destination: 'src/gone.ts', path: join(main, 'src/gone.ts') },
    ])
    expect(record.message).toContain('- src/gone.ts')
  })

  it('should take --root over the main worktree root', async () => {
    const result = await verb(
      '[plan](.canon/plans/feature-x.md)',
      '--root',
      linked,
    )

    expect(result.exitCode).toBe(1)
  })
})
