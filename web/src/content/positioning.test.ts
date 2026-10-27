import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { fold, site } from './copy'

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))

function readText(path: string): string {
  return readFileSync(`${ROOT}${path}`, 'utf8')
}

function readJson(path: string) {
  return JSON.parse(readText(path)) as {
    description: string
    plugins?: { description: string }[]
  }
}

/** The README's opening sentence, the line under the title. */
function readmeOpening(): string {
  const line = readText('README.md')
    .split('\n')
    .find((candidate) => candidate.startsWith('A CLI and Claude Code plugin '))
  if (line === undefined)
    throw new Error(
      'README.md has no line opening "A CLI and Claude Code plugin "',
    )
  return line
}

describe('public positioning', () => {
  it('should carry the short variant on every typed surface', () => {
    const marketplace = readJson('.claude-plugin/marketplace.json')

    const surfaces = [
      site.tagline,
      marketplace.description,
      marketplace.plugins?.[0]?.description,
      readJson('claude/.claude-plugin/plugin.json').description,
      readJson('package.json').description,
    ]

    expect(new Set(surfaces).size).toBe(1)
  })

  it('should take the headline claim from the README opening sentence', () => {
    expect(readmeOpening()).toContain(fold.headline.replace(/^canon /, ''))
  })

  it('should end the hero lead on the README opening sentence', () => {
    const tail = fold.lead.slice(fold.lead.indexOf('established'))

    expect(readmeOpening().endsWith(tail)).toBe(true)
  })
})
