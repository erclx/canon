---
title: Config comments rule ledger
description: Sources for governance/rules/tooling/config-comments.md, one row per bullet
---

# Config comments rule ledger

The field is comment style in configuration files. Neither the YAML spec nor the JSON-with-comments convention takes a side on what a comment says, and no published style guide covers config files the way Google's guides cover source. So every kept bullet stands on a house-choice row naming its bug class.

## Comments

| Bullet                                   | Source                                                                                                                                                                                                             | Read       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| What a key does or accepts, not its name | House choice: the allowed values are set by the tool reading the file, a fact the key name does not carry, while a comment restating the name adds a line that tells the reader nothing and can drift from the key | 2026-10-18 |

## Declined

Every bullet the rewrite removed, grouped by why.

### A convention Claude follows unprompted

- Cut "Match the comment density of the surrounding file", since the Claude Code system prompt already tells the model to match the surrounding code's comment density

### Cut without a source or a bug class

- Cut "Keep each comment to one short line", since comment length is taste and no reviewer could point at a defect a two-line comment causes
- Cut "Prefer a one-word category label over a sentence for a group header", as taste with no bug class
