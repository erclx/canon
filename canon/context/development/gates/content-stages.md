---
title: Content stages
description: The gate stages reading what a file says, covering hero provenance and its capture stamps, seed independence, shipped references and their patterns, and raw-field file references
---

# Content stages

## Hero provenance

The Hero stage asks two questions of a branch and neither is whether the frames are current. `scripts/core/regen-hero.sh --check` fills every template into a temp folder and discards the result, so a renamed featured skill, an empty catalog, or an unresolved placeholder still fails. The `captureStamps` measure in `src/gate/measures.ts` then checks each image against its markup. A branch commits no frame file of its own.

Currency sits off the branch because committed images cannot merge. Were each branch to capture, the first to land would force every branch behind it to rebase and redo the capture, across the markup, image, and stamp of every frame. `.github/workflows/refresh-capture-frames.yml` regenerates them from `main` and opens one pull request, which merges itself once its required check passes, so the committed frames lag `main` by one check run.

### What the stamp proves

`canon capture` writes a `.stamp` beside each PNG from inside the render, recording a `source-sha256` over the markup it read and an `image-sha256` over the bytes it wrote. The stage hashes both files where they sit on disk and compares each against its field. What it proves is provenance: this image came from this markup, whatever either file's history says.

That holds for a file source only. For a URL source the field hashes the URL string rather than the page it served, so a change to the served markup never stales the stamp.

Two digests rather than one, because either file can move alone. The markup side catches an edit committed with no capture. The image side catches a PNG replaced, truncated, or committed by itself under markup that never changed, which a markup-only digest passes. Each digest covers a whole file rather than the counts inside it, which keeps the stage ignorant of what the markup renders and correct as the frame grows fields.

Writing the stamp inside the render rather than in a wrapper is what makes it worth reading. A caller cannot capture and skip the stamp, so a PNG without a current one is either uncaptured or hand-placed, and the stage names which of a frame's three files is missing rather than reporting a mismatch it cannot compute. A tree carrying no markup under `assets/` has no set to read and passes, which is correct.

`captureStamps` takes the `.html` files under `assets/captures/` as its bases and resolves each base's `.png` and `.stamp` against `assets/`, so a frame added later is covered with no second edit and an image that no markup renders is left alone. `file_sha256` reads the path rather than a committed blob, so the stamp check clears on a staged capture before its commit exists, which lets a ship chain verify ahead of the step that commits.

### What moves a frame

The counts rendered into the frame come from the standards and skills trees and from the CLI registration block, so a merge adding a standard, a skill, or a command group moves `assets/captures/hero.html` and the refresh pull request carries the change. `canon design css --no-components` fills a `{{TOKENS}}` placeholder in every template, so a merge moving a value in `src/design/tokens.ts` moves `hero.html` and `install.html` and both light sets together. The command count is the source a plan is least likely to predict, since the commands expose no `--json` catalog and the figure comes through `canon gov counts`, which parses the registration list in `src/cli.ts` directly.

### Gotchas

`file_sha256` refuses on a machine carrying neither `sha256sum` nor `shasum`, and it refuses on stderr. Every caller reads it through a command substitution that captures stdout into the digest, so a message written there is swallowed and the stage reports a mismatch against a blank value, which names the image as wrong when the checker is what could not run.

The regen script is intermittently non-deterministic and nothing here explains why. `scripts/core/regen-hero.sh` exits 2 with no stdout and no stderr on roughly one run in five on WSL2, reaching the reader as `Hero regen health check failed` under a `run_check` that has nothing to print. The catalog verbs it shells out to run clean individually with stderr surfaced, and a trace ends mid-write of the `STANDARDS_JSON` assignment, so the failing command is unpinned.

Silence is the script's own doing rather than the stage's: `catalog()` sends every `list` call's stderr to `/dev/null`, so a failure inside one reaches nobody. Re-run the script before reading that shape as a real stale count, and know that `auto-ship` bounds verify at one fix attempt, so a chain meeting this stops on a stage that passes on retry.

## Seed independence

The Seed independence stage runs `scripts/core/check-seed-independence.sh`, which walks the `.md` files under every seed root and fails on the literal token `canon`. Seed prose installs into a scaffolded project and is read there as instruction about that project, so a line naming this repository's CLI hands a target a verb it may not be able to run and tells the reader the file is about somewhere else.

Banning a token is blunt, and the alternative is a judgment no stage can make. The only false-positive class is a fenced example naming the toolkit on purpose, which no seed carries, and a rule admitting fenced mentions would parse markdown to answer a question the corpus has never asked. The match is a bare substring rather than a word boundary, and `grep -w` does not narrow it, since a slash is a non-word character and `grep -w canon` still matches `canon/config/config.json`. The stage prefers a false positive to a missed citation because it gates.

### What the walk covers

The walk is scoped by extension rather than by path. Three seed hooks, `tasks-index.sh`, `memory-index.sh`, and `standards-audit.sh`, call the CLI deliberately and each reports by name when the binary is absent, so they keep the dependency and the extension scope leaves them outside the walk with no exemption list to maintain against them.

Discovery runs through `collect_seed_roots` in `scripts/lib/tooling.sh`, shared with the Seed standards stage, so a stack seeding `.claude/` later is covered with no edit to either caller.

Three outcomes separate a clean walk from one that measured nothing, matching `check-plugin-boundary.sh` on the last two. A missing `tooling/` exits 1, since the walk covers nothing. Roots that resolve and carry no markdown between them exit 1 for the same reason, because a pass there says the seeds cite no CLI on the strength of having read no prose. No seed root carrying `.claude/` exits 0 and says so, because the Seed standards stage already reads that one condition as a skip.

`internal/rules/claude/596-claude-md.md` carries the matching authoring rule, so a session editing the seed meets it at the edit rather than at the push. Its glob stays on the two `CLAUDE.md` paths rather than widening to every seed markdown, since the bullets beside it govern the root-and-seed pair and mean nothing over `canon/REQUIREMENTS.md`. The stage covers the rest of the seed tree.

### A seed gates harder than a context entry

The same finding fails a push against `tooling/*/seeds/` and only reports against `canon/context/`. The corpus moves it rather than the measure: a seed is authored once and installed into every scaffolded project, so a defect there propagates, while a context entry is edited by the people who own it and a threshold failing their push teaches them to route around the stage. Widening the `paths` globs on the claude rules was the alternative, and it is only a nudge, since a rule loads only when a session opens the file. Gating a measure with a known false-positive class forces an escape hatch, so `stub: true` exempts a seed and both install paths strip it before a target sees it.

The 150-line length checkpoint stays on the context side of that split and never gates. The whole-document ceiling is a fact about any corpus rather than a threshold on one, so the Document ceiling stage in `canon/context/development/gates/catalog-stages.md` reads it across seeds and context entries alike.

## Shipped references

The Shipped references stage reads `referencesIn` from `src/shipped/references.ts` over the seven corpora a target reader reaches, which is the package's `files` field less `src` and less the two trees that field already negates. It fails a push on six forms, each for what a reader holding a plugin cache rather than this repository meets:

- A bare pull request number resolves against the reader's own tree and reaches something else
- A bare commit sha resolves nowhere at all
- Either form qualified against this repository's own name resolves exactly as badly as the bare form it qualifies
- A `docs/`-relative path that resolves against this checkout names a file the reader does not hold
- A phase-label-shaped token has no board to resolve against
- A numbered rule path reaches its rule only through a separate `canon gov sync`, and only where governance was installed at all

It gates rather than reports, since a report leaves a citation for a person to notice rather than for a push to catch. The stage emits every hit before returning its failure, since a stage halts the run on its first failing check and a branch carrying several would otherwise repair one.

### The docs-path pattern

The docs-path pattern gates on resolution rather than on shape, because shape alone cannot tell a citation of this repository's own reference corpus from an illustration naming a target's own tree: `docs/agents/tasks.md` and `docs/retry.md` are the same token to a pattern with no filesystem behind it. `root` is a required argument on `referencesIn` rather than a defaulted one, since a caller that dropped it would silently report zero docs-path findings rather than fail to typecheck.

`canon/context/` takes no equivalent pattern, since resolution cannot separate `canon/context/index.md`, which every scaffolded project holds, from `canon/context/indexes.md`, this repository's own domain entry. Both resolve and only the second is a defect, which is a semantic read the rule and the review checklist carry instead.

### The two skill-body patterns

The standards-path pattern is scoped to `claude/skills/` rather than reaching the other six corpora. `598-authoring-layout.md` fixes `${CLAUDE_SKILL_DIR}/../../standards/<name>.md` as the form that resolves off the `claude/standards` symlink in every plugin cache, so a bare `standards/<name>.md` citation is the defect there and nowhere else: `docs/agents/` and `docs/workflow/` carry the identical bare shape correctly, since a docs page resolves from this checkout's own root. `REQUIREMENT.md` stays out of the scope even there, since a maintainer or an audit command reads that file rather than a session loading it.

The rule-path pattern shares that scope and reasoning, and a bare match reports whether or not the named rule exists, since a same-repository citation under this corpus names no target project's own tree. A rule reaches a target only through a separate `canon gov sync`, a narrower and slower delivery path than the plugin merge that ships the citing skill. The pattern anchors on the trailing `\d{3}-[\w-]+\.md` rather than on the bare `.claude/rules/` prefix, which lets a folder mention carrying no number pass untouched.

### The shape-only patterns

The phase-label pattern gates on shape alone, the way the pull-request and commit-sha patterns do, since a target holds no board a resolution check could run against. It does not reuse `VERSION_TOKEN` from `src/labels/phase.ts`, which admits one or two decimal groups so it can also catch a three-group semver tag in a release pull request's generated body. This reader requires exactly two numeric groups with a negative lookahead rejecting a third, which every phase label carries and every semver tag does not.

Both number patterns exclude the repair form by construction rather than by exemption. A lookbehind rejecting a word character before `#` never matches `owner/repo#123`, and the sha pattern rejects `@` and `/` in the same position so `owner/repo@abc1234` passes. A trailing boundary rejects a hex color reading as a pull request number too, such as `bg-[#316ff6]`, which would otherwise read as pull request 316.

### What the walk reads

The corpus stops short of `src/` on the reader rather than on the shipping. A `src/` doc comment lands on a target's disk and nothing serves it to a target reader, so its every number resolves for the person reading it. That boundary is also what keeps the check a prose pattern instead of a parser, since `src/design/` writes values shaped `#191512` and no width or boundary rule separates an all-digit hex color from a pull request number.

The walk passes `dot: true`, which is what reaches the seeds. `Bun.Glob` skips any path carrying a dotted segment by default, and every seeded `.claude/` tree, `.cspell/` list, and `.husky/` hook under `tooling/` sits behind one. It does not follow `claude/standards`, since that tree is a corpus here in its own right, and following the symlink would report every finding in it under two paths.

### Gotchas

The commit-sha pattern reads 7 to 40 contiguous hex characters with no narrower width check, so a URL-encoded hex color inside shipped prose can collide with it. `%23e0724b`, the percent-encoding of `#e0724b`, decodes to a `#` the check does not see and eight trailing hex characters it reads as a short sha. Write such a color as `rgb(224,114,75)` rather than a hex literal.

The marker mutes a line and nothing narrower, because `isMarked` reads the line itself and the one above and stops there. A real citation later added beside a marked line ships unreported. `isMarked` also reads a code span exactly as it reads a comment, so a token documented inside a code span on its own line arms the marker over that line and the line below it with nothing naming them as exempt, which is how `standards/publish.md` states its convention.

## Raw-field file references

The Raw-field file references stage walks the same seven corpora as Shipped references through the same file list, and fails a push on a `gh api` raw-string flag carrying a file reference. `-f body=@<path>` posts the literal path as the field value, so a comment edited that way is overwritten with the path and loses the marker a later read resolves it by. `-F` is the flag that reads the file.

The pattern is `(?:^|\s)(?:-f|--raw-field)[ =]\S+=@`, which needs the `=@` and so passes `-F`, `--field`, and a raw string such as `-f body="text"`, the last being what `scripts/sandbox/git/followup.sh` posts on purpose. It needs no judgment, since a raw-string flag followed by an `@` file reference has no correct reading. The stage stands apart from Shipped references because its verdict is a flag spelling rather than an unresolvable reference, and it scans prose, so a body quoting the wrong spelling to explain it fails and gets reworded rather than exempted.
