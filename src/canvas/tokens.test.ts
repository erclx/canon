import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveFrameTokens } from '@/canvas/tokens'
import { buildDesignCss } from '@/design/css'

let ROOT = ''

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-canvas-tokens-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

function seedDesign(file: string, css: string): void {
  const path = join(ROOT, '.claude', 'design', file)
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, css)
}

describe('resolveFrameTokens', () => {
  it('should take the toolkit token module in the toolkit checkout', () => {
    seedDesign('base.css', ':root { --color-text: red; }')

    const tokens = resolveFrameTokens(ROOT, { isOwnCheckout: true })

    expect(tokens).toEqual({ source: 'toolkit', css: buildDesignCss() })
  })

  it('should take the installed base followed by the project overrides', () => {
    seedDesign('base.css', '/* base */')
    seedDesign('project/b.css', '/* b */')
    seedDesign('project/a.css', '/* a */')

    const tokens = resolveFrameTokens(ROOT, { isOwnCheckout: false })

    expect(tokens).toMatchObject({
      source: 'installed',
      files: [
        '.claude/design/base.css',
        '.claude/design/project/a.css',
        '.claude/design/project/b.css',
      ],
    })
    expect(tokens.css.indexOf('/* base */')).toBeLessThan(
      tokens.css.indexOf('/* a */'),
    )
    expect(tokens.css.indexOf('/* a */')).toBeLessThan(
      tokens.css.indexOf('/* b */'),
    )
  })

  it('should take project overrides alone when no base is installed', () => {
    seedDesign('project/a.css', '/* a */')

    const tokens = resolveFrameTokens(ROOT, { isOwnCheckout: false })

    expect(tokens).toMatchObject({
      source: 'installed',
      files: ['.claude/design/project/a.css'],
    })
  })

  it('should resolve to none with a notice when nothing is installed', () => {
    const tokens = resolveFrameTokens(ROOT, { isOwnCheckout: false })

    expect(tokens).toMatchObject({
      source: 'none',
      css: '',
      notice: expect.stringContaining('.claude/design/base.css'),
    })
  })
})
