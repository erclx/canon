---
title: Groundwork output reference
description: The chat output a groundwork run closes on, one template for open and resume, a retell for a fully leaned pass, and one for close
---

# Groundwork output reference

Applies to the report a `plan-groundwork` run emits once its mode finishes. Every path is the full relative path from the project root.

## Open and resume

Use `📂 Resumed` in place of `📂 Opened` on a resume pass.

```plaintext
📂 Opened .canon/groundwork/<nn>-<slug>/

**Written:**

- `.canon/groundwork/<nn>-<slug>/README.md`
- `.canon/groundwork/<nn>-<slug>/01-current-state.md`

**Open questions:**

1. <question>
   - Leaning: <where the evidence currently points>
   - Overturned by: <the finding that would change it>
```

## Retell

Replaces the open and resume template once every open question carries a lean. It also answers an operator who asks for one, whatever the questions' state. Chat only, and the retell itself writes no file.

Use H2 only, one-line bold-label bullets, and numbers only where they settle something. Stay near 300 words.

- Keep the leans that decide the operator's call, five at most, and fold the rest into one line naming how many more there are and where they sit
- Label each reversal `Overturned by`, as `groundwork.md` does
- Drop the held and not held split when the operator gave no hunch to test
- Put a question marked `none, needs measuring` under `## More measuring` as a yes, since an asked-for retell has no lean to give it
- List a file the pass wrote or updated under `**Written:**` after the verdict, and omit the block when none was

```plaintext
**<the verdict in one line>**

**Written:**

- `.canon/groundwork/<nn>-<slug>/<file>.md`

## Problem

<one or two sentences>

## What is true now

- **Held:** <the part of the operator's hunch the evidence supports>
- **Not held:** <the part it does not>

## Leans

1. <lean>
   - **Overturned by:** <the finding that would change it>

## More measuring

**<Yes or No>:** <its cost, and what it would decide>

## Dropped

- <what was set aside>

## Your call

<the single decision the operator owes>
```

## Close

Omit the uncited-claims block when the count is zero.

```plaintext
✅ Closed .canon/groundwork/<nn>-<slug>/

**Written:**

- `.canon/groundwork/<nn>-<slug>/06-decision.md`
- `.canon/groundwork/<nn>-<slug>/07-next-session.md`

**Uncited external claims:** <count, or none>

- `<file>`: <the claim>

<the decision in one line>

Next: /plan-feature
```
