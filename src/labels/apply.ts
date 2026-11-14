/** What a label apply decided to do, before any write. */
export interface LabelDiff {
  /** Earned labels the pull request lacks and the remote carries, so addable. */
  readonly toAdd: readonly string[]
  /** Every earned label the pull request lacks, whether or not it is addable. */
  readonly owed: readonly string[]
  /** Owed labels the remote does not carry, which are reported and never created. */
  readonly missingOnRemote: readonly string[]
}

/**
 * Diffs what a branch earns against what its pull request already carries and
 * what the remote can attach.
 *
 * The diff only adds. A label the map does not earn is a person's decision and
 * never appears here, so nothing in the result can become a removal. Order
 * follows `earned`, so two runs over one branch produce one list. A label the
 * remote lacks is set apart rather than dropped, since the REST add endpoint
 * creates any label it is handed. Names match regardless of case, as GitHub
 * holds them, which agrees with `missingLabels`.
 */
export function diffLabels(
  earned: readonly string[],
  present: readonly string[],
  remote: readonly string[],
): LabelDiff {
  const fold = (labels: readonly string[]): Set<string> =>
    new Set(labels.map((label) => label.toLowerCase()))
  const has = fold(present)
  const carried = fold(remote)

  const owed = earned.filter((label) => !has.has(label.toLowerCase()))

  return {
    owed,
    toAdd: owed.filter((label) => carried.has(label.toLowerCase())),
    missingOnRemote: owed.filter((label) => !carried.has(label.toLowerCase())),
  }
}
