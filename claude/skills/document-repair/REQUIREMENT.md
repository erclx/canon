---
name: document-repair
description: What the repair skill is for, the drift it closes, and why it gates only through the CLI
---

# Document repair requirement

## Gap

Without this skill, an older project fails the density limits on every file it has not edited since the limits landed, and nothing repairs it. `document-health` reports a length finding and stops, and the edit hook fires only on a file being touched, so an untouched folder stays over the limits.

A folder repaired by hand also drifts back, since a target gates nothing until a folder is listed, and a session listing one by hand can list a folder that still fails.

## Must

- Each batch takes one folder and leaves it at zero findings or reports it ungated
- A folder gates only through `canon markdown gated add`, which refuses one with a finding left
- A rewrite keeps every stated reason, command, and path the original carried, and leaves a context entry no more shape findings than it started with
- The body names the verbs and states no limit number
- A requirement gates by its own path, never through a folder prefix

## Must not

- Edit `canon/config/markdown.toml` by hand
- Report a folder gated that the verb refused
- Reach zero density findings by growing the context shape findings
- Change what a document claims to pass the audit
- Be reachable only by its name, since `document-health` names it for every length finding

## Out of scope

- Reporting rot across length, placement, and staleness, which `document-health` owns
- Whether a document exists or holds its required sections, which `target-check` owns
