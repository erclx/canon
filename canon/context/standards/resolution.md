---
title: Resolution
description: The two roots a standard resolves against, how each surface cites a standard, why the install channel closed, why skill-local copies lost to the flat root, and the reading gotchas
---

# Resolution

No standard installs into a project. A reader resolves one instead, and everything below follows from that: which roots answer, which route a shipped body actually takes, and why a narrow-readership standard still sits in the flat corpus.

## The two roots

`standardRoots` in `src/standards/read.ts` returns `standards/` at the caller's working directory, then the corpus inside the canon package. The first is this repository's authoring root and a project's own folder anywhere else, so a repository that writes standards governs its own copy. The second answers everywhere else, which is every target.

`.claude/standards/` is not a root. In a target holding one it is a stale artifact an older toolkit left, inert rather than authoritative.

Two entries rather than one because a checkout of this repository would otherwise resolve an edit in progress against whatever the installed package holds. A target carries neither the first root nor a copy of the second, so only one answers there and no precedence is left to reason about.

## Citing a standard by surface

No single citation form answers everywhere, since nothing mirrors the corpus under `.claude/` and no install writes a copy into a target. `internal/rules/claude/598-authoring-layout.md` states the split as one case apiece: a body under `claude/` cites the plugin root, a rule or a seed calls `canon standards <name>`, and a file staying in this repository cites `standards/<name>.md`.

A reader has to know which surface they are on, and nothing checks that they got it right. `DEFAULT_FOLDERS` in `src/context/folders.ts` covers `context`, `decisions`, `diagrams`, and `wireframes`, so the citation gate never resolves a `standards/` path either way and reports nothing on a wrong form.

The `paths:` glob on `891-standard-authoring` matches `standards/` alone, so a target holding a stale installed copy elsewhere never matches that rule, which governs authoring rather than an installed artifact.

## No install verb

The domain has no install and no sync verb, and writes no copy into a target. `canon init` carries no `Standards` step and no `--standards` flag, and the domain sits outside `SCANNED_DOMAINS`, `SYNC_DOMAINS`, `STAMP_DOMAINS`, and the root layouts `detectUnmigrated` walks.

A reader who needs a concern a `Does not govern:` entry hands off runs `canon standards <name>` again for that name.

`NonInteractivePolicy` in `src/sync/engine.ts` carries a `refuse` branch that standards was the only adapter to declare, so it is now unreachable, and `hasUnattributedDrift` is read only from inside it. The type stays because it is an extension point a later adapter may declare, and removing it would delete that option along with the code.

## Why the install channel closed

The corpus reaches a project two ways and neither writes into it: the `claude/standards` symlink puts the whole corpus in every plugin cache for a session, and the published package carries it as the CLI's root for a machine reader. An install verb writing the flat root into a target is the alternative that lost, because every copy becomes a file sync has to reconcile forever, measured at five relocated standards sitting 12 to 45 lines behind with no command able to refresh them. Measured at `3ac31a09` on 2026-08-20.

`tooling/<stack>/reference.md` closed the same channel for tooling stack references: `src/tooling/read.ts` resolves a reference at the working root ahead of the packaged corpus, mirroring `standardRoots`, and `canon tooling reference <stack>` is the read verb `canon tooling sync` stopped writing a copy through. Measured at `16591fd2` on 2026-08-27.

A machine-parsed standard is exempt from any design inlining a standard into the rule that cites it, because a rule restating the list a parser reads is two sources for one list. The set is empty: the ban set and the six structural checkpoints that made `markdown.md` a member ship as data in `src/markdown/` instead, at the accepted cost that the prose and the shipped numbers can drift with nothing comparing them. Measured at `60fc97bf` on 2026-08-19.

## Skill-local references

A standard several surfaces cite, however narrow its readership, sits in the flat root like every other standard and resolves through `${CLAUDE_SKILL_DIR}/../../standards/<name>.md` at zero copies.

A generated folder copying each narrow-readership standard into its consumers' `references/` is the alternative that lost, on a duplication measurement: the most-cited standard, named by 21 skill bodies across the two catalogs, would have landed a copy in each, while the fallback citation form 39 bodies already carried serves a root standard to any number of readers at zero copies. Measured at `16a80339` on 2026-08-25.

A file under a skill's own `references/` is always hand-authored and skill-local. Nothing generates a copy into `references/`, so a reference living only there is written for that one skill and carries no `consumers:` field to read.

## Standards read by more than one session

`standards/groundwork.md` and `standards/intake.md` sit in the flat root rather than a skill's `references/`, since both govern a folder edited routinely by sessions that never invoke the skill that names them. A skill-local reference is right for a file only that skill reads. A standard a session opens directly is not that file. Each skill cites its standard at the plugin root, the single form every shipped body takes.

Both govern a gitignored folder no check reaches, which puts them in one class with the plan and memory standards. `.claude/hooks/standards-audit.sh` exits early on the scratch paths and the audit skill reads changed files from git, which never lists a gitignored one, so all four are enforced by a session reading them and by nothing else. `canon records validate <kind>` reports against each of the four without writing, which is what makes a verb safe over a folder with no history to recover from.

A fifth kind, `standards`, reads this corpus rather than a gitignored folder and keeps the same reporting-only discipline for the opposite reason: a standard is tracked and cited by bare filename across the tree, so the risk a write carries is a rename reaching further than the file it moved rather than a repair nothing can undo. `canon/context/cli/audits/records.md` holds the check and its two roots.

## The command route

A shipped body names one path for a standard, and the command route is what nearly none takes: most shipped bodies name `${CLAUDE_SKILL_DIR}/../../standards/<name>.md`, and a handful call `canon standards` where a resolved root rather than a named file is what they want. `claude/standards` is a symlink carrying the whole corpus, so a body reading a standard in a target that installed the plugin is answered there and never reaches the resolve in `src/standards/read.ts`.

The resolve has exactly one caller, `src/commands/standards.ts`, and no shipped body invokes the verb directly. Its second root is the package corpus, which is the route a machine reader takes and the reason a command reading a standard answers in any target. `<canon>` is how a resolve from that root spells itself, since the other label is project-relative and a report could join it to a root.

`infra:standards read` is the sandbox arm that covers it, and `canon/context/sandbox/coverage/workflow-arms.md` records what the arm reaches and what it leaves to the plugin-root route.

## Gotchas

- A target holding `.claude/standards/` from an older toolkit resolves nothing through it. The folder is inert rather than authoritative, and deleting it is safe. This repository carries no such folder either.
- A project that wants a standard of its own writes `standards/<slug>.md` at its root, which the resolver reads ahead of the package. `create-standard` writes there in the toolkit and in a target alike.
- Do not hand-edit `standards/index.md` here. `regen-indexes.sh` rewrites it from the frontmatter of whatever is present, and a standard missing `title` or `description` fails that regen.
- `bun run check` regenerates nothing for this corpus, and the Consumed copies stage names `.claude/rules` alone. Editing `standards/<name>.md` needs no second file staged behind it. No skill-reference fan-out exists either: a `references/` file is skill-local and edited in place.
- A grep for `standards install` or `standards sync` in a skill body or a doc is a stale citation, not a verb. Neither exists.
- A standard citing a `docs/agents/` page resolves as a path here and nowhere else, since neither root carries a `docs/` tree. `standards/tasks.md` carries the first such pointer.
- `canon docs <name>` resolves a sub-area file by its bare name, so `canon docs tasks` is the spelling the pointer above can run. A name two folders of one root share still resolves to neither, and across roots `docs/` answers first.
- The two read routes return different bytes. `canon standards <name>` runs its file through `stripFrontmatter` at `src/standards/read.ts:99`, so stdout opens at the H1, while the `content` field of `canon standards list --json` carries the source whole. Anything comparing a target's leftover copy against the corpus reads the catalog, since an install once copied the source file whole and the verb's output differs from it by the frontmatter block. Measured 2026-08-28: the catalog's `content` for `slug` is byte-identical to `standards/slug.md`.

A plan's measured claim that nothing covers an artifact can be false when the covering file sits in a subfolder a catalog read excludes, since the listing the plan trusted then reports it missing while the conclusion drawn from it is wrong. Glob a domain root recursively rather than reading its `index.md` alone, and where a match turns up in an excluded subfolder, the fix is usually a promotion to the flat root plus the one missing rule.
