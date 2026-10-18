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

Replaces the open and resume template once every open question carries a lean, and whenever the operator asks for one. A pass with a question marked `none, needs measuring` keeps the open and resume template. Chat only, with no file written.

Use H2 only, one-line bold-label bullets, and numbers only where they settle something. Stay near 300 words, capping the rules rather than listing every finding. Reuse the labels `Leaning` and `Overturned by` from the open template. Drop the held and not held split when the operator gave no hunch to test.

```plaintext
**<the verdict in one line>**

## Problem

<one or two sentences>

## What is true now

- **Held:** <the part of the operator's hunch the evidence supports>
- **Not held:** <the part it does not>

## Leans

1. <lean>
   - **Would change if:** <the finding that would overturn it>

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
