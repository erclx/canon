---
description: Enforce FastAPI router, dependency injection, and async handler patterns
paths:
  - '**/*.py'
---

# FastAPI standards

## Project structure

- Mount routes through `APIRouter` modules. Do not register handlers directly on `FastAPI()`.
- Group routers by feature under `src/<pkg>/api/` and include them from the root app factory.
- Use an `app_factory()` callable over a module-level `app = FastAPI()` for testability.

## Handlers

- Define path operations as `async def` unless the handler is purely CPU-bound.
- Do not perform blocking I/O inside `async def`. Use async clients or `run_in_threadpool`.
- Annotate path, query, and body parameters explicitly. Do not rely on `**kwargs`.
- Return pydantic models and set `response_model=` on the decorator for serialization control.

## Dependency injection

- Express shared logic (auth, db sessions, settings) as `Depends(...)` over decorators or globals.
- Use `Annotated[T, Depends(...)]` over default-value `Depends()` for reusable dependencies.
- Scope db sessions per request via a generator dependency that yields then closes.

## Lifespan and configuration

- Use the `lifespan` context manager for startup and shutdown over deprecated `@app.on_event`.
- Load settings via `pydantic_settings.BaseSettings`, injected through a cached dependency.

## Errors

- Raise `HTTPException` for client-facing errors with explicit status codes.
- Register `@app.exception_handler` mappings for domain exceptions over per-route try/except.
- Do not leak internal exception messages. Map to safe summaries at the boundary.

## Validation and security

- Validate request bodies through pydantic models. Do not parse `Request.json()` manually.
- Apply `dependencies=[Depends(auth)]` at the router or app level for cross-cutting auth.
- Configure CORS, trusted hosts, and HTTPS redirects through middleware, not per-route checks.
