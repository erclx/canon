---
title: Overview
description: What the internal Claude domain owns and the folder holding it
---

# Overview

Owns the Claude surfaces that never leave this repo: the `internal-*` skills under `.claude/skills/`, the orchestrator and worker artifacts that coordinate multi-session work, and how a local session loads the plugin. What ships to target projects lives in `canon/context/claude-plugin/`.

## Layout

- `.claude/skills/` owns the `internal-*` skills, loaded before editing a toolkit domain and never installed into a target
