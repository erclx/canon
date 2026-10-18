/**
 * Path prefixes, from the repository root, whose context entries gate on the
 * section shape under `--gate`.
 *
 * Every other entry still reports its shape findings and never fails a push,
 * since the entries are rebuilt to the shape a batch at a time and an unrebuilt
 * one carries `## Decisions` by construction. A batch rebuilding a folder adds
 * its prefix here in the same change, which is what holds the folder to the
 * shape from then on.
 *
 * Read against the repository root rather than the audit root, so a seed tree
 * audited at its own root is listed by its path in the toolkit, such as
 * `tooling/base/seeds/`, and never collides with the entry a target installs
 * from it.
 */
export const SHAPE_GATED_FOLDERS: readonly string[] = [
  'canon/context/context-model.md',
  'canon/context/development/',
  'canon/context/features/',
  'canon/context/surfaces/',
  'canon/context/workflow/',
]

/** Whether a repository-relative entry path sits under a gated prefix. */
export function isShapeGated(
  rel: string,
  prefixes: readonly string[] = SHAPE_GATED_FOLDERS,
): boolean {
  return prefixes.some((prefix) => rel.startsWith(prefix))
}
