---
name: draft-and-pick
description: Why a decision settled by looking needs its own surface, and where its boundary against the planning, audit, measurement, and recording skills falls
---

# Draft and pick requirement

## Gap

Without this skill, a session facing a decision nobody can settle from a diff:

- Describes two options in prose and asks the operator to choose. The operator decides by looking, so a described option is not an option and the answer that comes back is arbitrary.
- Produces one answer for a decision that was taste, so the operator never sees what they were choosing between and the call is taken silently by whoever wrote the code.
- Reports that a candidate reads well without rendering it, so the claim rests on the markup having been written rather than on the page having been seen.
- Hands over one image per arm, which asks the operator to hold the differences in memory rather than showing them. The comparison is the artifact and a set of separate files is not one.
- Varies three properties at once across the arms, so the pick cannot say which difference decided it and the next iteration guesses.
- Writes the candidates into the real surface, so the losing arms have to be unpicked out of a tree the operator has not judged yet, and a variant left behind a flag becomes a second design nobody maintains.
- Stops the loop when the arms stop differing rather than when the operator says the pick is right, which ends the run on the session's own patience.
- Reads a driver record as a verdict and drops an arm on it. `canon drive` reports findings and never gates, so a run filtering the arms on a probe reading has made a claim the probe catalog has not earned.
- Reads a color without compositing its alpha, samples a round control at the corner of its bounding box, or confirms a panel's dimensions while it sits above the viewport. Each reads as a passing measurement about something no reader sees.
- Meets a machine with no browser binary and reports on the arms anyway, since nothing in the default flow separates a render that failed from one that was never attempted.
- Hand-writes a mockup of a surface a running app already serves, which drifts from what ships by a few pixels and a few words the moment the app's own markup or stylesheet moves on.
- Varies a property the decision is not about, which satisfies the one-property rule and produces a set differing in the layer a reader notices least. Five palettes over one identical page read as five skins of one design, and the operator rejected the whole set on sight.
- Renders each arm in whatever theme it happens to carry, so a set spanning both themes cannot be compared without the operator toggling every arm and holding the earlier ones in memory.
- Looks at a render to confirm it came out rather than to judge whether it is worth showing, which satisfies the rule against reporting an unseen result and still hands over weak work.
- Writes the run's renders to a scratch path outside the record that cites them, leaving the folder holding source markup and none of the images, so the judgment is unreachable to everyone except the session that made it.
- Narrows the page onto the picked arm in place on each iteration, so every earlier round is overwritten and a later pass cannot see what was already rejected.
- Names no layer at all, since the instruction to name one carries no catalog to name from and nothing reports the omission. Four consecutive rounds against one page each varied a property at the top layer while the defect sat two below it, and three of the four changed nothing the operator could see.
- Judges a lower layer through a finished higher one, so an operator asked about composition looks at the palette instead and answers about that.
- Hands over the combined page alone for a decision about layout, where every arm sits in a column while the media queries answer to the whole window, so no arm is ever seen at its own viewport and a fault that appears only narrower survives the pick.
- Rebuilds a navigation harness by hand on a run with several rounds, since each round writes its own folder and nothing reaches all of them from one address. Two design tracks hand-wrote the same page picker, theme toggle and iframe width control.
- Sets the theme on an arm that persists its own and reads it back on load, so the control reports one theme while the arm renders the other and the set is compared across two.

## Must

- Produce three to five arms with the shipping state among them, each carrying an id, a label, and what the arm costs.
- Author the whole candidate set as one self-contained page and render it once, so the comparison arrives as one image, except where the surface under decision is a running app: there the page links a copy of the built stylesheet rather than inlining it, per `references/live-arms.md`.
- Emit the layer in the run's own output, drawn from the catalog `design-taste` fixes rather than from a word invented per run, and vary the arms at that layer alone. A layer held privately is one nothing can report missing, which is how the instruction went unfollowed while every round passed its own rules.
- Grey-box the set when the declared layer sits below typography, and say the set is grey-boxed when handing it over, so the operator reads a flat page as the question rather than as unfinished work.
- Render every arm in one theme at a time, with a control that sets the whole set, so the comparison holds still while the operator reads it, and set the theme in a way that survives an arm reading its own stored preference back on load.
- Hand over the per-arm file addresses beside the combined page where the declared layer is composition, layout or space, since only a whole-page file at a real viewport answers how an arm behaves at a width, and write a frame from `references/frame.html` where the run has several rounds or that layer applies, whose iframe width is the control and whose picker reaches every round from one address. The browser's device toolbar is the fallback where no frame was written.
- Judge each render against a stated bar before handing it over, name the weakest thing on the page, and fix it where that sentence would embarrass the work.
- Write each iteration to its own folder rather than narrowing the previous one in place, so every earlier round stays openable.
- Write the run's renders inside the record that cites them wherever one exists, and reserve the scratch path for inputs that are re-runnable and cited by nothing.
- Render before reporting on any arm, and report a missing browser binary as a refusal naming the repair rather than describing an arm nobody has seen.
- Take the pick through the structured question surface, with the recommendation ranked first and marked, and every option carrying its cost.
- Keep every write inside the run's scratch folder until the pick is final.
- Apply the winning arm in one change.
- Capture every arm from the final round as an image before deleting the run's scratch folder, rather than discarding the losing arms with it.
- Resolve the archival capture's destination against the main worktree root, never against a linked worktree the run happens to be building in.
- Serve the candidates live where the decision is one the operator has to drive, since a still cannot answer how a gesture feels or how a pace reads.

## Must not

- Take the pick where two arms are both defensible and the difference is taste. That call is the operator's, and taking it silently is the failure this skill exists to prevent.
- Draft candidates for a decision the operator has not asked to make. Each arm costs a render, and a run offering options everywhere spends their attention rather than saving it.
- Restate the mechanics of the render, the address, or the probes. `canon capture`, `canon serve`, and `canon drive` own those and their help text is the source, so a second copy here hands one case two answers.
- Read a `canon drive` finding as a gate over the arms.
- Fire on a request that already names one answer.

## Guards

The refusal strings sit in the body, since the runtime loads that file and ignores this one. Two conditions stop a run: a request naming one answer and asking for it to be built, and a decision with no visible form for a render to show.

## Out of scope

- `plan-feature` plans the work once the answer is settled, and declares the pull request boundary its plan carries. This produces the answer to pick from and stops before the plan.
- `ux-audit` reads source to find roughness and reports it. This takes its input from the operator and changes nothing until they pick.
- `ux-measure` measures what a running interface costs to paint. This measures whatever a visual claim depends on, which is usually geometry or contrast rather than cost.
- `ui-test` writes tests for a change already made. This runs before there is a change to test.
- `draft-screencast` scripts a recording of something already built. This has nothing built yet.
- `canon capture`, `canon serve`, and `canon drive` own the render, the address, and the probes, and are invoked rather than reimplemented.

### What did not travel

This descends from a project-local skill whose interactive half was written against one repository. Three of its capabilities do not travel, and the three verbs above are what stands in their place:

- An arm switcher compiled into the project's own page, driven by a query parameter. `canon serve` over a self-contained scratch page replaces it, which puts the arms in scratch rather than in the source and removes the call site a run had to remember to delete.
- A copy cycle keyed to canonical page text held in a second repository. No toolkit surface has that shape, so a project holding one owns the second edit and this skill states nothing about it.
- A walker that reads every control on every page and groups them by treatment. `canon drive` probes one page and reports findings, so a sweep across every surface of a site is out of reach here and a run needing one measures by hand.

The capture mechanics traveled with a change of owner rather than being lost. They sat in a project-local path-scoped rule that fired whether or not the skill ran, and `canon capture` owns them here, which is why this file bars restating them rather than naming a rule to defer to.
