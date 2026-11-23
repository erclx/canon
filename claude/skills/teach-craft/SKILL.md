---
name: teach-craft
description: Carries the judgment for teaching a subject so it sticks, being the lesson's goal, how it explains and presents, retrieval, spacing, interleaving, pitching just past what the learner can do, quizzes that leak no answer, and the teach-back. Use before teaching over more than one exchange, when writing a lesson, a quiz, or a study plan, or when asked "teach me X", "make me a lesson on X", or "quiz me on this". Do NOT use to answer one question or to write project documentation.
metadata:
  family: answer
---

# Teach craft

A session asked to teach explains, and a smooth explanation reads as a lesson learned. It is fluency, which does not survive a delay. This skill carries what turns teaching into retention: test before telling, space the returns, and grade only what the learner produced unaided.

Its rules hold on any surface. A lesson lands on the project's board when it has one and as a standalone page otherwise, per `## Where the lesson lands` below.

## References

- `${CLAUDE_SKILL_DIR}/references/pedagogy.md`: fluency against storage strength, retrieval practice, spacing and its ladder, interleaving, where to place the learner, and where difficulty helps
- `${CLAUDE_SKILL_DIR}/references/explanation.md`: planning from the goal, figures paired with words, signaling, refuting the misconception, names first, segments, and the concrete case tied to the rule
- `${CLAUDE_SKILL_DIR}/references/lesson-craft.md`: restraint, quiz design, the teach-back, and what makes a lesson worth returning to
- `${CLAUDE_SKILL_DIR}/references/presentation.md`: citation marks and the reference list, figures and density, one callout, type, and the contrast checks

Read `pedagogy.md` before picking what to teach next and `explanation.md` before choosing what a lesson covers. Read `lesson-craft.md` before writing a quiz or a lesson, and `presentation.md` before drawing it or writing its page.

Read `${CLAUDE_SKILL_DIR}/references/adopted.md` only when extending this guidance or arguing against a rule in it. It records the research each rule rests on, the passage relied on, and which rules stand as house judgment.

## Before teaching

- Ask what the learner already knows rather than assuming it. Difficulty with no floor under it teaches nobody.
- Read the subject from sources rather than from recall, and say which claims rest on recall where no source was reachable
- Open a returning learner on retrieval of what they got wrong last time, before anything new
- State what the learner will be able to do, and the check that would show it, before choosing any content

## While teaching

- Place each step just past what the learner can do unaided, from what they got wrong rather than from the subject's own order
- Carry a quiz and a teach-back, since recognition and production fail differently
- Record the wrong answer itself rather than a count, since the next session places the learner from the misconception

## Where the lesson lands

A board frame runs a quiz and cannot save what the learner picked, so the surface decides where the record goes as well as where the lesson is drawn. Decide it the way `app-drive` decides whether a drive draws.

- Draw on the project's Frameboard board when `canon/config/design.toml` or `.canon/board/` exists at the main root, reaching it per `${CLAUDE_SKILL_DIR}/../design-pick/references/board.md`
- Write the lesson as a standalone HTML page otherwise, since a missing board is no reason to refuse a lesson
- Keep the learning record on the board as a frame the session writes from what the learner reports, beside the lesson it records
- Keep the record as a file beside the standalone lessons when the project has no board

## Reading mode

A learner who says they do not want to be quizzed in chat gets the remaining lessons in reading mode. Switch on that statement alone, never on short replies or a guess about what they would prefer.

- Drop the chat gate, being the retrieval asked before each advance and the one a returning session opens on, so the learner moves at their own pace
- Keep the quiz and the teach-back on the page. The page runs them, and a learner who declined in chat may still try them, so a later ask for a quiz is answered as usual.
- Draw the remaining lessons together rather than one per session, since nothing paces them
- Record the opt-out in the learning record per `${CLAUDE_SKILL_DIR}/references/pedagogy.md`, and end it when the learner asks for retrieval again

## The lesson kit

Every lesson takes one look, shipped as the Frameboard kit folder `${CLAUDE_SKILL_DIR}/assets/lesson/`. Read its `kit.md` before writing a lesson page, for the page a lesson writes, the course map, and the classes to reach for.

- On a board, run `frameboard kit add <project> --from ${CLAUDE_SKILL_DIR}/assets/lesson --json`, then `frameboard frame kit <page>/<frame> lesson --json` on each lesson frame
- Without a board, copy the folder to `assets/kits/lesson/` in the lessons' folder, the path a board project holds it at, so one lesson page loads on both
- Write the course's map as `course.js` in that same `assets/` folder, outside the kit, so a newer kit replaces the folder and the map survives
- Move a board course to a newer kit with `frameboard kit remove`, then `kit add`, then `frame kit` on each lesson frame again, since the board refuses a kit the project already holds

## Excuses and rebuttals

| Excuse                                    | Rebuttal                                                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| They followed the explanation, so move on | Following is fluency. Advance on a retrieval the learner passed unaided.                      |
| Review the last lesson before testing it  | Review rebuilds the fluency the test would have measured. Test first, then fill what missed.  |
| The answer is obvious from the options    | Then the distractors are not misconceptions anyone holds. Rewrite them.                       |
| They declined quizzing, so cut the quiz   | Only the chat gate goes. The page keeps its quiz and teach-back for a learner who wants them. |

## Red flags

- You are about to explain a topic and the learner has not yet tried to answer anything on it.
- You are choosing a lesson's content and have not written what the learner will be able to do.
- The learner said it makes sense and you are moving to the next topic.
- A returning learner's session opens on new material.

### Quizzes and records

These flags fire on what the session has written.

- The correct options in a quiz are the longest ones, or sit in the same slot.
- You are writing a claim about the subject with no source open.
- The learning record you are about to write holds a score and no wrong answer.

## Before handing over

Check each line against the lesson and the record the session produced.

- The lesson states its goal, and its quiz and teach-back test that goal.
- Every advance followed a retrieval the learner passed unaided, not a smooth explanation.
- The lesson carries a quiz and a teach-back with a named audience.
- Every quiz keeps its options to one length and rotates the correct slot by question number.

### Sources and the record

Check what the lesson cites and what it leaves for the next session.

- Every claim names the source it was read from, or says it rests on recall.
- The learning record names each wrong answer and the next revisit from the ladder.

## What this delegates

- Finding and opening the sources a lesson is read from: `search-craft`
- Reaching and starting the board, and drawing a frame on it: `design-pick`'s board reference and Frameboard's `draw` skill
- The contrast floors and the accessibility of a rendered lesson: `ui-craft`
