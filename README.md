# Synchub

A GitHub-first development synchronization and traceability platform built as a modular
TypeScript monorepo. Version 0.4.0 connects repositories, delivery events and tasks through the
Synchronization Network.

## Synchronization Network

- connect a GitHub repository to a Synchub project;
- process signed `push`, `pull_request` and workflow webhooks;
- infer task keys such as `SYNC-12` from delivery text;
- link commits and pull requests to the work they deliver;
- inspect connection health, runs, errors and the last network pulse;
- manually reconcile a connection from the Sync center.

## One-click local mode

On Windows, extract the project and run only:

```text
SYNCHUB.bat
```

The first run installs Node.js when needed, installs npm dependencies, generates secure local
configuration, creates the embedded SQLite database, seeds it, validates the source, builds the
applications and starts the API and web interface. Later runs only validate the installation state
and start Synchub.

No Docker, PostgreSQL or Redis installation is required for the saved local foundation.

- Web: `http://localhost:3000`
- API: `http://localhost:3333/api/v1`
- Swagger: `http://localhost:3333/docs`
- Demo login: `demo@synchub.local` / `Synchub123!`

## Architecture

- `apps/api`: modular NestJS API;
- `apps/web`: Next.js application;
- `packages/contracts`: shared Zod contracts;
- Prisma + embedded SQLite for the zero-configuration local foundation;
- signed, deduplicated and task-aware GitHub webhook processing;
- persistent synchronization state and run history.

See `README.pt-BR.md`, `STATUS.md`, and `docs/HANDOFF.md`.
