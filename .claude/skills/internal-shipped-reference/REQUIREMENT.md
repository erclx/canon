---
name: internal-shipped-reference
description: Scope boundary for the one portability read the shipped-reference gate cannot make by pattern, and what stays with the mechanical gate instead
---

# Internal shipped reference requirement

## Gap

Without this skill, a `canon/context/<name>.md` token in a shipped-corpus edit ships unreviewed. The shipped-references gate classifies the other forms by pattern, and no pattern tells a citation of this repository's own entry from an illustration of a target's generic tree.

A layout, stack, or config-path claim stated as portable when it is true of this checkout alone slips through the same way, since only reading the sentence decides it.

## Must

- Every `canon/context/<name>.md` token on an added or changed line under the shipped corpora is classified as a citation or an illustration
- Every layout, stack, or config-path claim in the same lines is read as a portable convention or a checkout-only fact
- A finding names `<file>:<line>`, the half of the test it failed, and a repair
- A clean run reports a pass rather than staying silent

## Must not

- Reclassify a pull request number, a commit sha, a resolvable `docs/` path, or a phase label, which `canon gate run` already gates
- Add or propose a pattern check for the `canon/context/` form
- Write the `canon-allow-reference` marker over a real citation
- Report a second finding on a line `canon-allow-reference` already mutes
- Re-derive where toolkit content is authored or which copy is cited, which the rest of `authoring-layout.md` states

## Out of scope

- Voice, rhythm, and word choice in the same diff, which `write-human` owns
- Banned characters and formatting in the same diff, which `markdown-craft` owns
