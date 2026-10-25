/**
 * The labels a map names that the remote does not carry yet, in map order.
 *
 * Only ever a subset of the map, so a label a person made by hand never
 * appears and nothing here can become an edit or a deletion on the remote.
 */
export function missingLabels(
  mapLabels: readonly string[],
  remote: readonly string[],
): string[] {
  const carried = new Set(remote)
  return mapLabels.filter((label) => !carried.has(label))
}
