---
title: Walk file
description: The shape of the file an operator walk writes before its first step, being the step table, its four states, and the fields each step carries
---

# Walk file

The file an operator walk writes before saying its first step, and edits before saying any change. An operator opens it to see what is left, and a later session resumes from it.

## The step table

The file opens on one table holding every step, in the order the operator runs them.

- Name each step with a short imperative, numbered from 1, matching its H2 below
- Fill `Where` with the console, the terminal, or the session the step runs in, so the operator knows which window to open
- Order a step that needs a value after the step producing it, and a step that cannot be undone after every check that could stop it
- Renumber the whole table when a step is added or moved, since a resumed session reads the numbers as the order

## States

A step's `State` cell holds one of four values, or nothing for a step the walk has not reached.

| State     | Means                                                                                               |
| --------- | --------------------------------------------------------------------------------------------------- |
| `next`    | The step the walk is on. Exactly one row reads it while the walk is open.                           |
| `done`    | Its check passed. Write `done, by the operator's word` where the step has no read-only check.       |
| `skipped` | The operator chose not to run it. Follow the state with the reason, such as `skipped, already set`. |
| `blocked` | It cannot finish now. Follow the state with what it waits on, such as `blocked, the host is down`.  |

A resumed walk opens on the first step neither `done` nor `skipped`, which puts a blocked step ahead of everything after it.

## Each step

Each step takes one H2 carrying its number and name, and the fields below in this order.

- **Why:** one line on what the step is for, so the operator can tell when a screen asks for something the step never needed
- The action as a numbered list. Each command sits in its own fenced block, ready to copy, and each click names the page and the label on the control.
- **Expect:** what the screen or the output shows when the step worked
- **If it differs:** what to do instead, or `stop and say what you see` where nothing safe is known
- **Checked by:** the read-only command the session runs to confirm it, or `the operator's word` where none exists

A step that yields a secret adds a **Secret:** field last, naming where the value is pasted, such as a repository secret or a password manager, and never the value.

### What the file never holds

The file is read by later sessions and sits in scratch no records push reads, which keeps it out of a pushed history but not off the screen.

- Never write a token, a password, a key, or a recovery code into it, nor a partial one, even masked
- Never paste a command's output that printed a secret. Write what the output showed instead, such as `the token was printed once`.
- Write a step that asks for a screenshot with `clear` or a closed tab ahead of the capture, so a secret left in scrollback stays out of the image

## Template

````markdown
# <Walk name>

| Step      | Where                        | State |
| --------- | ---------------------------- | ----- |
| 1. <name> | <console, terminal, session> | done  |
| 2. <name> | <console, terminal, session> | next  |
| 3. <name> | <console, terminal, session> |       |

## 2. <name>

**Why:** <one line>

1. <the click, naming the page and the control>
2. Run:

   ```bash
   <exact command>
   ```

**Expect:** <what the screen or output shows>

**If it differs:** <what to do instead>

**Checked by:** <a read-only command, or the operator's word>

**Secret:** <where the value goes, never the value>
````
