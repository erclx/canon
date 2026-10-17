---
title: Overview
description: The CLI shell-out pattern, procedures defined once in an owner skill, the main-root write route, and the two gates a new skill trips
---

# Overview

## Overview

Procedures that run inside more than one plugin skill, and the reasoning each body cites rather than restates. A skill body ships to targets where no `canon/context/` path resolves, so the why behind a shared step lives here for the maintainer editing it.

## Layout

- `claude/skills/` owns the bodies that carry these procedures
- `claude/skills/git-pr/references/publish.md` and `claude/skills/git-branch/references/slug.md` own the two procedures defined once and cited
- `src/labels/` owns `canon labels audit`, which the label map procedure calls

Each file covers one procedure family.

- `canon/context/claude-plugin/skill-procedures/labels.md` covers the label map a project declares, when labelling runs, and what the map fails to cover
- `canon/context/claude-plugin/skill-procedures/worktree-entry.md` covers the `core.bare` repair, the dependency check, the branch entry hands the ship chain, and which document the chain resolved
- `canon/context/claude-plugin/skill-procedures/ship-chain.md` covers the hazards a ship chain meets, from a citation count reading one surface to a write landing on the wrong pull request

## Decisions

### The CLI shell-out pattern

Plugin skills that shell out to the CLI read the toolkit catalog via `canon <domain> list --json`, match it against project context, then run the CLI with `CANON_NON_INTERACTIVE=1` so it skips prompts.

- Claude Code's tool permission dialog is the single confirmation gate
- Skills never reimplement CLI logic or hardcode rule or stack names
- `target-setup` is the reference

### The non-interactive variable answers a prompt

`CANON_NON_INTERACTIVE=1` skips a prompt by resolving it, not by declining to proceed. `select` in `src/cli/ui.ts` returns the first option under that variable, so a verb whose argument a prompt would have asked for takes whatever sorts first in its catalog.

A body that mandates the variable and calls such a verb bare runs against a value nothing about the target produced, and reports the difference as a finding.

- `canon tooling sync --check` with no stack is the worked case, since the stack catalog sorts `astro` first and the tooling section reports drift that is an artifact of the comparison
- `target-check` takes the stack from the drift report's own `tooling.chain` instead, and refuses the domain when that field names none
- A skill mandating the variable owes every verb it calls each argument a prompt would have asked for

A default reached this way is silent in both directions. The command exits zero and the report reads as measured, so nothing downstream can tell the answer from one the target earned.

### Reading a report rather than rediscovering

A skill reading `canon sync --check --json` treats an absent report key as unread rather than as an empty answer. Reading an absent key as empty exits zero and reports a clean target the CLI never measured, while a current CLI reporting an empty array has looked and found nothing.

- A skill loads live from the plugin and reaches a target through whichever CLI the machine has, so a body written against a field can run against a binary predating it
- `canon/context/claude-plugin/distribution.md` carries the two-speed release as a standing risk
- The fallback does not key on `historyUnavailable`, since `unmigrated` carries no attribution and keying on it would drop a correct detection whenever an unrelated half could not be dated

### Where the fallback stops being the safe answer

A fallback is worth having when its failure is an imprecision and worth refusing when its failure is a proposal nobody can undo.

- `unmigrated` pairs against domain folders whose worst listing error is an unfiltered count, so a skill reading it degrades to a listing when the key is absent
- A `superseded` pairing fails differently, since a listing of `.claude/*.md` also reaches `ARCHITECTURE.md`, `REQUIREMENTS.md`, and `DESIGN.md`, so a fallback there would shred three documents
- No shipped skill reads `superseded`, and the principle stands for whichever skill reads such a key next

### A skill whose subject is a banned path

The Skill paths stage fails the build on a shipped body naming a `wiki/` path, since a shipped skill runs where no such path resolves. When the folder is the skill's subject, the ban shapes the whole body. The wiki reference of `draft-doc` is that case and names no path at all.

- It cites its standard through `${CLAUDE_SKILL_DIR}/references/wiki.md`
- It resolves the folder and its vendor subfolder from that standard's own placement section, and carries both as placeholders through every later step
- The standard is the single owner of the path, which is the outcome the citation rule wants anyway

The script anchors its pattern on a non-path character, so a nested spelling such as `.claude/wiki/` stays legal and only the bare one fails. Reaching for the nested form passes the gate and is still wrong, since the target does not necessarily have that layout. Resolving from the standard is what separates passing the check from being portable.

### Bundled references

`target-setup` bundles `references/detect.md`, `references/indexes.md`, and `references/verify.md`, each holding the per-phase procedure its body routes to. A `references/` file is read in a target project where no `canon/context/` path resolves, so nothing in one cites the reasoning behind it. That reasoning is recorded here for the maintainer.

`canon/context/claude-plugin/machine-plugins.md` keeps the plugin catalog a retired setup skill bundled the same way.

## Procedures defined once and cited

### Owner references

Two procedures run inside more than one skill. Each is defined once in an owner skill's `references/` and cited from each body rather than restated, `publish.md` for the scan and `slug.md` for the transform. Neither sits inside a document-type standard, since `markdown.md` does not govern a scan and `skill.md` does not govern a slug transform.

The scan carries two checks under one citation, characters and phase labels. The rules sit in `markdown.md` and `versioning.md` beside it.

- A skill citing the scan gets both checks without naming either file, so a new check costs no edit in every consuming body
- The label check scopes by destination, so a skill writing into the repository rather than onto a remote takes the character half alone

### What the standard states and what it leaves out

Both are stated generally and neither names what enforces it here. An installed standard belongs to the project that installed it, so one citing this repository's audit hook, scratch paths, or output filenames goes wrong in a target that has none of them, with nothing reporting it.

In this repository the scan covers text the hook never reaches, meaning `.canon/tmp/`, anything leaving through `gh`, and anything inside a fence. That belongs here rather than in the file that ships, and each citing skill names its own gap, since the gap is a fact about the skill.

### Citing a shared reference

A citation names one path, `${CLAUDE_SKILL_DIR}/../<skill>/references/<name>.md`, the same as any shared reference a body reads. The plugin ships its skills side by side, so that path resolves wherever the plugin does. `slug.md` and `publish.md` are reached by citation alone.

- The standard owns the procedure and the body owns the trigger, since the moment a scan runs and the text it runs against vary per skill
- The empty-branch case splits the same way, with three answers across the catalogue (fall back to `latest`, stop, or fall through), so a body citing without its own reads as if the default applied
- Nothing detects a body that restates a procedure instead of citing it, since `assert_no_drift` covers generated copies only, so the guarantee is that a single definition exists to correct

## Main-root writes

### The routing handoff drains per session

A handoff queue under `.canon/tmp/handoff/` drains per session rather than accumulating unread, so a file sitting in it is evidence about one session rather than about the mechanism. A handoff outlives its producer only when that producer never reached its own ship chain.

An aged file therefore reads as a session that stopped early. Check the modification time against the live worktree list before concluding the mechanism itself is unread.

### A main-root write names its route or the guard silently takes it

Several bodies write shared session scratch at the main worktree root, and Claude Code refuses any such write from a linked worktree, redirecting to the worktree copy. The redirected write still succeeds, so a body stating only the destination reports success and loses the file, with no stage reporting the miss.

Each body names the route beside the destination.

- Creating a whole file goes out as one plain `Bash` heredoc command, with `mkdir -p` sent separately, since the isolation refuses a compound command it cannot statically verify
- Changing a line inside an existing file goes through a `canon` verb, since the shell route for that case is the stream editor `CLAUDE.md` bans
- `session-worktree` states the split once in its `references/main-root-writes.md`, and each guard names only its destination, its route, and a pointer to that skill

### Structured edits and reads

Two structured edits have verbs, `canon tasks pull-request` and `canon tasks outcome`. They were chosen over a body instruction because the board write has a measured cost and a verb is the only part a test can reach.

A structured edit no verb covers, such as `context-fold` retargeting a `Plan:` line, reads the file and writes it back whole. It stays a body instruction until a second caller wants the same edit. A read site needs no route, since `Read` resolves against the main root normally.

## Adding a shipped skill

### Two gates trip before the skill is wrong

A new folder under `claude/skills/` fails `bun run check` twice before anything about the skill itself is wrong.

- `src/claude/cases/all.test.ts` asserts every shipped skill carries at least one routing case, so the suite fails until the name gets an entry in a `src/claude/cases/*.ts` file
- The Hero gate stage fails because the captured frame prints the skill count, so regenerate `assets/captures/hero.html`, re-render it through `canon capture`, and commit markup, image, and stamp

The `internal-claude` sync checklist names the folder, the catalog decision, the sandbox scenario, and both gates, pointing back here for the reasoning behind each.
