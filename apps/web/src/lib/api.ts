import type { WorkspaceSummary } from './domain';

export const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest(path: string, init: RequestInit = {}) {
  const request = () =>
    fetch(`${apiUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...init.headers,
      },
    });

  let response = await request();
  const refreshExcluded = new Set(['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']);
  if (response.status !== 401 || refreshExcluded.has(path)) return response;

  const refresh = await fetch(`${apiUrl}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!refresh.ok) return response;

  response = await request();
  return response;
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiRequest(path, init);
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) message = body.message.join(', ');
      else if (body.message) message = body.message;
    } catch {
      // The response did not contain JSON.
    }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function getPrimaryWorkspace() {
  const workspaces = await apiJson<WorkspaceSummary[]>('/workspaces');
  const workspace = workspaces[0];
  if (!workspace) throw new ApiError('No workspace is available for this account', 404);
  return workspace;
}

export function requireLogin(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    window.location.assign('/login');
    return true;
  }
  return false;
}
