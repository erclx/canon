---
title: Groundwork output reference
description: The chat output a groundwork run closes on, one template for open and resume and one for close
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
