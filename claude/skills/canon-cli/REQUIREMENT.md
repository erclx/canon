---
name: canon-cli
description: Why a session is pointed at the verb catalog, the reference docs, and the overwrite contract from one place, and why the skill reads rather than writes
---

# Canon cli requirement

## Gap

Without this skill, a session runs a `canon` sync and finds out afterward what it did. The command names give nothing away. `install` and `sync` differ per domain, some surfaces overwrite unconditionally, some merge, some are written once and never touched again, and none of that is visible from the command line the user typed.

The damage lands on the files a project owns. A golden config carrying local edits is replaced without a warning anyone saw, and a standards install overwrites every standard in a project that only needed the two it had drifted on. The user learns which category a file was in by losing the edit.

The inverse failure is quieter. A session that assumes a sync will pick up a change edits a seed and waits for an update that never comes, because the seed is copy-once and no sync command writes it again. Both failures are one missing fact available before the command runs.

Being reachable is a separate problem from being right. This is a pure reference whose moment happens inside another skill's run, so nothing brings it up unless a body names it. Three sibling requirement files named it and routed nothing, because Claude Code loads `SKILL.md` as the entry and never opens the sibling. A route lives in a body or it does not exist, and a fourth requirement mention would repeat the same defect.

The body now carrying an inline pointer is `seed-sync`, at the point it runs or prints an overwriting command.

A third gap sits beside the first two, aimed at a different question. `canon --help` lists every top-level verb and `canon docs` emits the toolkit's own reference corpus, but no reference skill pointed a session at either. No skill does now. A session guessing at a verb's name, or restating what a doc already answers, is the same missing-fact failure the overwrite gap names.

## Must

- State per surface and per command whether an existing file is overwritten, merged, written once, or left alone
- Warn about a destructive run before it happens, naming the surface that will be lost
- Name the section-preserving path for a standard or seed the project has customized
- Defer to the toolkit's own context docs when they and this summary disagree, since the summary is a copy and they are the source
- Point to `canon docs agents` for the verb catalog and to `canon docs` for the reference corpus, rather than restating either

## Must not

- Run, or send the session to run, a `canon` command that writes or installs. The skill is read before acting on a sync.
- Restate the verb catalog or a reference doc's content. Point to `canon docs agents` or `canon docs <topic>` instead. The overwrite table is this skill's one authored exception, and it too is a target-session summary, with the detail living with its owner.
- Take a mention in a sibling's requirement file as an inbound route. The three bodies named in the gap above carry the pointer, and adding a fourth means editing that body rather than its requirement.

## Guards

- A surface or command the contract does not cover routes to the context docs rather than to an inference from a similar row

## Out of scope

- Executing the sync, which the user runs
- Reconciling a customized seed section by section: `seed-sync`
- Deciding which stack, rule, or standard a project should install, which the setup skills resolve from live catalogs
- Diagnosing what a project is behind on: `target-check`
