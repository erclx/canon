import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  checkoutMismatchWarning,
  findCheckoutMismatch,
  isOwnCheckout,
  PROJECT_ROOT,
} from '@/project-root'

let fixture: string

const writePackage = (dir: string, name: string): void => {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name }))
}

beforeEach(() => {
  fixture = mkdtempSync(join(tmpdir(), 'checkout-mismatch-'))
})

afterEach(() => {
  rmSync(fixture, { force: true, recursive: true })
})

describe('findCheckoutMismatch', () => {
  it('should report the ancestor when a matching name sits at a different path', () => {
    writePackage(fixture, '@erclx/canon')
    const startDir = join(fixture, 'src/commands')
    mkdirSync(startDir, { recursive: true })

    expect(findCheckoutMismatch(startDir)).toBe(fixture)
  })

  it('should report nothing when no ancestor carries a matching package.json', () => {
    const startDir = join(fixture, 'unrelated/project')
    writePackage(startDir, 'some-other-package')

    expect(findCheckoutMismatch(startDir)).toBeUndefined()
  })

  it('should report nothing when the matching ancestor is PROJECT_ROOT itself', () => {
    expect(findCheckoutMismatch(PROJECT_ROOT)).toBeUndefined()
  })
})

describe('checkoutMismatchWarning', () => {
  it('should name both roots when the caller stands in a second checkout', () => {
    writePackage(fixture, '@erclx/canon')
    const startDir = join(fixture, 'src/commands')
    mkdirSync(startDir, { recursive: true })

    const message = checkoutMismatchWarning(startDir)

    expect(message).toContain(PROJECT_ROOT)
    expect(message).toContain(fixture)
  })

  it('should report nothing when no ancestor carries a matching package.json', () => {
    const startDir = join(fixture, 'unrelated/project')
    writePackage(startDir, 'some-other-package')

    expect(checkoutMismatchWarning(startDir)).toBeUndefined()
  })
})

describe('isOwnCheckout', () => {
  it('should read true for PROJECT_ROOT itself', () => {
    expect(isOwnCheckout(PROJECT_ROOT)).toBe(true)
  })

  it('should read true for a different directory carrying the same package name', () => {
    writePackage(fixture, '@erclx/canon')

    expect(isOwnCheckout(fixture)).toBe(true)
  })

  it('should read false for a directory carrying a different package name', () => {
    writePackage(fixture, 'some-other-package')

    expect(isOwnCheckout(fixture)).toBe(false)
  })

  it('should read false for a directory carrying no package.json', () => {
    expect(isOwnCheckout(fixture)).toBe(false)
  })
})
