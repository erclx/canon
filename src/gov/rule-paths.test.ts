import { describe, expect, it } from 'vitest'
import { buildRuleEntries } from '@/gov/list'
import { PROJECT_ROOT } from '@/roots/project'

function matchesRule(name: string, path: string): boolean {
  const rule = buildRuleEntries(PROJECT_ROOT).find((r) => r.name === name)
  const globs = rule?.paths ?? []
  return globs.some((glob) => new Bun.Glob(glob).match(path))
}

describe('rule paths', () => {
  describe('testing-php', () => {
    it.each([
      'tests/A.php',
      'invoicing/tests/Database/L.php',
      'src/FooTest.php',
    ])('loads for %s', (path) => {
      expect(matchesRule('testing-php', path)).toBe(true)
    })

    it('does not load for a PHP file outside a tests folder', () => {
      expect(matchesRule('testing-php', 'src/A.php')).toBe(false)
    })
  })

  describe('testing-py', () => {
    it.each(['tests/conftest.py', 'billing/tests/factories/user.py'])(
      'loads for %s',
      (path) => {
        expect(matchesRule('testing-py', path)).toBe(true)
      },
    )

    it('does not load for a Python file outside a tests folder', () => {
      expect(matchesRule('testing-py', 'src/app.py')).toBe(false)
    })
  })
})
