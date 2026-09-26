---
name: internal-rule-audit
description: Audits the governance rule set as a set, running nine checks per rule against the verbs and files that answer them and returning one row per rule with a verdict of keep, move, retire, or merge. Use when asked to "audit the governance rules", "does this rule earn its place", "is this rule worth keeping", or before a plan that regroups, retires, or re-scopes rules. Do NOT use to review the bullets of a rule just written or revised, which is the bullet checklist in `internal-governance`, and do NOT use to edit a rule, a stack, or a task file.
---

# Internal rule audit

Turn each rule's load mode, reach, restatements, and enforcement into a verdict on the rule as a whole. The bullet checklist in `internal-governance` judges whether a bullet is well written. This skill judges whether the file should exist where it is.

The skill reports and writes nothing the rule set reads. A plan acts on the verdicts.

## Step 1: resolve the corpus

- With no argument, the corpus is every rule under `governance/rules/` and `internal/rules/`.
- With a rule name or a path, the corpus is that one rule.
- Run every verb from the checkout as `bun src/cli.ts gov ...`. The global `canon` binary resolves a published package and reads a tree older than the one under audit, and it says so on stderr.

Read the two sources once for the whole run rather than once per rule:

```bash
bun src/cli.ts gov list --json
bun src/cli.ts gov restated --json
```

`gov list` lists `governance/rules/` alone. Read each `internal/rules/` file's own frontmatter for its `paths:` rather than reporting it as unlisted.

Read audience from which stacks select a rule, never from the folder a rule sits in. Folder names change on a regroup and stack membership is what decides where a rule loads.

## Step 2: run the checks

Read `references/checks.md` for the nine checks, the source each one reads, and what each does when its source is silent. Run all nine on every rule, even after one has already decided the verdict, since the row reports the deciding check and a reader acting on it needs to know nothing else stands in the way.

Two gaps in `gov restated` are declared in that file rather than fixed here:

- It takes no `internal/rules/` file as a subject and searches no `.claude/skills/` body as a surface, so restatements for that folder are a grep the reference spells out.
- It reads a bullet saying `Never` plus a pinned-version token as a prohibition and a skill line saying `no` plus the same token as a description, so the CI workflow rule's `@latest` bullet reports as a contradiction against the `ci-workflow` skill. Discount that pair. It decides no verdict.

## Step 3: assign the verdict

The verdict set is closed at four:

- **keep.** The rule loads where its subject lives, reaches only projects that have that subject, and states something no other surface a target receives carries. A rule that stays but carries cuttable bullets is a keep, and the row names the bullets to cut.
- **move.** The rule is worth its text and loads in the wrong place: always-on where a path scope would do, path-scoped where its subject has no glob, or selected by a stack whose projects lack its subject. Report a path-scope change as a move of the load mode. A change of folder that leaves the selecting stacks and the load mode as they were is a regroup rather than a move, and reads as keep here.
- **retire.** Every bullet is restated on a surface a target receives, enforced by a hook or a gate stage, owned by a standard the rule already points at, or a harness default.
- **merge.** Another rule states the same instruction for the same audience, so one file absorbs the other.

Hold two overrides above the verdict:

- An open branch editing the rule forbids a move, retire, or merge this pass. Report the verdict the checks reach and mark it held, naming the branch.
- A rule publishing a heading some verb parses keeps that verb as a dependency. A retire or merge verdict on it carries the parsing file as a code change the acting plan owes.

## Step 4: report

Emit one row per rule in the corpus, with no rule skipped. A rule no stack selects still gets a row, reporting its audience as opt-in or as none per the reach check.

```markdown
| Rule | Load mode | Audience | Deciding check | Verdict | Note |
| ---- | --------- | -------- | -------------- | ------- | ---- |
```

- **Load mode:** `always` or `paths`, with the globs abbreviated when long
- **Audience:** the stacks that select the rule, `this repository` for an `internal/rules/` file, `opt-in`, or `none`
- **Deciding check:** the name of the check from `references/checks.md` that settled the verdict
- **Note:** the bullets to cut on a keep, the target on a move, the surviving file on a merge, the parsing file on a parsed heading, or the branch on a held row

Write the table to `.canon/tmp/rule-audit/report.md` at the current worktree's root and print it in the reply. Close with the verdict counts and the row count. On a full-corpus run, check the row count against the rules `gov list` reports plus the files under `internal/rules/`. A mismatch means a rule was skipped, so name it rather than reporting the table as complete.
