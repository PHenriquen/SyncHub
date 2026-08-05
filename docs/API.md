# API surface — v0.4

Base URL: `/api/v1`

## Health and public session endpoints

- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /github/webhooks`

## Authenticated endpoints

- `GET /auth/me`
- `GET /workspaces`
- `POST /workspaces`
- `GET /workspaces/:workspaceId/members`
- `GET /projects?workspaceId=...`
- `GET /projects/:projectId`
- `POST /projects`
- `GET /tasks?projectId=...`
- `GET /tasks/assigned?workspaceId=...`
- `POST /tasks`
- `PATCH /tasks/:taskId/status`
- `GET /tasks/:taskId/comments`
- `POST /tasks/:taskId/comments`
- `GET /activity?workspaceId=...&limit=30`
- `GET /dashboard?workspaceId=...`
- `GET /sync/overview?workspaceId=...`
- `GET /sync/pull-requests?workspaceId=...`
- `POST /sync/repositories`
- `POST /sync/repositories/:repositoryId/run`

Swagger is exposed at `/docs` while the API is running.

## Authorization order

```text
VIEWER < MEMBER < ADMIN < OWNER
```

Read operations require `VIEWER`. Creating or updating delivery work requires `MEMBER`.
Connecting a repository requires `ADMIN`; manual synchronization requires `MEMBER`.
