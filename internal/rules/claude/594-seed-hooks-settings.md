---
description: Hold the seeded hook scripts and settings file to the shipped hook and settings rules
paths:
  - 'tooling/claude/seeds/.claude/hooks/**/*.sh'
  - 'tooling/claude/seeds/.claude/settings.json'
---

# Seed hook and settings standards

## The seeded copies

- Follow `governance/rules/claude/575-hooks.md` for a seeded hook script. Every target receives this copy, so the stdin guard and the silencing rule hold here as they do in `.claude/hooks/`.
- Follow `governance/rules/claude/576-settings.md` for the seeded settings file. Every target receives this copy, so a session budget setting written here reaches every operator.
