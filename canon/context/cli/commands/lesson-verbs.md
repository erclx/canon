---
title: Lesson verbs
description: Why the teach verbs draw quiz order and splice chrome, the CSS quiz stepper, and the JSX component layer a lesson renders through
---

# Lesson verbs

## Decisions

### Why lesson verbs exist

A verb exists where an instruction to the model would reproduce a defect the instruction already failed to prevent. `canon teach lesson` draws quiz option order rather than telling a session to vary it, because an author varying position by judgment settles on the first slot.

### What `teach lesson` reports

It writes nothing. It reports the numbered path, the shared stylesheet with whether the file is on disk, the mission's success lines, and one draw per question.

Reporting the stylesheet rather than writing it keeps the second lesson in a workspace from discarding what the first put there.

### `teach nav` splices chrome

It applies the same principle to a whole page's chrome, splicing the header, breadcrumb, jump menus, and behavior scripts from four marker comment pairs a session leaves empty. Composing them by hand let three pages drift out of step.

A lesson missing a marker pair is refused by name rather than guessed at. The root listing and every contents page rewrite from the same read.

### A drawn order reports its position

`orderQuiz` returns the position it produced beside the permutation. A caller handed only the permutation derives the answer index itself, a second place the same fact can be got wrong.

### The quiz stepper is CSS

A page behavior a stylesheet can carry ships as CSS spliced into the lesson rather than an injected script. `teach nav` gates a quiz on `:has()` over the radio inputs each question is written from.

- Every question following one with no checked input is hidden
- Feedback stays hidden until its own question is answered
- Everything sits inside `@supports selector(:has(*))`, so an engine without `:has()` renders every question rather than a stepper showing nothing

### Feedback never shows unconditionally

Outside the `@supports` wrapper, the rule would outrank `.fb { display: none }` on every engine and reveal feedback in the button-shape lessons the retired script still drives.

The block is spliced after the workspace stylesheet so it wins the cascade at equal specificity. It hides and shows and sets nothing else, which leaves layout and appearance to the workspace.

### One detector decides both regions

A detector on `<button class="opt"` decides the stepper and the scripts together. The stepper's rules match a button question that can never hold a checked radio, so a lesson given both mechanisms hides every question past the first for good and outranks the class `QUIZ_SCRIPT` reveals feedback with.

### The gate takes the general sibling combinator

It selects the same set as the adjacent one for a conforming quiz. The adjacent form matches nothing the moment anything sits between two questions and shows every later one at once, resting on a markup contract nothing checks.

### The component layer

`src/teach/html/` carries the JSX-to-string factory the lesson body renders through, with no React and no build step. `src/teach/components/` carries the components a lesson composes.

`src/teach/components/lesson.test.tsx` composes the components directly as JSX and asserts the rendered string, writing no file.

### The fixture workspace

The committed fixture at `examples/teach/00-fixture/` sits outside `.canon/teach/`. `teachDir` in `src/teach/workspace.ts` takes a root already named `teach` as the teach folder itself rather than wrapping it in `recordDir`.

That lets `canon teach nav 00-fixture --root examples/teach` reach the fixture's workspace verbs like any workspace under `.canon/teach/`.

### Slugs and stubs

`listSlugs` keeps only folders named `NN-<topic>`, so a sibling such as `examples/teach/evidence/` is neither listed nor given a contents page by `nav`. A workspace with no `MISSION.md` still lists and draws as a disabled `Stub` row, which `examples/teach/02-unopened/` exists to show.

### `canon teach render`

`src/teach/render.ts` is the one verb that reaches the component layer. It takes no topic and no `--root`, since it reads nothing off a workspace.

It renders a JSON array of `heading`, `paragraph`, `list`, `refs`, `code`, and `raw` blocks from stdin through the five components. It refuses `bad-input` by block index on an unrecognized type or a field of the wrong shape.

### Render input rules

The renderer validates each block's shape before it emits anything.

- A `code` block's optional `lang` must match `^[a-z0-9+#-]+$`, since it lands in a class attribute
- `raw` passes its `html` through unescaped for content the five cannot express, such as the quiz and teach-back markup
- That markup travels as the array's last `raw` block, followed only by `refs`
- A reference `url` must parse as `http:` or `https:`, since attribute escaping does not stop a `javascript:` href

### Cites resolve in a second pass

A paragraph's `cites` resolve against the one `refs` block after every block renders. A cite with no reference, a cite on a lede, or a second `refs` block refuses by the offending block's index rather than leaving a dead anchor.

Cites stay off the lede because `extractLessonMeta` reads it back through `stripTags`, which would keep a marker's digit on the contents page.

### Two tests, two entry points

`lesson.test.tsx` composes the components directly as JSX. `render.test.ts` reaches them through `renderLessonBody`, the block renderer behind this verb. Nothing spawns the verb itself.

### One brand for composition

`jsx()` and every component return the same branded `RawMarkup` value the escape hatch uses, not a plain string. A plain string returned from a nested call reads like author text, so a component nesting another's output as `{children}` would escape it twice.

`render()` unwraps to a plain string only where a caller writes the result to disk.

### The brand stops at element content

`renderAttribute` escapes a `RawMarkup` value like any other string. Markup is never itself markup inside a quoted attribute, and treating it as such let a double quote in an explicit `raw()` call or an ordinary component's output close the attribute early.
