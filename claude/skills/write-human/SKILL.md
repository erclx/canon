---
name: write-human
description: Carries the voice, word choice, rhythm, sentence construction, and information density rules a banned-character scan cannot express, plus the catalog of machine tells that survive a clean ban scan. Use when writing or revising prose a person will read, when a passage reads flat or uniform, or when asked to "make this read like a person", "fix the cadence", "this reads like AI wrote it", "vary the sentences", or "tighten this without gutting it". Do NOT use for banned characters, which `markdown.md` states and `canon markdown audit` gates, and do NOT use to restate text that already exists in plainer words, which is `restate-plainly`, whose body loads these rules from here.
---

# Write human

Write prose that reads as though a person wrote it. A ban list subtracts words and reaches nothing about how a passage moves, so this skill carries the half no scan measures.

Load this before drafting a passage rather than after. A revision pass recovers the words and never recovers the structure the draft already settled.

The banned characters sit in `${CLAUDE_SKILL_DIR}/../../standards/markdown.md`. They stay in force here. This skill adds to them and never restates them, since `canon markdown audit` reads them from the package and a second copy would drift. The word guidance under `## Voice` is the one copy of that list, and no command reads it.

## What yields and what does not

- A surface stating its own voice keeps that voice. Blogs, emails, changelogs, and commit messages are surfaces of that kind, as is any document whose own standard states a voice.
- The yield covers voice alone. Rhythm, density, and the machine tells below apply on every surface, as do the bans and the markdown mechanics.
- Terse reference prose is the default register. A warmer register is an overlay a surface declares, never a reason to drop the rules underneath it.

## Voice

- Write for a developer who is scanning rather than studying. Every sentence has to land on first read.
- Use active voice, and present tense unless past or future is factually correct.
- Name the actor in a sentence that has one. Passive voice with an unnamed actor hides who acts and reads as evasion.
- Prefer direct verbs and plain words. Write `use` over `utilize`, `help` over `facilitate`, `is` over `serves as`.
- Drop marketing words: `seamless`, `robust`, `powerful`, `revolutionary`, `enhanced`, `allows`, and `leverage`. Each claims a quality without showing it, so state what the thing does and let the reader judge it.
- Drop vague qualifiers: `simply`, `just`, `easily`, `quickly`, `very`, and `really`. Cut the word where the sentence stands without it, and give the measurement where the degree matters.
- Be direct on an established fact. Hedge on a genuinely uncertain claim and say which it is.
- Assume developer-level knowledge. Skip the explanation the reader already carries.
- Front-load the key information in a paragraph, and give every sentence something the reader did not have.

## Rhythm

Uniform cadence is the tell that survives the cleanest ban scan. Measure it rather than judging it:

- Read the paragraph as one block. Uniformity is audible and close to invisible line by line.
- Compare the longest and shortest sentence in a paragraph. Within roughly five words of each other means the paragraph has one cadence and needs a short sentence or a long one added.
- Count the opening word of each sentence. Two alike is coincidence and three is a pattern to break.
- Vary the grammatical shape of the opening, not the word alone. Three sentences opening on three different subjects still share one shape.
- Never buy variety with a fragment. A verbless clause standing as a sentence trades one uniformity for another and is the failure these rules exist against.
- Use a substantive connective where the flow needs one, and never add a word for rhythm alone.

## Density

- Carry one claim per sentence. A sentence carrying three claims hides the two the reader most needs to check.
- Cut a sentence restating the one above it at a different altitude. A summary of the previous sentence is the most common padding in machine prose.
- Compress by removing what repeats, never by removing the verb. Dropping the verb is the fragment rule wearing an efficiency argument.
- Resolve a pronoun or a demonstrative to its noun whenever more than one antecedent is in reach.

Read `${CLAUDE_SKILL_DIR}/references/density.md` when a passage is dense and still reads long, or when cutting it keeps breaking the sentences.

## Machine tells

Read `${CLAUDE_SKILL_DIR}/references/machine-tells.md` before revising text a model drafted, and whenever a passage clears the ban scan and still reads wrong. It catalogs the patterns no closed word set can match, being rule-of-three, synonym cycling, false ranges, inline-header lists, adverb propping, and the rest, each with the fix.

Skip that reference on a short original draft where nothing reads off. The catalog is a diagnostic and costs a read on every invocation that does not need it.

## Revising a passage

1. Read the whole passage before editing a line of it.
2. Mark the sentence lengths and the openings in each paragraph, and rewrite the flattest run first.
3. Check each paragraph for a sentence that adds no claim, and cut it rather than shortening it.
4. Re-read for the tells the catalog names, if the passage came from a model.
5. Run `canon markdown audit <path>` for the mechanical half, and rewrite each hit rather than swapping the token for a near-synonym.

Report each file written or updated by its full path from the project root.

## Source material

The position on external writing guidance sits in `${CLAUDE_SKILL_DIR}/references/source-material.md`, which states what this skill adopted, what it declined, and the measurement behind each. Read it before importing a rule from outside this corpus. Do not re-derive that position, since a second answer will disagree with the recorded one.
