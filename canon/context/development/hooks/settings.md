---
title: Session budget settings
description: The three Claude Code settings bounding a long session's cost that the repository records without setting, being autoCompactWindow, autoContinueAtUsageLimit, and crossSessionInbound
---

# Session budget settings

Three Claude Code settings bound what a long session costs, and they sit beside the hooks because `.claude/settings.json` is the same file the hooks register in. This repository sets none of them, and `tooling/claude/seeds/.claude/settings.json` sets none of them either. Two are live in the operator's own `~/.claude/settings.json` and the third is deliberately unset, so this file is the only place the repository says so. A session reading the settings file alone would conclude all three are unconfigured and set them again, possibly to a different value.

`governance/rules/claude/576-settings.md` routes that session here, since JSON carries no pointer of its own. The rule globs `.claude/settings.json` and the seed copy at `tooling/claude/seeds/.claude/settings.json`, so editing either loads the two facts that hold in any project, being the `autoContinueAtUsageLimit` inversion and the `autoCompactWindow` cap, and a third bullet sending the reader to whatever development record their own project keeps. It names no path, since a rule reaches a target through `canon gov sync` while this entry never leaves the repository, so a citation to this file would resolve for nobody holding the rule.

Every value below was read from `https://code.claude.com/docs/en/settings-reference`, `https://code.claude.com/docs/en/model-config`, `https://code.claude.com/docs/en/cross-session-messaging`, and `https://code.claude.com/docs/en/costs`. Re-read those pages before trusting a value here against a newer client.

## autoCompactWindow

The setting fixes how full the context window gets before Claude Code compacts. It takes an absolute token count from 100K to 1M rather than a percentage, accepting a plain integer, a `k` or `M` suffix, or a bare number from 100 to 1000 read as thousands. Its documented scope is any settings file. Left unset, a session compacts at its model's context limit, and `/autocompact <value>` writes a value to the user file rather than to the project one.

The operator's user file sets it to 750000. Claude Code caps the window at the model's own context window, so a 200K session reaches the cap first and the setting changes nothing there, and the value bites only on a session running the 1M window.

The value stays in the user file rather than moving here or into the seed. A threshold that suits an orchestrator open all day is wrong for a session that opens for ten minutes, which makes it a per-operator preference rather than a project fact, and committing one machine's answer here would impose it on everyone who opens the repository.

## autoContinueAtUsageLimit

The setting makes a session wait in place and continue its task after a claude.ai usage limit resets, instead of losing where it was. It is set to `true` in the operator's user file.

The project file cannot assert it. Its documented scope is user or managed, and the precedence rules carve out one direction for this key alone: while a repository file sets it and no user, `--settings`, or managed value does, Claude Code reads the setting as off. Writing `true` into `.claude/settings.json` would therefore turn the behavior off for anyone carrying no value of their own.

The rolling five-hour usage-limit window is not readable locally. There is no `claude usage` subcommand, `/usage` is interactive, `stats-cache.json` holds daily counts rather than a rolling window, and nothing under `~/.claude/` names usage, limit, or quota. Do not rebuild that search.

## crossSessionInbound

The setting decides what a session does with a message from one of your other sessions, on an `accept`, `hold`, `refuse` ladder. Claude Code delivers an inbound message as a new turn whenever the receiving session sits idle, and that turn carries the whole context, which is what makes the key a cost lever for a dispatch loop. The vendor's own cost page names `hold` as the way to stop paying it.

This repository leaves it unset. `hold` and `refuse` are the two values that bound the cost, and both break the worker handback the orchestrator loop runs on, since a held message reaches nobody until an `accept` later applies and a refused one is dropped outright. `accept` is the third value and bounds nothing, so no value on the ladder both saves tokens and keeps the loop working.

Precedence is the reason to leave the seed alone as well. A project or local value wins over managed, `--settings`, and user values when it is stricter and is ignored when it is not, so a `hold` seeded into a scaffolded target would override that operator's own `accept` rather than yield to it.
