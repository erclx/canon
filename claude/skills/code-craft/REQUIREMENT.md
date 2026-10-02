---
name: code-craft
description: Why a session writing code needs stated rules on the shape of a function, a class, or a module's internals, and where that judgment stops short of placement, the test loop, a caller's contract, and review
---

# Code craft requirement

## Gap

Without this skill, nothing in the toolkit shapes code at the moment it is written. `test-first` runs the loop around the code, `codebase-layout` places the file, `api-design` shapes what a caller sees, and the core code rule holds placement, error, and naming floors. The shape of a function, a class, or a module's internals is left to whatever the neighboring code suggests.

Agents fail there in recorded ways. Birgitta Böckeler's two articles on agentic coding name them: code that is copied rather than reused, a lack of modularity that spreads one change across files, features and business logic nobody asked for, assumptions filled in where the requirement was silent, and brute-force fixes that silence a symptom rather than its cause. Each reads fine in its own diff and costs the next change.

Before this skill, two shipped pointers left interface depth unowned. `api-design` declined depth and the internals behind a boundary, and `codebase-layout` named depth as having no owner, so a session routed away from either on that question landed nowhere. Both now point here.

## Must

- Open with the change test: name the change most likely to come next and count what it would touch before choosing a shape
- State depth as rules a session can act on: a unit earns its place when its interface is simpler than what it does, a pass-through is inlined, and a module splits by the decision it hides rather than by processing step
- State each tension as when one side wins: one piece of knowledge in one place against coupling two things that only look alike, building only what is asked against seams that ease change, and one reason to change against over-decomposition
- List patterns by their wrong case, short enough to stay in the body, with a plain function named as the usual replacement for the class
- State hidden inputs: pass in the clock, the environment, randomness, and globals, keep business rules free of transport and storage code, and skip ports and adapters for a thin read-and-write application
- Close the concern groups with the agent failure modes as checks on the session's own diff: a copy where a refactor belonged, one responsibility scattered across files, a feature nobody asked for, an assumption filled in rather than asked, and a brute-force fix
- Record the external sources adopted and declined with the reason for each, so a later session extends the position instead of re-deriving it
- Close with a table of the excuses a session gives for a shape that costs the next change, each with its rebuttal, the red flags a session can see in its own work mid-task, and a checklist each line of which answers yes or no against the code the change produced

## Must not

- Restate a definition a model already holds, such as what coupling or a design pattern is
- State a tension as one side only, such as "never duplicate"
- Name a language, a framework, or a type system feature in the body
- Restate the red, green, refactor loop `test-first` runs, or the design review procedure `review-craft` carries for a finished diff
- Restate the error and naming bullets of the core code rule

## Guards

- A change filling in a body whose shape is already fixed skips the skill
- A shape is never chosen for a change nobody can name, since that shape is a guess

## Out of scope

- Where a new file sits on disk: `codebase-layout`
- The red, green, refactor loop: `test-first`
- Which layer a test belongs at: `test-craft`
- The contract a caller depends on, being its exports, flags, output, errors, and versioning: `api-design`
- Judging a finished diff, including a design review of it: `review-craft`
- Service architecture and layering beyond the one hidden-inputs bullet kept here
- Whether the guidance changes what a session ships, which needs a measured with-and-without run rather than a rule here
