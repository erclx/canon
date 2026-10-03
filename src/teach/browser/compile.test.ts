import { describe, expect, it } from 'vitest'
import { compileScript } from '@/teach/browser/compile'
import { dismiss } from '@/teach/browser/dismiss'
import { focusLine } from '@/teach/browser/focus-line'
import { glossaryFilter } from '@/teach/browser/glossary-filter'
import { head } from '@/teach/browser/head'
import { quiz } from '@/teach/browser/quiz'
import { reload } from '@/teach/browser/reload'
import { sidebar } from '@/teach/browser/sidebar'
import { theme } from '@/teach/browser/theme'

function body(script: string): string {
  return script.slice('<script>'.length, -'</script>'.length)
}

function double(n: number): number {
  const result: number = n * 2
  return result
}

describe('compileScript', () => {
  it('should wrap the call in one script block', () => {
    const script = compileScript(theme)

    expect(script.startsWith('<script>')).toBe(true)
    expect(script.endsWith('</script>')).toBe(true)
    expect(script.match(/<script>/g)).toHaveLength(1)
  })

  it('should emit plain JavaScript with no type syntax', () => {
    const script = compileScript(double, [2])

    expect(script).not.toMatch(/: number/)
    expect(new Function(`return ${body(script)}`)()).toBe(4)
  })

  it('should serialize each argument as JSON', () => {
    const script = compileScript(head, ['lesson', 1100])

    expect(script).toMatch(/\)\("lesson",1100\)<\/script>$/)
  })

  it('should keep a closing script tag inside an argument from ending the block', () => {
    const script = compileScript(head, ['</script><b>', 1])

    expect(script.match(/<\/script>/g)).toHaveLength(1)
    expect(script).toContain('\\u003c/script>')
  })

  it('should declare a helper ahead of the function that calls it', () => {
    const script = compileScript(sidebar, [900], [focusLine])

    expect(script).toContain('function focusLine')
  })

  it.each([
    ['theme', theme],
    ['dismiss', dismiss],
    ['glossaryFilter', glossaryFilter],
    ['quiz', quiz],
    ['reload', reload],
  ])('should emit %s with no module syntax', (_name, run) => {
    expect(body(compileScript(run))).not.toMatch(/^\s*(import|export)\b/m)
  })

  it('should emit the sidebar as a script that parses', () => {
    const script = compileScript(sidebar, [900], [focusLine])

    expect(() => new Function(body(script))).not.toThrow()
  })

  it('should throw when module syntax is left in the output', () => {
    const run = Object.assign(() => 0, {
      toString: () => 'function run() {}\nimport x from "y"',
    })

    expect(() => compileScript(run)).toThrow(/import or export/)
  })
})
