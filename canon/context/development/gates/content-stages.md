---
title: Content stages
description: The gate stages reading what a file says, from hero provenance and seed independence to shipped references
---

# Content stages

## Decisions

### Hero provenance

The Hero stage asks two questions of a branch, and neither is whether the frames are current. `bun scripts/core/regen-hero.ts --check` fills every template into a temp folder and discards it, so a renamed featured skill, an empty catalog, or an unresolved placeholder fails. The `captureStamps` measure then checks each image against its markup.

- A branch commits no frame file of its own, because committed images cannot merge and the first branch to land would force every other to redo its captures
- `.github/workflows/refresh-capture-frames.yml` regenerates them from `main` in one self-merging pull request, so committed frames lag `main` by one check run

### What the stamp proves

`canon capture` writes a `.stamp` beside each PNG from inside the render, recording a `source-sha256` over the markup it read and an `image-sha256` over the bytes it wrote. The stage hashes both files where they sit and compares each against its field, which proves provenance, that this image came from this markup.

- For a URL source the field hashes the URL string rather than the page, so a change to the served markup never stales the stamp
- Two digests are needed because either file can move alone. The markup side catches an edit with no capture, and the image side catches a PNG replaced or truncated under unchanged markup.
- Each digest covers a whole file, so the stage stays ignorant of what the markup renders and correct as the frame grows fields
- The stamp is written inside the render, so a caller cannot skip it, and a PNG without a current one is uncaptured or hand-placed
- The stage names which of a frame's three files is missing rather than reporting a mismatch it cannot compute

`captureStamps` takes the `.html` files under `assets/captures/` as bases and resolves each `.png` and `.stamp` against `assets/`, so a later frame is covered with no second edit and an image no markup renders is left alone. A tree with no markup under `assets/` has no set to read and passes.

`file_sha256` reads the path rather than a committed blob, so the stamp check clears on a staged capture before its commit exists, which lets a ship chain verify ahead of the step that commits.

### What moves a frame

The counts in the frame come from the skills tree and the CLI registration block, so a merge adding a skill or a command group moves `assets/captures/hero.html` and the refresh pull request carries the change.

- `canon design css --no-components` fills a `{{TOKENS}}` placeholder in every template, so a value moved in `src/design/tokens.ts` moves `hero.html`, `install.html`, and both light sets together
- The command count is the hardest to predict, since `countCommands` in `src/counts/catalogs.ts` parses the registration list in `src/cli.ts` and the commands expose no `--json` catalog

### Hero gotchas

`file_sha256` refuses on a machine carrying neither `sha256sum` nor `shasum`, and it refuses on stderr. Every caller reads it through a command substitution capturing stdout, so the message is swallowed and the stage reports a mismatch against a blank value, naming the image as wrong when the checker could not run.

The bash regen script exited 2 with no output on roughly one run in five on WSL2, reaching the reader as `Hero regen health check failed`. A wrapper sent every `list` call's stderr to `/dev/null`, so the failing command was never pinned.

- `scripts/core/regen-hero.ts` replaced it and spawns no verb, and thirty consecutive `--check` runs on WSL2 passed clean
- The cause is still unpinned, since the rewrite removed the suspected path rather than reproducing the failure
- A failure now prints a `regen-hero:` message, so record it here if one appears and re-run before reading it as a real stale count

### Seed independence

The Seed independence stage runs the `seedIndependence` measure in `src/gate/boundaries.ts`, which walks the `.md` files under every seed root and fails on the literal token `canon`. Seed prose installs into a target and reads there as instruction, so a line naming this repository's CLI hands it a verb it may not run.

Banning a token is blunt, and the alternative is a judgment no stage can make. The only false-positive class is a fenced example naming the toolkit on purpose, which no seed carries, and admitting fenced mentions would parse markdown to answer a question the corpus has never asked.

- The match is a bare substring, and `grep -w` does not narrow it, since a slash is a non-word character and `grep -w canon` still matches `canon/config/config.json`
- The stage prefers a false positive to a missed citation because it gates

### What the seed walk covers

The walk is scoped by extension rather than by path.

- Two seed hooks, `records-index.sh` and `standards-audit.sh`, call the CLI deliberately and report by name when the binary is absent, so the extension scope leaves them out with no exemption list
- Discovery runs through `seedRoots` in `src/tooling/seeds.ts`, shared with the Seed standards stage, so a stack seeding `.claude/` later is covered with no edit to either caller

Three outcomes report unmeasured, which warns on a contributor's machine and refuses under CI.

- A missing `tooling/` covers nothing
- Roots that resolve and carry no markdown between them, since a pass would say the seeds cite no CLI on the strength of having read no prose
- No seed root carrying `.claude/` or `canon/`, which agrees with the Seed standards stage, while the bash this stage replaced exited 0

`internal/rules/claude/seed-mirror.md` carries the matching authoring rule, so a session editing the seed meets it at the edit rather than the push. Its glob stays on the two `CLAUDE.md` paths, since its bullets govern the root-and-seed pair and mean nothing over `canon/REQUIREMENTS.md`.

### A seed gates harder than a context entry

The same finding fails a push against `tooling/*/seeds/` and only reports against `canon/context/`. The corpus moves it rather than the measure. A seed is authored once and installed into every scaffolded project, so a defect propagates, while a threshold failing the push of the people who own a context entry teaches them to route around the stage.

- Widening the `paths` globs on the claude rules was only a nudge, since a rule loads only when a session opens the file
- Gating a measure with a known false-positive class forces an escape hatch, so `stub: true` exempts a seed and both install paths strip it before a target sees it
- The 150-line length checkpoint stays on the context side and never gates, since the Document ceiling stage in `canon/context/development/gates/catalog-stages.md` reads the ceiling across both

### Shipped references

The Shipped references stage reads `referencesIn` from `src/shipped/references.ts` over the five corpora a target reader reaches, being the package's `files` field less `src` and the two trees it negates.

- It gates rather than reports, since a report leaves a citation for a person to notice rather than a push to catch
- It emits every hit before failing, since a stage halts the run on its first failing check and a branch carrying several would otherwise repair one

Seven forms fail a push, each for what a reader holding a plugin cache rather than this repository meets.

| Form                                 | Why it fails                                                      |
| ------------------------------------ | ----------------------------------------------------------------- |
| Bare pull request number             | Resolves against the reader's own tree and reaches something else |
| Bare commit sha                      | Resolves nowhere                                                  |
| Either qualified by this repo's name | Resolves as badly as the bare form                                |
| `docs/`-relative path resolving here | Names a file the reader does not hold                             |
| Phase-label-shaped token             | Has no board to resolve against                                   |
| Installed rule path                  | Reaches its rule only through a separate `canon gov sync`         |
| `canon standards` call               | Sends the reader to a verb no installed CLI carries               |

### The docs-path pattern

The docs-path pattern gates on resolution rather than shape, because shape cannot tell a citation of this repository's reference corpus from an illustration naming a target's own tree: `docs/agents/tasks.md` and `docs/retry.md` are the same token to a pattern with no filesystem behind it.

- `root` is a required argument on `referencesIn`, since a defaulted one dropped by a caller would silently report zero docs-path findings rather than fail to typecheck
- `canon/context/` takes no such pattern, since `canon/context/index.md` (every target has one) and `canon/context/context-model.md` (ours alone) both resolve and only the second is a defect
- That semantic read sits in the rule and the review checklist instead

### The retired-verb and rule-path patterns

The retired-verb pattern reads every corpus but `docs/`, since a `canon standards` call fails for a reader wherever it sits and `docs/` pages still document the verb. A trailing lookahead rejects a hyphen so a `standards-audit` page name passes.

- The rule-path pattern is scoped to `claude/skills/`, less each `REQUIREMENT.md`, which a maintainer or audit reads rather than a session
- A match reports whether or not the named rule exists, since a same-repository citation names no target project's own tree
- A rule reaches a target only through a separate `canon gov sync`, a narrower path than the plugin merge that ships the citing skill
- It anchors on a trailing `.md` file rather than the bare `.claude/rules/` prefix, so a folder mention naming no file passes

### The shape-only patterns

The phase-label pattern gates on shape alone, like the pull-request and commit-sha patterns, since a target holds no board to resolve against. It does not reuse `VERSION_TOKEN` from `src/labels/phase.ts`, which also admits three-group semver tags. It requires exactly two numeric groups, with a negative lookahead rejecting a third.

Both number patterns exclude the repair form by construction rather than by exemption.

- A lookbehind rejecting a word character before `#` never matches `owner/repo#123`
- The sha pattern rejects `@` and `/` in the same position, so `owner/repo@abc1234` passes
- A trailing boundary rejects a hex color such as `bg-[#316ff6]`, which would otherwise read as pull request 316

### What the shipped-references walk reads

The corpus stops short of `src/` on the reader rather than the shipping, since nothing serves a `src/` doc comment to a target reader. That keeps the check a prose pattern instead of a parser, as `src/design/` writes values shaped `#191512` and no rule separates an all-digit hex color from a pull request number.

The walk passes `dot: true`, which reaches the seeds. `Bun.Glob` skips any path with a dotted segment by default, and every seeded `.claude/` tree, `.github/` workflow, and `.husky/` hook sits behind one.

### Shipped-references gotchas

The commit-sha pattern reads 7 to 40 contiguous hex characters with no narrower width check, so a URL-encoded hex color can collide with it. `%23e0724b`, the encoding of `#e0724b`, hides its `#` and leaves eight hex characters read as a short sha. Write such a color as `rgb(224,114,75)`.

The marker mutes a line and nothing narrower, because `isMarked` reads the line itself and the one above, so a citation added beside a marked line ships unreported. It reads a code span as it reads a comment, so a token documented in a code span arms the marker over that line and the next, as `claude/skills/git-pr/references/publish.md` states.

### Raw-field file references

The Raw-field file references stage walks the same corpora and fails on a `gh api` raw-string flag carrying a file reference. `-f body=@<path>` posts the literal path as the field value, so an edited comment is overwritten with the path and loses its marker. `-F` is the flag that reads the file.

- The pattern is `(?:^|\s)(?:-f|--raw-field)[ =]\S+=@`, which needs the `=@` and so passes `-F`, `--field`, and a raw string like `-f body="text"`, which `sandbox/git/followup.ts` posts on purpose
- It needs no judgment, since a raw-string flag followed by an `@` file reference has no correct reading
- It stands apart from Shipped references because its verdict is a flag spelling, and it scans prose, so a body quoting the wrong spelling to explain it is reworded rather than exempted
