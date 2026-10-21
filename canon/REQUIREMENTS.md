# Requirements

A developer handing real work to an agent has no way to run it from plan to merge. Planning, building, review, and shipping each get improvised per session, and nothing holds the agent to the practices that make code worth keeping. All of it depends on setup every repository accumulates the same way and lets drift.

Authoring guidance: `claude/skills/write-doc/references/requirements.md`.

This record holds at most 600 words.

## Worldview

- Code is free. Context and human attention are scarce.
- Claude Code is the platform. Tools live inside it or attach to it through skills, hooks, and the plugin system.
- Humans stay in the loop only where judgment is non-obvious. Process and planning are where the return is largest.
- The toolkit is agent-first throughout. Human-friendly UX layers on top where needed.
- Consistency is a prompt. Same patterns across domains reduce context load and make refactors cheap.
- A rule a model can ignore needs a check that fails. Prose sets the intent, and a hook, a stage, a gate, a verb, or a permission rule makes it hold and says what it does when its inputs are missing rather than reporting a pass. A hook backs a rule up but never holds a hard deny, since it fails open on a timeout.
- A safe behavior sits on the default path, not behind a flag.
- A custom mechanism is preferred over a platform-native one only until the platform ships an equivalent.
- A bottleneck is a defect to remove, not a constant to design around.

## Goals

- **Workflow.** An agent's work runs from plan to merge, in parallel, with each step handed to a session that owns it and leaves a record the next one reads.
- **Practice.** The code and interfaces an agent builds follow established engineering practice. Every practice the toolkit teaches cites the source it comes from, and a check rather than a reminder holds the agent to it.
- **Shared setup.** One authoritative source for rules, standards, skills, seeds, and the project's design record, installed and synced into any repository without hand-patching. The two goals above run on it.

## Non-goals

- Replace human code review on risky changes. Agents augment the review loop and humans own the final call.
- Ship runtime dependencies or application code to target projects. The toolkit ships configs, seeds, rules, and code proven to stay out of the production build, verified per instance.
- First-class support for every AI coding tool. Claude Code is the platform. Another tool stays deferred until a concrete use case drives it.
- Produce visual, video, or teaching artifacts as products. Frameboard carries the design board in its own repository, and composed video goes to a tool built for it.
- Wrap framework scaffolding. Users run `bun init`, `npm create vite`, and similar themselves, and the toolkit layers on top.
- Provide a hosted service. Everything runs locally. Publishing to a registry someone else hosts stays in scope.

## Constraints

- Agent-first: every command has a non-interactive path, and data on stdout pipes clean through any wrapper.
- The toolkit is the authoritative source. Target projects consume through install and sync and never author in place.
- Skills call the CLI and never reimplement it.
