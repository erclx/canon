import { $ } from 'bun'
import { gitEnv } from '@/git/env'

/**
 * How a first-parent commit enters the delivery figures. A bot or a release
 * leaves every figure, a typed one feeds the type counts, and an untyped one
 * counts toward coverage alone.
 */
export type MergeClass = 'typed' | 'untyped' | 'bot' | 'release'

/** One first-parent commit, read as one merge under the squash assumption. */
export interface Merge {
  readonly sha: string
  /** Committer date, `YYYY-MM-DD` in the committer's own zone. */
  readonly date: string
  readonly subject: string
  readonly author: string
  readonly class: MergeClass
  /** The conventional type, present only on a `typed` merge. */
  readonly type?: string
  readonly files: readonly string[]
}

const TYPED = /^([a-z]+)(\([^)]*\))?!?: /

/**
 * The release-please subject both measured repositories use. Releases leave by
 * subject rather than author, since 475 of canon's 485 carry a human author.
 */
const RELEASE = /^chore(\([^)]*\))?: release /

/** GitHub's app accounts carry `[bot]` in both the name and the noreply address. */
function isBot(author: string, email: string): boolean {
  return author.includes('[bot]') || email.includes('[bot]')
}

export function classify(
  subject: string,
  author: string,
  email: string,
): { class: MergeClass; type?: string } {
  if (isBot(author, email)) return { class: 'bot' }
  if (RELEASE.test(subject)) return { class: 'release' }

  const typed = TYPED.exec(subject)
  return typed ? { class: 'typed', type: typed[1] } : { class: 'untyped' }
}

const RECORD = '\x1e'
const FIELD = '\x1f'

/** The `--format` that `parseLog` reads, with `-z` separating the file names. */
export const LOG_FORMAT = `${RECORD}%H${FIELD}%cI${FIELD}%an${FIELD}%ae${FIELD}%s`

/**
 * Parses `git log -z --name-only` under `LOG_FORMAT`. Each record is the
 * header, a NUL, then the file names, each NUL-terminated after a leading
 * newline. Names come NUL-separated because newline output C-quotes a path
 * holding a quote or a non-ASCII character.
 */
export function parseLog(text: string): Merge[] {
  const merges: Merge[] = []

  for (const record of text.split(RECORD)) {
    if (!record) continue
    const [header, ...names] = record.split('\0')
    const [sha, committed, author, email, subject] = header.split(FIELD)
    if (!sha || !committed) continue

    const files = names
      .map((name) => name.replace(/^\n/, ''))
      .filter((name) => name !== '')

    merges.push({
      sha,
      date: committed.slice(0, 10),
      subject,
      author,
      ...classify(subject, author, email),
      files,
    })
  }

  return merges
}

/**
 * Reads the first-parent log from `since` (a `YYYY-MM-DD` date) to HEAD,
 * newest first. A merge commit's files are its diff against the first parent,
 * so a merge-commit repository reads the same files a squash would carry.
 *
 * Returns undefined when git cannot read the log.
 */
export async function readLog(
  root: string,
  since: string,
): Promise<Merge[] | undefined> {
  const result =
    await $`git -C ${root} log --first-parent --diff-merges=first-parent --no-renames -z --name-only ${`--format=${LOG_FORMAT}`} ${`--since=${since}`} HEAD`
      .env(gitEnv())
      .quiet()
      .nothrow()
  if (result.exitCode !== 0) return undefined
  return parseLog(result.text())
}

/** The repository's top level, HEAD's sha and date, and its first commit's date. */
export interface Repository {
  readonly root: string
  readonly head: string
  readonly headDate: string
  readonly firstDate: string
}

async function git(
  root: string,
  args: readonly string[],
): Promise<string | undefined> {
  const result = await $`git -C ${root} ${args}`.env(gitEnv()).quiet().nothrow()
  return result.exitCode === 0 ? result.text().trim() : undefined
}

/**
 * Resolves `path` to the repository holding it, reading from the top level so
 * the log's paths and the tree's paths name the same files.
 *
 * Returns undefined outside a git repository or in one with no commits.
 */
export async function readRepository(
  path: string,
): Promise<Repository | undefined> {
  const root = await git(path, ['rev-parse', '--show-toplevel'])
  if (root === undefined) return undefined

  const head = await git(root, ['log', '-1', '--format=%H%x1f%cI', 'HEAD'])
  const first = await git(root, [
    'log',
    '--first-parent',
    '--max-parents=0',
    '--format=%cI',
    'HEAD',
  ])
  if (!head || !first) return undefined

  const [sha, committed] = head.split(FIELD)
  const firstDate = first.split('\n').at(-1) ?? first

  return {
    root,
    head: sha,
    headDate: committed.slice(0, 10),
    firstDate: firstDate.slice(0, 10),
  }
}

/**
 * The lockfiles and release files that leave every file count, matched by
 * basename. A lockfile moves with every dependency bump and a release file with
 * every release, so either would lead the hotspots for no reason a reader acts on.
 */
const LOCK_AND_RELEASE: ReadonlySet<string> = new Set([
  'bun.lock',
  'bun.lockb',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'deno.lock',
  'Cargo.lock',
  'Gemfile.lock',
  'composer.lock',
  'poetry.lock',
  'uv.lock',
  'Pipfile.lock',
  'go.sum',
  'CHANGELOG.md',
  '.release-please-manifest.json',
])

export function isLockOrRelease(path: string): boolean {
  return LOCK_AND_RELEASE.has(path.slice(path.lastIndexOf('/') + 1))
}

/**
 * The paths among `paths` that `.gitattributes` marks `linguist-generated`,
 * the one marker of a generated file that holds across stacks.
 *
 * Returns an empty set when git cannot answer, since a missed generated file
 * stays in the counts rather than failing the report.
 */
export async function readGenerated(
  root: string,
  paths: readonly string[],
): Promise<Set<string>> {
  if (paths.length === 0) return new Set()

  const stdin = Buffer.from(`${paths.join('\0')}\0`)
  const result =
    await $`git -C ${root} check-attr -z --stdin linguist-generated < ${stdin}`
      .env(gitEnv())
      .quiet()
      .nothrow()
  if (result.exitCode !== 0) return new Set()

  // `-z` output is `<path> NUL <attribute> NUL <value> NUL` per path.
  const fields = result.text().split('\0')
  const generated = new Set<string>()
  for (let index = 0; index + 2 < fields.length; index += 3) {
    const value = fields[index + 2]
    if (value === 'set' || value === 'true') generated.add(fields[index])
  }
  return generated
}
