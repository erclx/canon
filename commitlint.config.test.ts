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
