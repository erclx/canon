---
name: target-check
description: Reports what a target project holds against what the toolkit currently ships, one section per domain, reading through `canon` verbs rather than inspecting files. Use when asked to "check this target", "what has this project fallen behind on", "is this project current with the toolkit", "run the target check", or as the first thing a rollout worker runs after entering a target. Do NOT use to repair a finding, which the owning command or skill does, and do NOT use in the toolkit repository itself.
---

# Target check

Reports, per domain, what this target holds against what the toolkit currently ships. It reports and never repairs, so whoever read the report decides what to fix.

Six domains carry the report. Five answer from a verb that already exists and the sixth answers from nothing, which it says rather than omitting. `${CLAUDE_SKILL_DIR}/references/domains.md` holds what each one reads, what current looks like, and where a finding routes. This body holds the order, the guards, and the report shape.

## Guards

- `canon` absent from the path: stop. `❌ canon is not on PATH, so no domain can be read.`
- No `.claude/` directory at the working root: stop. `❌ No .claude/ here, so nothing is installed to check. Run canon init first.`
- A `claude/skills/` folder at the working root, with no leading dot: stop. `❌ This is the toolkit itself rather than a target. canon-rollout takes a change out to the targets.` A target receives skills at `.claude/skills/` and authors none, so the spelling without the dot separates the source from what it installs into.
- Run every command under `CANON_NON_INTERACTIVE=1` and prompt at no point. Every caller in the near term is a worker a wave dispatched, with nobody present to answer, so the non-interactive path is the only path rather than a flag a caller remembers.
- Branch on each record's own fields rather than on an exit status. An operator's shell profile may wrap `canon` in a function whose status comes from a trailing command, which reports every refusal as success.

## Step 1: read the reports

Run these from the target root, in parallel:

```bash
CANON_NON_INTERACTIVE=1 canon sync --check . --json
CANON_NON_INTERACTIVE=1 canon context audit --json
```

The first answers five domains from one read, being `skew`, `domains`, `seeds`, `tooling`, and the layout fields `unmigrated`, `superseded`, and `reverse`. The second deepens a domain that first read only counts.

Then run `CANON_NON_INTERACTIVE=1 canon records validate <kind> --json` once per record folder the target carries, taking `<kind>` from what is present under the record root rather than from a list held here.

### The tooling read takes a stack, always

The tooling comparison runs last, because it needs a value the first read returns. Take `<stack>` from the first name in the report's `tooling.chain`, which records the stack nearest the target, and pass it:

```bash
CANON_NON_INTERACTIVE=1 canon tooling sync --check <stack>
```

Refuse the domain and report it unread when `chain` names nothing, rather than running the command bare. A bare call reaches the stack prompt, and the non-interactive variable this skill's Guards make mandatory resolves that prompt to the first option in the catalog instead of refusing it. The domain would then compare every target against whichever stack sorts first, and report drift that is an artifact of the wrong comparison rather than anything the target did. It would fire on every run rather than on an edge, since nothing about the target is read on the way to that default.

Read every installed domain from the catalog the report returns rather than from a name written into this body. `domains` enumerates what the target actually stamped, so a domain the toolkit adds later reaches this report with no edit here, and a name hardcoded here is a bug.

## Step 2: report each domain

Report the six in this order, one section each, per `${CLAUDE_SKILL_DIR}/references/domains.md`:

1. Toolkit version
2. The `canon/` folder
3. Governance rules
4. Tooling
5. Seeds
6. The Claude harness

Give each section three things and nothing else: the state, the evidence the state was read from, and the command or skill that repairs it. Naming the repair is not running it.

### Unread is not current

A refused command, an absent key, or a subcommand the target's binary does not carry leaves a domain unread. Report it as unread, name which read could not be taken, and name the cause. Reading an absent key as an empty answer reports a clean target to a project nothing looked at, which is the failure this report exists to replace.

The version domain is what makes that case legible rather than mysterious. A target a release behind is missing verbs the other five sections call, so the version section is read first and its state explains every unread section under it.

### No verdict across the six

Report a state per domain and no number over them. Five sections answer from verbs and the sixth answers from nothing, so any roll-up is a figure that lies about the sixth. `canon inventory` reports a listing rather than a verdict for the same reason, and it is absent from the six here because its subject is a target's own routes rather than what the toolkit ships.

## Step 3: stop at the report

Repair nothing, write no file in the target, and open no pull request. A wave decides what to fix after reading this, and a check that repaired as it read would leave the reader unable to tell a finding from a fix.

## Output

Lead with the table, then one detail block per domain that is not current:

```markdown
Target check: `<path>`, against canon `<version>`.

| Domain           | State                     | Evidence                          |
| ---------------- | ------------------------- | --------------------------------- |
| Toolkit version  | current / behind / unread | `skew.installed` against `latest` |
| `canon/` folder  | current / behind / unread | what the layout fields named      |
| Governance rules | current / behind / unread | the per-state counts              |
| Tooling          | current / behind / unread | what a sync would change          |
| Seeds            | current / behind / unread | the per-state counts              |
| Claude harness   | unchecked                 | no verb reads it                  |

No overall verdict. The harness row is unchecked rather than passing.
```

Keep the harness row `unchecked` on every run until a verb reads it. A domain left out of the table reads as a domain that passed, which is the one shape the row exists to prevent.
