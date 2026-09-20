---
name: canon-operator
description: Front door to the toolkit in a target project. Orients on the toolkit's own docs and live `canon` catalogs, then runs or routes any toolkit operation from a plain-language intent. Use when you want one entry point instead of picking a specific setup or sync skill, or when asked to "use the toolkit", "what can the toolkit do", "sync my standards", "install rules", or "help me set up this project". User-invoked only. Defers first-time scaffold to setup and seed drift to seed-sync.
disable-model-invocation: true
---

# Canon operator

Front door to the toolkit. Orient first, then run the simplest operation that satisfies the intent or hand off to the owning skill. Never bypass `canon` to edit managed files by hand.

## Orient

Run these from the target project root, in parallel, before acting:

- `canon docs list`: the index of toolkit reference docs
- `canon docs agents`: the CLI command catalog and invocation contract
- `canon docs target-projects`: the scaffold, add-a-domain, and sync lifecycle

Load a domain doc with `canon docs <topic>` only when the intent touches that domain. Read the live catalog for any domain you act on with `canon <domain> list --json`. Never hardcode stack, rule, snippet, or standards names.

## Diagnose

Run `canon sync --check . --json` before routing. It reports what a target is behind on across every surface, so the intent comes from the project state rather than from the user having to know it already. Skip only when the user named a single operation to run.

Read seven fields off the report and carry each to `## Route`:

- `unmigrated`: a domain sitting at the root layout with nothing under `.claude/`. The most urgent finding, because that domain reports no drift of its own while being entirely behind
- `superseded`: a file a newer seed folder replaced. No command moves it, since the content is the project's own, so this routes to the skill that proposes the split rather than ending at the report
- `seeds`: entries are `matching`, `stale`, `drifted`, or `missing`. Anything but `matching` needs the seed handoff
- `domains[].entries`: per-file `stale`, `customized`, `stranded`, and `orphaned` as before
- `reverse`: what the target holds that no live catalog claims. `unclaimed` lists folders at roots the toolkit stopped shipping, each with an `attribution` of `dropped`, `unattributed`, or `project`. Act on the first two and leave `project` alone, which history proved the project owns. `migrations` names a proposal-only skill with a live case here and the `reason` it was measured from
- `historyUnavailable` on a domain, on `seeds`, or on `reverse`: nothing could be dated, so treat every difference as unverified and say so rather than reporting a file as untouched. It is set on `reverse` when the toolkit itself ships without history, which is the registry-install case, so the walk found nothing rather than finding a clean target
- `tooling`: read `measured` first. Every count under it is zero when it is false, which is an absence of measurement rather than a measured zero. Past that, `chain` names the stacks the install resolved, nearest first, and `counts.gitignore` counts the managed ignore entries the target is missing.

State what the report found in one line per finding before acting on any of it.

A `reverse` key the report does not carry at all is a CLI predating the field rather than a target with nothing unclaimed. Say the walk did not run and name the CLI version as the cause. Reading the absent key as an empty answer reports a clean target to a project nobody has looked at, and answering it from a filesystem walk of your own is worse, since that reaches a verdict the attribution the field carries is the only thing entitled to make.

## Route

Map the stated intent, or what `## Diagnose` found, to one lifecycle phase, then act.

The two can name different rows, and a reply answers both rather than picking one. Run or hand off what the finding names, then answer the intent in the same reply. A measurement intent therefore reaches the audit offers below even on a target whose diagnostic found scaffold work, which is the case a session leaving from the scaffold row would otherwise never read.

- A domain in `unmigrated`: name it, the root path, and the install path. No command moves it, so the user runs the relocation themselves
- An entry in `migrations`: hand off to the skill its `skill` field names, spelled as the report spells it. Both of them propose without writing, so the handoff is where this stops
- Anything in `superseded`: name which files and what replaced them, then hand off to `migration-superseded`. Both skills propose, so neither moves nor deletes the file
- A folder in `unclaimed`: name it and the attribution it carries. No command moves it and the content may be the project's own, so the decision is the user's

- First-time scaffold of a fresh project: hand off to `setup`
- Governance rules for the project stack: hand off to `setup`, which installs them alone on its `gov` phase
- Bootstrap the `index.md` system: hand off to `setup`, which bootstraps it on its `indexes` phase
- Seed or standards drift in `CLAUDE.md` or `.claude/` preambles: hand off to `seed-sync`
- Install one snippet, standard, or rule: run the domain `install` command
- Sync one domain or every installed domain: run `canon <domain> sync` or `canon sync`
- Fix only the ignore entries of the installed stack: run `canon tooling inject --gitignore <stack>`
- Measure a surface without changing it: offer the audits under `### Audits`
- Browse what is available: run `canon <domain> list`

### The ignore-only row

The ignore-only row runs on a measured tooling report alone, so `measured` decides before `chain` is read at all. A false one splits three ways. Report tooling as unmeasured in each, name the cause, and run nothing, since the zero counts underneath are unmeasured rather than clean:

- An empty `chain` at a workspace root, which carries `pnpm-workspace.yaml` or a `workspaces` key in `package.json`: no chain is recorded there by design, since one would guess at what the packages hold. Name `canon tooling sync <stack> <path>` against a package.
- An empty `chain` anywhere else: no tooling install is recorded, so name `canon tooling sync` as the command that records one rather than asking the user for a stack.
- A `chain` carrying names: this toolkit no longer ships those stacks. Name them, since injecting would write against a retired name.

On a measured report, take `<stack>` from the first name in `tooling.chain`, which records the stack nearest the target. Inject re-resolves that leaf's own chain, so a target whose recorded chain is shorter receives the entries from the layer its install skipped. Say so before running it.

### Audits

Five audits measure a surface without changing it. Offer the ones whose surface the target carries, list them together, and let the user pick. Run none of them unasked, and never treat a finding as a reason to abandon the operation the user asked for, since each reports judgments beside facts.

A lifecycle row and these offers fire together on a project carrying a context folder and no installed domain, which is the ranking the preamble states. Scaffold work on a target with nothing installed is real work, so an audit offered instead of it answers a question nobody asked, while an audit dropped in favor of it loses the one the user did.

- `canon/context/` present: offer `canon context audit`
- A record folder present under `.claude/`, one of `plans`, `groundwork`, `intake`, or `memory`: offer `canon records validate <kind>` for each one found
- Markdown that git lists: offer `canon markdown audit`
- TypeScript or shell source present: offer `canon comments scan`
- A `package.json` script that serves an interface, one of `dev`, `preview`, `serve`, or `start`: offer `ux-measure`

An audit offered against a surface the target lacks reports an empty run as a finding, which is the same defect as never offering it at all. Check the surface before naming the command.

The markdown row is the one every target satisfies, since a project with no markdown is not one this reaches. Its condition is stated so the five rows read alike, and the row needs no gate beyond it.

The last row is a skill handoff rather than a command, so `## Execute` does not govern it. Hand it off and stop, the way a lifecycle row hands off. Its condition reads a serving command rather than a source folder, since that skill measures what a browser receives and never opens the tree behind it. It carries a second condition this skill cannot read, which is a browser harness the project already installed, and the skill itself reports what it needs when it finds none. Testing for that here would put the detection in two places and let this one answer stale.

## Execute

For operations this skill runs directly:

- Read the catalog first with `canon <domain> list --json`, then match against project context
- Read the `canon-cli` skill before any install or sync, and warn the user by name about each surface it lists as overwritten. A command name says nothing about what it does to a file already there, and this skill is the one running it.
- Run the CLI with `CANON_NON_INTERACTIVE=1` so it skips prompts. The tool permission dialog is the confirmation gate.
- Report the command run and what changed. Emit the full relative path for any file written.
- Re-run `canon sync --check . --json` after any operation that wrote, and compare it against the report `## Diagnose` read before acting
- Report the fields that moved and name the write that moved each one. Do not restate the second report, since the value sits in the difference alone.
- State a field that moved the wrong way and leave it for the user to decide on. The re-check reports and never repairs.

A write can leave a target worse in a field the write never named, which stays silent while the operation itself succeeds. The re-check is what makes that visible, so it runs before the operation is reported as done.

The comparison needs the earlier report. When `## Diagnose` was skipped because the user named a single operation, say the write ran with no baseline rather than describing the target from scratch, which would attribute differences another session made to this run.

## Boundaries

- Run `canon`. Never reimplement its install or sync logic, and never edit managed files like rules, configs, or seeds by hand.
- Hand off the deep flows. Do not duplicate `setup` detection or `seed-sync` part-diffing inline.
- Resolve names from catalogs at runtime. A hardcoded name is a bug.
