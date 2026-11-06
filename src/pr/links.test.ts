import { describe, expect, it } from 'vitest'
import { diffAnchor, findMislinked, linkKeyChanges } from '@/pr/links'

const FILES = 'https://github.com/acme/widgets/pull/7/files'

/** The anchor GitHub rendered for this path on a merged pull request. */
const STUB_REMOTE = {
  path: 'src/sandbox/stub-remote.test.ts',
  anchor:
    'diff-4109c85a3ff85da0607ba40926208c2717c139868f5c3d8e833c15e272486fb2',
}

function body(...bullets: string[]): string {
  return ['## Summary', '', 'Prose.', '', '## Key changes', '', ...bullets]
    .concat(['', '## Technical context', '', 'Names `src/other.ts`.'])
    .join('\n')
}

describe('diffAnchor', () => {
  it('should match the anchor GitHub renders for a path', () => {
    expect(diffAnchor(STUB_REMOTE.path)).toBe(STUB_REMOTE.anchor)
  })
})

describe('linkKeyChanges', () => {
  it('should link a changed path to its diff, keeping the code span label', () => {
    const out = linkKeyChanges(
      body(`- Fix \`${STUB_REMOTE.path}\` to match the proxy.`),
      [STUB_REMOTE.path],
      FILES,
    )
    expect(out).toContain(
      `- Fix [\`${STUB_REMOTE.path}\`](${FILES}#${STUB_REMOTE.anchor}) to match the proxy.`,
    )
  })

  it('should leave a path no changed file matches as a bare code span', () => {
    const input = body('- Mention `src/untouched.ts` here.')
    expect(linkKeyChanges(input, ['src/pr/links.ts'], FILES)).toBe(input)
  })

  it('should link a path cited with a line suffix by the file alone', () => {
    const out = linkKeyChanges(
      body(`- Rewrite \`${STUB_REMOTE.path}:12\`.`),
      [STUB_REMOTE.path],
      FILES,
    )
    expect(out).toContain(
      `[\`${STUB_REMOTE.path}:12\`](${FILES}#${STUB_REMOTE.anchor})`,
    )
  })

  it('should not link a path named outside the Key changes section', () => {
    const out = linkKeyChanges(
      body('- Edit `src/a.ts`.'),
      ['src/other.ts'],
      FILES,
    )
    expect(out).toContain('Names `src/other.ts`.')
  })

  it('should not link an already linked span a second time', () => {
    const once = linkKeyChanges(body('- Edit `src/a.ts`.'), ['src/a.ts'], FILES)
    expect(linkKeyChanges(once, ['src/a.ts'], FILES)).toBe(once)
  })

  it('should hash the raw path when it holds a space or bracket', () => {
    const path = 'docs/a [draft] b.md'
    const out = linkKeyChanges(body(`- Edit \`${path}\`.`), [path], FILES)
    expect(out).toContain(`[\`${path}\`](${FILES}#${diffAnchor(path)})`)
  })
})

describe('findMislinked', () => {
  it('should report a link whose anchor hashes a different path', () => {
    const input = body(
      `- Edit [\`src/a.ts\`](${FILES}#${diffAnchor('src/b.ts')}).`,
    )
    expect(findMislinked(input)).toEqual([
      { path: 'src/a.ts', anchor: diffAnchor('src/b.ts') },
    ])
  })

  it('should report nothing for a link whose anchor hashes its label', () => {
    const input = body(
      `- Edit [\`src/a.ts\`](${FILES}#${diffAnchor('src/a.ts')}).`,
    )
    expect(findMislinked(input)).toEqual([])
  })

  it('should report nothing for a bare bullet', () => {
    expect(findMislinked(body('- Edit `src/a.ts`.'))).toEqual([])
  })
})
