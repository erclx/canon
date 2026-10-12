---
name: canon-cli
description: Why a session is routed from a job to its canon verb from one place, why the verbs that can lose its edits are flagged before they run, and why the skill reads rather than writes
---

# Canon cli requirement

## Gap

Without this skill, a session guesses at a verb from its name and runs a `canon` sync to find out afterward what it did. The command names give nothing away. `install` and `sync` differ per domain, some surfaces overwrite unconditionally, some merge, some are written once and never touched again, and none of that is visible from the command line the user typed.

The damage lands on the files a project owns. A golden config carrying local edits is replaced without a warning anyone saw, and a governance sync takes back a rule the project had edited. The user learns which category a file was in by losing the edit.

The inverse failure is quieter. A session that assumes a sync will pick up a change edits a seed and waits for an update that never comes, because the seed is copy-once and no sync command writes it again. Both failures are one missing fact available before the command runs.

A third gap is the route itself. `canon --help` lists every top-level verb by a one-line description, and a session with a job in hand pays a `--help` read per candidate to find the one that does it, or picks by name and lands on the wrong one. The job-to-verb mapping is the fact the session needs and no verb answers.

Being reachable is a separate problem from being right. This is a pure reference whose moment happens inside another skill's run, so nothing brings it up unless a body names it. A route lives in a body or it does not exist, and a mention in a sibling's requirement file is not one.

## Must

- Name each target-usable top-level verb by its job, never its subcommands or flags
- Route an author-and-render verb to the skill that owns it rather than describing it
- Warn about a verb that can lose the project's edits before it runs, naming what it replaces
- Point each destructive verb at `canon docs install-and-sync`, which owns the overwrite detail
- Point to `canon <verb> --help --all` and `canon docs agents` for subcommands, flags, and the invocation contract, and have the session read that help before running a verb no skill body spells out, a verb a skill pins in full being exempt
- Defer to `canon docs install-and-sync` when it and this summary disagree, since the summary is a copy and the doc is the source

## Must not

- Run, or send the session to run, a `canon` command that writes or installs. The skill is read before acting on a sync.
- List a subcommand, a flag, or a JSON shape. That restates the docs and is the drift the one-name-per-verb rule removes.
- List a verb that only works inside the toolkit repository. A named exemption set in the coverage test holds that boundary.
- Take a mention in a sibling's requirement file as an inbound route. The pointer lives in the body that needs it.

## Guards

- A test fails naming each top-level verb in `COMMAND_GROUPS` that the body neither carries as `canon <verb>` nor exempts, and fails again when an exemption names something that is no longer a verb
- A verb or surface the skill does not cover routes to `canon docs` rather than to an inference from a similar row

## Out of scope

- Executing the sync, which the user runs
- Reconciling a customized seed section by section, which an operator does by hand
- Deciding which stack, rule, or standard a project should install, which the setup skills resolve from live catalogs
- Diagnosing what a project is behind on: `target-check`
