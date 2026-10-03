import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ts from 'typescript'
import { afterEach, describe, expect, it } from 'vitest'

const BROWSER_DIR = import.meta.dirname

/**
 * A module's exported functions become page scripts with only their own source,
 * so a name resolving anywhere else throws in the browser with no type error.
 * Scope analysis needs a parser, and the shipped CLI carries none, so this
 * runs over the module sources rather than inside `compileScript`.
 */
function freeReferences(file: string, allowed: readonly string[]): string[] {
  const program = ts.createProgram([file], {
    lib: ['lib.dom.d.ts', 'lib.es2022.d.ts'],
    types: [],
    noResolve: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
  })
  const checker = program.getTypeChecker()
  const source = program.getSourceFile(file)
  const found: string[] = []
  if (!source) return found

  const scan = (fn: ts.FunctionDeclaration) => {
    const visit = (node: ts.Node) => {
      if (ts.isIdentifier(node)) {
        const declarations =
          checker.getSymbolAtLocation(node)?.declarations ?? []
        const isOutside = declarations.some(
          (declaration) =>
            !program.isSourceFileDefaultLibrary(declaration.getSourceFile()) &&
            (declaration.getSourceFile() !== source ||
              declaration.pos < fn.pos ||
              declaration.end > fn.end),
        )
        if (isOutside && !allowed.includes(node.text)) found.push(node.text)
      }
      ts.forEachChild(node, visit)
    }
    visit(fn)
  }

  source.forEachChild((node) => {
    const isExported =
      ts.isFunctionDeclaration(node) &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    if (isExported) scan(node)
  })

  return found
}

function moduleFiles(): string[] {
  return readdirSync(BROWSER_DIR).filter(
    (name) =>
      name.endsWith('.ts') &&
      !name.endsWith('.test.ts') &&
      name !== 'compile.ts',
  )
}

let dir: string | undefined

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
  dir = undefined
})

function writeFixture(body: string): string {
  dir = mkdtempSync(join(tmpdir(), 'browser-module-'))
  const file = join(dir, 'fixture.ts')
  writeFileSync(file, body)
  return file
}

describe('browser modules', () => {
  it.each(moduleFiles())(
    'should leave %s with no name resolving outside its function',
    (name) => {
      const allowed = name === 'sidebar.ts' ? ['focusLine'] : []

      expect(freeReferences(join(BROWSER_DIR, name), allowed)).toEqual([])
    },
  )
})

describe('freeReferences', () => {
  it('should name a file-level constant the function reads', () => {
    const file = writeFixture(
      'const shared = 1\nexport function run(): number {\n  return shared\n}\n',
    )

    expect(freeReferences(file, [])).toEqual(['shared'])
  })

  it('should name a sibling function the function calls', () => {
    const file = writeFixture(
      'function helper(): number {\n  return 1\n}\nexport function run(): number {\n  return helper()\n}\n',
    )

    expect(freeReferences(file, [])).toEqual(['helper'])
  })

  it('should accept a browser global and a name declared inside', () => {
    const file = writeFixture(
      'export function run(): string {\n  const own = document.title\n  return own\n}\n',
    )

    expect(freeReferences(file, [])).toEqual([])
  })
})
