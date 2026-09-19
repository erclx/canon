---
name: ux-measure
description: Why a rendering cost question is answered with a number against a published threshold, and why the runner is detected rather than prescribed
---

# UX measure requirement

## Gap

Without this skill, a session asked what a page costs answers from source. It reads component code, names a suspicious loop, and reports a judgment, so nobody learns the number and the next session repeats the guess. Nothing in the corpus starts a browser, so the question has no surface at all and lands on whichever skill matched the word "UI".

A session that does start one picks a runner on the spot. The reading then comes from a browser nobody chose, cannot be compared against the next run, and disappears with the chat. A number reported with no boundary beside it is the same dead end as the judgment it replaced, because a reader holding `1.9s` and no threshold concludes nothing from it.

## Must

- Detect the harness the project already carries before naming any runner
- Report a number per metric beside the threshold it is measured against and the published source of that threshold
- Cover paint, processor, and layout cost, and name what the run left unmeasured
- Name the elements the layout figure came from, taken off the run that produced the median so the parts sum to the figure beside them
- Distinguish a layout figure of zero from a harness that reported no attribution, since one is a page that held still and the other is a reading that went missing
- Report what the measurement needs and stop when no harness is detected, since that is a project without a runner rather than a failure here
- Take several readings and report the median, since one load carries startup noise wider than the gap between two thresholds
- Write the reading to the branch-derived path at the main worktree root, overwriting
- Reach the URL before measuring against it, starting the project's own command only when nothing already answers there
- Leave the interface stopped and the probe deleted

## Must not

- Install a runner, add a dependency, or write a config to make detection succeed
- Invent a threshold, or move a published one to fit a reading
- Report an observation about the source in place of a measurement
- Suggest a fix for what it measured, which is a change with its own review
- Measure anything past the three metrics, since every adjacent ask doubles the run. Naming which elements shifted is not a fourth metric, being the composition of the third and already present in the reading it summarizes.
- Read the source to improve an element name the harness gave. A better selector bought that way is the source judgment this skill replaces.

## Guards

- No command that serves an interface and no URL from the user: stop, since there is nothing to reach. Test for a servable interface rather than for source under a named folder, which refuses a project laying its tree out differently while its server sits ready
- No harness detected: name the runners this can drive and stop
- No URL derivable from the project's own commands: ask rather than guessing a port

## Out of scope

- Judging the interface against stated intent, which `ux-audit` owns
- Contrast, which is computable from two color values in the token table `ux-audit` already reads. A contrast failure from a color computed at runtime stays invisible to that reader, and the cost is accepted rather than overlooked.
- Network waterfall, bundle size, and accessibility, which no version of this measures
- Writing behavioral tests against the interface, which `test-first` and `test-craft` own
- Fixing what the reading found
