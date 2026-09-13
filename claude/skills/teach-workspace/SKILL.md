---
name: teach-workspace
description: Opens and runs a learning workspace on one subject, holding a mission, resources, numbered lessons, reference pages, a glossary, and learning records that survive across sessions, and proposes where a durable page from one belongs once it outgrows the workspace. Use when asked to "teach me X", "open a learning workspace", "I want to learn X", "quiz me on this", "continue the lesson", "resume my workspace on X", or "promote this reference page". Do NOT use to write project documentation, which belongs to the surface owning that document, and do NOT use to answer one question, which is an ordinary reply.
disable-model-invocation: true
argument-hint: <subject to learn, or the topic of a workspace to resume or promote>
---

# Teach workspace

Run a learning workspace on one subject across sessions. The workspace holds what the learner has been through, so a session weeks later resumes from the folder rather than from the conversation.

The shape of the workspace is fixed by `${CLAUDE_SKILL_DIR}/../../standards/teach.md`. Read it before writing anything into the folder. The glossary answers to `${CLAUDE_SKILL_DIR}/../../standards/glossary.md`, whose shape governs a glossary wherever it lands, since a promoted glossary keeps its shape at whatever path it reaches and no project folder covers all of them. The pedagogy sits in `${CLAUDE_SKILL_DIR}/references/pedagogy.md`, the lesson craft in `${CLAUDE_SKILL_DIR}/references/lesson-craft.md`, and the promotion routing in `${CLAUDE_SKILL_DIR}/references/promotion.md`.

## Guards

- If the invocation names no subject and no existing workspace matches, stop: `❌ No subject. Invoke with the subject to learn, or the topic of a workspace to resume.`
- Never trust recall for what the subject says. Research first, cite what was read, and say what was not.
- Write nothing outside the workspace folder, apart from the one handoff file Step 6 names. A durable page stays in `reference/` and is copied out by the skill that owns the destination, never by this one.
- Do not open a second workspace on a subject one already covers. Resume that one.
- Never promote a lesson. It is generated markup carrying a quiz and a learner, and no request makes it promotable.
- Carry the toolkit's favicon on every page this skill writes, index and lesson alike, in the `<head>` verbatim: `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='10 10 80 80'%3E%3Cpath d='M34,20 L15,28 L15,72 L34,80 Z M66,20 L85,28 L85,72 L66,80 Z' fill='rgb(224,114,75)' /%3E%3Crect x='44' y='15' width='12' height='70' rx='2' fill='rgb(224,114,75)' /%3E%3C/svg%3E" />`

## Step 0: let the CLI resolve the workspace root

Workspaces live at the main worktree root, never inside a linked worktree. A copy per worktree forks the learning records, and the learner is one person.

Every `canon teach` verb resolves that root in-process, so no step below composes a path to a workspace file. Read the folder through the CLI rather than deriving its location:

```bash
canon teach list --json
```

It reports every workspace with its path, its counts, and the ordinal a new one would take. A `no-teach` refusal means the project has opened none yet, which is the new-workspace path in Step 1 rather than a reason to stop. The open verb creates the folder.

From a linked worktree the file-editing tools refuse every path under the main root and offer a worktree copy instead, which is a second file no later session reads. Never take that redirect. The route splits by what the write does to the file:

- Creating a whole file that does not exist yet, which is a lesson, a reference page, and a learning record, goes out as one plain shell command carrying a heredoc
- Changing a line inside a file that already exists goes through the verb that owns it, since the stream editors are banned and no other shell route reaches it

## Step 1: open or resume

A topic the listing already carries is a resume, and anything else is a new workspace. An invocation asking to promote is neither: read the named workspace through the listing and go to Step 6, which teaches nothing and writes no lesson.

On a resume, run `canon teach list <topic> --json` for the files behind each count, then read the highest-numbered learning record and `GLOSSARY.md`. Those carry where the learner stopped and what they got wrong. The listing record carries `success`, the mission's success lines, which are the exit criteria this workspace is finished against. Report them with what is already met before teaching anything.

It also carries `due`, what the learning records schedule, soonest first. Each entry names the item, its date, the rung it has reached, whether it is `overdue`, and the two dates the next record could write. Read it here rather than later: it is the input to what this session opens on, and `canon teach lesson` takes a `--slug` naming a choice already made. Report what is overdue before proposing a lesson. An empty `due` on a workspace holding records means no record scheduled anything, which is a gap in the records rather than a clear schedule.

On a new workspace, settle the starting point first, by asking rather than by assuming. Difficulty with no floor under it teaches nobody, and the mission cannot be written without it.

Then open the workspace, which derives the ordinal and writes all three required files:

```bash
canon teach open <topic> --json \
  --subject "<one line stating the subject>" \
  --starting-point "<what the learner already knows>" \
  --success "<an observable thing the learner will be able to do>" \
  --out-of-scope "<what this workspace does not cover>"
```

Repeat `--success` and `--out-of-scope` per line. The verb refuses a topic another workspace already covers, which is the guard against opening a second one on the same subject.

## Step 2: research before teaching

Read the subject from sources rather than from recall. Record what was read and what was only found through the verb that owns the file:

```bash
canon teach resource <topic> --json \
  --read "<title, naming which claims rest on it>=<url>" \
  --lead "<title>=<url>"
```

Each flag repeats, and the pair splits on the first `=` so a URL carrying one survives. A URL already listed is refused rather than repeated.

A claim nothing was read for is the failure this step exists against. Where no source is reachable, say so in the lesson and mark what rests on recall.

## Step 3: place the learner

Pick the next lesson from the learning records rather than from the subject's own order. The target is the band immediately past what the learner can already do unaided, which `${CLAUDE_SKILL_DIR}/references/pedagogy.md` states in full.

Open on what `due` reports as overdue, oldest date first, before anything new. Where nothing is overdue, open on retrieval of what the last session got wrong. A learner who cannot retrieve the previous lesson is not ready for the next one, and moving on anyway buys fluency that decays.

Reading the last record alone is what the schedule replaces. A topic missed three sessions ago and never revisited is invisible to that read and sits in `due` with a date already past, which is the whole reason the field exists.

## Step 4: write the lesson and the reference

Two outputs with two lifetimes, and the split decides the format.

- A lesson is a self-contained page carrying its own quiz, a teach-back block, and the feedback for each question. It embeds one shared stylesheet rather than restating styles, and it is disposable and never promoted.
- A reference page goes to `reference/<slug>.md`, written for a reader with no learner in it. This is the half that survives the workspace, so it is written in markdown to pass the authoring gates a promotion would put it through.

Resolve the lesson before writing it, rather than composing its name or its quiz order by hand:

```bash
canon teach lesson <topic> --json \
  --slug <kebab slug for what this lesson covers> \
  --questions <how many questions the quiz carries> \
  --options <how many options each question carries>
```

It writes nothing and reports three things:

- `lesson`, the numbered path the lesson takes. Write it there.
- `success`, the mission's success lines, carried here so Step 5 needs no second read.
- `quiz`, one entry per question, carrying `order` and `answer`.

Write the correct option first, then present the options in the order `order` reports, reading it as authored indices where `0` is the correct one. Take the order as given. Position drawn here rather than chosen is the whole reason the verb exists, and a lesson that reorders on its own judgment puts the answer back in the first slot.

### The quiz and the teach-back block

The quiz markup is a contract rather than a convention. `canon teach nav` splices a stepper into the lesson that gates on exactly the class names and nesting `${CLAUDE_SKILL_DIR}/references/lesson-craft.md` states under `## Quiz construction`, so a quiz in any other shape shows every question at once and nothing reports it. That is the leak this shape closes: a later stem naming what an earlier question asked for answers it while both sit on screen.

Write each option as a `<label class="opt" data-k="<letter>">` holding a radio `<input>` and a `<span>`, every option in one question sharing a `name` and each question taking a different one, the correct option carrying `data-a="1"`, and one `.fb` block as the last child of the `.q`. Never write a `<button class="opt">` in a new lesson. That is the shape written before the stepper, kept working by an injected script the button itself still triggers, and a lesson mixing the two gets both mechanisms.

Then carry a teach-back block beside the quiz. A quiz is recognition and the pedagogy prefers production, so a lesson offering only a quiz tests the weak form. Ask for an explanation to a named audience, and carry a `<details>` listing what a complete explanation covers, closed by default, so a learner reading with no session in the room can grade themselves. The reference states both shapes in full.

Compose the quiz and the teach-back block as one string. Below, that string is the block list's trailing `raw` entry, rather than markup written into the file by hand.

### Building the lesson body

Write the chrome as four empty marker pairs rather than composing it by hand: `<!-- canon:teach:style -->`/`<!-- /canon:teach:style -->` inside `<head>`, and `<!-- canon:teach:header -->`, `<!-- canon:teach:footnav -->`, and `<!-- canon:teach:scripts -->` each with its own close marker, in that order in `<body>`.

Build the authored `<h1>`, lede, body, and quiz as a JSON array of blocks rather than composing markup by hand, and render it through the verb rather than through a component import:

```bash
echo '[
  {"type":"heading","level":1,"text":"<title>"},
  {"type":"paragraph","lede":true,"text":"<the dek>"},
  {"type":"paragraph","text":"<a body paragraph>"},
  {"type":"list","ordered":true,"items":["<step one>","<step two>"]},
  {"type":"raw","html":"<the quiz and teach-back block composed above>"}
]' | canon teach render --json
```

A `heading`, a `paragraph` (`lede: true` for the dek), and a `list` cover the structural body. Reach for `raw` only where none of the three can carry the content, never as a shortcut around composing one, and give the quiz and teach-back block the array's trailing `raw` entry every time, since their fixed contract is not a components concern. Take the call's `html` field and write it between the header's close marker and the footnav's open marker, and nothing else anywhere in the file.

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

Follow `${CLAUDE_SKILL_DIR}/references/lesson-craft.md` for what makes a lesson worth returning to. Keep every quiz answer the same length, so formatting leaks no clue about which one is correct.

### Hand over a link, never a path

A lesson is a page carrying a script, and an editor preview cannot run it, so a path alone opens markup with no working quiz. Serve the teach root and give the learner a link they can click:

```bash
canon serve .canon/teach --entry <nn>-<topic>/index.html --json
```

Start it in the background so the session keeps going, and read `url` off the record rather than composing one. The verb walks past a port already in use, so the port it took is exactly the half a guessed URL gets wrong. Report the refusal and its `reason` when `ok` is false, and report it rather than proceeding silently when the verb does not resolve at all, which is an installed CLI predating it.

Do this on every run that opens or resumes a workspace, including one that writes no lesson, since the learner's route into what is already there is the same link.

## Step 5: record what happened

Write `learning-records/<nnnn>-<slug>.md` before the session ends, carrying the lessons covered, what the learner retrieved unaided, what they got wrong with the wrong answer itself, and a `## Revisit` section.

Record the wrong answer rather than the count. The next session places the learner from this file, and a tally carries no misconception to work against.

Record what the teach-back left out under what the learner got wrong, naming the concept and where the explanation broke. A produced answer and a selected one are both retrieval failures the next session places from, so a second heading would split one input across two sections.

Then write `## Revisit`, one bullet per item, in the shape `${CLAUDE_SKILL_DIR}/../../standards/teach.md` fixes:

```markdown
## Revisit

- **<what comes back up>**: due <YYYY-MM-DD>, rung <n>
```

Take both the date and the rung from the `due` entry Step 1 already read, copying `hit` for an item the learner retrieved unaided and `miss` for one they did not, with the rung stepped the same way. Do not compute a date from the ladder. A session told to widen a gap still picks the number by judgment, which is the reason the verb reports both dates at all.

An item the records have never scheduled has no `due` entry to copy from. Open it at rung 1, dated the day after this session, which is the ladder's floor and the one number this body states. Every later date for it comes from the verb.

An entry outside this shape schedules nothing and nothing reports that it was skipped, so write the shape exactly. A later record naming the same item supersedes an earlier entry, so revise a schedule by writing the new bullet rather than editing the record it was set in.

Then restate the mission's success lines with what is now met, reading them from the `success` the lesson verb already reported rather than from `MISSION.md` by eye. Report each line as met or not met, and name what the learner did that meets it. A mission whose lines are all met is finished, and saying so is what closes a workspace.

## Step 6: propose where the durable half belongs

Run this when the invocation asks for it, or offer it in one line when a mission finishes, since that is when the workspace stops growing and its reference pages stop changing. Never run it unasked mid-course.

Read `${CLAUDE_SKILL_DIR}/references/promotion.md` first. It carries what may be promoted, the routing test, both spellings of the wiki folder, the refusal when a project has none, and what each destination expects a page to carry.

Propose and wait. A promoted page is public prose that needs a line naming who owns its subject, which is a judgment about ownership rather than a move a session makes on its own reading. Present one block per candidate page:

```plaintext
reference/<slug>.md → <destination path>
Subject owner: <who owns it, in a few words>
Still owed:    <what the destination expects that the page does not carry yet>
```

Then stop and let the operator strike, redirect, or confirm each block.

Write nothing to a destination here. One skill owns the durable writes, and two skills editing one file at one step is the failure that rule exists against. Record each confirmed block in `.canon/tmp/teach-promotion/<slug>.md` at the main worktree root instead, appending when the file exists, with one H2 per destination naming its path, the source page beneath it, and the page body fenced:

````markdown
## <destination path>

Source: .canon/teach/<nn>-<topic>/reference/<slug>.md

```markdown
<the page body as it should land, with the source line the destination expects>
```
````

The body is fenced rather than written bare because a reference page carries headings of its own, and the reader splits this file on its H2 lines. An unfenced body turns every section heading in the page into a destination naming no path. Open the body fence with four backticks so a page carrying a fenced code block of its own still closes where it should, and widen both fences together if it carries a four-backtick fence.

Derive `<slug>` per `${CLAUDE_SKILL_DIR}/../../standards/slug.md`. Fall back to `latest` on an empty result.

The handoff is its own file rather than a shared one. The routed-facts file another skill writes is deleted by whichever pass folds it, so a second producer's unread work goes with it, and a sibling path costs the folding skill one more read and removes the interaction.

An append is a whole-file operation, so send it as a plain single `Bash` command carrying a heredoc, per Step 0. Then tell the operator that `/docs-fold` folds the file in from a branch. The proposal costs nothing tracked and runs anywhere, while the page it describes is a tracked file, so the fold is a worktree operation and the workspace it came from is not.

## Output

```plaintext
✅ <opened|resumed> .canon/teach/<nn>-<topic>/
Lesson:    .canon/teach/<nn>-<topic>/lessons/<nnnn>-<slug>.html
Reference: .canon/teach/<nn>-<topic>/reference/<slug>.md
Record:    .canon/teach/<nn>-<topic>/learning-records/<nnnn>-<slug>.md
Progress:  <n> of <m> success lines met
Open:      [<the url the serve verb reported>](<the same url>)
```

Omit the reference line where the lesson produced no durable page. The open line is the one line that is never omitted, since it is the only route the learner has into the page, and it carries what `canon serve` reported rather than a URL composed here. Where the verb refused, that line names the refusal instead of a link.

Write that line as a markdown link carrying the URL as both its text and its target, rather than as a bare URL and never inside backticks. A code span renders as text the reader has to select and copy, which is the one thing the line exists to save them, and the path rule the project states governs a file path rather than a URL.

Emit every path from the project root, in the form the project's instruction file sets.

A promotion pass reports its own shape instead, one line per page the operator confirmed and one naming the handoff:

```plaintext
➡️ Promoting: .canon/teach/<nn>-<topic>/reference/<slug>.md → <destination path>
→ Confirmed pages wait at .canon/tmp/teach-promotion/<slug>.md. Run /docs-fold from a branch to fold them in.
```

A pass where the operator confirmed nothing writes no handoff file and reports that alone.
