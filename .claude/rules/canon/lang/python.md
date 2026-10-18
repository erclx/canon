---
description: Enforce strict Python type hints, exception handling, data shapes, and import patterns
paths:
  - '**/*.py'
---

# Python standards

## Type hints

- Annotate every public function and method, since a type checker skips the body of an unannotated function.
- Use `X | None`, `X | Y`, and built-in generics such as `list[str]` over `Optional`, `Union`, and `typing.List`.
- Do not add `from __future__ import annotations`. Python plans to deprecate and remove it.
- Use `typing.Protocol` for an interface a class satisfies by shape, over an abstract base class it must subclass.
- Type a value that can be anything as `object` and narrow it. Never use `Any`, which turns checking off.

## Errors

- Raise a specific built-in exception or one from a project-rooted hierarchy, never bare `Exception`.
- Catch the narrowest exception class. Never use bare `except:`.
- Re-raise with `raise ... from err` to preserve the cause chain.

## Data shapes

- Use `dataclasses.dataclass(frozen=True, slots=True)` for internal value objects.
- Use `enum.Enum` or `enum.StrEnum` for closed sets over module-level constants.
- Prefer `pathlib.Path` over `os.path` for filesystem paths.

## Imports and modules

- Use absolute imports rooted at the package over relative ones.
- Do not alias imports to shorten internal names. Ecosystem conventions (`numpy as np`, `pandas as pd`) are exceptions.
- Do not place executable code at module scope. Guard it with `if __name__ == "__main__":` and call a `main` function.
