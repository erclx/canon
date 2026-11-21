/** Whether the pull request object's head still names the branch tip. */
export type HeadState = 'fresh' | 'stale'

/** Why the tip could not be resolved from the remote. */
export type TipRefusal = 'unresolvable-ref' | 'no-remote-branch'

/** Why the comparison produced no reading, adding the object's own half. */
export type HeadRefusal = TipRefusal | 'no-object-head'

export type TipReading =
  | { readonly kind: 'read'; readonly tip: string }
  | { readonly kind: 'refused'; readonly reason: TipRefusal }

export type HeadReading =
  | {
      readonly kind: 'read'
      readonly state: HeadState
      readonly branch: string
      readonly tip: string
      readonly object: string
    }
  | {
      readonly kind: 'refused'
      readonly reason: HeadRefusal
      readonly branch: string
    }

/**
 * Hands back the stdout of `git ls-remote --heads origin <branch>`, or null
 * when the command failed. Injected rather than called here, so the disagreement
 * this module reports is a fixture, not a live push nobody can stage in a test.
 */
export type RefReader = (branch: string) => Promise<string | null>

/**
 * The sha `git ls-remote` reported for exactly this branch, matched on the whole
 * ref rather than a suffix, since the command takes a pattern: `--heads origin x`
 * also returns `refs/heads/feat/x`, and the first line would answer another branch.
 */
function findRef(stdout: string, branch: string): string | undefined {
  for (const line of stdout.split('\n')) {
    const [sha, ref] = line.trim().split(/\s+/)
    if (sha !== undefined && ref === `refs/heads/${branch}`) return sha
  }
  return undefined
}

/**
 * Resolves a branch tip from the remote itself rather than the tracking ref,
 * which is as stale as the last fetch, at a cost of 0.410s against 0.001s. A
 * failed read stays apart from a missing branch, or a refusal reads as deleted.
 */
export async function resolveTip(
  branch: string,
  read: RefReader,
): Promise<TipReading> {
  const stdout = await read(branch)
  if (stdout === null) return { kind: 'refused', reason: 'unresolvable-ref' }

  const tip = findRef(stdout, branch)
  if (tip === undefined) return { kind: 'refused', reason: 'no-remote-branch' }

  return { kind: 'read', tip }
}

/**
 * Compares the head a pull request object reports against the branch tip. The
 * object's head lags the branch ref by up to a minute after a push, so trusting
 * it claims green against a commit CI never saw; the tip is the authority.
 */
export async function resolveHead(
  branch: string,
  objectHead: string | undefined,
  read: RefReader,
): Promise<HeadReading> {
  const resolved = await resolveTip(branch, read)
  if (resolved.kind === 'refused') {
    return { kind: 'refused', reason: resolved.reason, branch }
  }

  if (objectHead === undefined || objectHead === '') {
    return { kind: 'refused', reason: 'no-object-head', branch }
  }

  return {
    kind: 'read',
    state: resolved.tip === objectHead ? 'fresh' : 'stale',
    branch,
    tip: resolved.tip,
    object: objectHead,
  }
}
