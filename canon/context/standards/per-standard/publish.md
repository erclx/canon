---
title: Publish
description: The cross-reference form split by destination, the destination test every scan under it inherits, the record-root reading, and the title-spelling and title-format checks beside them
---

# Publish

## Cross-reference form

`standards/publish.md` states the form a pull request or issue number takes, under `## Cross-reference form`. The rule is one test rather than a list of surfaces: bare where the destination auto-links it, backticked where it does not. A list goes stale when a new surface appears, and the test covers the cross-repository spelling without a clause of its own.

The split runs through the remote. A pull request body, an issue body, a comment on either, and a commit message all auto-link, and a markdown file browsed from the repository tree links neither spelling, so each form is correct in one place and a reference moved between them is rewritten.

`publish.md` holds the rule over `markdown.md` because it turns on where the text is going rather than on what the text is. `markdown.md` governs a file reference identically in every file, and this one is wrong in one destination and right in the other, which is the split `publish.md` already draws for phase labels. `markdown.md` carries the `Does not govern:` entry and `publish.md` names the rule in its own scope line, so the boundary is declared from both sides. `canon/context/standards/scope.md` holds the general case.

Every skill writing GitHub conversational text already cites the standard, so a single section reaches all of them and no skill body carries the rule. Restating it per skill would put one rule in several places on several cadences.

Quoted text is exempt, and the rule says so rather than leaving it to judgment. Two consumers quote repository prose into a GitHub comment, so an instruction to rewrite a reference would reach inside a quotation and report the source as having said something it never said.

Nothing enforces it and nothing can. `canon markdown audit` runs over repository files, where the backticked form is the correct one, so a check there would flag the compliant references and reach none of the published text that goes wrong. The rule joins the character and phase-label bans as something an author applies at publish time.

## Destination test

The paragraph scoping a check by destination sits under `## When it runs` rather than inside one check's section, so a check added later inherits it instead of restating it: a reader inside the repository holds the task board and a reader on a remote holds neither that nor any gitignored record folder. `## Phase labels` and `## Board identifiers` both fall under it, the second covering a label a code span quotes and a path under a record root, and each says under its own heading that the shared paragraph scopes it.

`canon labels scan` is the verb behind the checks, and it is destination-scoped by construction rather than by a parameter, since the workflow wires it to `pull_request` and `pull_request_review`, both readers holding the checkout the check scopes against. The negative half is asserted: a unit case runs the markdown ban sets, the repository-bound corpus, through the scan and expects nothing. A `destination` argument lost, since it moves a split the invocation site already draws into a function every caller then has to answer for.

`## Session links` is the third check the paragraph governs, with a narrower dependency. The other two turn on the reader holding this checkout. A session link resolves for the one account that started it, which no checkout reaches, so the section states that dependency under its own heading.

It is reported on a release pull request too, where the board identifier is exempted. That exemption reasons from every commit in release-please's generated history having already passed this gate, and a category the gate did not yet scan for would reach a release body underneath the premise.

`standards/pr.md` names the rule from the reader's side, one line in its `Does not govern:` list routing at `publish.md`, so the person writing a body meets the rule rather than only a red check.

## Record roots

Which paths the verb reads as absent from a clone splits by root:

- `.canon/` matches on the root alone, since one `.gitignore` line covers everything beneath it. That reading also catches a path under a `.canon/` folder no entry list names, such as a worker's own scratch note.
- `.claude/` keeps the entry-list reading. `src/labels/phase.ts` composes it from `RECORD_ENTRIES` plus the worktrees folder, which is ignored at `.gitignore` and absent from that list on purpose, since the harness pins a worktree to `.claude/` and a migration told to relocate one would break it.

Adding the worktrees entry to `RECORD_ENTRIES` lost, since it changes what the record move carries to fix what a scan reports.

## Title spelling

`canon labels scan`'s unspelled-word check on a pull request title carries no `publish.md` section. The destination-scoped checks name text a reader outside this checkout cannot resolve, and a misspelled word carries no such dependency, so it fits neither that paragraph nor the namespace split `versioning.md` states for phase labels against semver tags. It is a fact about one field feeding one sink: release-please copies a pull request title straight into `CHANGELOG.md` with nothing having spell-checked it first. This entry and `docs/agents/commands.md` state it about the verb.

`cspell` is a devDependency of this repository alone, per `075-dependencies.md`'s ban on importing a transitive-only package, so `src/labels/spelling.ts` resolves `node_modules/.bin/cspell` by walking from the caller's working directory up to the filesystem root rather than spawning a bare `cspell`.

- `bun src/cli.ts labels scan`, the invocation `phase-label-gate.yml` runs, sits outside `bun run` and carries no `node_modules/.bin` on `PATH`, so a bare spawn throws `ENOENT` even inside this repository.
- The resolved path rules out a `bunx` fallback, which could reach the network from inside an otherwise offline, regex-based command.
- A target project carrying no `cspell` gets no coverage from this check rather than a forced dependency or a network call.

`scanTitleSpelling` reads the `cspell` exit code and reports `check-failed` on any value outside its two defined ones, rather than reading an unreadable exit as a clean title. The `--json` record carries `spellingChecked` beside `unspelledWords`, so a caller can tell a clean title from one nothing checked.

## Title format

The title-format check grades a pull request title against `standards/pr.md`'s `## Title` section, format, casing, and length, so it enforces a rule already written rather than a fact this entry alone states.

The rules are checked independently, `structure`, the two casing pairs, and `length`, rather than failing the title on the first mismatch. A title breaking two rules and reporting only the first leaves an author fixing one and meeting the second on the next run. `format.test.ts` breaks one rule at a time and asserts each fails alone. `structure` still stands apart, because a title failing the shape match parses no `<type>`, `<scope>`, or `<subject>` to grade casing against.

It does not check `<type>` against `standards/commit.md`'s type enum. `pr.md`'s `## Title` states format, casing, and length only, and cites `commit.md` for the structure it shares rather than for a type list, so checking the enum would enforce a rule from the wrong document.

The commit side mirrors it. The built-in `subject-case` rule tests the whole subject's casing, which rejects a legitimate capitalized proper noun anywhere in it rather than the first word alone `standards/commit.md` governs, so `commitlint.config.js` leaves it at `[0]`. A local rule function checks the subject's leading letter run alone, matching the title check's subject-casing rule.

A second local rule, `no-claude-co-author`, refuses a `Co-authored-by` trailer naming Claude or Anthropic. It reads `raw` line by line rather than `footer`, since `@commitlint/parse` files a lone trailer under `body` and leaves `footer` null, so a footer check passes the exact message it exists to stop. It matches `claude` or `anthropic` as a whole word in the name or the address rather than refusing co-author trailers outright, because capture-refresh squashes carry a `github-actions[bot]` trailer and history holds a human one, and both are legitimate. A line opening with `#` never matches, so git's own comment lines in the file `--edit` reads pass.
