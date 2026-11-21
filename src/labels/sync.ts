/**
 * The labels a map names that the remote does not carry yet, in map order. Only
 * ever a subset of the map, so nothing here can edit or delete a hand-made
 * label, and names match regardless of case since GitHub holds them unique.
 */
export function missingLabels(
  mapLabels: readonly string[],
  remote: readonly string[],
): string[] {
  const carried = new Set(remote.map((label) => label.toLowerCase()))
  return mapLabels.filter((label) => !carried.has(label.toLowerCase()))
}
