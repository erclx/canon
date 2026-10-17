---
title: Markdown audit
description: The markdown ban scan and its gate, the relative-link check, why one rule set reads every path, and the edit-time hook that calls the same verb
---

# Markdown audit

## Decisions

### The first ban-list verb

`canon markdown audit` is the first verb that reads a ban list rather than measuring structure, and the first that needs no folder to resolve. An attribute standard governs a file, so the index-plus-entry contract had kept `.claude/rules/` and `governance/` outside every audit, which was 90 markdown files across three trees.

### The ban set ships as data

The ban set lives in `src/markdown/bans.ts` and the nine checkpoints in `src/markdown/structure.ts`, not parsed out of the standards per run. Parsing put a parser contract on documents authored for people, and a one-word backticked example in a `- Do not use ` bullet was lifted into a literal ban and banned that word everywhere.

### Where the numbers are stated

Six of the nine checkpoints are stated in `markdown.md` and the three cadence numbers in the `write-human` skill. The standard carries what a scan decides and the skill carries what a ban list cannot express.

### Drift is the accepted cost

Nothing compares the shipped numbers against the sentences stating them. A checkpoint moved in code and left alone in `claude/skills/markdown-craft/references/markdown.md` drifts silently, so move both. A test restoring the comparison would put `markdown.md` back under a machine reader and undo the unlock.

### The set is closed and holds two characters

A character is the one class a literal match settles. A project wanting its own vocabulary is asking for a different feature.

### Words and spellings sit outside the gate

Word guidance lives in the `write-human` skill, since a word ban catches the token and misses the habit. `just`, `allows`, and `very` carry honest uses no literal match separates, and no check reads spelling.

Gating both was rejected. Measured at `60fc97bf` on 2026-08-19, 21 terms ran across 483 markdown files for a clean exit, and every occurrence sat inside the ban list itself or an example demonstrating the ban.

### An empty set is reported, not passed

An empty set finds nothing and would exit clean, which reports an unchecked corpus as one carrying no violation. `emptyBanSets` names the set when it arrived empty and the run exits 3. The set ships with the package, so the only cause is a defect in the build.

### Exit 3 stays apart from the refusal at 1

A refusal built no corpus and the gate reports the stage as unmeasured. An empty set walked the corpus and looked for nothing, so the stage fails on 3. Reusing 1 would put the gate behind a warning that lets the push through.

The `--json` record carries `bans.emptySets`, and both hooks read that field.

### Hooks also answer an absent record

A completed run always writes the record and a refusal writes none, so emptiness means the verb declined to measure. The verb refuses outside a git repository, which a scaffolded project can be, and reading the findings alone reported that as a clean file.

### The package root is hard to observe

An ordinary run here resolves the package root to the repository root. Only a fixture rooted outside the repository separates it, which is what the `loadStandards` cases in `bans.test.ts` do at `mkdtemp`.

`PROJECT_ROOT` derives from `import.meta.url`, not Bun's `import.meta.dir`, which the test runner leaves undefined. Otherwise any module reading the package root is unreachable from a test.

### Fence parity

A walker toggling on any backtick run reads the closing fence of a three-backtick block nested inside a four-backtick one as an opening, and inverts the rest of the file. It reported ten closing fences as bare.

- `src/markdown/scan.ts` owns the only fence walker and marks each line rather than filtering it
- The depth measure skips a fenced line, bullet folding treats one as a break, and the ban scan ignores it
- `src/records/validate.ts` reads `linesOutsideFences` from there instead of keeping its own copy

### Frontmatter anchors at position 0

The pattern matches at position 0 alone, so a `---` block inside a fenced template is body rather than a second divider.

### Ban scan and weight measures see different text

Both drop a link destination and an autolink. Only the ban scan drops a code span, so a standard quoting its own banned character does not report itself, while a weight measure counts a backticked path because the path is on the page.

### They share patterns, not the masking function

`maskDisplayed` holds each span's width so a finding can name a column. A held width is what a weight measure exists to discount, so `visibleText` drops the span. Measuring source instead cost 7 weight-only paragraphs and 4 files past the depth checkpoint.

### `visibleText` walks around a span

Keeping the span counted and then dropping link syntax from inside it takes the decision back. A backticked path holding an angle-bracket placeholder is where that lands, and masking through one hid 2 bullets and 5 paragraphs the corpus carries.

### The ban half gates

A banned character is a fact and passes the test that gates a citation. What held the gate back was that failing on day one against a never-checked corpus fails on work nobody could have fixed yet.

Taking the ban count to zero was the precondition. The structural measures stood at 99 heavy bullets, 220 heavy paragraphs, and 40 files past the depth checkpoint, and moved with neither decision.

### Exit codes keep two meanings apart

The gate exits `2` and leaves `1` meaning refusal, so a measurement that found something stays distinct from the audit declining to measure. `src/markdown/gate.ts` takes the structural reports beside the ban list and gates on the bans, which gives the split a place to be asserted.

### Links join the ban list as a gating fact

A relative link resolving to nothing on disk is gated over the same corpus. `src/markdown/links.ts` skips a destination carrying a URL scheme, a same-file anchor, a root-absolute path, or an angle-bracket template placeholder, so `<slug>`-shaped illustrations stay unreported.

- `gate.ts` gates on either list
- `markdownBans` in `src/gate/measures.ts` reads the shared exit code rather than a second `Measure`, since one run reports both facts

### The merge gate walks the whole corpus

The stage in `src/gate/stages.ts` runs over every tracked file, not the changed ones. A `Do not use` bullet added to a standard bans a token retroactively, and no file in that push was edited.

The stage sits below `Context citations` for that stage's reason. Every stage above it is pure bash, and both of these depend on TypeScript.

### A deleted tracked file throws

The corpus comes from the tracked listing and the walker opens each path without testing it exists. A tracked file deleted in the working tree with the deletion unstaged throws `ENOENT`, so stage the deletion before auditing a change that removes a file.

### One rule set reads every path

`canon context audit` tiers by path, failing a push against a seed tree and reporting against a context entry, and it carries the `stub: true` exemption. `canon markdown audit` has neither half. Every markdown file git lists is measured the same way, and nothing under `src/markdown/` reads an exemption marker.

### Tiering would rank the wrong tree lowest

Tiering fits a structural measure because a checkpoint is a judgment, and a seed leaving the repository is where a judgment is worth failing a push over. A banned character is as wrong in a context entry as in a seed, so a per-path tier would count a violation least in the tree its authors read most.

Adding that tiering is the change this record exists to decline.

### Colon and heading-case measures are advisory

Both report and neither gates. `isGating` in `src/markdown/gate.ts` reads the ban and link lists alone and carries both findings as inputs it ignores.

### Why a colon never gates

The colon measure counted 1,393 candidate lines across 464 of 716 tracked files at `2203cc0a8`, and a colon is sometimes right. It exists because an agent told to drop an em dash often writes a colon in its place and leaves the sentence as it was.

### The hook scopes colons to the edit

The hook matches the word before the colon and the colon against the new text, not the whole line, since an edit often rewrites only a phrase of one. An old colon never asks the current edit to answer for it.

The scoping lives in the hook because only the hook holds the edit's new text, and the verb stays a pure measure of a file.

### Heading case

A proper noun is the one case heading case cannot tell from title case. Gating would need a names list and an escape marker, and the operator chose warnings on 2026-10-11 to avoid both. The hook reads the whole file's headings, since fixing one is a single edit where it stands.

### One ban set at edit time

`.claude/hooks/standards-audit.sh` calls the verb per edited file, so one copy of the ban set serves the edit-time surface and the stage that fails the push. A second copy inside the hook is a divergence nothing would compare.

The seed copy calls the verb too, since the set ships as data and a hook parsing `markdown.md` would read nothing a ban added there states.

### The hook decides from the record

The hook reads the `--json` record rather than the exit code, so a binary predating the gate reports at edit time all the same. A missing runner degrades to a report of no enforcement, since an unchecked edit and a clean one are the same quiet to a reader.

### The checkout beats the installed binary

The hook prefers a checkout's `src/cli.ts` over a global `canon`, the choice the merge gate makes for its own reason. The installed binary trails the checkout by however many releases it has missed, so a ban kind added to `src/markdown/bans.ts` would report at push and not at edit.

### Seed fallback

A scaffolded project carrying no `canon` gets a report rather than a pass. The seed resolves one runner where the toolkit copy resolves two, and names the binary to install when neither the findings nor the empty-set field can be read.

The Seed independence measure in `src/gate/boundaries.ts` scopes to markdown alone and leaves the seed hooks outside its walk, which its comment records as deliberate.

### Testing the hook's runner choice

`src/hooks/guard.test.ts` strips the real binary from `PATH` so the index hook reports the same branch on every machine. That puts the acting branch of a CLI-calling hook out of reach, so this case takes a stub runner on a `PATH` of its own.

- Each stub reports a `kind` naming itself, which lets a test read the runner the hook resolved
- The acting case proves a verdict was reached and says nothing about which branch produced it, so the preference could stop resolving with every test green

### Three cases cover the hook

The cases cover the checkout, the fallback, and the machine carrying neither. Each was confirmed by breaking its branch and watching that case alone fail.

- The degradation case runs against a fixture directory linking `bash` and `jq` and holding no runner
- Both are what the run depends on, the first to spawn the hook and the second to parse the payload, and missing either lands somewhere silent for an unrelated reason
- Filtering the caller's `PATH` for a directory with `jq` and no runner was rejected, since it reads machine provisioning and a machine with `bun` in `/usr/bin` leaves no directory qualifying
