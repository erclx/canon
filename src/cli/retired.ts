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
