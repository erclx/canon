import { join } from 'node:path'
import { execa } from 'execa'
import { checkoutMismatchWarning, PROJECT_ROOT } from '@/roots/project'
import { logWarn } from '@/cli/ui'

export async function execScript(
  script: string,
  args: string[],
): Promise<void> {
  const mismatch = checkoutMismatchWarning(process.cwd())
  if (mismatch !== undefined) logWarn(mismatch)

  const scriptPath = join(PROJECT_ROOT, 'scripts', script)
  const result = await execa(scriptPath, args, {
    stdio: 'inherit',
    env: { ...process.env, PROJECT_ROOT },
    reject: false,
  })
  process.exit(result.exitCode ?? 1)
}
