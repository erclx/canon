---
description: Enforce strict Python type hints, casing, and import patterns
paths:
  - '**/*.py'
---

# Python standards

## Casing conventions

- Use `snake_case` for modules, functions, variables, and methods.
- Use `PascalCase` for classes, type aliases, `TypeVar`, and `ParamSpec`.
- Use `UPPER_SNAKE_CASE` for module-level constants and environment variables.
- Use `_leading_underscore` for module-private names. Reserve `__dunder__` for the standard protocol.

## Type hints

- Annotate all public functions, methods, and class attributes.
- Use `X | None` over `Optional[X]` and `X | Y` over `Union[X, Y]`.
- Use built-in generics (`list[str]`, `dict[str, int]`) over `typing.List` and `typing.Dict`.
- Avoid `from __future__ import annotations` in modules that pydantic, FastAPI, or other libraries introspect at runtime.
- Use `typing.Protocol` for structural typing over abstract base classes for interfaces.
- Do not use `Any`. Reach for `object` or `typing.cast` at boundaries instead.

## Errors

- Raise specific built-in exceptions over bare `Exception`.
- Define a project-rooted exception hierarchy for domain errors.
- Catch the narrowest exception class. Never use bare `except:`.
- Re-raise with `raise ... from err` to preserve the cause chain.

## Data shapes

- Use `dataclasses.dataclass(frozen=True, slots=True)` for internal value objects.
- Use `enum.Enum` or `enum.StrEnum` for closed sets over module-level constants.
- Prefer `pathlib.Path` over `os.path` for filesystem paths.

## Imports and modules

- Use absolute imports rooted at the package. Do not use parent-relative (`from ..pkg`) imports.
- Do not alias imports to shorten internal names. Ecosystem conventions (`numpy as np`, `pandas as pd`) are exceptions.
- Do not place executable code at module scope. Guard with `if __name__ == "__main__":`.
