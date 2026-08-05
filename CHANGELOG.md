# Changelog

## 0.4.0 — Synchronization Network

- added a dedicated Sync center with connected repositories, network health and sync history;
- added persistent synchronization runs, error state and last-synchronized timestamps;
- added repository connection and manual reconciliation from the web interface;
- process signed GitHub push, pull-request and workflow events into the activity stream;
- infer task keys such as `SYNC-12` and create traceable commit/PR links automatically;
- replaced the pull-request placeholder with synchronized delivery data;
- added representative synchronized demo data while keeping the SQLite one-click setup;
- preserved the Node.js 24 Windows launcher fix and readiness-based browser startup.

## 0.3.2 - Work-mode type safety fix

- Corrected the JWT cookie extractor to return `string | null`, matching `passport-jwt`.
- Replaced narrow tuple `includes` usage with a typed terminal-status set.
- Preserved resumable one-click setup so existing dependencies are not reinstalled.

## 0.3.1 — TypeScript 6 compatibility hotfix

- Removed the deprecated API `baseUrl` option; TypeScript now resolves modules through standard NodeNext rules.
- Made the one-click preparation resumable after a failed validation instead of reinstalling dependencies.
- Added staged preparation state and clearer recovery messages.
- Kept the single `SYNCHUB.bat` entry point for installation and startup.

## 0.3.0 — One-Click Local Foundation

- replaced the Docker/PostgreSQL requirement with an embedded SQLite local database;
- added `SYNCHUB.bat` as the single installer, repair entrypoint and launcher;
- added automatic Node.js LTS installation through winget when needed;
- made dependency installation, database setup, seed, tests and build automatic;
- updated backup and restore to preserve the portable SQLite database;
- added automatic browser opening and installation-state validation.

## 0.2.1 — First-run usability fix

- `INICIAR_SYNCHUB.bat` now detects a fresh installation and runs preparation automatically;
- added clearer Portuguese startup and failure messages;
- retained `PREPARAR_SYNCHUB.bat` for explicit environment validation and repair.

## 0.2.0 — Foundation Complete

- replaced demonstration data with PostgreSQL-backed pages;
- added real project and task creation flows;
- added assigned-work, activity and team views;
- added registration and session-aware navigation;
- added task comments to the API;
- made refresh-token rotation atomic against concurrent reuse;
- added request-origin protection for cookie-authenticated mutations;
- added live and readiness health endpoints;
- persisted GitHub webhook deliveries for replay protection;
- removed unused Redis infrastructure;
- added environment doctor, secure bootstrap, backup, restore and source release tooling;
- added snapshot verification and dependency-free foundation tests;
- documented the exact handoff point for future development.

## 0.1.0 — Initial Foundation

- established the Next.js, NestJS, Prisma and PostgreSQL monorepo;
- created the first dashboard, domain model and authentication boundary.
