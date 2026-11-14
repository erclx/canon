/**
 * Path prefixes, from the repository root, whose context entries gate on the
 * section shape under `--gate`.
 *
 * Every other entry reports its shape findings and never fails a push, since
 * the entries are rebuilt a batch at a time. A batch rebuilding a folder adds
 * its prefix here in the same change. Read against the repository root, so a
 * seed tree audited at its own root is listed by its toolkit path, such as
 * `tooling/base/seeds/`, and never collides with the entry a target installs.
 */
export const SHAPE_GATED_FOLDERS: readonly string[] = [
  'canon/context/context-model.md',
  'canon/context/development/',
  'canon/context/features/',
  'canon/context/surfaces/',
  'canon/context/workflow/',
  'tooling/base/seeds/',
]

/** Whether a repository-relative entry path sits under a gated prefix. */
export function isShapeGated(
  rel: string,
  prefixes: readonly string[] = SHAPE_GATED_FOLDERS,
): boolean {
  return prefixes.some((prefix) => rel.startsWith(prefix))
}
