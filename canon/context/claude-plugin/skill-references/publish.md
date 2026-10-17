---
title: Publish
description: The cross-reference form split by destination, the destination test every scan inherits, the record-root reading, and the title-format check
---

# Publish

## Overview

The publish reference splits one rule by destination, so the same reference takes opposite spellings on either side of the remote. Every check scoped by destination inherits one test, and the title-format check grades a field that release-please copies into the changelog unread.

## Layout

- `claude/skills/git-pr/references/` owns the publish and pull request references these decisions explain
- `src/labels/` owns `canon labels scan`, the verb behind the destination-scoped and title checks

## Decisions

### Cross-reference form

`claude/skills/git-pr/references/publish.md` states the form a pull request or issue number takes, under `## Cross-reference form`. The rule is one test. Write the number bare where the destination auto-links it and backticked where it does not.

- A list goes stale when a new surface appears, and the test covers the cross-repository spelling without a clause of its own
- A pull request body, an issue body, a comment on either, and a commit message all auto-link
- A markdown file browsed from the repository tree links neither spelling, so a reference moved between the two is rewritten

### Why publish.md holds it

`publish.md` holds the rule over `markdown.md` because it turns on where the text is going rather than on what the text is. `markdown.md` governs a file reference identically in every file, while this one is wrong in one destination and right in the other.

`markdown.md` carries the `Does not govern:` entry and `publish.md` names the rule in its own scope line, so the boundary is declared from both sides. `canon/context/claude-plugin/skill-references/authoring.md` holds the general case.

### Reach and enforcement

Every skill writing GitHub conversational text already cites the standard, so one section reaches all of them and no skill body carries the rule. Restating it per skill would put one rule in several places on several cadences.

- Quoted text is exempt, because two consumers quote repository prose into a GitHub comment and a rewrite would report the source as saying something it never said
- Nothing enforces the rule and nothing can, since `canon markdown audit` reads repository files, where the backticked form is correct, and reaches none of the published text
- The rule joins the character and phase-label bans as something an author applies at publish time

### Destination test

The paragraph scoping a check by destination sits under `## When it runs` rather than inside one check's section, so a check added later inherits it. A reader inside the repository holds the task board, and a reader on a remote holds neither it nor any gitignored record folder.

`## Phase labels` and `## Board identifiers` both fall under it, the second covering a label a code span quotes and a path under a record root. Each says under its own heading that the shared paragraph scopes it.

### Scan scoping

`canon labels scan` is destination-scoped by construction rather than by a parameter, since the workflow wires it to `pull_request` and `pull_request_review`, both readers holding the checkout the check scopes against.

- The negative half is asserted, because a unit case runs the markdown ban sets, the repository-bound corpus, through the scan and expects nothing
- A `destination` argument lost, since it moves a split the invocation site already draws into a function every caller then has to answer for

### Session links

`## Session links` is the third check the paragraph governs, with a narrower dependency. The other two turn on the reader holding this checkout, while a session link resolves for the one account that started it, which no checkout reaches. The section states that dependency under its own heading.

- It is reported on a release pull request too, where the board identifier is exempted
- That exemption assumes every commit in release-please's history already passed this gate, and a category the gate did not yet scan for would slip underneath it
- `claude/skills/git-pr/references/pr.md` names the rule in one `Does not govern:` line routing at `publish.md`, so a body's author meets it before a red check

### Record roots

The verb reads paths as absent from a clone, and the reading splits by root.

- `.canon/` matches on the root alone, since one `.gitignore` line covers everything beneath it, including a folder no entry list names such as a worker's scratch note
- `.claude/` keeps the entry-list reading, which `src/labels/phase.ts` composes from `RECORD_ENTRIES` plus the worktrees folder

The worktrees folder is ignored at `.gitignore` and absent from `RECORD_ENTRIES` on purpose, since the harness pins a worktree to `.claude/` and a migration told to relocate one would break it. Adding it to `RECORD_ENTRIES` lost, since it changes what the record move carries to fix what a scan reports.

### Title format

The title-format check grades a pull request title against the `## Title` section of `claude/skills/git-pr/references/pr.md`, covering format, casing, and length. It enforces a rule already written.

The rules are checked independently, being `structure`, the two casing pairs, and `length`. A title breaking two rules and reporting only the first leaves an author meeting the second on the next run.

- `format.test.ts` breaks one rule at a time and asserts each fails alone
- `structure` stands apart, because a title failing the shape match parses no `<type>`, `<scope>`, or `<subject>` to grade casing against
- The check skips the `<type>` enum in `claude/skills/git-commit/references/commit.md`, since `pr.md` cites `commit.md` for shared structure and not a type list

### Commit side

The built-in `subject-case` rule tests the whole subject's casing, which rejects a legitimate capitalized proper noun anywhere in it. `claude/skills/git-commit/references/commit.md` governs the first word alone.

- `commitlint.config.js` leaves `subject-case` at `[0]`
- A local rule function checks the subject's leading letter run alone, matching the title check

A second local rule, `no-claude-co-author`, refuses a `Co-authored-by` trailer naming Claude or Anthropic.

- It reads `raw` line by line, since `@commitlint/parse` files a lone trailer under `body` and leaves `footer` null, so a footer check passes the message it exists to stop
- It matches `claude` or `anthropic` as a whole word in the name or address, because capture-refresh squashes carry a `github-actions[bot]` trailer and history holds a human one
- A line opening with `#` never matches, so git's own comment lines in the file `--edit` reads pass
