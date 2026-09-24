---
title: Rule routing
description: The two-part test separating a rule from a skill, the standards each rule routes to, the surfaces reached without a glob, and the pair that reads as one
---

# Rule routing

A rule fires on a path match with no decision from the session, and a skill fires on invocation or a description match, so the rule is the floor and the skill is the depth. `standards/rule.md` and `standards/skill.md` each carry the checkpoint pointing at the other, and both ship to targets. Nothing checks either one, which is accepted, since the checkpoint is a judgment prompt rather than an invariant.

## Decisions

### What crosses into a rule

A two-part test decides. Does the invariant fire when a specific path is edited, and does violating it ship silently? Most candidates are orientation and fail the first half, and a second group fails the second half because `bun run check` already gates it.

Record a rejection by which half failed rather than by judgment:

- The init gate's asserted-path requirement fails the first half, since its trigger is adding a domain and no glob matches that.
- The husky re-drop on a monorepo subtree fails the first half too, firing when a command runs rather than when a path is edited.
- The stale-copy failure on a widened source rule fails the second half, since that gate is closed and loud.

One candidate passes both halves and stays deferred. A child folder carrying no `index.md` drops out of every catalog silently, and closing it means widening `510-context`, which ships to every `base` consumer and would carry an invariant about a system a target may not run. It needs a shipped rule and a stack decision first.

### Every file-path standard has a routing rule

A standard governing a file path carries a rule routing to it, so an edit loads the standard without the matching skill being invoked. The route makes a standard reachable from the action rather than from a session that thought to look.

- `595-tooling-reference` is authored under `internal/rules/claude/`, because `internal/standards/tooling-reference.md` governs a surface a target never authors, and shipping the route would point at a path no install creates. It globs `manifest.toml` beside `reference.md`, since a rule protecting a symmetry has to fire from either side and the manifest moves first.
- `510-context` carries a write-time policy beside its read-time one, so editing a domain leaves its context entry conforming. It ships to every `base` consumer, so each write-time bullet states an outcome of the edit rather than a backlog to drain, which also reads correctly in a project with no entries yet.
- `556-groundwork` and `557-intake` route the two track folders and sit beside `555-tasks` in `base`, so the three workflow surfaces share one roster. A skill-local reference would load only with its skill, never when a returning session opens the folder directly.
- Each of those two carries the directives that ship silently when violated, the answer contract and the re-measure floor, and points at its standard for the rest. The write scope stays in the skill body, since a misrouted write lands on a path the glob never matches.
- `561-teach` globs `.canon/teach/**`, a folder most targets never open, and its frontmatter says so. `562-session` globs `.canon/tasks/session-*.md` alone inside the folder `555-tasks` globs whole, because the board and the handoff are two shapes and one rule over both would carry two.

### Directives beside the pointer

A claude rule carries operative directives beside its pointer, since a rule arrives attached to the edit while a pointer reaches a session only if that session opens the file. Five directives is the cap, and past it a rule reproduces the standard's structure rather than stating what must not go wrong. The standard keeps the full specification either way, so a drift is a rule falling behind rather than two files disagreeing, and nothing checks it.

`592-claude-md` carries directives and no pointer. No standard governs the root file, so there is no structure to reproduce, and the seed and `seed-sync` hold the role a standard would.

`500-prose` and `501-markdown` stay pointer-only for two different reasons. `501-markdown` points at a standard whose bans ship as package data, so restating part of the list puts a second copy beside the one `canon markdown audit` reads. `500-prose` points at the `write-human` skill and carries the instruction to load it rather than a compressed sample, since the compressible half of that guidance does the least work.

### A rule cites a standard through the read verb

A rule citing a standard names `canon standards <name>`, whose resolver falls through to the corpus the package ships. A rule loads on a glob match with no skill context, so `${CLAUDE_SKILL_DIR}` expands to nothing and the plugin-root path a skill body spells is unavailable. Spelled in prose, that path also reads ambiguously against the project-root `standards/` folder.

The verb ships with the CLI and so does the rule, so the two never arrive apart and a verb citation owes no report-the-gap bullet. The bullet is owed only where the carrier ships on the other channel, which is why `561-teach` keeps one on its glossary bullet.

Test the target for a guard before writing `Load` into a rule. `write-human` is advisory, with no guard and nothing it starts, so `500-prose` can say load. `teach-workspace` runs a workspace, stops on a missing subject, and resumes a matching one, so a rule telling a session to load it for a glossary shape gets a refusal or a workspace.

`561-teach` names `references/glossary.md` to read and says not to invoke the skill. `canon/context/standards/scope.md` carries what this narrows on the standards side.

### Surfaces reached by something other than a glob

`standards/versioning.md` is deliberately unrouted. It governs commit subjects, pull request titles and bodies, review comments, issues, and git tags, none of which are files, so a path-scoped rule would never fire.

`git-commit` and `git-pr` reach that surface by instruction, and a leak there is caught by `publish.md`, which reads the label rule from `versioning.md` beside it. Routing it into those two skills would take the file out of the flat root that `publish.md` and `tasks.md` depend on in-body. `canon/context/standards/destinations.md` carries the reader count behind that.

#### A missing file

A rule with a file to match still cannot reach the moment that file is missing. `562-session`'s glob excludes the no-map case by definition, so a bullet about what to do when no session map exists could never fire from it. The absent-file response belongs to the standard, which a session reaches without a glob.

#### Citations from `CLAUDE.md`

A rule reached by its own glob needs no citation from `CLAUDE.md`, while a skill does. The harness delivers a path-scoped rule when a matching file opens, so a pointer from the always-loaded file re-announces what already arrives and spends budget every session pays. A skill loads on invocation alone, which is why the domain table and the `canon:docs-sync` line earn their place there.

A filename is the wrong citation besides, since a project renumbers around a collision with a shared set. `592-claude-md` carries both directions as directives.

A rule with no `paths:` key arrives unconditionally, so the argument runs harder. `core/087-git.md` carries no `canon:git-*` skill pointer, since the precedence it states already loads into every session.

#### Rules that always load

`core/091-channel.md` states only what a session holding neither worker nor planner role carries nowhere else, and points at the two role bodies' own addressee ladders rather than restating them. No glob exists for a session's own role, so it loads into every session in every governed target, and an inert rule where nobody relays is the accepted cost. `session-relay` also carries the mechanical send for any session that invokes it, and the rule still answers for a session that never does and for a target holding governance without the plugin.

`090-code-comments` owns the degradation term list rather than `src/comments/`, because `src/comments/vocabulary.ts` reads the terms out of whichever rule publishes `## Degradation vocabulary`. Editing the backticked terms there changes what `canon comments scan` sweeps for here and in every target on `base`. Discovery anchors on the heading rather than the filename, so a renumber cannot empty the list.

### The question surface is a rule rather than a skill body

A call the operator's preference decides goes through the structured question surface, stated in `governance/rules/core/005-behavior.md`, an always-loaded rule a target reaches through `canon gov sync` rather than through a seed copy nothing updates. A skill body such as `decision-escalate` fires only when typed, which would have the operator starting the interaction that exists to interrupt them.

The rule forbids reopening a question a written artifact already answered rather than forbidding the surface, since that was the real defect behind the rejections of it. The escape hatch ships as a guarantee the surface supplies rather than an option to author, since `AskUserQuestion` appends its own and its contract forbids writing one.

### Two always-loaded rules that read as one

`000-constitution.md` ranks native platform capabilities over third-party libraries, and `070-planning.md` says to search the project, its dependencies, and the standard library before writing new code. Both load on every session, and the pair scans as one instruction stated twice.

They govern different moments. The constitution ranks options a session is already choosing between, and the planning bullet fires before there are options, when the open question is whether the code already exists. `standards/rule.md` bans reasoning in a rule body, so this entry carries the distinction instead.

## Gotchas

- The degradation sweep matches on comment text, so a comment naming a term as an example reads as a hit. The matcher's own doc comment in `src/comments/scan.ts` is the standing case. Read a hit before treating it as a defect.
