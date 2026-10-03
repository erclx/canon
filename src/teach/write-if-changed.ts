import { readFile, writeFile } from 'node:fs/promises'

/**
 * Writes `text` to `path` only when the file does not already hold it, and
 * reports whether it wrote. `canon teach up` watches the folder `nav` writes
 * into, so a pass that rewrites unchanged bytes raises the events that start
 * the next pass, and an unchanged mtime is what lets the loop settle.
 */
export async function writeIfChanged(
  path: string,
  text: string,
): Promise<boolean> {
  const current = await readFile(path, 'utf8').catch(() => undefined)
  if (current === text) return false
  await writeFile(path, text)
  return true
}
