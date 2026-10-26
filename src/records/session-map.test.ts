import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  isSessionMap,
  measureSessionMap,
  SESSION_MAP_WORD_CAP,
  sessionMapWords,
} from '@/records/session-map'

function words(count: number): string {
  return Array.from({ length: count }, (_, index) => `w${index}`).join(' ')
}

describe('counting a session map', () => {
  it('should leave out the frontmatter and the title line', () => {
    const source = [
      '---',
      'title: Session map',
      'description: what the board cannot show',
      '---',
      '',
      '# Session map',
      '',
      '## State',
      '',
      'one two three',
    ].join('\n')

    expect(sessionMapWords(source)).toBe(5)
  })

  it('should count a map with no frontmatter and no title', () => {
    expect(sessionMapWords('## State\n\none two three\n')).toBe(5)
  })

  it('should leave out a Resume section and resume counting at the next H2', () => {
    const source = [
      '# Session map',
      '## State',
      'one two',
      '## Resume',
      'skipped words here',
      '## Standing cautions',
      'three',
    ].join('\n')

    expect(sessionMapWords(source)).toBe(8)
  })

  it('should count a fenced block and ignore a heading inside it', () => {
    const source = [
      '## Resume',
      'skipped',
      '## State',
      '```markdown',
      '## Resume',
      'fenced words',
      '```',
    ].join('\n')

    expect(sessionMapWords(source)).toBe(8)
  })
})

describe('measuring a session map against the cap', () => {
  it('should flag a map over the cap', () => {
    const length = measureSessionMap(
      'session-orchestrator.md',
      `# Session map\n\n${words(351)}\n`,
    )

    expect(length).toEqual({
      record: 'session-orchestrator.md',
      words: 351,
      cap: 350,
      over: true,
    })
  })

  it('should not flag a map exactly at the cap', () => {
    const length = measureSessionMap('session-a.md', words(350))

    expect(length.over).toBe(false)
  })
})

describe('recognizing a session map file', () => {
  it('should take a session-prefixed markdown file', () => {
    expect(isSessionMap('session-orchestrator.md')).toBe(true)
  })

  it('should refuse the legacy single handoff and a task', () => {
    expect([isSessionMap('session.md'), isSessionMap('v1.2-x.md')]).toEqual([
      false,
      false,
    ])
  })
})

describe('the cap the standard states', () => {
  it('should agree with the session map reference', () => {
    const standard = readFileSync(
      join(
        import.meta.dirname,
        '../../claude/skills/session-map/references/session.md',
      ),
      'utf8',
    )
    const stated = standard.match(/\bat most (\d+) words\b/)?.[1]

    expect(Number(stated)).toBe(SESSION_MAP_WORD_CAP)
  })
})
