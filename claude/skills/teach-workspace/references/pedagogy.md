---
title: Pedagogy reference
description: Fluency against storage strength, retrieval practice, spacing, interleaving, the zone of proximal development, and where difficulty helps
---

# Pedagogy reference

The rules a lesson is built from. Read this before picking what to teach next, not while writing the markup.

## Fluency is not storage strength

A learner who follows an explanation smoothly has demonstrated that the explanation was clear. That is fluency, and it decays within days. Storage strength is whether the material can be retrieved later without the explanation present, and the two move independently.

The practical consequence is that a lesson cannot report its own success. Only a later retrieval can, which is why the learning record exists and why every session opens by testing the last one rather than by reviewing it.

- Treat a learner's confidence as evidence about the lesson, never about their retention
- Never advance on the strength of a smooth session. Advance on a retrieval the learner passed unaided.

## Retrieval practice

Pulling an answer out of memory strengthens it far more than reading it again. Recognition is the weak form: a learner who picks the right option from four has done less work than one who produced the answer from nothing.

- Ask before telling. Open with the question, then teach into the gap the attempt exposes.
- Prefer a question the learner has to produce an answer to over one they select from
- Let the learner fail an attempt before correcting it. A failed retrieval followed by the answer beats being told first.
- Do not cue the answer in the question. A question restating the material tests reading rather than memory.

The teach-back block is the production form this section prefers, and it is why a lesson carries one beside its quiz rather than a quiz alone. A quiz is recognition, so a lesson offering only one tests the weak form and reports it as retrieval. Asking the learner to explain the material to somebody who does not have it makes them produce the whole structure rather than pick from four, and what the explanation leaves out is the gap the next session places from.

- Carry a teach-back block in every lesson, asking for an explanation rather than an answer
- Name the audience the explanation is for, since an explanation with no reader has no floor to sit above
- Record what the explanation left out under what the learner got wrong. A produced answer and a selected one are both retrieval failures, and splitting them across two sections splits one placement input.

## Spacing

The same total time spread across days beats the same time in one sitting. Forgetting between sessions is the mechanism rather than the cost, because effortful retrieval is what strengthens the trace.

- Revisit a topic after the learner has begun to forget it, not while it is still fresh
- Widen the gap each time a topic is retrieved correctly, and shorten it after a miss
- Name what to revisit and when in the learning record, so the next session has a schedule rather than a guess

The ladder is 1, 3, 7, 16, and 35 days. A topic retrieved unaided moves up a rung and a miss drops it back one, held inside the ladder at either end, so a topic the learner keeps missing stays on the shortest gap rather than restarting a sequence.

Do not compute a date from that ladder by hand. `canon teach list <topic> --json` reports the schedule with both dates already resolved for every item, which is what turns the ladder into a number to copy rather than a rule to apply. An author told to widen a gap still picks the gap by judgment, and this is the same reason quiz option order is drawn by a verb rather than stated here.

## Interleaving

Mixing related topics within a session beats finishing one before starting the next. Blocked practice inflates in-session performance and hurts what survives it, because the learner stops having to work out which approach a problem calls for.

- Mix topics inside a session once the learner has a foothold in each
- Keep problems in a mixed set close enough that telling them apart is the work
- Do not interleave a topic the learner has never seen. Interleaving discriminates between things already known.

## The zone of proximal development

The productive band is what the learner cannot do alone and can do with support. Below it the session is review, and above it the support carries the whole task and nothing transfers.

- Compute the band from the learning records rather than from the subject's own order
- Target the first thing the last record shows the learner could not do unaided
- Withdraw support as the learner succeeds, and restore it on a miss rather than repeating the lesson
- Where the records show nothing, ask. A guessed starting point misses in both directions.

## Where difficulty helps and where it hurts

Difficulty is not uniformly good. It helps skill acquisition, where the learner is building a procedure they will execute, and it hurts knowledge acquisition, where the learner is taking on facts and structure they do not have yet.

- Introduce new facts and structure in their clearest form, with worked examples and no invented obstacles
- Add difficulty once the learner is practicing rather than acquiring: withhold the worked step, vary the surface of the problem, delay the feedback
- Never confuse a hard explanation with a hard problem. A confusing explanation adds load that teaches nothing.

## Sourcing

Parametric recall is confident where it is wrong, and a learner cannot audit it. Every claim in a lesson traces to something read.

- Read the subject from sources before teaching, and record each one with its link
- Mark any claim resting on recall as resting on recall, in the lesson itself
- List a source found and not opened as a lead, and never cite it
- Choose which sources to read by the ladder under `### Choosing sources` in the teach standard, which also rules out the learner's own work as proof of a general claim
