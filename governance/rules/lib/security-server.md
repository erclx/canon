---
description: Enforce server-side authorization, secret handling, and abuse limits on request handlers
paths:
  - '**/*.py'
  - '**/*.ts'
  - '**/*.js'
  - '**/*.go'
  - '**/*.php'
---

# Server security standards

## Authorization

- Authorize every request on the server, whatever the client already checked.
- Derive the caller identity from the verified session or token. Never read it from a request body, query string, or header the client sets.
- Check that the caller owns or may reach the specific record a request names, not only that the caller is signed in.
- Deny by default. Grant a route access through an explicit allow.

## Credentials

- Hash passwords with Argon2id, or scrypt or bcrypt where it is missing, and a per-password salt. Never store a reversible password.
- Compare tokens, signatures, and password hashes with a constant-time function.
- Expire and revoke sessions and refresh tokens on the server. Do not rely on client-side deletion.

## Secrets

- Read every secret from the environment or a secret manager at runtime.
- Never commit a secret, connection string, or private key to the repository.
- Never return a secret, connection string, stack trace, or internal hostname in a response body.

## Abuse limits

- Rate-limit authentication, password reset, and any endpoint that sends mail or costs money per call.
- Set an explicit maximum body size and request timeout on every endpoint.
- Bound pagination parameters with a server-side maximum.

## Transport

- Serve every route over TLS. Fail a plaintext API request rather than redirecting it.
- List CORS origins explicitly whenever credentials are allowed, since a wildcard is refused then. Never reflect the request origin.
