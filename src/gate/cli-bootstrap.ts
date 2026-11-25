import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const ENTRY = 'src/cli.ts'
const COMMANDS = 'src/commands/'
const IMPORT = /(?:from|import\()\s*['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g

function resolveLocal(root: string, from: string, spec: string): string {
  const base = spec.startsWith('@/')
    ? join(root, 'src', spec.slice(2))
    : resolve(dirname(join(root, from)), spec)
  const found = [
    `${base}.ts`,
    `${base}.tsx`,
    base,
    join(base, 'index.ts'),
  ].find((path) => /\.tsx?$/.test(path) && existsSync(path))
  if (found === undefined)
    throw new Error(`cannot resolve ${spec} from ${from}`)
  return relative(root, found)
}

/**
 * The CLI entry and what it loads outside a command, which every command runs
 * through and no command's import graph holds. A failed read throws, since a
 * missing answer must not narrow the scope.
 */
export function cliBootstrap(root: string): readonly string[] {
  const seen = new Set<string>()
  const queue = [ENTRY]
  while (queue.length > 0) {
    const file = queue.pop() as string
    if (seen.has(file)) continue
    seen.add(file)
    const source = readFileSync(join(root, file), 'utf8')
    for (const match of source.matchAll(IMPORT)) {
      const spec = match[1] ?? match[2]
      if (!spec.startsWith('@/') && !spec.startsWith('.')) continue
      const target = resolveLocal(root, file, spec)
      if (!target.startsWith(COMMANDS)) queue.push(target)
    }
  }
  return [...seen].sort()
}
