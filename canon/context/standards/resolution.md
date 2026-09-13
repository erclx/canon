---
title: Resolution
description: The two roots a standard resolves against, why the install channel and the generated mirror both closed, the retired fan-out and its consumers field, and the reading gotchas
---

# Resolution

No standard installs into a project. A reader resolves one instead, and everything below follows from that: which roots answer, which route a shipped body actually takes, and what the retired fan-out used to reach that the flat corpus reaches on its own now.

## The two roots

`standardRoots` in `src/standards/read.ts` returns `standards/` at the caller's working directory, then the corpus inside the canon package. The first is this repository's authoring root and a project's own folder anywhere else, so a repository that writes standards governs its own copy. The second answers everywhere else, which is every target.

`.claude/standards/` is not a root and no longer exists anywhere. In a target it is a stale artifact an older toolkit left. Here it was the generated mirror `regen-claude-copies.sh` wrote and `bun run check` asserted, 28 tracked files rebuilt on every run, and it is gone.

Two entries rather than one because a checkout of this repository would otherwise resolve an edit in progress against whatever the installed package holds. A target carries neither the first root nor a copy of the second, so only one answers there and no precedence is left to reason about.

## What retiring the mirror removed

The mirror existed so a rule, a skill, or a seed could cite one path resolving here and in a target alike, which is the pattern `snippets/` and `governance/rules/` still run. It stopped buying that the day the install channel closed, since no target could hold the copy the citation named, so the spelling was portable in form and resolved in this checkout alone. Forty of the 62 shipped bodies already name `${CLAUDE_SKILL_DIR}/../../standards/<name>.md` instead, which is the measurement that says the form was not carrying the readers it claimed.

Removing it took the `mirror_dir` call for `standards/` out of `scripts/core/regen-claude-copies.sh`, dropped `.claude/standards` from the drift assertion the merge gate runs, and deleted the 28 files. The `paths:` glob on `591-standard-authoring` lost its mirrored entry, so a target holding an old installed copy stops matching that rule. That is the intended outcome rather than a regression, since the rule governs authoring and such a copy is not authored.

What it costs is that one citation form no longer answers everywhere. A body under `claude/` cites the plugin root, a rule and a seed call `canon standards <name>`, and a file staying in this repository cites `standards/<name>.md`, which `internal/rules/claude/598-authoring-layout.md` now states as one case apiece rather than as a single spelling. A reader has to know which surface they are on, and nothing checks that they got it right: `DEFAULT_FOLDERS` in `src/context/folders.ts` covers `context`, `diagrams`, and `wireframes`, so the citation gate never resolved a `.claude/standards/` path and would not have reported one left behind. The sweep that moved them was a grep rather than a check. Measured at `7374bb51` on 2026-08-28.

## What closing the install channel removed

`canon standards install` copied the flat root into a target and `canon standards sync` reconciled it afterward. Both are gone, with `src/standards/install.ts`, `src/standards/adapter.ts`, `src/standards/index-refresh.ts`, and `src/standards/closure.ts`. The domain left `SCANNED_DOMAINS`, `SYNC_DOMAINS`, `STAMP_DOMAINS`, and the root layouts `detectUnmigrated` walks, and `canon init` lost its `Standards` step and its `--standards` flag.

Every copy was a file sync had to reconcile forever, and a filed issue measured what that cost when the source layout moved: five standards relocated into a subfolder were skipped as not in toolkit source and sat 12 to 45 lines behind, with no command able to refresh them.

The closure machinery went with the flag it served. A selection expanded to the transitive closure of what its standards cited so a subset could not land a dangling reference, and with nothing copied there is no subset and no dangling reference. The measurement behind it is worth keeping even so: following both citation classes, the mean closure over a single name was 14.1 of 15, because nearly all the corpus density sits inside `Does not govern:` lists. Following dependencies alone the mean was 1.4. A reader who needs a handed-off concern runs the verb again for that name.

Two things the channel supported have no user left. `NonInteractivePolicy` in `src/sync/engine.ts` carries a `refuse` branch that standards was the only adapter to declare, so it is now unreachable, and `hasUnattributedDrift` is read only from inside it. The type stays because it is the extension point `canon/ARCHITECTURE.md` records a reason for, and removing it would delete that reason along with the code. Decide it deliberately rather than by drift.

## The retired fan-out and its consumers field

`standards/bundled/` and the `consumers:` frontmatter field it read are both gone. Six sources used to sit there and fan out into eleven copies under `claude/skills/*/references/`, one per skill the field named, and the field's cost tracked its length rather than the file it sat on: three of the six listed more than one consumer and `branch.md` alone listed four. That ratio is what decided against moving the flat corpus into the folder, since `markdown.md` is named by eighteen skill bodies across the two catalogs and would have arrived as eighteen copies. `canon/ARCHITECTURE.md` carries the decision and the corrected premise that closed the folder entirely rather than only bounding it.

`standards/bundled/` was unaffected by the install channel closing, which is the fact the fan-out's retirement corrects rather than repeats. Those six never installed into a target either way, reaching a consumer through its `references/` copy instead of the resolve below, so a channel that carried nothing for them could not be what kept the folder open. What kept it open was believing the folder was still buying reach, and the fallback citation form already reached every flat standard at zero copies, so once measured against that the folder had nothing left to buy. The six sources now sit at the flat root and resolve exactly as every other standard does.

A handwritten reference that lives only in one skill's `references/` never carried `consumers:`, which is the field's absence rather than its presence that survives the retirement: nothing generates a copy into `references/` any more, so every file there is skill-local and hand-authored, and a mistaken `consumers:` value on one of them can no longer silence anything, since the audit that read the field alongside the folder location has both gone.

## Standards that moved out of a skill

`standards/groundwork.md` and `standards/intake.md` are the two that went the other way, out of a skill's `references/` and into the flat root. A skill-local reference is right for a file only that skill reads, and both of these govern a folder edited routinely by sessions that never invoked the skill, so the readership test that kept the orchestrator runbooks local sends these two out.

The reference is deleted rather than left beside the standard, since publishing on both surfaces makes two sources for one text. Each skill now cites its standard at the plugin root alone, which is the single form every shipped body took once nothing installed a project copy for a first branch to try.

Both govern a gitignored folder no check reaches, which puts them in one class with the plan and memory standards rather than leaving each to find its own answer. `.claude/hooks/standards-audit.sh` exits early on the scratch paths and the audit skill reads changed files from git, which never lists a gitignored one, so all four were enforced by a session reading them and by nothing else.

The precedent extended is `canon tasks validate`, which reports against the board without writing, and reporting is what makes a verb safe over a folder with no history to recover from. `canon records validate <kind>` now covers all four, `memory` having landed with its standard rather than as a second command.

A fifth kind reads this corpus rather than a gitignored folder, and it keeps the reporting discipline on the opposite reason. A standard is tracked and cited by bare filename across the tree, so the risk a write carries is a rename reaching further than the file it moved rather than a repair nothing can undo. `canon/context/cli/audits.md` holds the check and its two roots.

## Which route a reader actually takes

A shipped body names one path for a standard, and the command route is what nearly none takes. Of the 62 shipped bodies, 40 name `${CLAUDE_SKILL_DIR}/../../standards/<name>.md` and 7 call `canon standards` where a resolved root rather than a named file is what they want. `claude/standards` is a symlink carrying the whole corpus, so a body reading a standard in a target that installed none is answered there and never reaches the resolve in `src/standards/read.ts`. Measured on 2026-08-25.

The two-branch citation those 38 replaced named an installed path first and the plugin root behind it. Both branches resolved while the corpus still installed, which is what hid a partial sweep, so the collapse ran as one pass rather than riding along with each skill's next edit.

A grep for the installed prefix comes back at 25 lines across 18 files outside the fixture trees, and none of them is a citation. Six classes account for every one, and a line matching none of them is a live citation the sweep missed:

- A target's own stale folder, inert and safe to delete, covering `canon-cli`, `docs/target-projects.md`, `docs/agents/records.md`, and the gotcha below.
- The rule forbidding the citation, covering `standards/skill.md` and `create-standard`'s requirement.
- A dated record of a past mechanism or measurement, covering `canon/ARCHITECTURE.md`, `destinations.md`, and `distribution.md`.
- Fixture or test data, covering `scripts/sandbox/`, `scripts/eval/`, and every `*.test.ts`.
- A marker-syntax illustration, covering `src/context/citations.ts`.
- The label-map prefix kept so a diff deleting the folder stays covered, covering `canon/config/pr-labels.toml`.

Run that classification rather than a bare grep. The first sweep moved 64 citations and left three lines stating the mirror as live, in `orchestration.md`, `sandbox/overview.md`, and `scripts/eval.md`, each of which reads as prose about a folder until the rule is applied to it. Nothing here is checkable, so the classification is the whole of the discipline.

The resolve has exactly one caller, `src/commands/standards.ts`, and no shipped body invokes the verb. Its second root is the package corpus, which is the route a machine reader takes and the reason a command reading a standard answers in any target. `<canon>` is how a resolve from that root spells itself, since the other label is project-relative and a report could join it to a root.

`infra:standards read` is the arm that covers it, and `canon/context/sandbox/coverage.md` records what the arm reaches and what it leaves to the plugin-root route. Measured on 2026-08-20.

## Gotchas

- A target holding `.claude/standards/` from an older toolkit resolves nothing through it. The folder is inert rather than authoritative, and deleting it is safe. This repository no longer carries one either.
- A project that wants a standard of its own writes `standards/<slug>.md` at its root, which the resolver reads ahead of the package. `create-standard` writes there in the toolkit and in a target alike.
- Do not hand-edit `standards/index.md` here. `regen-indexes.sh` rewrites it from the frontmatter of whatever is present, and a standard missing `title` or `description` fails that regen.
- `bun run check` no longer regenerates anything for this corpus, and the Consumed copies stage names `.claude/rules` alone. Editing `standards/<name>.md` needs no second file staged behind it. There is no skill-reference fan-out either, since a `references/` file is skill-local now and edited in place.
- A grep for `standards install` or `standards sync` in a skill body or a doc is a stale citation, not a verb. Neither exists.
- The two read routes return different bytes. `canon standards <name>` runs its file through `stripFrontmatter` at `src/standards/read.ts:99`, so stdout opens at the H1, while the `content` field of `canon standards list --json` carries the source whole. Anything comparing a target's leftover copy against the corpus reads the catalog, since an install copied the source file whole and the verb's output differs from it by the frontmatter block. Measured 2026-08-28: the catalog's `content` for `slug` is byte-identical to `standards/slug.md`.
- A standard citing a `docs/agents/` page resolves as a path here and nowhere else, since neither root carries a `docs/` tree. `standards/tasks.md` carries the first such pointer.
- `canon docs` answers in a target and names the page now. It printed a split domain's `index.md` and stopped there, so `canon docs agents` reached the catalog and nothing named `tasks.md`. A sub-area file has resolved by its bare name since 2026-09-02, so `canon docs tasks` is the spelling the pointer above can run, and a name two folders share still resolves to neither.

A plan's measured claim that nothing covers an artifact can be false when the covering file sits in a source subfolder the mirror and the index both exclude, since every catalog read then reports it missing. One plan measured `standards/` at twelve files and concluded nothing governed a standard, while `standards/bundled/standard.md` already carried the overview, frontmatter, structure, rule, success-criterion, and example sections. `mirror_dir` excluded `*/bundled/*` and `standards/index.md` never listed it, so the listing the plan trusted was accurate and the conclusion drawn from it was not. Writing the planned new file would have duplicated it near-wholesale. The specific exclusion closed with the fan-out, since `standard.md` sits at the flat root now and every catalog read reaches it, but the general failure did not: glob a domain root recursively rather than reading its `index.md`, and where a match turns up in a subfolder a mirror or index excludes, the change is usually a promotion plus the one missing rule.
