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
    expect(out).toContain(
      `[\`${path}\`](${FILES}#diff-fb8e522ac138700823ce269fa7734ad6b51440ff229783fd79710d4c10c922f8)`,
    )
  })

  it('should rewrite the anchor of a diff link that opens another file', () => {
    const wrong = body(
      `- Edit [\`src/a.ts\`](${FILES}#${diffAnchor('src/b.ts')}).`,
    )
    const out = linkKeyChanges(wrong, ['src/a.ts', 'src/b.ts'], FILES)
    expect(out).toContain(`[\`src/a.ts\`](${FILES}#${diffAnchor('src/a.ts')})`)
  })

  it('should not nest a link inside the label of a longer link', () => {
    const input = body('- See [the `src/a.ts` file](https://example.com/a).')
    expect(linkKeyChanges(input, ['src/a.ts'], FILES)).toBe(input)
  })

  it('should not nest a link inside a link carrying a title', () => {
    const input = body(
      '- See [`src/a.ts`](https://example.com/a "a title") here.',
    )
    expect(linkKeyChanges(input, ['src/a.ts'], FILES)).toBe(input)
  })

  it('should not nest a link inside a link with an angle-bracket destination', () => {
    const input = body('- See [`src/a.ts`](<https://example.com/a b>) here.')
    expect(linkKeyChanges(input, ['src/a.ts'], FILES)).toBe(input)
  })

  it('should rewrite the anchor of a diff link that carries a title', () => {
    const wrong = body(
      `- Edit [\`src/a.ts\`](${FILES}#${diffAnchor('src/b.ts')} "diff") now.`,
    )
    const out = linkKeyChanges(wrong, ['src/a.ts'], FILES)
    expect(out).toContain(
      `[\`src/a.ts\`](${FILES}#${diffAnchor('src/a.ts')} "diff")`,
    )
  })

  it('should link the Key changes section when an earlier block repeats it', () => {
    const bullet = '- Edit `src/a.ts`.'
    const input = [
      '## Summary',
      '',
      bullet,
      '',
      '## Key changes',
      '',
      bullet,
    ].join('\n')
    const out = linkKeyChanges(input, ['src/a.ts'], FILES)
    expect(out.startsWith(`## Summary\n\n${bullet}\n\n## Key changes`)).toBe(
      true,
    )
    expect(out).toContain(`[\`src/a.ts\`](${FILES}#${diffAnchor('src/a.ts')})`)
  })
})

describe('findMislinked', () => {
  it('should report a link whose anchor hashes a different path', () => {
    const input = body(
      `- Edit [\`src/a.ts\`](${FILES}#${diffAnchor('src/b.ts')}).`,
    )
    expect(findMislinked(input, ['src/a.ts'])).toEqual([
      { path: 'src/a.ts', anchor: diffAnchor('src/b.ts') },
    ])
  })

  it('should report nothing for a link whose anchor hashes its label', () => {
    const input = body(
      `- Edit [\`src/a.ts\`](${FILES}#${diffAnchor('src/a.ts')}).`,
    )
    expect(findMislinked(input, ['src/a.ts'])).toEqual([])
  })

  it('should report nothing for a bare bullet', () => {
    expect(findMislinked(body('- Edit `src/a.ts`.'), ['src/a.ts'])).toEqual([])
  })

  it('should leave a label that is no changed path unjudged', () => {
    const input = body(
      `- Edit [\`new.ts\`](${FILES}#${diffAnchor('src/new.ts')}) and [\`verify()\`](${FILES}#${diffAnchor('src/new.ts')}).`,
    )
    expect(findMislinked(input, ['src/new.ts'])).toEqual([])
  })
})
