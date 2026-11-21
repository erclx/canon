import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { execaSync } from 'execa'
import { gitEnv } from '@/git/env'

/**
 * The shipped corpus alone, since a session loads a body from the plugin root.
 * Held with posix separators because git takes a pathspec in that form on every
 * platform, and `claude\skills` would match nothing and read as a clean tree.
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
 * Input is newest first, so the first commit naming a body is kept and an
 * existing name is never overwritten.
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
 * Which shipped skill bodies were rewritten between `ref` and the current `HEAD`.
 * Every path that cannot answer returns `unreadable` with its own reason, since
 * a marketplace cache has no history and an empty result would read as clean.
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
