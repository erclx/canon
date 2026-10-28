---
title: Adopted and declined
description: Which external software design sources this skill adopted, which it declined, and why, so a later session extends the position instead of re-deriving it
---

# Adopted and declined

External sources were read and filtered rather than imported. This file is the record, and a later session extending the skill adds to it rather than re-arguing an item settled here.

A source a bullet rests on is linked once, in that bullet's row of the toolkit's per-bullet ledger at `governance/ledger/skills/code-craft/`, which ships outside the plugin. This file names those sources without the link and keeps the catalog-level adopted and declined record, linking only a source no row cites.

## Adopted from the default shelf

### What to look for in a code review

Google's engineering practices say to solve the problem known to need solving now rather than one speculated about, and to read "too complex" as "cannot be understood quickly by a reader".

Adopted as the writing-time half of the same judgment, behind the change test and the ban on building for an unnamed case. The review procedure itself stays with `review-craft`.

## Adopted for depth and decomposition

### Information hiding

David Parnas, [On the Criteria To Be Used in Decomposing Systems into Modules](https://dl.acm.org/doi/10.1145/361598.361623), 1972, splits a system by the design decision each module hides, not by the steps of processing. Adopted as the module-split rule under depth.

### Deep modules

John Ousterhout, [A Philosophy of Software Design](https://web.stanford.edu/~ouster/cgi-bin/book.php), holds that complexity is what makes a system hard to change, and a module is worth having when its interface is much simpler than its implementation.

Adopted as the opening of the depth group and the pass-through flag. `api-design` declined depth as behind its boundary, so it lands here.

### The design book exchange

In John Ousterhout and Robert Martin's discussion, Martin argues for very small methods and Ousterhout for fewer, deeper ones a reader need not stitch together.

Adopted as the third tension, stated as when each side wins rather than as a verdict, plus the depth bullet preferring one function a reader follows top to bottom.

### Reducing coupling

Martin Fowler, Reducing Coupling, IEEE Software, 2001, holds that a change in one module should not ripple into others. Adopted behind the rule that a decision stays in one unit and the red flag on a third file opened to adjust one rule.

## Adopted for the tensions

### DRY as knowledge

Andy Hunt and Dave Thomas, Orthogonality and the DRY Principle, give every piece of knowledge one authoritative representation, which is broader than and different from avoiding repeated text.

Adopted as the first tension, with its other side stated. Two blocks that only look alike and change for different reasons stay apart.

### Yagni and its carve-out

Ron Jeffries, [You're NOT Gonna Need It](https://ronjeffries.com/xprog/articles/practices/pracnotneed/), and Martin Fowler, Yagni, build no capability for a presumptive feature, though Yagni "does not apply to effort to make the software easier to modify".

Adopted as the second tension, with Fowler's carve-out as the side that wins for a refactor, a test, or a parameter serving the asked-for code.

### Beck's design rules

Martin Fowler, [Beck Design Rules](https://martinfowler.com/bliki/BeckDesignRules.html), orders the rules as passes the tests, reveals intention, no duplication, fewest elements. Adopted for the ordering behind the closing checklist, where fewest elements stops the pattern table's indirection once the rules above it are met.

## Adopted for patterns and inputs

### Smells and patterns

[Refactoring Guru's code smells](https://refactoring.guru/refactoring/smells) and [design patterns](https://refactoring.guru/design-patterns) catalogs. Adopted only for the wrong case of six common patterns and the smells a red flag can see, such as speculative generality and a lazy class. Each pattern's definition is left to the model.

### Injection

Martin Fowler, Inversion of Control Containers and the Dependency Injection pattern, hands a component what it depends on rather than letting it find it. Adopted as the hidden-inputs rule for the clock, the environment, randomness, and globals, without any container.

## Adopted for agent failure modes

Birgitta Böckeler, The role of developer skills in agentic coding, 2025, and How far can we push AI autonomy in code generation?, 2025.

- Together they record a lack of reuse and modularity, overeagerness that builds unrequested features, assumptions filled in for silent requirements, and brute-force fixes
- Adopted as the closing concern group, worded as checks on the session's own diff
- They are the source each excuse row and red flag traces to

## Declined

Each item below was read and left out, with the reason it changes nothing a session does.

### Definitions and language pages

**Definitions a model already holds.** What coupling, cohesion, or a given pattern is. Declined because a definition changes no behavior a session would otherwise get wrong.

**Language-specific pages.** Every page tied to one language, its type system, or its runtime. Declined because the body holds on every code stack, so the one language note the pattern table carried became "a plain function often replaces the class".

### Architecture and books

**Layering and hexagonal architecture.** Beyond the one bullet kept, keeping business rules free of transport and storage and skipping ports and adapters for a thin application. Declined because where layers sit is a structure call made once, not a writing-time one.

**The Gang of Four and The Pragmatic Programmer as books.** Gamma, Helm, Johnson, and Vlissides, Design Patterns, 1994, and Hunt and Thomas, The Pragmatic Programmer, 1999, are declined as cited sources because neither is open to read at a link. The articles above carry the same positions where a reader can open them.
