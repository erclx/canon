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

function readmeOpening(): string {
  const line = readText('README.md')
    .split('\n')
    .find((candidate) => candidate.startsWith('canon is '))
  if (line === undefined)
    throw new Error('README.md has no line opening "canon is "')
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

  it('should open the hero lead with the README opening sentence', () => {
    expect(fold.lead.startsWith(readmeOpening())).toBe(true)
  })
})
