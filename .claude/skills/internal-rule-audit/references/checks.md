---
title: Rule audit checks
description: The nine per-rule checks the rule audit runs, the verb or file each one reads, and what each reports when its source is silent
---

# Rule audit checks

Each check names the source that answers it, so the audit reads rather than re-derives. A silent source reports as unread in the row rather than as a pass, since a check that could not run has not cleared the rule.

## 1. Load mode

- **Source:** the rule's `paths` in `gov list --json`, where `null` means always-on. For a file under `internal/rules/`, which that verb does not list, read the `paths:` key in the file's own frontmatter.
- **Test:** an always-on rule must pass "would removing this cause a mistake in every session this rule reaches". A path-scoped rule must pass the two-part test in `canon/context/governance/routing.md`: the invariant fires when a matching path is edited, and violating it ships silently.
- **Fails toward:** move, when the subject has a glob and the rule loads always, or when the subject has no glob and the rule is path-scoped and never fires. Retire instead when removing the rule causes no mistake even in a session that has its subject, since a rule stating only what a current model does unprompted, such as a textbook principle, earns no load anywhere and moving it carries the cost to a narrower audience unchanged.
- **Silent:** a frontmatter block that fails to parse reads as unscoped in `gov list`. Open the file and report the parse failure rather than the load mode.

## 2. Reach against audience

- **Source:** the `stacks` array in `gov list --json`. Each stack lists its own rules and names the stack it `extends`, so a rule a stack selects reaches that stack and every stack extending it. The `unreferenced` array names every governance rule no stack selects.
- **Test:** every project the selecting stacks reach has the rule's subject. A rule about code selected by a stack that docs-only projects consume fails.
- **Fails toward:** move to the stack whose projects have the subject.
- **Unreferenced:** a governance rule in `unreferenced` reaches no stack. Check it against `GOV_EXPECTED_UNREFERENCED` in `src/gate/measures.ts` before judging it. A rule on that list is opt-in by `--add`, so report its audience as `opt-in` and judge it on the other checks. A rule on neither list reaches nothing, so report its audience as `none` and its verdict as retire, or move when a stack it belongs in exists.
- **Internal:** a rule under `internal/rules/` reaches this repository alone and needs no stack. `internal/governance.toml` records which stack this repository consumes and does not widen any rule's audience.

## 3. Restated elsewhere

- **Source:** `gov restated --json`. Keep each entry in `restatements` whose `subject.file` ends in the rule's filename, and read its `surfaces`, where `kind` is `rule`, `skill`, or `seed`.
- **Test:** two surfaces a target receives stating one instruction means one goes. A surface reaching a target only through a seed copied at scaffold time does not count, per `canon/context/governance/routing.md`.
- **Fails toward:** retire when every bullet is restated, merge when the other surface is a rule for the same audience, keep with bullets to cut otherwise.

## 4. Owned by a standard

- **Source:** the standard the rule points at, read with `bun src/cli.ts standards <name>`.
- **Test:** a directive beside the pointer states what must not go wrong rather than restating the standard's structure. `canon/context/governance/routing.md` caps directives beside a pointer at five.
- **Fails toward:** keep with the restated directives to cut. A rule whose every directive restates its standard retires to the pointer alone, which reads as keep when the pointer still earns the load.

## 5. Pointer at a self-triggering skill

- **Source:** the `description` of each skill the rule names, in `claude/skills/<name>/SKILL.md` or `.claude/skills/<name>/SKILL.md`.
- **Test:** whether the skill's own description already fires on the moment the rule fires on. A rule that loads on a path edit and points at a skill whose description fires on the same edit is a second trigger for one thing.
- **Fails toward:** retire the pointer bullet. The rule stays when it also carries the floor the skill deepens, since the rule arrives with the edit and the skill arrives only when invoked.

## 6. Enforced elsewhere

- **Source:** the hooks under `.claude/hooks/`, the stage ids in `src/gate/stages.ts` that `canon gate run` executes, and the linter, formatter, and spelling configs a target installs from `tooling/`.
- **Test:** a mechanism that fails loudly on the violation the bullet forbids.
- **Fails toward:** retire the bullet. Keep it when the enforcement covers this repository alone and the rule ships to targets that have none.

## 7. Harness default

- **Source:** the Claude Code pages under `wiki/claude/`, reached from `wiki/index.md`. No verb answers this.
- **Test:** whether the bullet restates what the harness already instructs every session, such as committing only when asked.
- **Fails toward:** retire the bullet.
- **Silent:** when no page states the default, report the check as unread. A remembered default is not evidence.

## 8. Program input

- **Source:** grep the TypeScript under `src/`, test files excluded, for each H2 as a literal line including its `## ` prefix, and for the rule's filename stem. Bare heading text matches common words across unrelated readers.
- **Test:** whether a verb reads the rule by heading or by name, as the comment-vocabulary reader in `src/comments/` reads its terms from whichever rule publishes the heading it looks for. Open each hit, since most name the rule in a comment or a help example and read nothing. A hit counts when code compares against the heading or holds the name in a list, such as the opt-in allowlist in `src/gate/measures.ts`. A heading hit counts only when the reader names this rule's heading rather than a same-named section in another document.
- **Fails toward:** nothing on its own. It attaches the parsing file to a retire or merge verdict as a code change the acting plan owes, and to a move when the heading would change hands.

## 9. In flight

- **Source:** the in-flight read in `claude/skills/role-planner/SKILL.md` under `## Read what is in flight rather than inferring it`, then `git diff --name-only origin/main...<branch>` per branch after a fetch for the rule's source path.
- **Test:** whether an open branch edits the rule.
- **Fails toward:** holds the row. The verdict stands and is marked held, naming the branch, since moving a file another branch is editing strands that branch's hunk.
