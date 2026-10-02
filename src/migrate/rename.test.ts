import { describe, expect, it } from 'vitest'
import {
  AITK_RULES,
  defineRenameRules,
  isExcludedPath,
  renamePath,
  renameText,
  scanText,
} from '@/migrate/rename'

describe('renameText', () => {
  it('should rewrite the lowercase token', () => {
    expect(renameText('run aitk gov sync', AITK_RULES)).toBe(
      'run canon gov sync',
    )
  })

  it('should rewrite the uppercase token so an environment prefix moves with it', () => {
    expect(renameText('AITK_NON_INTERACTIVE=1', AITK_RULES)).toBe(
      'CANON_NON_INTERACTIVE=1',
    )
  })

  it('should rewrite the title-case token', () => {
    expect(renameText('# Aitk operator', AITK_RULES)).toBe('# Canon operator')
  })

  it('should rewrite every spelling in one pass', () => {
    expect(renameText('aitk AITK Aitk', AITK_RULES)).toBe('canon CANON Canon')
  })

  it('should rewrite the scoped package name', () => {
    expect(renameText('@erclx/aitk', AITK_RULES)).toBe('@erclx/canon')
  })

  it('should rewrite the repository slug, which moved with the repository', () => {
    expect(renameText('gh pr list --repo erclx/aitk', AITK_RULES)).toBe(
      'gh pr list --repo erclx/canon',
    )
  })

  it('should rewrite a repository URL', () => {
    expect(renameText('https://github.com/erclx/aitk.git', AITK_RULES)).toBe(
      'https://github.com/erclx/canon.git',
    )
  })

  it('should leave the sibling repository name alone', () => {
    expect(renameText('clone aitk-sandbox now', AITK_RULES)).toBe(
      'clone aitk-sandbox now',
    )
  })

  it('should leave the sibling repository alone when it carries the owner prefix', () => {
    expect(
      renameText('https://github.com/erclx/aitk-sandbox', AITK_RULES),
    ).toBe('https://github.com/erclx/aitk-sandbox')
  })

  it('should rewrite an unprotected token adjacent to a protected one', () => {
    expect(renameText('aitk-sandbox uses aitk gov', AITK_RULES)).toBe(
      'aitk-sandbox uses canon gov',
    )
  })

  it('should rewrite the governance marker', () => {
    expect(renameText('# aitk-allow-superseded: pinned', AITK_RULES)).toBe(
      '# canon-allow-superseded: pinned',
    )
  })

  it('should leave text carrying no token untouched', () => {
    expect(renameText('nothing to see', AITK_RULES)).toBe('nothing to see')
  })

  it('should drop the article that only agreed with the retired name', () => {
    expect(renameText('reached by an aitk install command', AITK_RULES)).toBe(
      'reached by a canon install command',
    )
  })

  it('should repair the article across a code span', () => {
    expect(renameText('goes through an `aitk` verb', AITK_RULES)).toBe(
      'goes through a `canon` verb',
    )
  })

  it('should repair an article that opens a sentence', () => {
    expect(renameText('An aitk verb resolves it', AITK_RULES)).toBe(
      'A canon verb resolves it',
    )
  })

  it('should repair the article before the uppercase token', () => {
    expect(
      renameText('set by an AITK_SANDBOX_DIR pointed inside', AITK_RULES),
    ).toBe('set by a CANON_SANDBOX_DIR pointed inside')
  })

  it('should keep the article before the sibling repository, which does not move', () => {
    expect(renameText('cloned into an aitk-sandbox checkout', AITK_RULES)).toBe(
      'cloned into an aitk-sandbox checkout',
    )
  })

  it('should leave an article before an unrelated word starting with canon', () => {
    expect(renameText('an canonical taxonomy', AITK_RULES)).toBe(
      'an canonical taxonomy',
    )
  })

  it('should leave a line carrying the keep marker', () => {
    const line = "join(target, '.claude', 'aitk.json') // canon-keep-retired"

    expect(renameText(line, AITK_RULES)).toBe(line)
  })

  it('should leave the line below a keep marker', () => {
    const text = ['// canon-keep-retired', "const path = 'aitk.json'"].join(
      '\n',
    )

    expect(renameText(text, AITK_RULES)).toBe(text)
  })

  it('should still rewrite a line two below the marker', () => {
    const text = [
      '// canon-keep-retired',
      "const retired = 'aitk.json'",
      "const current = 'aitk.json'",
    ].join('\n')

    expect(renameText(text, AITK_RULES)).toBe(
      [
        '// canon-keep-retired',
        "const retired = 'aitk.json'",
        "const current = 'canon.json'",
      ].join('\n'),
    )
  })
})

describe('scanText', () => {
  it('should count what it rewrote and what it protected', () => {
    expect(scanText('aitk erclx/aitk aitk-sandbox AITK', AITK_RULES)).toEqual({
      renamed: 3,
      protectedCount: 1,
    })
  })

  it('should report nothing for text carrying no token', () => {
    expect(scanText('nothing to see', AITK_RULES)).toEqual({
      renamed: 0,
      protectedCount: 0,
    })
  })
})

describe('renamePath', () => {
  it('should move the stamp folder', () => {
    expect(renamePath('.claude/aitk/pr-labels.toml', AITK_RULES)).toBe(
      '.claude/canon/pr-labels.toml',
    )
  })

  it('should move a prefixed skill folder', () => {
    expect(renamePath('claude/skills/aitk-cli/SKILL.md', AITK_RULES)).toBe(
      'claude/skills/canon-cli/SKILL.md',
    )
  })

  it('should move a prefixed scenario script', () => {
    expect(renamePath('sandbox/claude/aitk-operator.sh', AITK_RULES)).toBe(
      'sandbox/claude/canon-operator.sh',
    )
  })

  it('should leave a path carrying no token alone', () => {
    expect(renamePath('src/cli.ts', AITK_RULES)).toBe('src/cli.ts')
  })
})

describe('isExcludedPath', () => {
  it('should exclude the changelog, which records what shipped under the old name', () => {
    expect(isExcludedPath('CHANGELOG.md', AITK_RULES)).toBe(true)
  })

  it('should not exclude an ordinary source file', () => {
    expect(isExcludedPath('src/cli.ts', AITK_RULES)).toBe(false)
  })

  it('should exclude its own token map, which the sweep would otherwise flatten', () => {
    expect(isExcludedPath('src/migrate/rename.ts', AITK_RULES)).toBe(true)
  })

  it('should exclude its own tests, whose assertions name both spellings', () => {
    expect(isExcludedPath('src/migrate/rename.test.ts', AITK_RULES)).toBe(true)
  })

  it('should exclude the command that documents both spellings', () => {
    expect(isExcludedPath('src/commands/migrate.ts', AITK_RULES)).toBe(true)
  })

  it('should exclude an eval transcript, which records what a session ran', () => {
    expect(isExcludedPath('scripts/eval/result-seed.md', AITK_RULES)).toBe(true)
  })

  it('should not exclude the eval harness itself', () => {
    expect(isExcludedPath('scripts/eval/run.sh', AITK_RULES)).toBe(false)
  })
})

describe('defineRenameRules', () => {
  it('should order a token ahead of the shorter token it contains', () => {
    const rules = defineRenameRules({
      replacements: { ab: 'x', abcd: 'y' },
      keepMarker: 'keep',
    })

    expect(rules.tokenOrder).toEqual(['abcd', 'ab'])
  })

  it('should rewrite the longer token rather than its prefix', () => {
    const rules = defineRenameRules({
      replacements: { ab: 'x', abcd: 'y' },
      keepMarker: 'keep',
    })

    expect(renameText('abcd', rules)).toBe('y')
  })

  it('should keep the order an author wrote for tokens of equal length', () => {
    const rules = defineRenameRules({
      replacements: { aitk: 'canon', AITK: 'CANON', Aitk: 'Canon' },
      keepMarker: 'keep',
    })

    expect(rules.tokenOrder).toEqual(['aitk', 'AITK', 'Aitk'])
  })

  it('should protect nothing when a preset names no protected form', () => {
    const rules = defineRenameRules({
      replacements: { ab: 'x' },
      keepMarker: 'keep',
    })

    expect(scanText('ab cd ab', rules)).toEqual({
      renamed: 2,
      protectedCount: 0,
    })
  })

  it('should rewrite every token when a preset names no protected form', () => {
    const rules = defineRenameRules({
      replacements: { ab: 'x' },
      keepMarker: 'keep',
    })

    expect(renameText('ab cd ab', rules)).toBe('x cd x')
  })

  it('should treat a regex metacharacter in a token as a literal', () => {
    const rules = defineRenameRules({
      replacements: { 'a.c': 'z' },
      keepMarker: 'keep',
    })

    expect(renameText('a.c abc', rules)).toBe('z abc')
  })

  it('should exclude nothing when a preset names no exclusion', () => {
    const rules = defineRenameRules({
      replacements: { ab: 'x' },
      keepMarker: 'keep',
    })

    expect(isExcludedPath('CHANGELOG.md', rules)).toBe(false)
  })

  it('should stop at a word boundary when a preset asks for whole tokens', () => {
    const rules = defineRenameRules({
      replacements: { ab: 'x' },
      keepMarker: 'keep',
      wholeToken: true,
    })

    expect(renameText('ab abc ab-cd', rules)).toBe('x abc ab-cd')
  })

  it('should count no match for a token inside a longer word under whole tokens', () => {
    const rules = defineRenameRules({
      replacements: { ab: 'x' },
      keepMarker: 'keep',
      wholeToken: true,
    })

    expect(scanText('abc', rules)).toEqual({ renamed: 0, protectedCount: 0 })
  })

  it('should still rewrite a token a hyphenated suffix follows without whole tokens', () => {
    const rules = defineRenameRules({
      replacements: { ab: 'x' },
      keepMarker: 'keep',
    })

    expect(renameText('ab-cd', rules)).toBe('x-cd')
  })

  it('should leave a line carrying the marker the preset named', () => {
    const rules = defineRenameRules({
      replacements: { ab: 'x' },
      keepMarker: 'hold-this',
    })

    expect(renameText('ab // hold-this', rules)).toBe('ab // hold-this')
  })
})
