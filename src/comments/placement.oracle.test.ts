import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execaSync } from 'execa'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { lex } from '@/code/lex'
import { placementReader } from '@/comments/placement'
import { isPruned, languageFor } from '@/comments/scan'

const root = join(import.meta.dirname, '..', '..')

/** Every tracked TypeScript source the scan reads. */
function trackedSources(): string[] {
  return execaSync('git', ['-C', root, 'ls-files'])
    .stdout.split('\n')
    .filter((path) => languageFor(path) === 'ts' && !isPruned(path))
}

/** The compiler's function block bodies, the reference the walk is held to. */
function compilerBodies(path: string, source: string): ts.Block[] {
  const file = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const bodies: ts.Block[] = []
  const visit = (node: ts.Node): void => {
    if (
      ts.isFunctionLike(node) &&
      'body' in node &&
      node.body !== undefined &&
      ts.isBlock(node.body as ts.Node)
    ) {
      bodies.push(node.body as ts.Block)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return bodies
}

describe('placementReader against the compiler', () => {
  it('should place every comment in every tracked file as the compiler does', () => {
    const disagreements: string[] = []

    for (const path of trackedSources()) {
      const source = readFileSync(join(root, path), 'utf8')
      const bodies = compilerBodies(path, source)
      const read = placementReader(path, source)
      const { comments } = lex(source, { jsx: path.endsWith('.tsx') })

      for (const start of comments.values()) {
        const expected = bodies.some(
          (body) => body.getStart() < start && start < body.end,
        )
          ? 'body'
          : 'head'
        if (read(start) !== expected) {
          const line = source.slice(0, start).split('\n').length
          disagreements.push(`${path}:${line} read ${read(start)}`)
        }
      }
    }

    expect(disagreements).toEqual([])
  }, 60_000)
})
