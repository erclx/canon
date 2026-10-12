import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import micromatch from 'micromatch'
import { describe, expect, it } from 'vitest'
import { PROJECT_ROOT } from '@/roots/project'

const RULE = 'check-file/folder-naming-convention'

const ASTRO_CONFIG = join(
  PROJECT_ROOT,
  'tooling',
  'astro',
  'configs',
  'eslint.config.js',
)

const OXLINT_CONFIGS = {
  nextjs: join(PROJECT_ROOT, 'tooling', 'nextjs', 'configs', '.oxlintrc.json'),
  web: join(PROJECT_ROOT, 'tooling', 'web', 'configs', '.oxlintrc.json'),
} as const

const STACKS = ['astro', 'nextjs', 'web'] as const

interface OxlintOverride {
  readonly files: readonly string[]
  readonly rules?: Record<string, unknown>
}

const PATTERN_RE =
  /'check-file\/folder-naming-convention':\s*\[\s*'error',\s*\{\s*'([^']+)':\s*'KEBAB_CASE'/

function readOverrides(
  stack: keyof typeof OXLINT_CONFIGS,
): readonly OxlintOverride[] {
  const config = JSON.parse(readFileSync(OXLINT_CONFIGS[stack], 'utf8')) as {
    overrides: readonly OxlintOverride[]
  }
  return config.overrides
}

function oxlintPattern(stack: keyof typeof OXLINT_CONFIGS): string | undefined {
  for (const override of readOverrides(stack)) {
    const rule = override.rules?.[RULE]
    if (Array.isArray(rule) && rule[0] === 'error') {
      const options = rule[1] as Record<string, string>
      return Object.keys(options).find((key) => options[key] === 'KEBAB_CASE')
    }
  }
  return undefined
}

function folderNamingPattern(stack: (typeof STACKS)[number]): string {
  const pattern =
    stack === 'astro'
      ? PATTERN_RE.exec(readFileSync(ASTRO_CONFIG, 'utf8'))?.[1]
      : oxlintPattern(stack)
  if (!pattern) {
    throw new Error(`no folder-naming-convention pattern found in ${stack}`)
  }

  return pattern
}

describe('folder-naming-convention pattern', () => {
  it.each(STACKS)('should capture a bad-cased folder under %s', (stack) => {
    const pattern = folderNamingPattern(stack)

    expect(micromatch.capture(pattern, 'src/BadFolder/')).toBeTruthy()
  })

  it.each(STACKS)('should skip __tests__ under %s', (stack) => {
    const pattern = folderNamingPattern(stack)

    expect(micromatch.capture(pattern, 'src/__tests__/')).toBeUndefined()
  })
})

describe('subtree exemptions', () => {
  it('should turn folder-naming-convention off for astro pages', () => {
    const source = readFileSync(ASTRO_CONFIG, 'utf8')

    expect(source).toContain("files: ['src/pages/**/*.{ts,tsx,astro}']")
    expect(source).toContain("'check-file/folder-naming-convention': 'off'")
  })

  it('should turn folder-naming-convention off for the nextjs app router', () => {
    const appRouter = readOverrides('nextjs').find((override) =>
      override.files.includes('src/app/**/*.{ts,tsx}'),
    )

    expect(appRouter?.rules?.[RULE]).toBe('off')
  })
})
