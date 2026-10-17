---
name: code-craft
description: Carries the rules for shaping code while it is being written, being a function, a class, or a module's internals, so a session picks the shape the next change needs rather than copying its neighbor, splitting by step, or building for a case nobody asked for. Use before writing a new function, class, or module, when deciding whether to extract duplicated code, add an abstraction, a pattern, or a seam, or when asked "should I extract this", "is this abstraction worth it", "should this be a strategy", "is this class doing too much", or "should I just copy this". Do NOT use for the red, green, refactor loop, which is `test-first`, to decide where a file sits, which is `codebase-layout`, to shape what a caller sees, which is `api-design`, or to judge a finished diff, which is `review-craft`.
metadata:
  family: build
---

# Code craft

A session writing code takes its shape from what sits nearby. It copies a function rather than changing it, spreads one decision across the files it opened, and builds a hierarchy for a case that may never come. Each reads fine in the diff and costs the next change. This skill carries the judgment as the shape is chosen, before the body exists.

Load it before writing a new function, class, or module, and before extracting, abstracting, or copying existing code. Skip it for a change that fills in a body whose shape is already fixed.

## Name the next change first

Good design is design that makes the likely change cheap. Judge a shape by the change it serves, not by how it looks.

- Name the change most likely to come next, from the task, the plan, or the history of the file, before choosing a shape.
- Count what that change would touch under each shape you are weighing. The shape where it touches one place wins.
- When no next change can be named, write the plainest code that passes, since a shape built for an unnamed change is a guess.

## Earn depth

A unit is worth having when its interface is much simpler than what it does, so a caller learns a little and gets a lot.

- Add a function or a class only when its name and parameters are easier to hold than its body. One that forwards its arguments to another call with nothing added is a pass-through, so inline it.
- Split a module by the decision it hides, such as a file format, a storage choice, or a pricing rule, not by processing step, which makes one decision's change touch every step
- Keep a decision in one unit, so changing it opens one file. A decision whose details leak into its callers is not hidden, whatever the folder says.
- Prefer one longer function a reader can follow top to bottom over many tiny ones they have to stitch back together.

## Weigh the tensions

Each principle below has a case where the other side wins. State which case you are in before following either.

- **One piece of knowledge, one place, against false sharing.** Merge two copies encoding one rule, so a change never misses one. Leave apart two that only look alike, since merging couples them.
- **Build only what is asked, against seams that ease change.** Build no capability nobody asked for. A refactor, test, or parameter easing change to the asked-for code is not speculative.
- **One reason to change, against too many pieces.** Split a unit two unrelated changes would both land in. Stop when the pieces only make sense together and a reader rebuilds the whole.

## Reach for a pattern only past its wrong case

A pattern earns its indirection only when the problem it solves is present now. A plain function often replaces the class.

| Pattern   | Wrong when                                        | Write instead                          |
| --------- | ------------------------------------------------- | -------------------------------------- |
| Strategy  | Two cases, or the case never varies at runtime    | A conditional, or a function passed in |
| Factory   | One concrete type, so the factory chooses nothing | A direct constructor call              |
| Singleton | It exists so any code can reach shared state      | The instance passed to what needs it   |
| Observer  | One listener, known when the code is written      | A direct call                          |
| Decorator | One wrapper, always applied                       | The behavior inside the function       |
| Adapter   | It wraps your own code to fit your own code       | A change to the interface it adapts    |

## Pass hidden inputs in

- Pass the clock, the environment, randomness, and any global into the code that reads them, rather than reaching for them inside, since a function reading the time cannot be tested at a chosen one
- Keep business rules free of transport and storage code, so a rule can be read and tested without a request or a database.
- Skip ports and adapters for an application that only reads and writes records. The layers cost more than the change they protect against.

## Check your own diff

Agents fail at writing time in recorded ways. Read the diff for each before calling it done.

- A copy where a change to the existing code belonged. Search for the code you just wrote, and change the original if it encodes the same rule.
- One responsibility scattered across files, so the change touched several places that each hold part of one decision.
- A feature, an option, or a branch nobody asked for.
- An assumption filled in, such as a default value or a business rule the task never stated, where a question belonged.
- A brute-force fix that silences a symptom, such as a broad catch, a disabled check, or a special case for one input.

Read `${CLAUDE_SKILL_DIR}/references/adopted.md` only when extending this guidance or arguing against a rule in it. It records which external sources were adopted, which declined, and why.

## Excuses and rebuttals

| Excuse                                                   | Rebuttal                                                                                                         |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Copying is safer than touching code that works           | Two copies of one rule drift. The next change fixes one and leaves the other wrong, with no test pointing at it. |
| We will need this flexibility later                      | Later has no named change behind it. Build the seam when the second case arrives, and it costs the same then.    |
| The task did not say, so a sensible default is fine      | A default is a business rule nobody approved. Ask, or state the assumption where the reviewer reads it.          |
| The test passes now, so the fix is done                  | A fix that suppresses the symptom passes the test it was aimed at and leaves the cause for the next one.         |
| Following the existing pattern keeps the code consistent | Consistency with a shape that fails the next change spreads the cost. Match the neighbor only when it fits.      |

## Red flags

- You are about to paste a block you just read elsewhere in the project.
- A new class has one method, or a new function's body is one call with the same arguments.
- The change you are making opens a third file to adjust one rule.
- You are writing an interface, a factory, or a registry with one implementation behind it.

### Defaults and fixes

Defaults and fixes carry their own signs.

- You wrote a default value, a threshold, or a fallback the task never named.
- A fix is adding a special case, a catch, or a disabled check rather than changing the code that misbehaved.
- The code reads the current time, an environment variable, or a global from inside a rule.

## Before handing over

Check each line against the code the change produced. A line answering no is fixed or reported, never left with a note.

- The next likely change is named, and it touches one place in the code as written.
- Every new function or class hides more than its interface asks a caller to learn, with no pass-through left.
- No rule the change wrote exists in a second place, and nothing was merged that changes for a different reason.
- Every pattern in the diff solves a problem present now, with more than one case behind it.

### Inputs, scope, and fixes

Check the inputs, the scope, and the fixes the same way.

- Clock, environment, and global reads are passed in rather than taken inside a rule.
- The diff holds no feature, option, or default the task did not ask for or state.
- Every fix changes the code that misbehaved rather than silencing it.

## What this delegates

- Where a new file sits on disk: `codebase-layout`
- The red, green, refactor loop around the code: `test-first`
- Which layer a test belongs at: `test-craft`
- The contract a caller depends on, being its exports, flags, output, and errors: `api-design`
- Judging a finished diff, including a design review of it: `review-craft`
