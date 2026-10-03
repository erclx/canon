---
name: draft-screencast
description: Why a recording script ships pre-seeded rather than blank, what the four discovery questions buy, and why the draft stays stack-agnostic
---

# Draft screencast requirement

## Gap

Without this skill, a recording plan arrives as a wall of blank fields, so the user fills a template instead of editing a draft and the work the skill was meant to do lands back on them. The opposite failure costs more. A session that skips discovery guesses the audience, the length, and the hero moment, then writes five beats for a video nobody asked for, and every one of them has to be thrown away rather than edited.

A draft that names the recording software, the editing software, or the window manager pins the script to one machine and one person's setup, so it stops being reusable the moment anyone else records. And re-invoking to refine silently overwrites the edits the user made in the file, which is the one failure that destroys work rather than wasting it.

## Must

- Read project context and recent commits before proposing, since what shipped recently is usually the subject
- Ask exactly four discovery questions, each carrying a default derived from that context
- Wait for answers rather than reading silence as acceptance
- Pre-seed every section with concrete content so the draft is shippable as written and the user edits down
- Derive the slug from the topic and the discovery answers
- Write to `demos/<slug>/beats.md` at the project root, the committed folder the rest of the demo lives in, and print that path on its own line
- Seed a wrap section naming intro, outro, and music with a default each, so the choice of what surrounds the take is made at draft time rather than discovered at compose time

## Must not

- Name recording software, editing software, fonts, or window managers
- Record, edit video, or generate captions
- Re-run against an existing draft to refine it, since re-running overwrites
- Infer the hero moment without asking, which is the beat the whole script is built around

## Guards

- No topic provided: stop rather than guessing what is being recorded

## Out of scope

- Producing the recording, which `record-screencast` owns
- Refining an existing draft, which is a direct edit of the file
- Slide decks, which `draft-slides` owns
- Where the recording ships, which the draft lists and the user decides
