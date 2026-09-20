---
title: Readme reference
description: Readme voice, structure, and content conventions
---

# Readme reference

Applies to every `README.md`. The `## Voice` section states the voice for a repository's root README, so the `write-human` skill yields to it there. The yield covers voice alone. The rhythm and density rules that skill carries stay in force, as do the spelling rules, banned words, punctuation, and formatting in `markdown.md`, so the warmer register ships with the same hygiene: no em dashes, no semicolons, no buzzwords.

The reader is what changes. Reference prose serves someone who already committed to the project and is scanning for a fact. A root README meets someone deciding whether to commit at all, and it is often the only file they read.

## Scope

Governs every `README.md`: voice, heading structure, required and optional sections, the header block, badge selection, and what the page links out to instead of carrying.

Does not govern:

- Rhythm and sentence construction in README prose: the `write-human` skill, which yields the voice and keeps the rest
- Spelling, banned words, punctuation, and formatting in README prose: `markdown.md`, which yields nothing
- Product scope and goals: `requirements.md`
- The consumer-facing reference under `docs/`, whose reader has already committed and is operating the project: `docs.md`

## Voice

Scoped to the README at a repository root. A nested README documenting a folder, a harness, or an internal tool keeps the reference voice the `write-human` skill carries, since its reader has already committed and arrived looking for a fact.

- Address the reader in second person. First-person plural needs an authoring organization as its antecedent, so a single-maintainer project has none to use.
- Use contractions wherever the sentence reads better for one. Do not force them in.
- Write with a point of view. State what the project chose and why, not a neutral survey of the options it passed over.
- Ground a claim in something concrete rather than an adjective. A command, a number, or a named constraint carries more than a description of quality.
- Be honest about limits. Naming what the project does not do reads as more credible, not less.

## Structure

- H1 title, H2 major sections, H3 subsections. Maintain proper hierarchy for GitHub's auto-generated table of contents.
- Use sentence case for all headings (proper nouns and product names retain their casing)
- Project description in plain text below the header block, or directly under the H1 when the block holds nothing beneath the title. Keep it to 2-3 sentences.
- Do not create deeply nested heading structures that harm scannability
- Do not use horizontal rules or dividers (`---`)

## Sections

- Required: project description, installation/setup, usage examples, support/help resources
- Optional: the header block below, features, contributing (link to `CONTRIBUTING.md`), license (link to `LICENSE`)
- Do not include full API documentation. Link to separate docs instead.
- Do not include license text. Reference the `LICENSE` file.
- Do not include detailed contribution guidelines. Reference `CONTRIBUTING.md`.
- Do not include extensive troubleshooting guides. Use a wiki or separate documentation.
- A README that points to the project's own context entries instead of restating them satisfies the required list by routing rather than carrying. A repository documented in `docs/` or `canon/context/` names the entry point and the listing command, then stops. The reader is one hop away, the same way `## Badges` treats zero as complete.
- A README missing an H1, or whose headings restate the tool that scaffolded it rather than the project, is unedited generator output rather than a page anyone wrote. Draft over it. Nothing here asks a session to preserve a section a scaffold wrote and nobody replaced.

### Header block

The opening of a root README is a block of up to six elements in a fixed order. Every element is read off the repository rather than written from scratch, and each one is a slot: a project that holds nothing for it leaves it out.

1. Mark: the project's logo or icon, from an image the repository already commits. Omit it when the project has none.
2. Title: the H1, naming the project.
3. Badges: the block `### Badges` below governs, placed directly under the title.
4. Claim: one line saying what the project does, taken from the manifest description or the repository description.
5. Live link: the URL of the running surface, from a `homepage` field or a deploy config. Omit it when the project has no page or no known URL.
6. Product screenshot: an image the project already commits and references, shown with alt text naming what it depicts. Present only when the project has a page. Omit it when no such image exists rather than writing a placeholder path.

The description of 2-3 sentences follows the block and expands the claim rather than repeating it.

- A project with no page omits the link and the screenshot. A library or a CLI reads as a complete block with a title, badges, and a claim.
- A themed light and dark pair counts as one element in the slot rather than two. The block does not require a pair and leaves the handling of themes to the project.
- Centering the block in an HTML wrapper is optional. Plain markdown reaches every host a README renders on, and a wrapper is styling a project can add.
- Never invent an element. A mark or a screenshot the project does not hold stays out of the page.

### Badges

A badge earns its place by carrying a fact the reader cannot get from the page they are already on. Three classes pass that test.

- Package version, which reports what the registry actually published rather than what the working tree claims
- Build or CI status, which reports whether the checks are currently passing
- License, which passes because a README rendered on a registry page has no host sidebar stating it

Stars, forks, download counts, language chips, and "made with" badges fail. The first three restate what a repository host already renders above the README, and the rest decorate.

- Cap the block at four. A fifth costs more scanning than any badge repays.
- Give each badge alt text naming what it reports rather than the service that renders it. Write `npm version`, not `shields.io`.
- Link each badge to the page a doubting reader would check next, which is the registry listing for a version badge and the run history for a status badge. A red badge with no route to the failing run reports a problem and withholds the only thing the reader wants.
- Pin a status badge to the branch whose health it claims to report, and confirm the workflow actually runs on that branch. A workflow triggered by pull requests alone never runs on the default branch, so an unpinned badge reports whichever branch ran last and a pinned one reports nothing at all. Fix the trigger, or drop the badge under the rule below.
- Verify a badge by the value it renders, not by its status code. A badge service answers 200 for a query it cannot satisfy, so a blank badge and a working one look identical to a status check.
- Zero badges is a correct answer. A private project with no registry presence and no CI has nothing that passes the test, and an empty block beats a padded one.

## Content

- Open public-facing READMEs with universal problems any reader recognizes, not repo-specific artifact names. Save artifact names for feature or "What is inside" sections.
- Use relative paths for repository files. Use absolute URLs for external resources.
- Include practical usage snippets for core functionality
- For libraries/tools: include API quickstart
- For applications/products: include usage instructions and configuration options
- For CLI tools: include command examples with flags
- For agent-facing repositories: name the file an agent loads first and the command that lists what the project exposes
- For marketplace-distributed plugins: give the install command for every channel the project publishes to

A project is often several of these at once. Cover every type that applies rather than picking the closest one. A repository that ships a CLI, distributes a plugin, and holds agent conventions owes its reader all three.

## Examples

### Template

````markdown
# Project Name

Brief description of what the project does in 2-3 sentences.

## Features

- Key feature highlighting user benefit
- Key feature highlighting user benefit

## Installation

```bash
npm install project-name
```

## Usage

```javascript
import { feature } from 'project-name'

feature.doSomething()
```

## Documentation

See the [full documentation](https://docs.example.com) for detailed API reference.

## Support

- Open an issue for bug reports
- Check [existing issues](../../issues) before creating new ones

## Contributing

See the [contributing guidelines](CONTRIBUTING.md).

## License

[MIT](LICENSE)
````

### Correct

````markdown
# Auth SDK

Lightweight authentication library for Node.js with OAuth2 and JWT support.

## Features

- OAuth2 provider integration (Google, GitHub, Azure)
- JWT token generation and validation
- Session management with Redis support
- TypeScript support with full type definitions

## Installation

```bash
npm install auth-sdk
```

## Quick start

```javascript
import { AuthClient } from 'auth-sdk'

const client = new AuthClient({
  provider: 'google',
  clientId: process.env.CLIENT_ID,
})

const user = await client.authenticate(code)
```

## Documentation

Visit [docs.auth-sdk.dev](https://docs.auth-sdk.dev) for full API reference.

## Support

- Report bugs via [GitHub Issues](../../issues)
- Community support on [Discord](https://discord.gg/example)

## License

[MIT](LICENSE)
````

### Incorrect

````markdown
# Auth SDK

This is a seamless and powerful authentication library that allows developers to easily integrate robust OAuth2 functionality.

## Why Use This?

Basically, this library is just amazing and will revolutionize how you handle auth.

## Installation

Simply run the following command to install:

```bash
npm install auth-sdk
```

## API Documentation

### AuthClient Class

#### Constructor

constructor(options: AuthOptions)

[...full API docs inline, should link to external docs...]

## License

MIT License

Copyright (c) 2026 Example Corp

[...full license text, should reference LICENSE file...]
````
