import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execa } from 'execa'
import { describe, expect, it } from 'vitest'
import { pythonFunctionSpans } from '@/code/python'

const FIXTURES = join(import.meta.dirname, 'fixtures', 'python')

/**
 * Prints every `def` and `async def` span Python's own parser finds, keyed by
 * path, with depth counting the functions around each one, the reference the
 * indentation reader is held to.
 */
const AST_SPANS = `
import ast, json, sys

def walk(node, depth, spans):
    for child in ast.iter_child_nodes(node):
        if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
            spans.append({"line": child.lineno, "lines": child.end_lineno - child.lineno + 1, "name": child.name, "depth": depth})
            walk(child, depth + 1, spans)
        else:
            walk(child, depth, spans)

out = {}
for path in sys.argv[1:]:
    with open(path, encoding="utf-8") as f:
        out[path] = []
        walk(ast.parse(f.read()), 0, out[path])
print(json.dumps(out))
`

interface Span {
  readonly line: number
  readonly lines: number
  readonly name: string | null
  readonly depth: number
}

const byPlace = (a: Span, b: Span): number =>
  a.line - b.line || a.depth - b.depth

const fixtures = readdirSync(FIXTURES)
  .filter((name) => name.endsWith('.py'))
  .map((name) => join(FIXTURES, name))

/**
 * Runs whatever `python3` is on PATH, so a fixture holds no syntax newer than
 * 3.12. A missing interpreter rejects, which fails the test rather than
 * skipping it.
 */
async function astSpans(): Promise<Record<string, Span[]>> {
  const { stdout } = await execa('python3', [
    '-I',
    '-c',
    AST_SPANS,
    ...fixtures,
  ])
  return JSON.parse(stdout) as Record<string, Span[]>
}

describe('pythonFunctionSpans against ast', () => {
  it('should find fixtures to compare', () => {
    expect(fixtures.length).toBeGreaterThan(0)
  })

  it('should read the spans Python parses in every fixture', async () => {
    const expected = await astSpans()

    const actual = Object.fromEntries(
      fixtures.map((file) => {
        const read = pythonFunctionSpans(readFileSync(file, 'utf8'))
        return [
          file,
          read.kind === 'read' ? [...read.spans].sort(byPlace) : read,
        ]
      }),
    )

    expect(actual).toEqual(
      Object.fromEntries(
        Object.entries(expected).map(([file, spans]) => [
          file,
          [...spans].sort(byPlace),
        ]),
      ),
    )
  })
})
