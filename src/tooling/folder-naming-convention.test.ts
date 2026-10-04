import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import micromatch from 'micromatch'
import { describe, expect, it } from 'vitest'
import { PROJECT_ROOT } from '@/roots/project'

const CONFIGS = {
  astro: join(PROJECT_ROOT, 'tooling', 'astro', 'configs', 'eslint.config.js'),
  nextjs: join(
    PROJECT_ROOT,
    'tooling',
    'nextjs',
    'configs',
    'eslint.config.js',
  ),
  web: join(PROJECT_ROOT, 'tooling', 'web', 'configs', 'eslint.config.js'),
} as const

const PATTERN_RE =
  /'check-file\/folder-naming-convention':\s*\[\s*'error',\s*\{\s*'([^']+)':\s*'KEBAB_CASE'/

function folderNamingPattern(stack: keyof typeof CONFIGS): string {
  const source = readFileSync(CONFIGS[stack], 'utf8')
  const match = PATTERN_RE.exec(source)
  if (!match) {
    throw new Error(`no folder-naming-convention pattern found in ${stack}`)
  }

  return match[1]
}

describe('folder-naming-convention pattern', () => {
  it.each(Object.keys(CONFIGS) as (keyof typeof CONFIGS)[])(
    'should capture a bad-cased folder under %s',
    (stack) => {
      const pattern = folderNamingPattern(stack)

      expect(micromatch.capture(pattern, 'src/BadFolder/')).toBeTruthy()
    },
  )

  it.each(Object.keys(CONFIGS) as (keyof typeof CONFIGS)[])(
    'should skip __tests__ under %s',
    (stack) => {
      const pattern = folderNamingPattern(stack)

      expect(micromatch.capture(pattern, 'src/__tests__/')).toBeUndefined()
    },
  )
})

describe('subtree exemptions', () => {
  it('should turn folder-naming-convention off for astro pages', () => {
    const source = readFileSync(CONFIGS.astro, 'utf8')

    expect(source).toContain("files: ['src/pages/**/*.{ts,tsx,astro}']")
    expect(source).toContain("'check-file/folder-naming-convention': 'off'")
  })

  it('should turn folder-naming-convention off for the nextjs app router', () => {
    const source = readFileSync(CONFIGS.nextjs, 'utf8')

    expect(source).toContain("files: ['src/app/**/*.{ts,tsx}']")
    expect(source).toContain("'check-file/folder-naming-convention': 'off'")
  })
})
