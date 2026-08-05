import { spawn } from 'node:child_process';

const commands = [
  ['API', ['run', 'start:dev', '-w', '@synchub/api']],
  ['WEB', ['run', 'dev', '-w', '@synchub/web']],
];

function spawnNpm(args) {
  const npmCli = process.env.npm_execpath;
  const useNpmCli = Boolean(npmCli);

  return spawn(useNpmCli ? process.execPath : 'npm', useNpmCli ? [npmCli, ...args] : args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: process.env,
    // Node.js 24 no longer launches Windows .cmd files directly. npm_execpath
    // normally lets us execute npm-cli.js with node.exe; the shell is only a
    // fallback for direct `node scripts/dev.mjs` usage.
    shell: process.platform === 'win32' && !useNpmCli,
  });
}

const children = commands.map(([name, args]) => {
  const child = spawnNpm(args);

  for (const stream of [child.stdout, child.stderr]) {
    stream?.on('data', (chunk) => {
      for (const line of String(chunk).split(/\r?\n/)) {
        if (line) process.stdout.write(`[${name}] ${line}\n`);
      }
    });
  }

  child.on('exit', (code) => {
    if (code && code !== 0) shutdown(code);
  });
  child.on('error', (error) => {
    process.stderr.write(`[${name}] Nao foi possivel iniciar: ${error.message}\n`);
    shutdown(1);
  });
  return child;
});

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 250).unref();
}

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
