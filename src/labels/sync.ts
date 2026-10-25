/**
 * The labels a map names that the remote does not carry yet, in map order.
 *
 * Only ever a subset of the map, so a label a person made by hand never
 * appears and nothing here can become an edit or a deletion on the remote.
 *
 * GitHub holds label names unique regardless of case, so a remote `Docs`
 * counts as carrying `docs`. Creating it would be refused, and every later
 * run would report the same failure.
 */
export function missingLabels(
  mapLabels: readonly string[],
  remote: readonly string[],
): string[] {
  const carried = new Set(remote.map((label) => label.toLowerCase()))
  return mapLabels.filter((label) => !carried.has(label.toLowerCase()))
}
