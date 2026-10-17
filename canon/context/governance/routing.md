---
title: Rule routing
description: The two-part test separating a rule from a skill, the standards each rule routes to, the surfaces reached without a glob, and the pair that reads as one
---

# Rule routing

A rule fires on a path match with no decision from the session, and a skill fires on invocation or a description match. The rule is the floor and the skill is the depth.

`claude/skills/create-rule/references/rule.md` and `claude/skills/create-skill/references/skill.md` each carry the checkpoint pointing at the other, and both ship to targets. Nothing checks either one, which is accepted, since the checkpoint is a judgment prompt rather than an invariant.

## Decisions

### What crosses into a rule

A two-part test decides. Does the invariant fire when a specific path is edited, and does violating it ship silently? Most candidates are orientation and fail the first half, and a second group fails the second half because `bun run check` already gates it.

Record a rejection by which half failed rather than by judgment.

- The init gate's asserted-path requirement fails the first half, since its trigger is adding a domain and no glob matches that
- The husky re-drop on a monorepo subtree fails the first half too, firing when a command runs rather than when a path is edited
- The stale-copy failure on a widened source rule fails the second half, since that gate is closed and loud

One candidate passes both halves and stays deferred. A child folder carrying no `index.md` drops out of every catalog silently, and closing it means widening `governance/rules/canon/context.md`, which ships to every `base` consumer and would carry an invariant about a system a target may not run. It needs a shipped rule and a stack decision first.

### Every file-path standard has a routing rule

A standard governing a file path carries a rule routing to it, so an edit loads the standard without the matching skill being invoked. The route makes a standard reachable from the action rather than from a session that thought to look.

`tooling-reference` is authored under `internal/rules/claude/`, because `.claude/skills/internal-tooling/references/tooling-reference.md` governs a surface a target never authors, and shipping the route would point at a path no install creates.

- It globs `manifest.toml` beside `reference.md`, since a rule protecting a symmetry has to fire from either side and the manifest moves first

### The record-folder rules

`governance/rules/canon/context.md` carries a write-time policy beside its read-time one, so editing a domain leaves its context entry conforming. Each write-time bullet states an outcome of the edit rather than a backlog to drain, since it ships to every `base` consumer and must read correctly in a project with no entries yet.

`governance/rules/canon/tasks.md` and `plan.md` route the two record folders and ship in `base` with the `canon` folder. All three are hand-written, as `writing/markdown.md` is, since their standards live in `context-fold`, `task-board`, and `plan-feature` and the generator reads only `standards/`.

- The tasks and plan rules carry the directives that ship silently when violated, such as the blank answer slot and the board's generated index, and load their owner skill for the rest
- The write scope stays in the skill body, since a misrouted write lands on a path the glob never matches
- `tasks.md` globs `.canon/tasks/**` whole, so it also loads on a session handoff, and a carve-out bullet sends that file to `canon:session-map` because the board and the handoff are two shapes

### Directives beside the pointer

A claude rule carries operative directives beside its pointer, since a rule arrives attached to the edit while a pointer reaches a session only if that session opens the file. Five directives is the cap, and past it a rule reproduces the standard's structure rather than stating what must not go wrong.

The standard keeps the full specification either way, so a drift is a rule falling behind rather than two files disagreeing, and nothing checks it. No rule carries a directive for the root file and no standard governs it, so the seed holds the role a standard would.

- `governance/rules/writing/markdown.md` stays pointer-only on both halves, `markdown-craft` for format and `write-human` for voice, each told to load it rather than carrying a compressed sample
- The compressible half of that guidance does the least work, so a sample would buy little
- The one inline line names the two characters `src/markdown/bans.ts` owns, so a ban added there is a one-line edit to the rule

### A rule loads the skill owning a reference

A rule loads on a glob match with no skill context, so `${CLAUDE_SKILL_DIR}` expands to nothing and the sibling path a skill body spells is unavailable. A rule pointing at a shared reference loads the skill that owns it by its `canon:` name.

The skill ships on the plugin channel and the rule on the CLI channel, so the two can arrive apart, which is why the rule names the gap itself with a report-if-missing bullet. Test the target for a guard before writing `Load` into a rule.

- `write-human` is advisory, with no guard and nothing it starts, so the `writing/markdown` rule can say load
- `teach-workspace` runs a workspace, stops on a missing subject, and resumes a matching one, so a rule telling a session to load it for a glossary shape gets a refusal or a workspace
- `teach-workspace` reads its own `references/glossary.md`, and `canon/context/claude-plugin/skill-references/surfaces.md` carries why the shape lives there

### Surfaces reached by something other than a glob

`claude/skills/git-commit/references/versioning.md` is deliberately unrouted. It governs commit subjects, pull request titles and bodies, review comments, issues, and git tags, none of which are files, so a path-scoped rule would never fire.

`git-commit` and `git-pr` reach that surface by instruction, and `publish.md` catches a leak there by reading the label rule from `versioning.md` beside it.

### A missing file

A rule with a file to match cannot reach the moment that file is missing. The tasks rule's glob excludes the no-map case by definition, so a bullet about a missing session map could never fire from it. The absent-file response belongs to the `session-map` reference, which a session reaches through its skill without a glob.

### Citations from CLAUDE.md

A rule reached by its own glob needs no citation from `CLAUDE.md`, while a skill does. The harness delivers a path-scoped rule when a matching file opens, so a pointer from the always-loaded file spends budget every session pays. A skill loads on invocation alone, which is why the domain table and the `canon:docs-sync` line earn their place there.

- A filename is the wrong citation besides, since a project renumbers around a collision with a shared set
- A rule with no `paths:` key arrives unconditionally, so the argument runs harder. `canon/git.md` carries no `canon:git-*` pointer, since the precedence it states already loads into every session.

### Rules that always load

No rule carries the channel between sessions. `session-relay` owns the send mechanics, and each role body states only which message it owes and that it goes out first.

A rule for a roleless session would load into every governed session, since no glob exists for a session's own role, and the relay already serves that session directly. The retirement is an exception to the cut test below, since a project without the plugin goes without block-before-prompt.

- `code-comments` owns the degradation term list rather than `src/comments/`, because `src/comments/vocabulary.ts` reads the terms from the rule publishing `## Degradation vocabulary`
- Editing the backticked terms there changes what `canon comments scan` sweeps for here and in every target on `base`
- Discovery anchors on the heading rather than the filename, so a renumber cannot empty the list

### The question surface has no shipped rule

A rule telling sessions to use the structured question surface on a preference call was rejected for costing every session its words. The skills state the surface in their own bodies, so no shipped surface tells a target session to ask on a preference call. A skill such as `decision-escalate` fires only when typed, and the operator accepted that.

- The rejected rule forbade reopening a question a written artifact already answered rather than forbidding the surface, which was the real defect behind the rejections of it
- The plan answer contract in `governance/rules/canon/plan.md` still carries the answer for a plan

### What an always-loaded bullet has to carry alone

An always-loaded bullet is cut only where another surface a governed target receives carries the same instruction. A path-scoped rule, a skill body, a hook, or a standard counts. A scaffold-time seed does not, since the rule arrives through `canon gov sync` and the seed never does.

`output.md` therefore keeps its own linked-worktree bullet and names the `PostToolUse` path hook only as the preferred source. Two cuts refuse this test, both by the operator's choice rather than the test's.

- The relay retirement recorded under "Rules that always load" above
- The question-surface cut above, which also dropped the "answer from the artifact rather than re-asking" bullet that `plan.md` does not cover for intake and groundwork `- Suggested:` lines

Two always-loaded bullets stand beside a surface that looks like it covers them, each because that surface does not carry the act.

- `git.md` keeps the sentence saying the precedence bullets pick a surface and never authorize an operation, since a session reading them alone takes them as permission and commits unasked
- `task-scope.md` keeps the act of writing the plan in the same session, since `claude/skills/task-board/references/tasks.md` fixes the `Plan:` link and never tells a session to create one
- `scripts/eval/result-seed.md` measured sessions without the bullet writing no plan

## Gotchas

The degradation sweep matches on comment text, so a comment naming a term as an example reads as a hit. The matcher's own doc comment in `src/comments/scan.ts` is the standing case. Read a hit before treating it as a defect.
