---
title: Lesson craft reference
description: Typography, restraint, quiz construction, and what makes a lesson worth returning to
---

# Lesson craft reference

Judgment rather than shape. The workspace standard fixes where a lesson sits and what it is named, and this file covers what makes one worth opening twice.

## One course, not a pile of pages

A workspace accumulates lessons over weeks. The learner reads them as one body of material, so a lesson that invents its own look reads as someone else's work.

- `canon teach nav` embeds and re-embeds the shared stylesheet into every lesson on each run, so growing that stylesheet, by promoting anything used a second time into it, is the only step left by hand.
- Keep the structural furniture identical across lessons: where the title sits, where the quiz sits, what a correct answer looks like
- Do not restate styles inside a lesson. A local override is a decision the next lesson has to either copy or contradict.

## Typography

The learner is reading, so the reading surface is the product.

- Set body text at a comfortable reading size with generous line height, and hold the measure to roughly 65 to 75 characters
- Use one typeface for prose and one for code, and no others
- Build hierarchy from size and weight rather than from color. Color that carries meaning fails for a reader who cannot see it.
- Give code blocks room. Cramped code is the part of a lesson a learner skips.

## Restraint

Every element competes with the material for attention.

- Cut any decoration that carries no information
- Use at most one accent color, reserved for the thing the learner acts on
- Do not animate anything the learner did not trigger
- Prefer whitespace over rules and boxes to separate sections

## Diagrams

Follow `${CLAUDE_SKILL_DIR}/../../standards/figures.md` for when a diagram earns its place, the render-first policy between Mermaid and freehand SVG, and the wrapping, color, and accessibility rules every figure carries. A lesson reaching for a diagram on every section is the failure the neighboring `## Restraint` section already guards against.

## Quiz construction

The quiz is the retrieval, so a leak in its construction turns it into a reading test.

- Write every option to the same length, in words and in characters. A longer option reads as the considered one.
- Write the correct option first and let the ordering verb place it. Position is not the author's to pick: an author who varies it by hand still varies it by judgment, and the judgment settles on the first slot.
- Make each wrong option a misconception someone actually holds. An obviously wrong option removes itself and shrinks the question.
- Write one feedback block per question, covering the correct option and why each distractor fails, saying why rather than whether. One block reads as an explanation where a block per option reads as four verdicts, and only the explanation names what separates a wrong option from the answer.
- Give feedback after the attempt, never alongside the question

### The markup

The quiz shape is a contract rather than a convention. `canon teach nav` splices a stepper into the lesson that gates on exactly these class names and this nesting, so a quiz written in any other shape renders with every question on screen at once and nothing reports it.

```html
<div class="quiz">
<h2>Retrieval check</h2>

<div class="q"><p class="q-stem">1. <stem></p>
<label class="opt" data-k="A"><input type="radio" name="q1"><span><the option text></span></label>
<label class="opt" data-k="B"><input type="radio" name="q1" data-a="1"><span><the option text></span></label>
<div class="fb"><b>Correct: <the answer in a few words>.</b> <why each distractor fails.></div></div>
</div>
```

- Give every option in one question the same `name`, and a different `name` per question. Options sharing a name across two questions let one answer clear another.
- Mark the correct option with `data-a="1"` and leave the others without the attribute
- Carry `data-k` on the `label`, since the workspace stylesheet renders the key letter from it
- Keep `.fb` the last child of its `.q`. The stepper reveals it as a direct child, and a feedback block nested deeper stays hidden.
- Put the option text in a `<span>` inside the label rather than bare beside the input, so the workspace can lay the two out
- Never write a `<button class="opt">` in a new lesson. That is the shape written before the stepper, and it is kept working by an injected script the presence of a button is what still triggers.

The stepper hides and shows and sets nothing else, so how a selected option looks, and whether a wrong one is marked as wrong, is the workspace stylesheet's to grow. Name the correct option in the feedback text for that reason: it is what a learner reads to find out whether they were right.

## Teach back

A quiz is recognition and a teach-back is production, which is the form retrieval practice prefers. Carry both: the quiz places the learner against options someone could hold, and the teach-back is where the learner finds out what they cannot say without help.

- Ask for an explanation to a named audience rather than for an answer. Asking the learner to explain to somebody who has never written a pattern why a lazy quantifier is not an optional one gives the explanation a floor, where asking them to explain lazy quantifiers gives it none.
- Ask about the thing the lesson was for, not a detail beside it. A teach-back on a footnote tests attention rather than the material.
- Carry a self-check the learner can open, as a `<details>` listing what a complete explanation covers, closed by default. A learner reading with no session in the room otherwise gets an ask they cannot grade, and closed leaks nothing.
- Write the self-check as what the explanation has to cover rather than as the explanation itself. A model answer is read instead of produced, which turns the block back into reading.

```html
<div class="teach-back">
<h2>Explain it back</h2>
<p>Without looking above: <the ask, naming who it is for.></p>
<details><summary>What a complete explanation covers</summary>
<ul>
<li><a point the explanation has to reach></li>
</ul>
</details>
</div>
```

It needs no styles of its own beyond what the workspace already gives a section and a `<details>`.

## Tokens travel with the course

A lesson carries its own values in the shared stylesheet rather than reading a host project's. A workspace runs in any project and most carry no token record at all, so a lesson inheriting one is a lesson that renders unstyled wherever the record is absent, with nothing reporting it.

Pick values the material needs rather than values the project happens to hold. Inheriting is worth offering as something a learner asks for once, and it is the wrong default in every project that cannot answer.

## What makes a lesson worth returning to

- The worked example is complete. A learner returning for the example finds the whole thing rather than a fragment they have to reconstruct.
- The lesson states what it assumes. A returning reader can tell in one line whether they are in the right place.
- The hard part is named as the hard part. Material that flattens everything to one difficulty gives a returning reader nothing to navigate by.
- Nothing depends on the session it was written in. A lesson referring to what was discussed is unreadable a week later.
