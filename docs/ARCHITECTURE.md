# Architecture

Synchub is a modular monolith inside a TypeScript monorepo.

```text
Next.js web -> NestJS REST API -> Prisma -> embedded SQLite
```

The local foundation intentionally uses SQLite so a saved copy can be restored and started without
Docker or a database server. Domain boundaries remain compatible with introducing a PostgreSQL
production profile later.

Authentication uses short-lived access tokens and rotating refresh tokens stored as hashes.
Workspace membership provides role-based authorization. Tasks, comments, GitHub links and activity
events and synchronization runs form the traceability chain.

The GitHub webhook boundary validates HMAC signatures and stores delivery IDs before processing.
The Sync Engine then resolves the repository, infers task keys, upserts delivery links, records an
activity event and stores a successful or failed run. Delivery deduplication keeps this flow
idempotent.
