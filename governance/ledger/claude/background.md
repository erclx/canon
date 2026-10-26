---
title: Background rule ledger
description: Decisions behind governance/rules/claude/background.md, one row per bullet
---

# Background rule ledger

The rule is a core rule, so every row is a house choice rather than a citation. Each names what goes wrong without its bullet and the option the bullet beat, with the date it was decided.

## Slow commands

| Bullet                            | Source                                                                                                                                                                                         | Read       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Background past about a minute    | House choice: a foreground run holds the conversation, so the operator waits on a check they could have talked over. It beat a warning hook, which would only warn and still let the run block | 2026-10-26 |
| Name the slow kinds               | House choice: a minute is a guess made before the run, and with no cases to match a session reads a full check as quick. It beat the threshold alone                                           | 2026-10-26 |
| Keep a seconds command foreground | House choice: each wake costs a turn, so backgrounding a quick command spends two turns where one did. It beat backgrounding every command                                                     | 2026-10-26 |
| End the turn on one status line   | House choice: a turn that stops silently leaves the operator unable to tell a wait from a stall. It beat ending on the tool call alone                                                         | 2026-10-26 |
| Keep working beside a server      | House choice: a dev server or a watch never exits, so a session awaiting its wake waits forever. It beat treating every background command as awaited                                          | 2026-10-26 |

## Waking

| Bullet                            | Source                                                                                                                                                                                | Read       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Act on the wake, never a guess    | House choice: a session guessing a command is done reads a partial output as the result. It beat checking the output file on a hunch                                                  | 2026-10-26 |
| No sleep, poll, or scheduled wait | House choice: a foreground sleep or poll holds the conversation the rule freed, and a scheduled prompt spends a turn on every check. It beat all three as ways to wait on one command | 2026-10-26 |
| Keep a skill's own wait           | House choice: a skill owns the verb and the timeout it waits on, such as a review-state wait, and one rule-wide wait would override it. It beat a single wait for every caller        | 2026-10-26 |
