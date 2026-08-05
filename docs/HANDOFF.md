# Development handoff

This is the restart point after the Synchronization Network v0.4.0.

## Product position

Synchub is not a generic Kanban. Its differentiator is engineering traceability. Every task should
be able to explain which branch, commits, pull request, review and release delivered it.

## Current synchronization boundary

The signed webhook flow now processes `push`, `pull_request` and workflow events, infers task
keys, creates `GitHubLink` records and updates repository sync health. The Sync center exposes
connections, runs and manual reconciliation. Pull requests are no longer an empty state.

## First next milestone: GitHub App installation

Implement in this order:

1. create a GitHub App and installation callback flow;
2. discover and persist accessible repositories without manual IDs;
3. add scheduled incremental reconciliation through the GitHub API;
4. move tasks to `IN_REVIEW` when a linked pull request opens;
5. mark tasks complete when their linked pull request merges;
6. add user-configurable automation rules.

## Technical constraints

- keep the modular monolith until measured load justifies extraction;
- keep SQLite for the portable local foundation;
- introduce a separate PostgreSQL production profile only with deployment work;
- never store GitHub App private keys in the database or repository;
- preserve delivery IDs for idempotency;
- keep source files below 450 lines;
- add contracts and tests for every domain change.

## Resume checklist

1. read `STATUS.md` and this document;
2. run `SYNCHUB.bat`;
3. run `npm run check`, `npm run test` and `npm run build`;
4. create a feature branch for the GitHub App milestone.
