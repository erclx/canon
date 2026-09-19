---
title: Adopted and declined
description: Which external testing patterns this skill adopted, which it declined, and why, so a later session extends the position instead of re-deriving it
---

# Adopted and declined

External sources were read and filtered rather than imported. This file is the record. A later session extending the skill adds to it rather than re-arguing an item already settled here.

## Adopted

### Choosing the layer

**The smallest-layer rule.** Fowler: "Push your tests as far down the test pyramid as you can", and write a lower test when a higher one catches what no lower one did ([Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)). It is the body's layer rule and the reason for the decision table.

**Sizing by what a test touches.** Google's small, medium, and large sizes name what a test may touch rather than what it covers ([Software Engineering at Google, ch. 11](https://abseil.io/resources/swe-book/html/ch11.html)). The decision table reads the same way, keyed on what the behavior touches, so it transfers across stacks without naming a runner. The scope names unit, component, and end to end stay as the labels, since those are the names a reader and a file suffix already use.

**The component layer carrying UI weight.** Kent C. Dodds's trophy ([Write tests](https://kentcdodds.com/blog/write-tests)) and Testing Library's principle that tests resembling use give more confidence ([guiding principles](https://testing-library.com/docs/guiding-principles)). The pyramid and the trophy are one rule applied to different code: a component's logic is its rendered behavior, so its lowest layer is a rendered test.

### Judging a test

**The opening question and the final filter.** From `obra/superpowers@5bf4e78`, `skills/test-driven-development/writing-good-tests.md`: name the production change that makes a test fail and whether it is a bug or a decision, then cut mirror assertions, change detectors, assertions on mocks, framework tests, and run the mutation check. Adopted as the body's opening question and final filter, with the fixed pause added from the end to end incidents.

**Doubles in preference order and DAMP over DRY.** From `addyosmani/agent-skills@c004a74`, `skills/test-driven-development/SKILL.md`: real, fake, stub, mock, and descriptive test bodies over shared helpers. Adopted in `unit.md`.

**Kent Beck's desiderata as background.** The twelve properties at [testdesiderata.com](https://testdesiderata.com/) trade against each other. "Behavioral" and "structure-insensitive" together are the whole of "test behavior, not implementation", which is why the body states that pair as asserting through the public surface.

### Per layer

**Component query and wait rules.** Role queries first, user events over synthetic ones, one assertion per wait, no side effects inside a wait ([Common mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)). Adopted in `component.md` with the library names removed from the rules.

**Web-first assertions, actionability, config-wide reduced motion, sharding.** From Playwright's own pages ([best practices](https://playwright.dev/docs/best-practices), [actionability](https://playwright.dev/docs/actionability), [TestOptions](https://playwright.dev/docs/api/class-testoptions)). Adopted in `e2e.md`, where the runner is named because the reference is the per-layer home for runner specifics.

## Declined

**A numeric mix.** Google targets roughly 80% unit, 15% integration, 5% end to end ([same chapter](https://abseil.io/resources/swe-book/html/ch11.html)). A ratio is a codebase-wide target that a session writing one test cannot act on, and web.dev's point that the shape "should fit your architecture" ([Pyramid or Crab](https://web.dev/articles/ta-strategies)) is what a motion-heavy static site needs. The body states the rule and the budget in words instead.

**Delete the code written before its test.** `superpowers`'s test-driven skill tells a session to delete implementation written ahead of a failing test. Declined: this toolkit audits the order after the fact with its test-order verb and reports rather than destroys, since deleting working code punishes the session without restoring the evidence the red run would have given.

**Rationalization tables and an iron law.** Both external test-driven skills carry an "Iron Law" and a table of excuses with rebuttals. Declined for tone: this toolkit states a rule once with its reason, and a table of arguments against imagined objections costs a read on every load and adds no constraint.

**One skill per layer.** A unit skill, a component skill, and an end to end skill each loaded on its own trigger. Declined because the layer has to be chosen before the right skill can load, so the choice ends up restated in all three or in a fourth skill that is this one.

**A standard in place of a skill.** The guidance is judgment applied while writing, loaded on intent. A standard governs an artifact a reader checks afterwards, and nobody checks a test file against a layer rule after the fact.
