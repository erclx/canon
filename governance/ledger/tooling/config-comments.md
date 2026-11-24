---
title: Config comments rule ledger
description: Sources for governance/rules/tooling/config-comments.md, one row per bullet
---

# Config comments rule ledger

The field is comment style in configuration files. Neither the YAML spec nor the JSON-with-comments convention takes a side on what a comment says, and no published style guide covers config files the way Google's guides cover source. So every kept bullet stands on a house-choice row naming its bug class.

## Comments

| Bullet                                   | Source                                                                                                                                                                                                                                                                    | Read       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| What a key does or accepts, not its name | House choice: the allowed values are set by the tool reading the file, a fact the key name does not carry, while a comment restating the name adds a line that tells the reader nothing and can drift from the key                                                        | 2026-10-18 |
| A block of at most 3 text lines          | House choice: a config header that explains rationale grows into an essay no reviewer reads and drifts from the keys below it, and the code rule already holds a head block to 3 lines. No share cap, since a file explaining each key runs near half comments by design. | 2026-11-24 |
| True of the key, updated in the change   | House choice: a comment describing a value the key no longer holds reads as authoritative and misleads the next reader, and a config file has no test to catch it. Updating it in the same change puts both sides in front of one reviewer.                               | 2026-11-24 |
| No date, hash, issue, or `TODO`          | House choice: each is history or deferred work true only of the moment it was written, the same bug class the code rule bans. The scan matches each in `.yml`, `.yaml`, and `.toml` as it does in source.                                                                 | 2026-11-24 |

## Declined

Every bullet the rewrite removed, grouped by why.

### A convention Claude follows unprompted

- Cut "Match the comment density of the surrounding file", since the Claude Code system prompt already tells the model to match the surrounding code's comment density

### Cut without a source or a bug class

- Cut "Keep each comment to one short line", since comment length is taste and no reviewer could point at a defect a two-line comment causes
- Cut "Prefer a one-word category label over a sentence for a group header", as taste with no bug class
