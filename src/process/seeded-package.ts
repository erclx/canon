import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PROJECT_ROOT } from '@/roots/project'
import { resolveChain } from '@/tooling/manifest'
import { collectDeps, parseSpec } from '@/tooling/package'

// A write run into a folder with no package.json would run `bun add -D` against
// the registry. A package.json already naming the stack's packages leaves
// nothing to install, so a test not about the manifest stays offline.
export const seedPackage = (dir: string, stack: string): void => {
  const path = join(dir, 'package.json')
  if (existsSync(path)) return

  const devDependencies = Object.fromEntries(
    collectDeps(resolveChain(PROJECT_ROOT, stack), {}).map((dep) => [
      dep.name,
      parseSpec(dep.spec).pin || '*',
    ]),
  )
  writeFileSync(path, JSON.stringify({ devDependencies }))
}
