---
title: Overview
description: The CLI shell-out pattern every skill follows, reading a report rather than rediscovering, the procedures defined once in standards, the main-root write route, and the two gates a new skill trips
---

# Overview

## Overview

Procedures that run inside more than one plugin skill, and the reasoning each body cites rather than restates. A skill body ships to targets where no `canon/context/` path resolves, so the why behind a shared step lives here for the maintainer editing it.

## Layout

- `claude/skills/` owns the bodies that carry these procedures
- `standards/` owns the two procedures defined once and cited, `publish.md` and `slug.md`
- `src/labels/` owns `canon labels audit`, which the label map procedure calls

Each file covers one procedure family:

- `canon/context/claude-plugin/skill-procedures/labels.md`: the label map a project declares, when labelling runs, and what the map fails to cover
- `canon/context/claude-plugin/skill-procedures/worktree-entry.md`: the `core.bare` repair, the dependency check, the branch entry hands the ship chain, and which document the chain resolved
- `canon/context/claude-plugin/skill-procedures/ship-chain.md`: the hazards a ship chain meets, from a mis-scoped review to a write landing on the wrong pull request

## The CLI shell-out pattern

Plugin skills that shell out to the CLI follow a consistent pattern: read the toolkit catalog via `canon <domain> list --json`, match against project context, then execute the CLI with `CANON_NON_INTERACTIVE=1` so it skips prompts. Claude Code's tool permission dialog is the single confirmation gate. Skills never reimplement CLI logic or hardcode rule, stack, or snippet names. `target-setup` is the reference.

### The non-interactive variable answers a prompt rather than refusing it

`CANON_NON_INTERACTIVE=1` skips a prompt by resolving it, not by declining to proceed. `select` in `src/ui.ts` returns the first option under that variable, so a verb whose argument a prompt would have asked for takes whatever sorts first in its catalog. A body that both mandates the variable and calls such a verb bare therefore runs against a value nothing about the target produced, and it reports the difference as a finding.

`canon tooling sync --check` with no stack is the worked case. The stack catalog sorts `astro` first, so a target reached that way compares against `astro` and the tooling section reports drift that is an artifact of the comparison. `target-check` takes the stack from the drift report's own `tooling.chain` instead, which the same step already reads, and refuses the domain when that field names none.

The general rule is that a skill mandating the variable owes every verb it calls each argument a prompt would have asked for. A default reached this way is silent in both directions: the command exits zero and the report reads as measured, so nothing downstream can tell the answer apart from one the target earned.

### Reading a report rather than rediscovering

`canon-operator` reads `canon sync --check --json` rather than walking the tree itself, and treats an absent report key as unread rather than as an empty answer. An absent key and an empty array are separate states: reading an absent key as empty exits zero, takes the nothing-to-report branch, and reports a clean target the CLI never actually measured, while a current CLI reporting an empty array has looked and found nothing.

That skew is the general shape rather than one skill's problem. A skill reaches a target through whichever CLI the machine has, while the skill itself loads live from the plugin, so a body written against a field can run against a binary predating it. `canon/ARCHITECTURE.md` carries the two-speed release as a standing risk.

The fallback does not key on `historyUnavailable`, since that field reports failed attribution on a domain or on `seeds`, while `unmigrated` is a filesystem read carrying no attribution at all. Keying on it would drop a correct detection whenever an unrelated half of the report could not be dated.

### Where the fallback stops being the safe answer

A fallback is worth having when its failure is an imprecision and worth refusing when its failure is a proposal nobody can undo. `unmigrated` pairs against domain folders whose worst listing error is an unfiltered count, so a skill reading it degrades to a listing when the key is absent. A `superseded` pairing fails differently: a listing of `.claude/*.md` also reaches `ARCHITECTURE.md`, `REQUIREMENTS.md`, and `DESIGN.md`, each a single file the layout intends to stay one, so a fallback there would shred three documents. No shipped skill reads that key, and the principle stands for whichever skill reads such a key next.

### A skill whose subject is a banned path

`check-skill-paths.sh` fails the build on a shipped body naming a `wiki/` path, since a shipped skill runs where no such path resolves. The ban constrains a citation, and it constrains the shape of a whole body when the folder is the skill's subject rather than an aside in it. `draft-wiki` is that case and it names no path at all. It cites its standard through `${CLAUDE_SKILL_DIR}/../../standards/wiki.md`, resolves the folder and its vendor subfolder from what that standard's own placement section states, and carries both as placeholders through every later step. The standard is therefore the single owner of the path, which is the outcome the citation rule wants anyway and which the ban forces here rather than leaving to judgment.

The script anchors its pattern on a non-path character, so a nested spelling such as `.claude/wiki/` stays legal and only the bare one fails. A body reaching for that nested form to satisfy the pattern would pass the gate and still be wrong, since it names a layout the target does not necessarily have. Resolving from the standard is what separates passing the check from being portable.

### Bundled references

`target-setup` bundles `references/detect.md`, `references/indexes.md`, and `references/verify.md`, each holding the per-phase procedure its body routes to. A `references/` file is read by a session running in a target project, where no `canon/context/` path resolves, so nothing in one cites the reasoning behind it. That reasoning is recorded here instead, on a surface that never ships, for the maintainer editing a reference. `canon/context/claude-plugin/machine-plugins.md` keeps the plugin catalog a retired setup skill bundled the same way.

## Procedures defined once and cited

Two procedures run inside more than one skill and are defined once in `standards/`, cited from each body rather than restated in it. Each has a standard of its own, `publish.md` for the scan and `slug.md` for the transform. Neither sits inside a document-type standard, since `markdown.md` does not govern a scan and `skill.md` does not govern a slug transform.

The scan carries two checks under one citation, characters and phase labels, with the rules themselves held by `markdown.md` and `versioning.md` beside it. A skill citing the scan gets both without naming either file, which is what keeps a new check from costing an edit in every consuming body. The label check scopes by destination, so `draft-diagram` cites the same standard and takes the character half alone.

Both are stated generally, and neither names what enforces it here. An installed standard belongs to the project that installed it, so a standard citing this repository's audit hook, scratch paths, or output filenames goes wrong in a target that has none of them, with nothing reporting it. In this repository the scan covers text the hook never reaches, meaning `.canon/tmp/`, anything leaving through `gh`, and anything inside a fence, and that belongs here rather than in the file that ships. Each citing skill names its own gap for the same reason, since the gap is a fact about the skill.

A citation names one path, `${CLAUDE_SKILL_DIR}/../../standards/<name>.md`, the same as any standard a body reads. The plugin install dereferences the `claude/standards` symlink, so every plugin cache holds the whole corpus and that path resolves wherever the plugin does. `slug.md` and `publish.md` are reached by citation alone, since neither has a home outside the corpus.

The split between the two surfaces is what keeps the citation honest. The standard owns the procedure and the body owns the trigger, since both the moment a scan runs and the text it runs against vary per skill. The empty-branch case splits the same way, carrying three legitimate answers across the catalogue: fall back to `latest`, stop, or fall through to another source. A body that cites without stating its own case reads as if the default applied to it.

Nothing detects a body that restates a procedure instead of citing it. `assert_no_drift` covers generated copies and a hand-written restatement is not generated, so the guarantee is only that a single definition exists to correct.

## Main-root writes

### The routing handoff drains per session

The memory-routing handoff queue drains per session rather than accumulating unread, so a file sitting in it is evidence about one session rather than about the mechanism. A handoff outlives its producer only when that producer never reached its own ship chain, so an aged file reads as a session that stopped early rather than as a queue with no consumer. Check the modification time against the live worktree list before concluding the mechanism itself is unread.

### A main-root write names its route or the guard silently takes it

Several bodies write shared session scratch at the main worktree root, and Claude Code refuses any such write from a linked worktree, redirecting to the worktree copy instead. The redirected write still succeeds, so a body stating only the destination reports success and loses the file, with no stage reporting the miss.

Each body names the route beside the destination rather than the destination alone. Creating a whole file goes out as a plain single `Bash` command carrying a heredoc, with `mkdir -p` sent separately because the isolation refuses a compound command whose target it cannot statically verify. Changing a line inside an existing file goes through a `canon` verb, since the shell route for that case is the stream editor `CLAUDE.md` bans. `CLAUDE.md` and the seed state the split once, and each guard names only what it writes.

Two structured edits have verbs, `canon tasks pull-request` and `canon tasks outcome`, chosen over a body instruction because the board write has a measured cost and a verb is the only part of this a test can reach. A structured edit no verb covers, such as `docs-fold` retargeting a `Plan:` line or `memory-review` flipping an item's emoji, reads the file and writes it back whole, staying a body instruction until a second caller wants the same edit.

A read site needs no route, since `Read` resolves against the main root normally.

## Adding a shipped skill trips two gates

A new folder under `claude/skills/` fails `bun run check` twice before anything about the skill itself is wrong. `src/claude/cases/all.test.ts` asserts every shipped skill carries at least one routing case, so the suite fails until the new name gets an entry in one of the `src/claude/cases/*.ts` files, and the failure names the skill rather than the checklist step that was missed. The Hero gate stage then fails, because the captured frame prints the shipped skill count and the count moved, which wants `assets/captures/hero.html` regenerated and re-rendered through `canon capture` with all three of the markup, the image, and the stamp committed. The `internal-claude` sync checklist names the folder, the catalog decision, the sandbox scenario, and both of these, pointing back here for the reasoning behind each rather than restating it.
