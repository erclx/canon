---
name: canon-cli
description: Why a session is routed from a job to its canon verb from one place, why the verbs that can lose its edits are flagged before they run, and why the skill reads rather than writes
---

# Canon cli requirement

## Gap

Without this skill, a session guesses at a verb from its name. It learns afterward what the verb did, because `install` and `sync` differ per domain, with some surfaces overwriting, some merging, and some written once and never again. Golden configs and edited rules get replaced unwarned. A copy-once seed waits on a sync that never rewrites it.

The route is missing too. `canon --help` lists each verb in one line, so a session with a job pays a read per candidate or picks by name. The job-to-verb mapping is the fact it needs, and nothing brings it up unless a body names it.

## Must

- Name each target-usable top-level verb by its job, never its subcommands or flags, and route an author-and-render verb to the skill that owns it
- Warn before a verb that can lose the project's edits runs, naming what it replaces, and defer to `canon docs install-and-sync` where the summary disagrees
- Point to `canon <verb> --help --all` and `canon docs agents` for subcommands, flags, and the invocation contract, and have the session read that help before running a verb no skill body spells out
- Route a verb or surface the skill does not cover to `canon docs` rather than to an inference from a similar row
- Fail a coverage test naming each top-level verb that the body neither carries nor exempts, and each exemption naming something no longer a verb

## Must not

- Run, or send the session to run, a `canon` command that writes or installs
- List a subcommand, a flag, or a JSON shape, which restates the docs
- List a verb that only works inside the toolkit repository
- Take a mention in a sibling's requirement file as an inbound route, since the pointer lives in the body that needs it

## Out of scope

- Executing the sync, which the user owns
- Reconciling a customized seed section by section, which an operator owns
- Deciding which stack, rule, or standard a project installs, which `target-setup` owns
- Diagnosing what a project is behind on, which `target-check` owns
