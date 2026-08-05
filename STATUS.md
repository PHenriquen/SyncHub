# Synchub status

## Saved foundation

- Version: **0.4.0**
- Milestone: **Synchronization Network**
- State: ready to archive and resume later
- Next milestone: GitHub App installation flow and background synchronization

## Stable boundaries

- `apps/api`: modular NestJS monolith;
- `apps/web`: Next.js application using the REST API;
- `packages/contracts`: shared validation without API coupling;
- embedded SQLite: zero-configuration local source of truth;
- GitHub integration: signed webhooks, delivery deduplication and task-key linking;
- Sync Engine: repository state, synchronization runs, errors and manual reconciliation.

## Completed core flows

1. Install and start from one `SYNCHUB.bat` file.
2. Register or log in.
3. Access a workspace under role-based authorization.
4. Create and inspect projects.
5. Create tasks and move them through delivery states.
6. View assigned work, activity and members.
7. Record comments and immutable activity events.
8. Back up and restore local source, configuration and database.
9. Connect repositories to projects in the Sync center.
10. Link incoming commits and pull requests to tasks through keys such as `SYNC-12`.
11. Inspect repository health and synchronization history.

## Deliberately deferred

- GitHub App installation flow;
- GitHub App OAuth installation and repository discovery;
- invitations and membership administration;
- search, notifications and scheduled background jobs;
- PostgreSQL production deployment profile.

Resume from [docs/HANDOFF.md](docs/HANDOFF.md).
