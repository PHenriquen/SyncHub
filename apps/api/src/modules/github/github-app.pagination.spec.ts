import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { GitHubAppClient } from './github-app.client.js';

const config = {
  get: (key: string) => (key === 'GITHUB_API_URL' ? 'https://api.github.test' : undefined),
} as ConfigService;

function repository(id: number) {
  return {
    id,
    name: `repo-${id}`,
    full_name: `PHenriquen/repo-${id}`,
    default_branch: 'main',
    private: false,
    owner: { login: 'PHenriquen' },
  };
}

test('GitHub App discovery paginates until all repositories are retrieved', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const pages: number[] = [];
  globalThis.fetch = async (input) => {
    const page = Number(new URL(String(input)).searchParams.get('page'));
    pages.push(page);
    const repositories = page === 1
      ? Array.from({ length: 100 }, (_, index) => repository(index + 1))
      : [repository(101), repository(102)];
    return Response.json({ total_count: 102, repositories });
  };

  const result = await new GitHubAppClient(config).listInstallationRepositories(7n, 'token');
  assert.deepEqual(pages, [1, 2]);
  assert.equal(result.length, 102);
  assert.equal(new Set(result.map((item) => item.repositoryId)).size, 102);
});

test('GitHub App discovery rejects an incomplete final page', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => Response.json({
    total_count: 2,
    repositories: [repository(1)],
  });

  await assert.rejects(
    () => new GitHubAppClient(config).listInstallationRepositories(7n, 'token'),
    ServiceUnavailableException,
  );
});

test('GitHub App discovery rejects missing or invalid counts', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  for (const payload of [
    { repositories: [repository(1)] },
    { total_count: -1, repositories: [repository(1)] },
    { total_count: '1', repositories: [repository(1)] },
  ]) {
    globalThis.fetch = async () => Response.json(payload);
    await assert.rejects(
      () => new GitHubAppClient(config).listInstallationRepositories(7n, 'token'),
      ServiceUnavailableException,
    );
  }
});
