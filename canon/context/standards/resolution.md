---
title: Resolution
description: The two roots a standard resolves against, why the install channel and the generated mirror both closed, the retired fan-out and its consumers field, and the reading gotchas
---

# Resolution

No standard installs into a project. A reader resolves one instead, and everything below follows from that: which roots answer, which route a shipped body actually takes, and what the retired fan-out used to reach that the flat corpus reaches on its own now.

## The two roots

`standardRoots` in `src/standards/read.ts` returns `standards/` at the caller's working directory, then the corpus inside the canon package. The first is this repository's authoring root and a project's own folder anywhere else, so a repository that writes standards governs its own copy. The second answers everywhere else, which is every target.

`.claude/standards/` is not a root. In a target holding one it is a stale artifact an older toolkit left, inert rather than authoritative.

Two entries rather than one because a checkout of this repository would otherwise resolve an edit in progress against whatever the installed package holds. A target carries neither the first root nor a copy of the second, so only one answers there and no precedence is left to reason about.

## Citing a standard by surface

No single citation form answers everywhere, since nothing mirrors the corpus under `.claude/` and no install writes a copy into a target. `internal/rules/claude/598-authoring-layout.md` states the split as one case apiece: a body under `claude/` cites the plugin root, a rule or a seed calls `canon standards <name>`, and a file staying in this repository cites `standards/<name>.md`.

A reader has to know which surface they are on, and nothing checks that they got it right. `DEFAULT_FOLDERS` in `src/context/folders.ts` covers `context`, `decisions`, `diagrams`, and `wireframes`, so the citation gate never resolves a `standards/` path either way and reports nothing on a wrong form.

The `paths:` glob on `591-standard-authoring` matches `standards/` alone, so a target holding a stale installed copy elsewhere never matches that rule, which governs authoring rather than an installed artifact.

## No install verb

The domain has no install and no sync verb, and writes no copy into a target. `canon init` carries no `Standards` step and no `--standards` flag, and the domain sits outside `SCANNED_DOMAINS`, `SYNC_DOMAINS`, `STAMP_DOMAINS`, and the root layouts `detectUnmigrated` walks.

A reader who needs a concern a `Does not govern:` entry hands off runs `canon standards <name>` again for that name, rather than resolving a transitive closure the way an install selection once did.

`NonInteractivePolicy` in `src/sync/engine.ts` carries a `refuse` branch that standards was the only adapter to declare, so it is now unreachable, and `hasUnattributedDrift` is read only from inside it. The type stays because it is the extension point `canon/ARCHITECTURE.md` records a reason for, and removing it would delete that reason along with the code.

## Skill-local references

`standards/bundled/` and the `consumers:` frontmatter field it read do not exist. A standard several surfaces cite, however narrow its readership, sits in the flat root like every other standard and resolves through `${CLAUDE_SKILL_DIR}/../../standards/<name>.md` at zero copies. `canon/ARCHITECTURE.md` carries the reasoning that closed the folder rather than only bounding it.

A file under a skill's own `references/` is always hand-authored and skill-local. Nothing generates a copy into `references/`, so a reference living only there is written for that one skill and carries no `consumers:` field to read.

## Standards read by more than one session

`standards/groundwork.md` and `standards/intake.md` sit in the flat root rather than a skill's `references/`, since both govern a folder edited routinely by sessions that never invoke the skill that names them. A skill-local reference is right for a file only that skill reads. A standard a session opens directly is not that file. Each skill cites its standard at the plugin root, the single form every shipped body takes.

Both govern a gitignored folder no check reaches, which puts them in one class with the plan and memory standards. `.claude/hooks/standards-audit.sh` exits early on the scratch paths and the audit skill reads changed files from git, which never lists a gitignored one, so all four are enforced by a session reading them and by nothing else. `canon records validate <kind>` reports against each of the four without writing, which is what makes a verb safe over a folder with no history to recover from.

A fifth kind, `standards`, reads this corpus rather than a gitignored folder and keeps the same reporting-only discipline for the opposite reason: a standard is tracked and cited by bare filename across the tree, so the risk a write carries is a rename reaching further than the file it moved rather than a repair nothing can undo. `canon/context/cli/audits.md` holds the check and its two roots.

## The command route

A shipped body names one path for a standard, and the command route is what nearly none takes: most shipped bodies name `${CLAUDE_SKILL_DIR}/../../standards/<name>.md`, and a handful call `canon standards` where a resolved root rather than a named file is what they want. `claude/standards` is a symlink carrying the whole corpus, so a body reading a standard in a target that installed the plugin is answered there and never reaches the resolve in `src/standards/read.ts`.

The resolve has exactly one caller, `src/commands/standards.ts`, and no shipped body invokes the verb directly. Its second root is the package corpus, which is the route a machine reader takes and the reason a command reading a standard answers in any target. `<canon>` is how a resolve from that root spells itself, since the other label is project-relative and a report could join it to a root.

`infra:standards read` is the sandbox arm that covers it, and `canon/context/sandbox/coverage.md` records what the arm reaches and what it leaves to the plugin-root route.

## Gotchas

- A target holding `.claude/standards/` from an older toolkit resolves nothing through it. The folder is inert rather than authoritative, and deleting it is safe. This repository carries no such folder either.
- A project that wants a standard of its own writes `standards/<slug>.md` at its root, which the resolver reads ahead of the package. `create-standard` writes there in the toolkit and in a target alike.
- Do not hand-edit `standards/index.md` here. `regen-indexes.sh` rewrites it from the frontmatter of whatever is present, and a standard missing `title` or `description` fails that regen.
- `bun run check` regenerates nothing for this corpus, and the Consumed copies stage names `.claude/rules` alone. Editing `standards/<name>.md` needs no second file staged behind it. No skill-reference fan-out exists either: a `references/` file is skill-local and edited in place.
- A grep for `standards install` or `standards sync` in a skill body or a doc is a stale citation, not a verb. Neither exists.
- A standard citing a `docs/agents/` page resolves as a path here and nowhere else, since neither root carries a `docs/` tree. `standards/tasks.md` carries the first such pointer.
- `canon docs <name>` resolves a sub-area file by its bare name, so `canon docs tasks` is the spelling the pointer above can run. A name two folders share still resolves to neither.

### The two read routes return different bytes

`canon standards <name>` runs its file through `stripFrontmatter` at `src/standards/read.ts:99`, so stdout opens at the H1, while the `content` field of `canon standards list --json` carries the source whole. Anything comparing a target's leftover copy against the corpus reads the catalog, since an install once copied the source file whole and the verb's output differs from it by the frontmatter block. Measured 2026-08-28: the catalog's `content` for `slug` is byte-identical to `standards/slug.md`.

A plan's measured claim that nothing covers an artifact can be false when the covering file sits in a subfolder a catalog read excludes, since the listing the plan trusted then reports it missing while the conclusion drawn from it is wrong. Glob a domain root recursively rather than reading its `index.md` alone, and where a match turns up in an excluded subfolder, the fix is usually a promotion to the flat root plus the one missing rule.
