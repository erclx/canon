import { describe, expect, it } from 'vitest'
import config from './commitlint.config.js'

function subjectFirstWordCase(subject: string): [boolean, string?] {
  const rule = config.plugins[0].rules['subject-first-word-case']
  return rule({ subject })
}

describe('subject-first-word-case', () => {
  it('should pass a lowercase-first-word subject', () => {
    const [conforms] = subjectFirstWordCase('add retry logic for webhooks')

    expect(conforms).toBe(true)
  })

  it('should pass a subject starting with a quoted token', () => {
    const [conforms] = subjectFirstWordCase("'UserSession' validation logic")

    expect(conforms).toBe(true)
  })

  it('should pass a subject starting with a numeric token', () => {
    const [conforms] = subjectFirstWordCase('72-character cap on the header')

    expect(conforms).toBe(true)
  })

  it('should fail a subject starting with an uppercase word', () => {
    const [conforms] = subjectFirstWordCase('Add retry logic for webhooks')

    expect(conforms).toBe(false)
  })
})

function noClaudeCoAuthor(raw: string): [boolean, string?] {
  const rule = config.plugins[0].rules['no-claude-co-author']
  return rule({ raw })
}

function messageWithBody(body: string): string {
  return `feat(x): add y\n\n${body}\n`
}

describe('no-claude-co-author', () => {
  it('should fail the Claude trailer a session writes', () => {
    const [conforms] = noClaudeCoAuthor(
      messageWithBody('Co-Authored-By: Claude <noreply@anthropic.com>'),
    )

    expect(conforms).toBe(false)
  })

  it('should fail a lowercase Claude trailer', () => {
    const [conforms] = noClaudeCoAuthor(
      messageWithBody('co-authored-by: claude <claude@example.com>'),
    )

    expect(conforms).toBe(false)
  })

  it('should fail a trailer whose address alone names Anthropic', () => {
    const [conforms] = noClaudeCoAuthor(
      messageWithBody('Co-authored-by: Sam Doe <noreply@anthropic.com>'),
    )

    expect(conforms).toBe(false)
  })

  it('should fail a trailer after a breaking change footer', () => {
    const [conforms] = noClaudeCoAuthor(
      messageWithBody(
        'BREAKING CHANGE: drop the old flag\n\nCo-Authored-By: Claude <noreply@anthropic.com>',
      ),
    )

    expect(conforms).toBe(false)
  })

  it('should quote the offending line in the failure message', () => {
    const [, message] = noClaudeCoAuthor(
      messageWithBody('Co-Authored-By: Claude <noreply@anthropic.com>'),
    )

    expect(message).toContain('Co-Authored-By: Claude <noreply@anthropic.com>')
  })

  it('should pass the github-actions bot trailer', () => {
    const [conforms] = noClaudeCoAuthor(
      messageWithBody(
        'Co-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>',
      ),
    )

    expect(conforms).toBe(true)
  })

  it('should pass a human co-author trailer', () => {
    const [conforms] = noClaudeCoAuthor(
      messageWithBody('Co-authored-by: Sam Doe <sam@example.com>'),
    )

    expect(conforms).toBe(true)
  })

  it('should pass a body sentence that mentions Claude', () => {
    const [conforms] = noClaudeCoAuthor(
      messageWithBody('Claude wrote the draft of this section.'),
    )

    expect(conforms).toBe(true)
  })

  it('should pass a git comment line that mentions Claude', () => {
    const [conforms] = noClaudeCoAuthor(
      messageWithBody('# Co-authored-by: Claude <noreply@anthropic.com>'),
    )

    expect(conforms).toBe(true)
  })
})
