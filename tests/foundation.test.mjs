import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('foundation version is consistent', async () => {
  const version = (await read('VERSION')).trim();
  const manifests = await Promise.all([
    read('package.json'),
    read('apps/api/package.json'),
    read('apps/web/package.json'),
    read('packages/contracts/package.json'),
  ]);
  for (const source of manifests) assert.equal(JSON.parse(source).version, version);
});

test('one-click launcher owns installation and startup', async () => {
  const launcher = await read('SYNCHUB.bat');
  const oneClick = await read('scripts/oneclick.ps1');
  const browserWait = await read('scripts/open-when-ready.ps1');
  const developmentLauncher = await read('scripts/dev.mjs');
  assert.match(launcher, /oneclick\.ps1/);
  assert.match(oneClick, /winget install --id OpenJS\.NodeJS\.LTS/);
  assert.match(oneClick, /npm run db:push/);
  assert.match(oneClick, /open-when-ready\.ps1/);
  assert.doesNotMatch(oneClick, /Start-Sleep -Seconds 6/);
  assert.match(browserWait, /Invoke-WebRequest/);
  assert.match(browserWait, /Start-Process \$Url/);
  assert.match(developmentLauncher, /process\.env\.npm_execpath/);
  assert.match(developmentLauncher, /useNpmCli \? process\.execPath : 'npm'/);
  assert.doesNotMatch(developmentLauncher, /'npm\.cmd'/);
  assert.doesNotMatch(oneClick, /docker compose/);
});

test('production build prepares Prisma and pins the monorepo root', async () => {
  const manifest = JSON.parse(await read('package.json'));
  const nextConfig = await read('apps/web/next.config.ts');
  const oneClick = await read('scripts/oneclick.ps1');
  const environmentExample = await read('.env.example');
  assert.match(manifest.scripts.build, /^npm run db:generate &&/);
  assert.match(nextConfig, /turbopack:\s*\{[\s\S]*root: path\.join\(__dirname, '\.\.\/\.\.'\)/);
  assert.match(oneClick, /\$env:NODE_ENV = 'production'[\s\S]*npm run build/);
  assert.doesNotMatch(environmentExample, /^NODE_ENV=/m);
});

test('database model preserves the delivery and synchronization chain', async () => {
  const schema = await read('apps/api/prisma/schema.prisma');
  assert.match(schema, /provider = "sqlite"/);
  for (const model of ['Project', 'Task', 'TaskComment', 'GitHubLink', 'GitHubWebhookDelivery', 'SyncRun', 'ActivityEvent']) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
  }
});

test('synchronization network is exposed by API and web interface', async () => {
  const appModule = await read('apps/api/src/app.module.ts');
  const syncService = await read('apps/api/src/modules/sync/sync.service.ts');
  const sidebar = await read('apps/web/src/components/layout/sidebar.tsx');
  const syncCenter = await read('apps/web/src/components/sync/sync-center-view.tsx');
  assert.match(appModule, /SyncModule/);
  assert.match(syncService, /runManualSync/);
  assert.match(sidebar, /\/sync/);
  assert.match(syncCenter, /Synchronization center/);
});

test('backup and restore preserve the embedded database', async () => {
  const backup = await read('scripts/backup.ps1');
  const restore = await read('scripts/restore.ps1');
  assert.match(backup, /data\/synchub\.db/);
  assert.match(backup, /SHA256SUMS/);
  assert.match(restore, /database\/synchub\.db/);
  assert.doesNotMatch(backup, /pg_dump/);
  assert.doesNotMatch(restore, /pg_restore/);
});
