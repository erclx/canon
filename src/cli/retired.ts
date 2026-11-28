export interface RetiredVerb {
  /** The words a caller types after `canon`, one for a group and two for a subcommand. */
  readonly path: readonly string[]
  /** The release that dropped the verb, from the changelog. */
  readonly release: string
  readonly movedTo: string
}

const DESIGN_MOVED =
  'the design values now live in the stylesheet your canon/DESIGN.md lead names'

const CONTEXT_MOVED = '`canon context audit`, which reports placement findings'

/**
 * Every verb a release dropped, with the release and where the work went. The
 * router reads this ahead of the parser, and `canon migrate status` reads it to
 * find project calls. A verb that returns leaves this table in the same change.
 */
export const RETIRED_VERBS: readonly RetiredVerb[] = [
  {
    path: ['canvas'],
    release: '5.54.0',
    movedTo: 'Frameboard, which carries the design board in its own repository',
  },
  { path: ['design', 'render'], release: '5.54.0', movedTo: DESIGN_MOVED },
  { path: ['design', 'install'], release: '5.54.0', movedTo: DESIGN_MOVED },
  { path: ['design', 'sync'], release: '5.54.0', movedTo: DESIGN_MOVED },
  { path: ['design', 'fonts'], release: '5.54.0', movedTo: DESIGN_MOVED },
  { path: ['design', 'list'], release: '5.54.0', movedTo: DESIGN_MOVED },
  { path: ['design', 'add'], release: '5.54.0', movedTo: DESIGN_MOVED },
  {
    path: ['teach'],
    release: '5.53.0',
    movedTo: 'the canon:teach-craft skill',
  },
  {
    path: ['slides'],
    release: '5.53.0',
    movedTo: 'the canon:teach-craft skill',
  },
  {
    path: ['demo'],
    release: '5.53.0',
    movedTo: 'a tool built for composed video',
  },
  { path: ['context', 'classify'], release: '5.64.0', movedTo: CONTEXT_MOVED },
  {
    path: ['context', 'classifier'],
    release: '5.64.0',
    movedTo: CONTEXT_MOVED,
  },
]

/**
 * Matches the leading words of argv, stopping at the first option so a flag's
 * value is never read as a verb name.
 */
export function findRetired(args: readonly string[]): RetiredVerb | undefined {
  const words: string[] = []
  for (const arg of args) {
    if (arg.startsWith('-')) break
    words.push(arg)
  }
  return RETIRED_VERBS.find((verb) =>
    verb.path.every((word, index) => words[index] === word),
  )
}

export function retiredMessage(verb: RetiredVerb): string {
  return `error: 'canon ${verb.path.join(' ')}' was retired in v${verb.release}. The work moved to ${verb.movedTo}.`
}

export type StackCatalog = 'tooling' | 'governance'

export interface RetiredStack {
  readonly name: string
}

/**
 * Every stack the toolkit stopped shipping, read by each verb that would
 * otherwise report a bare `Stack not found` and by `canon sync --check` for a
 * recorded chain. Both catalogs dropped each one together.
 */
export const RETIRED_STACKS: readonly RetiredStack[] = [
  { name: 'go' },
  { name: 'php' },
]

export function findRetiredStack(name: string): RetiredStack | undefined {
  return RETIRED_STACKS.find((stack) => stack.name === name)
}

/**
 * A base tooling write replaces `scripts/verify.json` with a list requiring
 * only `check:format`, and the runner skips every phase it does not require,
 * so the way off customizes that file first or the project's checks stop.
 */
const WAY_OFF: Record<StackCatalog, string> = {
  tooling:
    'To keep its checks and move to base, run `canon tooling customize scripts/verify.json`, then `canon tooling sync base --write`.',
  governance:
    'Run `canon gov install base` to move to base, which keeps every rule base ships.',
}

/**
 * A chain naming no shipped stack is a subfolder synced with `--skip base`,
 * where a base write lands `.husky/` and `.github/` the root already owns.
 */
const ALONE_WAY_OFF =
  'Nothing the toolkit ships remains in this chain, as after a sync with `--skip base`, so leave the files as they are rather than writing base here.'

/**
 * Names the way off a retired stack. A tooling caller passes the recorded
 * chain when it has one, since the way off differs for a chain left with no
 * shipped stack, and a caller with none gets the base move.
 */
export function retiredStackMessage(
  name: string,
  catalog: StackCatalog,
  chain: readonly string[] = [],
): string {
  const alone =
    catalog === 'tooling' &&
    chain.length > 0 &&
    chain.every((each) => findRetiredStack(each) !== undefined)
  return `Stack '${name}' is no longer shipped by the toolkit. Its files stay yours. ${alone ? ALONE_WAY_OFF : WAY_OFF[catalog]}`
}
