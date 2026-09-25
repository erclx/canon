/**
 * The surfaces where markdown states what an agent does, and the extensions
 * that read as prose, held as data one command parses.
 *
 * Lifted verbatim in content from the list `auto-ship` Step 6 carried, whose
 * written fallback copy now sits in `auto-ship/references/verb-absent.md`,
 * which a session was asked to apply by hand. It failed that
 * application three times, so the set moved here and the body now calls a verb
 * that reads it. Being machine-parsed makes it permanently exempt from any
 * later design that folds a standard back into the surface citing it, per the
 * machine-parsed clause in `canon/context/standards/resolution.md`.
 */

/**
 * Path prefixes under which a markdown change is a behavior change.
 *
 * Most carry two spellings, the one a surface authors at and the one it reaches
 * a session at, so the rule reads the same in this toolkit and in a project
 * that consumed one. `standards/` and `snippets/` carry one apiece: neither
 * installs into a project, reaching a reader by resolution and through the
 * `claude/snippets` symlink respectively, so no `.claude/` spelling exists to
 * name.
 */
export const BEHAVIOR_PREFIXES = [
  'claude/skills/',
  '.claude/skills/',
  'governance/rules/',
  '.claude/rules/',
  'standards/',
  'snippets/',
  'internal/',
  'tooling/',
] as const

/**
 * Behavior surfaces named as whole paths rather than as prefixes.
 *
 * A path prefix reaches nothing that sits in no folder, which is what the root
 * instruction file is. Matching is equality rather than a suffix test, so a
 * nested `docs/CLAUDE.md` stays informational the way the body's "at the
 * repository root" qualifier says it should.
 */
export const BEHAVIOR_FILES = ['CLAUDE.md'] as const

/**
 * Extensions a changed file may carry for the branch to read as prose-only.
 *
 * Compared lowercased, so a `README.MD` is not routed to review for its
 * spelling. Everything else is code, a config, or an asset, and one of them
 * sends the whole branch to review.
 */
export const PROSE_EXTENSIONS = ['.md', '.txt'] as const
