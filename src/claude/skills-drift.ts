import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { execaSync } from 'execa'
import { gitEnv } from '@/git/env'

/**
 * The shipped corpus alone. A session loads a body from the plugin root, which
 * resolves to `claude/skills/`, so the internal tree carries no held copy that
 * could go stale in one.
 *
 * Held with posix separators because it is passed to git as a pathspec. Git
 * emits and accepts posix separators on every platform, so a `join()` form would
 * reach a Windows checkout as `claude\skills`, match no path, and return an
 * empty log that reads as a tree where nothing moved.
 */
const SHIPPED_SKILLS = 'claude/skills'

/** A `%H` line, which is 40 hex characters under sha1 and 64 under sha256. */
const COMMIT = /^[0-9a-f]{40,64}$/

/**
 * A skill body, which is the only file in the folder a session loads. A
 * reference or a requirement beside it is read by whoever opens it, so it holds
 * no copy that outlives the read.
 */
const BODY = /^claude\/skills\/([^/]+)\/SKILL\.md$/

export interface MovedBody {
  readonly name: string
  /** The newest commit that rewrote this body, not the first. */
  readonly commit: string
}

export type DriftReport =
  | {
      readonly kind: 'measured'
      readonly base: string
      readonly head: string
      readonly moved: readonly MovedBody[]
    }
  | { readonly kind: 'unreadable'; readonly reason: string }

/**
 * Reads `--name-only` log output into one entry per skill whose body moved.
 *
 * Reverse-chronological input means the first commit naming a body is the
 * newest that rewrote it, so an existing name is never overwritten. A body
 * rewritten twice therefore reports the recent commit, which is the one a
 * session can read to see what it is missing.
 */
export function parseMovedBodies(output: string): MovedBody[] {
  const moved = new Map<string, string>()
  let commit = ''

  for (const line of output.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '') continue

    if (COMMIT.test(trimmed)) {
      commit = trimmed
      continue
    }

    const match = BODY.exec(trimmed)
    if (match === null || commit === '') continue
    if (!moved.has(match[1])) moved.set(match[1], commit)
  }

  return [...moved]
    .map(([name, sha]) => ({ name, commit: sha }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

/**
 * Which shipped skill bodies were rewritten between `ref` and the current
 * `HEAD` of the tree at `root`.
 *
 * This measures a file moving rather than a held copy differing. A session
 * cannot read its own loaded body as bytes, so the comparison runs against
 * history and a session passing a ref older than its oldest load over-reports.
 * That is the safe direction, since confirming a name costs one read of the
 * body while the failure this answers is silence.
 *
 * Every path that cannot answer returns `unreadable` with its own reason. A
 * target project loads the plugin from a marketplace cache with no history
 * behind it, where reporting an empty result would read as a clean tree.
 */
export function readDrift(root: string, ref: string): DriftReport {
  if (!existsSync(join(root, SHIPPED_SKILLS))) {
    return {
      kind: 'unreadable',
      reason: `No shipped skill corpus under ${root}. Looked for ${SHIPPED_SKILLS}.`,
    }
  }

  const head = revParse(root, 'HEAD')
  if (head === undefined) {
    return {
      kind: 'unreadable',
      reason: `No git history under ${root}. A plugin loaded from a marketplace cache carries none, so a ref cannot be resolved there.`,
    }
  }

  const base = revParse(root, ref)
  if (base === undefined) {
    return {
      kind: 'unreadable',
      reason: `Ref ${ref} resolves to no commit in ${root}. Pass a commit this tree carries.`,
    }
  }

  const result = execaSync(
    'git',
    [
      '-C',
      root,
      'log',
      '--name-only',
      '--no-renames',
      '--format=%H',
      `${base}..${head}`,
      '--',
      SHIPPED_SKILLS,
    ],
    { reject: false, env: gitEnv(), extendEnv: false },
  )

  if (result.exitCode !== 0) {
    return {
      kind: 'unreadable',
      reason: `Reading history between ${ref} and HEAD failed: ${result.stderr || result.stdout}`,
    }
  }

  return {
    kind: 'measured',
    base,
    head,
    moved: parseMovedBodies(result.stdout),
  }
}

/**
 * The commit a ref names, or `undefined` when the tree carries no repository or
 * no such ref. `^{commit}` is what turns a tag or a tree into the commit behind
 * it, so a caller never compares a ref against an object of another type.
 */
function revParse(root: string, ref: string): string | undefined {
  const result = execaSync(
    'git',
    ['-C', root, 'rev-parse', '--verify', '--quiet', `${ref}^{commit}`],
    { reject: false, env: gitEnv(), extendEnv: false },
  )

  return result.exitCode === 0 ? result.stdout.trim() : undefined
}
