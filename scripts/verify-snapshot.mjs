import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const version = (await readFile(join(root, 'VERSION'), 'utf8')).trim();
const requiredFiles = [
  'README.md',
  'README.pt-BR.md',
  'STATUS.md',
  'docs/ARCHITECTURE.md',
  'docs/BACKUP.md',
  'docs/HANDOFF.md',
  'SYNCHUB.bat',
  'scripts/oneclick.ps1',
  'scripts/bootstrap.ps1',
  'scripts/backup.ps1',
  'scripts/restore.ps1',
  'scripts/release.ps1',
  'apps/api/prisma/schema.prisma',
  'apps/web/src/components/projects/project-view.tsx',
];

const problems = [];
for (const file of requiredFiles) {
  try { await access(join(root, file)); }
  catch { problems.push(`Required snapshot file is missing: ${file}`); }
}

for (const file of ['package.json', 'apps/api/package.json', 'apps/web/package.json', 'packages/contracts/package.json']) {
  const manifest = JSON.parse(await readFile(join(root, file), 'utf8'));
  if (manifest.version !== version) problems.push(`${file} version ${manifest.version} does not match ${version}`);
}

const rootManifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
if (rootManifest.devDependencies?.concurrently) problems.push('concurrently should not be required for local startup');

const environment = await readFile(join(root, '.env.example'), 'utf8');
if (environment.includes('REDIS_URL')) problems.push('Unused Redis configuration is still present');

const schema = await readFile(join(root, 'apps/api/prisma/schema.prisma'), 'utf8');
if (!schema.includes('provider = \"sqlite\"')) problems.push('Portable foundation must use embedded SQLite');
for (const model of ['User', 'Workspace', 'Project', 'Task', 'TaskComment', 'GitHubRepository', 'GitHubWebhookDelivery', 'SyncRun', 'ActivityEvent']) {
  if (!schema.includes(`model ${model} `)) problems.push(`Prisma model is missing: ${model}`);
}

const dashboard = await readFile(join(root, 'apps/web/src/components/dashboard/dashboard-view.tsx'), 'utf8');
if (/demoColumns|demoProjects|demoActivity/.test(dashboard)) problems.push('Dashboard still depends on demonstration data');

if (problems.length) {
  console.error('Snapshot verification failed:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
console.log(`Synchub v${version} snapshot verification passed.`);
