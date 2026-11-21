import { chmod, copyFile, mkdir, stat } from 'node:fs/promises'
import { dirname } from 'node:path'

/**
 * Copies with `cp` semantics: `Bun.write` drops the executable bit, and `copyFile` imposes the
 * source mode on an existing destination, which `cp` leaves alone. Every domain that writes into
 * a target routes through here.
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
