---
title: Adopted and declined
description: Which external testing patterns this skill adopted, which it declined, and why, so a later session extends the position instead of re-deriving it
---

# Adopted and declined

External sources were read and filtered rather than imported. This file is the record. A later session extending the skill adds to it rather than re-arguing an item already settled here.

## Adopted

### Choosing the layer

Three sources settle which layer a test belongs at and how the decision table reads.

| Adopted                                | Source                                                                                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The smallest-layer rule                | Fowler, "push your tests as far down the test pyramid as you can" ([Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html))                     |
| Sizing by what a test touches          | Google's small, medium, and large sizes ([Software Engineering at Google, ch. 11](https://abseil.io/resources/swe-book/html/ch11.html))                                         |
| The component layer carrying UI weight | Kent C. Dodds's trophy ([Write tests](https://kentcdodds.com/blog/write-tests)) and Testing Library's [guiding principles](https://testing-library.com/docs/guiding-principles) |

Each source below is read for what it settles.

- Fowler writes a lower test when a higher one catches what no lower one did. It is the body's layer rule and the decision table's reason.
- Google's sizes name what a test may touch rather than cover. The table keys on the same, so it transfers across stacks without naming a runner.
- Testing Library holds that tests resembling use give more confidence

The scope names unit, component, and end to end stay as the labels, since a reader and a file suffix already use them. The pyramid and the trophy are one rule applied to different code, since a component's logic is its rendered behavior and its lowest layer is a rendered test.

### Judging a test

The opening question and final filter come from `obra/superpowers@5bf4e78`, `skills/test-driven-development/writing-good-tests.md`. It names the production change that makes a test fail and whether it is a bug or a decision.

- It then cuts mirror assertions, change detectors, assertions on mocks, and framework tests, and runs the mutation check
- Adopted as the body's opening question and final filter, with the fixed pause added from the end to end incidents

### Doubles in preference order and DAMP over DRY

From `addyosmani/agent-skills@c004a74`, `skills/test-driven-development/SKILL.md`, which orders real, fake, stub, then mock, and prefers descriptive test bodies over shared helpers. Adopted in `unit.md`.

### Kent Beck's desiderata

The twelve properties at [testdesiderata.com](https://testdesiderata.com/) trade against each other and serve as background. "Behavioral" and "structure-insensitive" together are the whole of "test behavior, not implementation", which is why the body states that pair as asserting through the public surface.

### Excuses, red flags, and a closing checklist

From `addyosmani/agent-skills@2686b620`, [`docs/skill-anatomy.md`](https://github.com/addyosmani/agent-skills/blob/2686b620fc1fed2e8f60c704839c766b8594c6b6/docs/skill-anatomy.md): Common Rationalizations, Red Flags, and Verification. Adopted as the three closing sections every practice skill carries, with the final filter as the closing checklist.

This reverses an earlier decline of the excuses table, which objected to arguments against imagined objections. Each row here rebuts an excuse this skill's requirement records a session acting on, such as extending the open end to end spec or adding a pause for a run that flakes under load.

### Per layer

Each layer reference takes its rules from the tool's own guidance.

| Reference      | Adopted                                                                                                    | Source                                                                                                                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `component.md` | Role queries first, user events over synthetic ones, one assertion per wait, no side effects inside a wait | [Common mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)                                                                                                                   |
| `e2e.md`       | Web-first assertions, actionability, config-wide reduced motion, sharding                                  | Playwright's [best practices](https://playwright.dev/docs/best-practices), [actionability](https://playwright.dev/docs/actionability), and [TestOptions](https://playwright.dev/docs/api/class-testoptions) |

`component.md` states its rules with the library names removed. `e2e.md` names the runner, since the reference is the per-layer home for runner specifics.

## Declined

Each item below stays out of the skill for the reason given.

### A numeric mix

Google targets roughly 80% unit, 15% integration, 5% end to end ([same chapter](https://abseil.io/resources/swe-book/html/ch11.html)). A ratio is a codebase-wide target a session writing one test cannot act on.

web.dev's point that the shape "should fit your architecture" ([Pyramid or Crab](https://web.dev/articles/ta-strategies)) is what a motion-heavy static site needs, so the body states the rule and the budget in words instead.

### Delete the code written before its test

`superpowers`'s test-driven skill tells a session to delete implementation written ahead of a failing test. This toolkit audits the order after the fact with its test-order verb and reports rather than destroys, since deleting working code punishes the session without restoring the evidence the red run would have given.

### Other declines

The remaining three were declined on tone or on shape.

- **An iron law.** Both external test-driven skills carry an "Iron Law" stated as absolute. Declined for tone, since this toolkit states a rule once with its reason.
- **One skill per layer.** The layer has to be chosen before the right skill can load, so the choice ends up restated in all three or in a fourth skill that is this one.
- **A standard in place of a skill.** The guidance is judgment applied while writing, loaded on intent. Nobody checks a test file against a layer rule after the fact, which is what a standard governs.
