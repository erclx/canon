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
 * when the command failed.
 *
 * Injected rather than called here, so the disagreement this module exists to
 * report is a fixture rather than a live push nobody can stage in a test.
 */
export type RefReader = (branch: string) => Promise<string | null>

/**
 * The sha `git ls-remote` reported for exactly this branch.
 *
 * Matched on the whole ref rather than on a suffix, because the command takes
 * its argument as a pattern: `--heads origin x` also returns `refs/heads/feat/x`,
 * and reading the first line back would answer about another branch entirely.
 */
function findRef(stdout: string, branch: string): string | undefined {
  for (const line of stdout.split('\n')) {
    const [sha, ref] = line.trim().split(/\s+/)
    if (sha !== undefined && ref === `refs/heads/${branch}`) return sha
  }
  return undefined
}

/**
 * Resolves a branch tip from the remote itself.
 *
 * The remote rather than the remote-tracking ref, since a tracking ref is only
 * as current as the last fetch and the whole point here is answering about a
 * push this process never saw. It costs a round trip, measured at 0.410s
 * against 0.001s for the local read.
 *
 * A read that failed and a branch the remote does not carry are separated
 * rather than collapsed. Reading the first as the second would report a
 * network refusal as a deleted branch, which is a different repair.
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
 * Compares the head a pull request object reports against the branch tip.
 *
 * `gh pr view --json headRefOid` answers from the pull request object, which
 * lags the branch ref by up to a minute after a push and reports nothing about
 * the lag. A session trusting it calls a pushed commit unpushed and claims
 * green against a commit CI never saw. The tip is the authority and the
 * object's head is the claim being checked against it.
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
