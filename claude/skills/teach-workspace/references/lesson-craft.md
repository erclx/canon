---
title: Lesson craft reference
description: Typography, restraint, quiz construction, what makes a lesson worth returning to, and the verbs that build the lesson body
---

# Lesson craft reference

Judgment rather than shape. The workspace standard fixes where a lesson sits and what it is named, and this file covers what makes one worth opening twice.

## One course, not a pile of pages

A workspace accumulates lessons over weeks. The learner reads them as one body of material, so a lesson that invents its own look reads as someone else's work.

- `canon teach nav` embeds and re-embeds the shared stylesheet into every lesson on each run, so growing that stylesheet, by promoting anything used a second time into it, is the only step left by hand.
- Keep the structural furniture identical across lessons: where the title sits, where the quiz sits, what a correct answer looks like
- Do not restate styles inside a lesson. A local override is a decision the next lesson has to either copy or contradict.
- Refer to another lesson in the same workspace as "lesson" followed by its four-digit number, such as "lesson 0003", and let `canon teach nav` turn the mention into a link and report a number naming no lesson. A hand-written link is the one form nav never checks.

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

## The block list

`canon teach render` takes a JSON array of blocks and renders it through the same components a lesson body composes. Five types, and every structural body composes from them:

- `{"type":"heading","level":1|2,"text":"<text>"}`: an `<h1>` or `<h2>`.
- `{"type":"paragraph","text":"<text>","lede":true,"cites":[1]}`: a `<p>`, marked `lede` for the dek that opens the lesson. `cites` adds a footnote marker per reference number after the text, and a lede takes none.
- `{"type":"list","items":["<text>", ...],"ordered":true}`: a `<ul>` or, with `ordered`, an `<ol>`.
- `{"type":"refs","items":[{"title":"<name>","url":"<https URL>","note":"<text>"}, ...]}`: the lesson's one reference list, numbered from 1 in item order. `url` and `note` are optional, and a `url` must be http or https.
- `{"type":"raw","html":"<markup>"}`: the escape hatch, passed through unescaped.

The quiz and the teach-back block above are the one case `raw` is always needed for, since their fixed contract is not a components concern. Give them the array's last `raw` entry, followed only by `refs`, rather than reaching for `raw` anywhere the other types could carry the content instead.

A claim resting on a source carries a `cites` number, and the source goes in the lesson's one `refs` block rather than into the sentence. Draw every reference from what `canon teach resource --read` recorded, never from a lead, since a lead is a source nobody opened. Render refuses a cite no reference resolves, so number the list before citing into it.

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

## Building the lesson body

Step 4 of `teach-workspace` reads this section before writing a lesson, after the lesson verb has resolved its path and quiz order. Write the chrome as four empty marker pairs rather than composing it by hand: `<!-- canon:teach:style -->`/`<!-- /canon:teach:style -->` inside `<head>`, and `<!-- canon:teach:header -->`, `<!-- canon:teach:footnav -->`, and `<!-- canon:teach:scripts -->` each with its own close marker, in that order in `<body>`.

Build the authored `<h1>`, lede, body, and quiz as a JSON array of blocks rather than composing markup by hand, and render it through the verb rather than through a component import:

```bash
echo '[
  {"type":"heading","level":1,"text":"<title>"},
  {"type":"paragraph","lede":true,"text":"<the dek>"},
  {"type":"paragraph","text":"<a body paragraph>"},
  {"type":"paragraph","text":"<a claim resting on a source>","cites":[1]},
  {"type":"list","ordered":true,"items":["<step one>","<step two>"]},
  {"type":"raw","html":"<the quiz and teach-back block composed above>"},
  {"type":"refs","items":[{"title":"<source name>","url":"<https URL>"}]}
]' | canon teach render --json
```

`## The block list` above states each type and where `raw` belongs. Take the call's `html` field and write it between the header's close marker and the footnav's open marker, and nothing else anywhere in the file.

Report it rather than proceeding silently when the verb does not resolve, which is an installed CLI predating it, and never compose the lesson body by hand as a fallback. That is the state this section exists to end, and a target holds this skill body before it holds the verb, since a plugin skill reaches a target the moment it merges while the CLI reaches one only when a release publishes.

Then run:

```bash
canon teach nav <topic> --json
```

It fills every marker pair from what the workspace holds on disk: the embedded stylesheet, the header with its breadcrumb and jump menus, the prev/next footer nav, and the behavior scripts, and it rewrites the workspace's contents page and the teach-root listing in the same run. It refuses a lesson missing one of the four marker pairs by name rather than guessing at the boundary, so a marker dropped while writing the lesson is caught here rather than read back later as a lesson nothing links to. Report it rather than proceeding silently when the verb does not resolve, which is an installed CLI predating it, and never compose the chrome by hand as a fallback.

Seed the stylesheet through the verb rather than authoring a palette, on the first lesson in a workspace:

```bash
canon teach stylesheet <topic> --json
```

It writes the design tokens as custom properties and the components built on them, from the one source every other rendered surface reads. Add lesson rules under the seed and reach a value through its property rather than restating the hex, which is what let each workspace fork the palette from every other. It refuses to overwrite, so running it again on a workspace that has grown its own rules is safe and reports `written` as false.

Report it rather than proceeding silently when the verb does not resolve, which is an installed CLI predating it. Do not fall back to writing a palette by hand.

Add every term the lesson defines to `GLOSSARY.md` through the verb, which places the entries alphabetically in the shape the standard fixes:

```bash
canon teach glossary <topic> --json \
  --term "<term>=<definition, written without using the term>" \
  --first-seen <the lesson or reference page this batch comes from>
```

`--term` repeats and one call writes the file once, which is what keeps a batch of terms from racing on it. A term already defined is refused, since a definition the subject has moved under is a revision of the entry rather than a second one.
