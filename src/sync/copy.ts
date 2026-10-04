import { chmod, copyFile, mkdir, stat } from 'node:fs/promises'
import { dirname } from 'node:path'

/**
 * Copies with `cp` semantics. Two behaviors matter and neither is the default
 * in the obvious alternatives. `Bun.write` drops the executable bit, which
 * would land husky hooks and `scripts/verify.sh` non-executable. Plain
 * `copyFile` imposes the source mode on an existing destination, so a file the
 * target deliberately restricted to 600, or an earlier stack set executable,
 * comes back at the source's mode. `cp` leaves an existing destination's mode
 * alone.
 *
 * Every domain that writes into a target routes through here. The tooling
 * inject path found the trap first, and the sync engine inherits it for every
 * adapter.
 */
export async function copyPreservingMode(
  src: string,
  dest: string,
): Promise<void> {
  await mkdir(dirname(dest), { recursive: true })

  const existingMode = await stat(dest)
    .then((info) => info.mode)
    .catch(() => undefined)

  await copyFile(src, dest)

  if (existingMode !== undefined) await chmod(dest, existingMode)
}
