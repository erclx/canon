import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type WorkflowFile } from '@/pr/preview'

export async function readWorkflows(root: string): Promise<WorkflowFile[]> {
  const dir = join(root, '.github', 'workflows')
  if (!existsSync(dir)) return []
  const paths = [
    ...new Bun.Glob('*.{yml,yaml}').scanSync({ cwd: dir, onlyFiles: true }),
  ]
  return Promise.all(
    paths.map(async (name) => ({
      path: `.github/workflows/${name}`,
      text: await readFile(join(dir, name), 'utf8'),
    })),
  )
}
