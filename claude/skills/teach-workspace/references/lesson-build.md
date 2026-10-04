---
title: Lesson build reference
description: The block list canon teach render takes and the verbs that build the lesson body, being render, nav, stylesheet, and glossary
---

# Lesson build reference

Mechanics rather than judgment. `lesson-craft.md` covers what a lesson should be, and this file covers how its body reaches the page through the verbs.

## The block list

`canon teach render` takes a JSON array of blocks and renders it through the same components a lesson body composes. Six types, and every structural body composes from them:

- `{"type":"heading","level":1|2,"text":"<text>"}`: an `<h1>` or `<h2>`.
- `{"type":"paragraph","text":"<text>","lede":true,"cites":[1]}`: a `<p>`, marked `lede` for the dek that opens the lesson. `cites` adds a footnote marker per reference number after the text, and a lede takes none.
- `{"type":"list","items":["<text>", ...],"ordered":true}`: a `<ul>` or, with `ordered`, an `<ol>`.
- `{"type":"refs","items":[{"title":"<name>","url":"<https URL>","note":"<text>"}, ...]}`: the lesson's one reference list, numbered from 1 in item order. `url` and `note` are optional, and a `url` must be http or https.
- `{"type":"code","lang":"ts","text":"<source>"}`: a code sample, highlighted at render time with no script. `lang` is optional and takes a highlight.js name or alias. One the renderer does not register renders as plain escaped code.
- `{"type":"raw","html":"<markup>"}`: the escape hatch, passed through unescaped.

Code never travels through `raw`. A hand-written `<pre><code>` renders with no color, and `nav` never highlights markup already in a lesson body, so a sample written that way stays plain for good. A fenced block in a reference page's markdown is highlighted by `nav` on its own.

The quiz and the teach-back block in `lesson-craft.md` are the one case `raw` is always needed for, since their fixed contract is not a components concern. Give them the array's last `raw` entry, followed only by `refs`, rather than reaching for `raw` anywhere the other types could carry the content instead.

A claim resting on a source carries a `cites` number, and the source goes in the lesson's one `refs` block rather than into the sentence. Draw every reference from what `canon teach resource --read` recorded, never from a lead, since a lead is a source nobody opened. Render refuses a cite no reference resolves, so number the list before citing into it.

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
  {"type":"raw","html":"<the quiz and teach-back block composed per lesson-craft.md>"},
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
