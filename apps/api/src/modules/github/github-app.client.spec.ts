import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConfigService } from '@nestjs/config';
import { GitHubAppClient } from './github-app.client.js';

const config = {
  get: (key: string) => (key === 'GITHUB_API_URL' ? 'https://api.github.test' : undefined),
} as ConfigService;

test('GitHubAppClient normalizes installation repositories', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (input, init) => {
    assert.equal(
      String(input),
      'https://api.github.test/installation/repositories?per_page=100&page=1',
    );
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer installation-token');

    return new Response(
      JSON.stringify({
        repositories: [
          {
            id: 42,
            name: 'SyncHub',
            full_name: 'PHenriquen/SyncHub',
            default_branch: 'main',
            private: false,
            owner: { login: 'PHenriquen' },
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  const repositories = await new GitHubAppClient(config).listInstallationRepositories(
    7n,
    'installation-token',
  );

  assert.deepEqual(repositories, [
    {
      repositoryId: 42,
      owner: 'PHenriquen',
      name: 'SyncHub',
      fullName: 'PHenriquen/SyncHub',
      defaultBranch: 'main',
      private: false,
    },
  ]);
});
