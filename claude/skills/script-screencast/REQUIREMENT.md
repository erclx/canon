---
name: script-screencast
description: Why a recording script ships pre-seeded rather than blank, what the four discovery questions buy, and why the draft stays stack-agnostic
---

# Script screencast requirement

## Gap

Without this skill, a recording plan arrives as blank fields, so the user fills a template instead of editing a draft. The opposite failure costs more. A session skipping discovery guesses the audience, the length, and the hero moment, and writes beats that get thrown away. What surrounds the take surfaces only at compose time.

A draft naming the recording software, the editing software, or the window manager pins the script to one person's setup. Re-invoking to refine silently overwrites the edits the user made in the file, which destroys work rather than wasting it.

## Must

- Project context and recent commits are read before proposing, and exactly four discovery questions each carry a default derived from them
- The run waits for answers rather than reading silence as acceptance
- Every section is pre-seeded with concrete content, so the draft ships as written and the user edits down
- The draft lands at `demos/<slug>/beats.md` at the project root, with the slug derived from the topic and the answers, and its path printed on its own line
- A wrap section names intro, outro, and music with a default each

## Must not

- Name recording software, editing software, fonts, or window managers
- Record, edit video, or generate captions
- Re-run against an existing draft to refine it, since re-running overwrites
- Infer the hero moment without asking, or guess the topic when none is given

## Out of scope

- Producing the recording, which `record-screencast` owns
- Slide decks, which `make-deck` owns
- Refining an existing draft, which a direct edit of the file owns
- Where the recording ships, which the user owns
