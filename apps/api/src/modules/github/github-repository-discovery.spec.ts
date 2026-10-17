import assert from 'node:assert/strict';
import test from 'node:test';
import { parseInstallationRepositoryPage } from './github-repository-discovery.js';

const repository = {
  id: 42,
  name: 'SyncHub',
  full_name: 'PHenriquen/SyncHub',
  default_branch: 'main',
  private: false,
  owner: { login: 'PHenriquen' },
};

test('normalizes a valid installation repository page', () => {
  assert.deepEqual(parseInstallationRepositoryPage({ repositories: [repository] }), [
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

test('allows an explicitly empty repository page', () => {
  assert.deepEqual(parseInstallationRepositoryPage({ repositories: [] }), []);
});

test('rejects missing repository list instead of treating it as an empty installation', () => {
  assert.throws(() => parseInstallationRepositoryPage({ total_count: 3 }), /invalid page/);
});

test('rejects malformed repository data', () => {
  for (const malformed of [
    { ...repository, id: Number.MAX_SAFE_INTEGER + 1 },
    { ...repository, private: 'false' },
    { ...repository, owner: null },
    { ...repository, full_name: 'Another/SyncHub' },
    { ...repository, default_branch: '' },
  ]) {
    assert.throws(() => parseInstallationRepositoryPage({ repositories: [malformed] }), /invalid repository/);
  }
});
