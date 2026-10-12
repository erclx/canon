---
description: Enforce pydantic v2 patterns for validation and serialization
paths:
  - '**/*.py'
---

# Pydantic standards

## Models

- Use `pydantic.BaseModel` over `dataclass` at I/O and API boundaries.
- Use `model_config = ConfigDict(...)` over the legacy nested `Config` class.
- Set `extra="forbid"` on models receiving external input to prevent data pollution.
- Use `Field(...)` for defaults, descriptions, and constraints over docstring conventions.

## Validation

- Use `Model.model_validate(data)` over `Model(**data)` for untrusted dict input.
- Use `Model.model_validate_json(s)` over `json.loads` followed by validation.
- Use `@field_validator` over the legacy `@validator`.
- Use `@model_validator(mode="after")` for cross-field invariants.

## Types

- Use `AnyUrl`, `EmailStr`, `SecretStr`, and `PositiveInt` over hand-rolled regex constraints.
- Use `Annotated[T, Field(...)]` over default-value `Field(...)` for reusable constrained types.
- Do not use `Any` in fields. Reach for `JsonValue` or a `Union` of concrete types.

## Settings

- Use `pydantic_settings.BaseSettings` for env-driven configuration.
- Load environment through a single `Settings` model. Do not read `os.environ` directly elsewhere.

## Serialization

- Use `model.model_dump(mode="json")` over the legacy `.dict()`.
- Use `model.model_dump_json()` over `json.dumps(model.dict())`.
- Use `by_alias=True` when serializing to external schemas with non-Python field names.
