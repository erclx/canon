# Contributing to <project>

This page covers getting a working checkout, how to test a change, and the commit and pull request rules the hooks enforce.

## Setup

<Prerequisites, such as the runtime and its minimum version.>

```bash
git clone https://github.com/<owner>/<repo>.git
cd <repo>
<install command>
<check command>
```

<What the install step activates, such as git hooks, and what the check command runs.>

## Layout

| Path     | What it holds |
| -------- | ------------- |
| `<path>` | <role>        |

## Tests

<The commands that run the tests and what each one covers.>

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org), and release-please reads them to cut each release.

- The header reads `<type>(<scope>): <subject>`, such as `fix(server): close the socket on shutdown`
- The header is at most 72 characters
- The first word of the subject is lowercase, and the subject ends with no period

The types are `feat`, `fix`, `refactor`, `docs`, `chore`, `perf`, `test`, `style`, `build`, `ci`, and `revert`.

## Pull requests

Branch from `main` and open the pull request against it. Say what the change does and why, which files it touches, and how you tested it.

CI runs on every pull request, and a pull request merges once it passes. Keep each one to a single concern. A refactor that a feature needs reads better as its own pull request ahead of the feature.

## Releases

release-please cuts every release from the conventional commits on `main`. Each push to `main` keeps one release pull request open, holding the next version and its `CHANGELOG.md` entry. Merging that pull request tags the release.

## AI-assisted contributions

Contributions written with a coding agent are welcome. You are the author of what you submit, so read every line before you open the pull request and be ready to explain it.
