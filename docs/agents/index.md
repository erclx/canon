---
title: Agents
subtitle: CLI catalog and invocation rules for agents, split by command domain. Start with overview.
category: Agent surface
---

# Agents

CLI catalog and invocation rules for agents, split by command domain. Start with overview.

- [App config](app-config.md): Every table and key in canon/config/app.toml, being how canon drives, previews, and films the app and which device classes it supports
- [Audits](audits.md): Running every health check as one set, the verdict and exit codes, the corpus states, the retained baseline and its delta, and a catalog of every audit verb with whether a finding gates
- [Config](config.md): Every file a project writes under canon/config/, the keys of each but app.toml, the starters init seeds, and what the Config gate stage fails and warns on
- [Context audit](context-audit.md): Running the context audit, its folder scope, the exit codes, every check with the folders it reaches and whether it gates, the seed gate, and the citation exclusions
- [Drift report](drift-report.md): What canon sync --check reports, being the drift states, the eight side sections no sync applies, and version skew
- [Indexes](indexes.md): How canon indexes regen and canon indexes list resolve paths, what they stage, and the record and exit codes each emits
- [Install and sync](install-and-sync.md): What each install and sync verb writes, refuses, or leaves alone, and the rule detection record
- [Markdown audit](markdown-audit.md): Running the markdown audit over any path, each finding with whether it gates, the density and table limits, the advisory measures, the exit codes, and where the audit runs
- [Migrate](migrate.md): What each canon migrate verb moves, the markers that keep an old spelling, and what each one refuses
- [Output shape](output-shape.md): The framed output shape every command renders into, the JSON and color modes, the exit discipline, the runtime catalogs, and a headless invocation per domain
- [Overview](overview.md): What this folder covers, the invocation rules every command inherits, and how canon docs resolves a topic name
- [Records](records.md): Backing the record folders to a private remote, restoring them on a new machine, reading folder size, and pruning stale scratch
- [Sessions reap](sessions-reap.md): Stopping the background sessions a task recorded once its work ends, the finished sweep, the skips that protect live work, and the outcomes each row reads
- [Sessions transfer](sessions-transfer.md): Moving a session to another machine with export and import, the manifest fields, the refusal reasons, and what a resume on the target depends on
- [Targets](targets.md): The projects this toolkit installed into, where each answer comes from, the cross-target pull request read, and the releases since a target's install
