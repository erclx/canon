---
title: Rule audit checks
description: The nine per-rule checks the rule audit runs, the verb or file each one reads, and what each reports when its source is silent
---

# Rule audit checks

Each check names the source that answers it, so the audit reads rather than re-derives. A silent source reports as unread in the row rather than as a pass, since a check that could not run has not cleared the rule.

## 1. Load mode

An always-on rule must pass "would removing this cause a mistake in every session this rule reaches". A path-scoped rule must pass the two-part test in `canon/context/governance.md`, that the invariant fires when a matching path is edited and violating it ships silently.

- **Source:** the rule's `paths` in `gov list --json`, where `null` means always-on. A file under `internal/rules/` is unlisted, so read its own `paths:` frontmatter.
- **Fails toward:** move, when a subject with a glob loads always, or a subject with no glob is path-scoped and never fires
- **Retire:** when removing the rule causes no mistake even where its subject exists. A rule stating what a current model does unprompted earns no load anywhere, and a move only narrows who pays.
- **Silent:** a frontmatter block that fails to parse reads as unscoped in `gov list`. Open the file and report the parse failure rather than the load mode.

## 2. Reach against audience

Every project the selecting stacks reach must have the rule's subject. A rule about code selected by a stack that docs-only projects consume fails.

- **Source:** the `stacks` array in `gov list --json`. A rule a stack selects reaches that stack and every stack that `extends` it.
- **Fails toward:** move to the stack whose projects have the subject.
- **Internal:** a rule under `internal/rules/` reaches this repository alone and needs no stack. `internal/governance.toml` names the stack this repository consumes and widens no audience.

### Unreferenced rules

The `unreferenced` array in the same record names every governance rule no stack selects. Read the rule's `detect` field before judging it.

- A non-null `detect` means `canon gov detect` proposes it from a project's evidence, so report its audience as `opt-in` and judge it on the other checks
- A null `detect` means nothing reaches it, so report its audience as `none` and its verdict as retire, or move when a stack it belongs in exists

## 3. Restated elsewhere

Two surfaces a target receives stating one instruction means one goes. A surface reaching a target only through a seed copied at scaffold time does not count, per `canon/context/governance.md`.

- **Source:** `gov restated --json`. Keep each `restatements` entry whose `subject.file` ends in the rule's filename, and read its `surfaces`, each of kind `rule`, `skill`, or `seed`.
- **Own skills:** a surface under `.claude/skills/` counts against an `internal/rules/` subject alone, since no target receives this repository's own skills
- **Fails toward:** retire when every bullet is restated, merge when the other surface is a rule for the same audience, keep with bullets to cut otherwise.

## 4. Owned by a standard

A directive beside the pointer states what must not go wrong rather than restating the standard's structure. `canon/context/governance.md` caps directives beside a pointer at five.

- **Source:** the standard the rule points at, read with `bun src/cli.ts standards <name>`.
- **Fails toward:** keep with the restated directives to cut. A rule whose every directive restates its standard retires to the pointer alone, which reads as keep when the pointer still earns the load.

## 5. Pointer at a self-triggering skill

A rule that loads on a path edit and points at a skill whose own description fires on the same edit is a second trigger for one thing.

- **Source:** the `description` of each skill the rule names, in `claude/skills/<name>/SKILL.md` or `.claude/skills/<name>/SKILL.md`.
- **Fails toward:** retire the pointer bullet. The rule stays when it also carries the floor the skill deepens, since the rule arrives with the edit and the skill only when invoked.

## 6. Enforced elsewhere

A mechanism that fails loudly on the violation the bullet forbids makes the bullet redundant.

- **Source:** the hooks under `.claude/hooks/`, the stage ids in `src/gate/stages.ts` that `canon gate run` executes, and the linter and formatter configs a target installs from `tooling/`.
- **Fails toward:** retire the bullet. Keep it when the enforcement covers this repository alone and the rule ships to targets that have none.

## 7. Harness default

A bullet restating what the harness already instructs every session, such as committing only when asked, adds nothing.

- **Source:** the Claude Code pages under `wiki/claude/`, reached from `wiki/index.md`. No verb answers this.
- **Fails toward:** retire the bullet.
- **Silent:** when no page states the default, report the check as unread. A remembered default is not evidence.

## 8. Program input

A verb may read the rule by heading or by name, as the comment-vocabulary reader in `src/comments/` reads its terms from whichever rule publishes the heading it looks for. This check fails toward nothing on its own.

- **Source:** grep `src/` TypeScript, tests excluded, for the rule's filename stem and each H2 as a literal line with its `## ` prefix, since bare heading text matches common words
- **Fails toward:** attaching the parsing file to a retire or merge verdict as a code change the acting plan owes, and to a move when the heading would change hands

### Which hits count

Open each hit, since most name the rule in a comment or a help example and read nothing.

- A hit counts when code compares against the heading or holds the name in a list, such as the opt-in allowlist in `src/gate/measures.ts`
- A heading hit counts only when the reader names this rule's heading rather than a same-named section in another document

## 9. In flight

An open branch editing the rule holds its row. The verdict stands and is marked held, naming the branch, since moving a file another branch is editing strands that branch's hunk.

- **Source:** the in-flight read under `## Read what is in flight rather than inferring it` in `claude/skills/role-planner/SKILL.md`
- **Per branch:** after a fetch, `git diff --name-only origin/main...<branch>` for the rule's source path
