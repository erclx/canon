---
title: Rule routing
description: The two-part test separating a rule from a skill, the standards each rule routes to, the surfaces reached without a glob, and the pair that reads as one
---

# Rule routing

A rule fires on a path match with no decision from the session and a skill fires on invocation or a description match, so the rule is the floor and the skill is the depth. `standards/rule.md` and `standards/skill.md` each carry the checkpoint pointing at the other, and both ship to targets. Nothing checks either one, which is accepted, since the checkpoint is a judgment prompt rather than an invariant.

## What crosses into a rule

The two-part test decides. Does the invariant fire when a specific path is edited, and does violating it ship silently? Run over the `## Gotchas` bullets, the six domain skill bodies, and `CLAUDE.md`'s behavior list, it promoted four rules and widened one, which is the filter working rather than failing. Most of the pool is orientation and fails the first half, and a second group fails the second half because `bun run check` already gates it.

A rejection is recorded by which half failed rather than by judgment. The init gate's asserted-path requirement fails the first half, since the trigger is adding a domain and no glob matches that. The husky re-drop on a monorepo subtree fails it for the same reason, firing when a command runs rather than when a path is edited. The stale-copy failure on a widened source rule fails the second half, since that gate is closed and loud.

One candidate passes both halves and is deferred. A child folder carrying no `index.md` drops out of every catalog silently, and closing it means widening `510-context`, which ships to every `base` consumer and would carry an invariant about a system a target may not run. It needs a shipped rule and a stack decision, which is the deferral `claude/skills/` already took.

## Rules that route to a standard

Every standard governing a file path carries a rule routing to it, so an edit loads the standard without the matching skill being invoked. The route is what makes a standard reachable from the action rather than from a session that thought to look.

`595-tooling-reference` is toolkit-local and is authored under `internal/rules/claude/`, because `internal/standards/tooling-reference.md` governs a surface a target never authors and shipping the route would point at a path no install creates. It sits in `internal/` rather than `governance/rules/` so location enforces the boundary, the same way the internal standards and snippets do. It globs `manifest.toml` alongside `reference.md`, because a rule protecting a symmetry has to fire from either side and the manifest is the side that moves first.

`510-context` carries a write-time policy alongside its read-time one, so editing a domain leaves its context entry conforming. It ships in `base.toml` to every consumer, so each write-time bullet states an outcome of the edit rather than a backlog to drain, which is the only phrasing that also reads correctly in a project with no entries yet.

`556-groundwork` and `557-intake` route the two track folders, added to `base` beside `555-tasks` so the three workflow surfaces sit on one roster. Both folders are gitignored and both were governed only by a `references/folder-format.md` inside their skill, which loads when the skill does and never when a promotion pass or a returning session opens the folder directly.

Each of those two carries the pair of directives that ship silently when violated, the answer contract for intake and the re-measure floor for groundwork, and points at its standard for the rest. What a rule cannot carry is the write scope, since a misrouted write lands on a path the glob never matches, so that floor stays in the skill body.

`561-teach` and `562-session` route the two standards the destination census named and did not build. The first globs `.canon/teach/**`, a folder most targets never open, and its frontmatter says so rather than leaving a rule that fires for nobody looking like one that fires for everybody. The second globs `.canon/tasks/session-*.md` alone, inside the folder `555-tasks` already globs whole, because the board and the handoff are two shapes and one rule over both would carry two.

Eighteen of the twenty claude rules now carry operative directives beside the pointer, since a rule arrives attached to the edit while a pointer reaches a session only if that session opens the file. Five bullets is the cap, matching the two largest of the seven that reached the shape on their own, and past it a rule reproduces the standard's structure rather than stating what must not go wrong. The standard keeps the full specification either way, so a drift is a rule falling behind rather than two files disagreeing, and nothing checks it.

`592-claude-md` sits outside that cap at six bullets, and it is the one claude rule carrying no pointer. No standard governs the root file, so there is no structure for it to reproduce and nothing for the cap to protect. The seed and `seed-sync` occupy the role a standard would take, which is a decision the standards census closed rather than one this rule reopened.

`500-prose` and `501-markdown` stay pointer-only, on two different arguments now that the parser exemption behind the old shared one is empty. `501-markdown` points at a standard whose bans ship as package data, so restating even part of the list here puts a second copy beside the one `canon markdown audit` reads. `500-prose` points at the `write-human` skill rather than at a standard, and the rule carries the instruction to load it rather than a compressed sample of what it says, since the compressible half of that guidance is the half that does the least work. `561-teach` took the same form on its glossary bullet once that reference moved into the fan-out.

A rule citing a standard names the read verb rather than a path. All eighteen say `canon standards <name>`, whose resolver falls through to the corpus the package ships. What forces it is that a rule loads on a glob match with no skill context, so `${CLAUDE_SKILL_DIR}` expands to nothing and the plugin-root path a skill body spells is unavailable. A path spelled against the plugin in prose is worse than unavailable, since it reads ambiguously against the project-root `standards/` folder and turns a citation that resolved into one a session reports as missing.

That is also why none of the eighteen carries the report-the-gap bullet. The verb ships with the CLI and so does the rule, so the two never arrive apart, and the bullet is owed only where the carrier ships on the other channel. `561-teach` keeps it on its glossary bullet for exactly that reason.

The two spell the pointer differently, and the difference is the target rather than the author. A rule may say load only where the skill is advisory, which `write-human` is: no guard, no argument, nothing it starts doing. `teach-workspace` runs a learning workspace, stops on a missing subject, and resumes a matching one, so a rule telling a session to load it for a glossary shape gets a refusal or a workspace instead of the shape. That bullet names `references/glossary.md` to read and says explicitly not to invoke the skill. Test the target for a guard before writing `Load` into a rule. `.claude/ARCHITECTURE.md` carries the general form, and `.claude/context/standards/scope.md` carries what it narrows on the standards side.

## Rules reached by something other than a glob

`standards/versioning.md` is deliberately unrouted. It governs commit subjects, PR titles and bodies, review comments, issues, and git tags, none of which are files, so a path-scoped rule has nothing to match and would never fire.

`git-commit` and `git-pr` reach that surface by instruction instead, and what catches a leak there is a check rather than a route. The check is `publish.md`, which reads the label rule from `versioning.md` beside it, so the six skills that publish to a remote inherit it from the citation they already carry.

The census tried to move it and withdrew, which leaves that arrangement standing rather than superseding it. Routing it into those two skills through the fan-out would take the file out of the flat root, and `publish.md` and `tasks.md` each depend on it in-body, so the citation this paragraph rests on would point at a file no target installs. `.claude/context/standards/destinations.md` carries the withdrawal and the reader count behind it.

A rule that does have a file to match still cannot reach the moment that file is missing. The glob fires when a matching path is opened, so guidance about the absence of that path sits in a rule nothing loads at the time it applies. `562-session` was drafted with a bullet telling a reader to say nothing when no session map exists, which its own `.canon/tasks/session-*.md` glob excludes by definition, and the bullet was cut before merge. The absent-file response belongs to the standard the rule points at, which a session reaches without a glob.

A rule reached by its own glob also needs no citation from `CLAUDE.md`, while a skill needs one. The harness delivers a path-scoped rule when a matching file is opened, so a pointer from the always-loaded file re-announces what already arrives attached to the edit and spends the budget every session pays. A skill loads on invocation alone, which is why the domain table and the `canon:docs-sync` line earn their place there and a rule filename does not. `592-claude-md` carries both directions as directives. A filename is the wrong citation besides, since a project renumbers around a collision with a shared set.

The argument runs harder for a rule carrying no `paths:` key, which arrives unconditionally rather than on a match. `core/087-git.md` retired the `canon:git-*` line this paragraph cited as a skill pointer, since the precedence that line stated moved into a rule every session already loads, and a pointer at it would have been the first this file aimed at the tier needing one least.

`core/091-channel.md` takes the same shape for a different gap. `session-relay` fires only on invocation, so a roleless session that never learns to invoke it gains nothing from routing the contract there, and a third role body meets the operator's own rejection already, since the addressing-and-timing half already lives in `role-worker` and `role-planner`. What remains routes to a rule instead: it points at the two role bodies' own addressee ladders rather than restating either, and states only what a session holding neither carries nowhere else. The rule fails conditional presence knowingly, since no glob exists for a session's own role, so it loads into every session in every target that installed governance, most of which never dispatch or relay at all. The accepted cost is an inert rule in every session that never relays.

`090-code-comments` owns the degradation term list rather than `src/comments/`, because `src/comments/vocabulary.ts` reads the terms out of whichever rule publishes a `## Degradation vocabulary` heading. Editing the backticked terms there changes what `canon comments scan` sweeps for here and in every target on `base`. Discovery anchors on the heading rather than the filename, so a renumber cannot silently empty the list.

## Two always-loaded rules that read as one

`000-constitution.md` ranks native platform capabilities over third-party libraries, and `070-planning.md` says to search the project, its dependencies, and the standard library before writing new code. Both ship in `base`, both load on every session, and the pair scans as one instruction stated twice.

They govern different moments. The constitution ranks options a session is already choosing between, and the planning bullet fires before there are options, when the open question is whether the code already exists. A clause drawing that distinction inside either rule body was declined, since `standards/rule.md` bans reasoning in a rule, so the entry covering the rule tier carries it instead.

## Gotchas

- The degradation sweep matches on comment text, so a comment naming a term as an example reads as a hit. The matcher's own doc comment in `src/comments/scan.ts` is the standing case. Read a hit before treating it as a defect.
