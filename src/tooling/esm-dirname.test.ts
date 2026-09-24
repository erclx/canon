import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PROJECT_ROOT } from '@/project-root'

// A golden config loads as ESM under a native config loader, where
// `__dirname` is undefined and a path built from it silently resolves nowhere.
// `import.meta.dirname` is the ESM spelling every supported runtime carries.
function findDirnameUses(): string[] {
  const glob = new Bun.Glob('*/configs/**/*.{ts,mts,js,mjs}')
  const toolingRoot = join(PROJECT_ROOT, 'tooling')

  return Array.from(glob.scanSync({ cwd: toolingRoot, dot: true }))
    .sort()
    .flatMap((relative) =>
      readFileSync(join(toolingRoot, relative), 'utf8')
        .split('\n')
        .flatMap((line, index) =>
          line.includes('__dirname')
            ? [`tooling/${relative}:${index + 1}`]
            : [],
        ),
    )
}

describe('golden config module scope', () => {
  it('should resolve paths without the CommonJS __dirname global', () => {
    expect(findDirnameUses()).toEqual([])
  })
})
