---
title: Lesson build reference
description: The block list canon teach render takes and the verbs that build the lesson body, being render, nav, stylesheet, and glossary
---

# Lesson build reference

Mechanics rather than judgment. `lesson-craft.md` covers what a lesson should be, and this file covers how its body reaches the page through the verbs.

## The block list

`canon teach render` takes a JSON array of blocks and renders it through the same components a lesson body composes. Six types, and every structural body composes from them:

- `{"type":"heading","level":1|2,"text":"<text>"}`: an `<h1>` or `<h2>`.
- `{"type":"paragraph","text":"<text>","lede":true,"cites":[1]}`: a `<p>`, marked `lede` for the opening dek. `cites` adds a footnote marker per reference number, and a lede takes none.
- `{"type":"list","items":["<text>", ...],"ordered":true}`: a `<ul>` or, with `ordered`, an `<ol>`.

### Reference, code, and raw blocks

The other three carry sources, code, and markup the components cannot.

- `{"type":"refs","items":[{"title":"<name>","url":"<https URL>","note":"<text>"}, ...]}`: the one reference list, numbered from 1. `url` and `note` are optional, and a `url` must be http or https.
- `{"type":"code","lang":"ts","text":"<source>"}`: a sample highlighted at render time with no script. `lang` is optional and takes a highlight.js name or alias, and an unregistered one renders plain.
- `{"type":"raw","html":"<markup>"}`: the escape hatch, passed through unescaped.

### Where code and raw go

Code never travels through `raw`. A hand-written `<pre><code>` renders with no color, and `nav` never highlights markup already in a body, so it stays plain for good. A fenced block in a reference page's markdown is highlighted by `nav` on its own.

The quiz and teach-back block in `lesson-craft.md` always need `raw`, since their fixed contract is not a components concern. Give them the array's last `raw` entry, followed only by `refs`, and use `raw` nowhere the other types could carry the content.

### Citing

A claim resting on a source carries a `cites` number, and the source goes in the lesson's one `refs` block rather than the sentence.

- Draw every reference from what `canon teach resource --read` recorded, never from a lead, since a lead is a source nobody opened
- Render refuses a cite no reference resolves, so number the list before citing into it

## Building the lesson body

Step 4 of `teach-workspace` reads this section before writing a lesson, after the lesson verb has resolved its path and quiz order. Write the chrome as four empty marker pairs rather than composing it by hand.

- `<!-- canon:teach:style -->` and `<!-- /canon:teach:style -->` inside `<head>`
- `<!-- canon:teach:header -->`, `<!-- canon:teach:footnav -->`, and `<!-- canon:teach:scripts -->`, each with its own close marker, in that order in `<body>`

### Render the body

Build the authored `<h1>`, lede, body, and quiz as a JSON array of blocks, and render it through the verb rather than a component import:

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

`## The block list` above states each type and where `raw` belongs. Write the call's `html` field between the header's close marker and the footnav's open marker, and nothing else anywhere in the file.

### When a verb does not resolve

Every verb in this section can be missing from an installed CLI that predates it. Report that rather than proceeding silently, and never hand-compose the body, the chrome, or a palette as a fallback.

A hand-composed body is the state this section exists to end. A target holds this skill body before the verb, since a plugin skill reaches a target on merge while the CLI arrives only when a release publishes.

### Fill the chrome

Then run:

```bash
canon teach nav <topic> --json
```

It fills every marker pair from what the workspace holds on disk, and rewrites the workspace's contents page and the teach-root listing in the same run.

- The markers take the embedded stylesheet, the header with its breadcrumb and jump menus, the prev and next footer nav, and the behavior scripts
- It refuses a lesson missing a marker pair by name rather than guessing the boundary, so a dropped marker is caught here rather than read back as a lesson nothing links to

### Seed the stylesheet

On the first lesson in a workspace, seed the stylesheet through the verb rather than authoring a palette:

```bash
canon teach stylesheet <topic> --json
```

It writes the design tokens as custom properties and the components built on them, from the one source every rendered surface reads.

- Add lesson rules under the seed, and reach a value through its property rather than restating the hex, which is how each workspace forked the palette
- It refuses to overwrite, so a rerun on a workspace with its own rules is safe and reports `written` as false

### Add glossary terms

Add every term the lesson defines to `GLOSSARY.md` through the verb, which places entries alphabetically in the shape the standard fixes:

```bash
canon teach glossary <topic> --json \
  --term "<term>=<definition, written without using the term>" \
  --first-seen <the lesson or reference page this batch comes from>
```

`--term` repeats and one call writes the file once, which keeps a batch of terms from racing on it. A term already defined is refused, since a definition the subject has moved under is a revision of the entry rather than a second one.
