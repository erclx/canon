---
name: index-lookup
description: Why a topic search over the tracked index catalog needs its own skill, and why a folder outside `list`'s walk gets a named pointer instead of a search hit
---

# Index lookup requirement

## Gap

Without this skill, `canon indexes list --json` exists as a verb with nobody wrapping it into a topic-search request. A session either greps the tree by hand, which misses everything the catalog already states in `title` and `description` rather than in file contents, or answers from whichever folder it happened to open, which reports a topic as undocumented when the topic only sits outside the walked corpus: a gitignored indexed folder such as `.canon/tasks/` or `.canon/memory/`, or a README-based record catalog such as `.canon/groundwork/`, neither of which `list` ever reaches.

## Must

- Run `canon indexes list --json` and match the topic against every entry's `title`, `description`, and `path`
- Check whether the project carries a gitignored indexed folder or a README-based record catalog outside `list`'s walk before naming any of them, since a folder absent from the project names nothing
- Report zero hits inside the walked corpus as zero hits, never as "not documented," since a folder outside the walk can still hold the answer

## Must not

- Search file contents. A miss against `title`, `description`, and `path` is the whole answer, and grepping the tree is a different request.
- Extend `canon indexes list` to read a `README.md` catalog or to bypass the gitignore filter. Both are accepted trade-offs the verb already carries, and widening either is a CLI change, not a skill-body change.
- Regenerate an index on its own initiative. Reporting a stale-looking entry is this skill's job, and writing the fix belongs to `canon indexes regen`.
- Fire from a request to browse a file whose path is already known, or to search source code, both of which this skill answers nothing for
- Assume this skill's own invocation frequency needs no check. The reminder hook names it beside `canon indexes list --json`, and a session recognizing a topic-lookup request can trigger it by description, but whether anything reaches for it beyond an operator typing its name has no answer at creation time, so a review pass some months in should read that back rather than take it on faith.

## Guards

- `canon indexes list` does not resolve on an older install. Report that rather than falling back to a manual walk, since a hand-rolled walk here restates the CLI logic this skill exists to call.
- A folder failing frontmatter validation drops out of `entries` and its message lands in `errors`, per the verb's own per-folder isolation. Report the error alongside the match rather than treating it as a reason to stop.

## Out of scope

- Regenerating or scaffolding an index, which `canon indexes regen` and the `setup` skill's `indexes` phase own
- Reading a folder's contents once a hit names it, which is an ordinary file read rather than part of the lookup
- Chaining this skill into the `setup` skill's `indexes` phase as a verification step. Left independent: that phase already validates through `canon indexes regen --dry-run`, and a second skill call inside a bootstrap flow duplicates a check that already runs.
