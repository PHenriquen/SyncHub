# SyncHub

SyncHub is a local development-traceability project built around GitHub repositories, tasks and delivery history.

The part I care about most is connecting work items to what actually reached the repository. A task key mentioned in a commit or pull request can be associated with that delivery, while webhook runs keep the synchronization history visible instead of hiding it behind a background job.

> Current version: `0.4.0`. The local flow is the main target; this is not a hosted SaaS product.

## What it does

- connects a GitHub repository to a SyncHub project;
- receives signed `push`, `pull_request` and workflow webhooks;
- deduplicates webhook deliveries;
- finds task keys such as `SYNC-12` in delivery text;
- links commits and pull requests to tasks;
- stores synchronization runs and errors;
- allows a connection to be reconciled manually when needed.

## Main flow

```text
GitHub event
    ↓
signed webhook
    ↓
validate + deduplicate
    ↓
find project / task references
    ↓
store delivery history
    ↓
show connection state and runs
```

## Structure

```text
apps/
├── api/          # NestJS API and Prisma data layer
└── web/          # Next.js interface

packages/
└── contracts/    # shared Zod contracts

scripts/          # setup, development, backup and checks
tests/            # source-level tests
```

The local setup uses SQLite so the project can be opened without requiring PostgreSQL or Redis first.

## Stack

| Part | Technology |
|---|---|
| API | NestJS + TypeScript |
| Web | Next.js + TypeScript |
| Database | Prisma + SQLite |
| Validation | Zod |
| Tests | Node Test Runner + workspace tests |

## Running locally

Requirements:

- Node.js 22+
- npm 10+

On Windows, `SYNCHUB.bat` is kept as the single root shortcut for the local setup/start flow. The PowerShell scripts it calls live under `scripts/`.

You can also work with the project directly:

```bash
npm install
npm run check
npm run test
npm run dev
```

The web interface uses port `3000` and the API uses `3333` in the default local configuration.

## Repository maintenance

Backup, restore, diagnostics and source-snapshot helpers are under `scripts/windows/` instead of being separate launchers in the repository root.

The source checks also keep application files from growing indefinitely; when a module starts owning unrelated behavior, I prefer splitting that responsibility before adding more code to it.

## SyncHub vs. SincroHub

The names are close, but they are different projects.

**SyncHub** is about software-development synchronization and traceability around GitHub. **SincroHub** is a newer operations/monitoring project built around telemetry and incidents.

## More information

- [`README.pt-BR.md`](README.pt-BR.md) — Portuguese notes;
- [`STATUS.md`](STATUS.md) — current implementation status;
- [`docs/HANDOFF.md`](docs/HANDOFF.md) — technical handoff notes.

## License

MIT — see [LICENSE](LICENSE).
