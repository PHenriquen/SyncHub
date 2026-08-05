import { execFile } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = process.cwd();
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.css', '.scss']);
const ignoredDirectories = new Set(['node_modules', '.git', '.next', '.synchub', 'dist', 'coverage', 'data', 'backups', 'releases']);
const forbiddenTrackedSegments = new Set(['node_modules', '.next', '.synchub', 'dist', 'release', 'releases', 'backups', 'coverage']);
const maximumLines = 450;
const maximumTrackedBytes = 2_000_000;
const problems = [];

async function trackedFiles() {
  try {
    const { stdout } = await execFileAsync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root });
    const files = stdout.split('\0').filter(Boolean);
    if (files.length) return files;
  } catch {
    // A downloaded source archive may not be a Git repository yet.
  }

  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (ignoredDirectories.has(entry.name)) continue;
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolutePath);
      else if (entry.name !== '.env') files.push(relative(root, absolutePath).replaceAll('\\', '/'));
    }
  }
  await walk(root);
  return files;
}

for (const repositoryPath of await trackedFiles()) {
  const segments = repositoryPath.split('/');
  const absolutePath = join(root, repositoryPath);

  if (segments.some((segment) => forbiddenTrackedSegments.has(segment))) {
    problems.push(`Generated content is tracked: ${repositoryPath}`);
  }
  if (segments.at(-1) === '.env') {
    problems.push(`Secret environment file is tracked: ${repositoryPath}`);
  }

  let metadata;
  try { metadata = await stat(absolutePath); } catch (error) {
    if (error?.code === 'ENOENT') continue;
    throw error;
  }
  if (metadata.size > maximumTrackedBytes) {
    problems.push(`Tracked file is larger than 2 MB: ${repositoryPath}`);
  }

  if (sourceExtensions.has(extname(repositoryPath))) {
    const content = await readFile(absolutePath, 'utf8');
    const lines = content.split(/\r?\n/).length;
    if (lines > maximumLines) {
      problems.push(`${repositoryPath} has ${lines} lines; limit is ${maximumLines}`);
    }
  }
}

if (problems.length) {
  console.error('Repository quality check failed:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log('Repository quality check passed.');
