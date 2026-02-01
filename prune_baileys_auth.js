#!/usr/bin/env node
// prune_baileys_auth.js
// Script seguro para reduzir o tamanho da pasta `baileys_auth` sem perder a sessão.
// - Mantém: `creds.json`, `device-list-*.json`, `app-state-sync*` e outros arquivos importantes
// - Compacta e arquiva: arquivos `pre-key-*.json` antigos (gzip) em `baileys_auth/archived/`
// Uso:
//  node prune_baileys_auth.js --keep=30 [--dry-run]

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream');
const { promisify } = require('util');
const pipe = promisify(pipeline);

async function gzipFile(srcPath, destPath) {
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  const gzip = zlib.createGzip();
  await pipe(fsSync.createReadStream(srcPath), gzip, fsSync.createWriteStream(destPath));
}

function human(size) {
  const units = ['B','KB','MB','GB'];
  let i = 0; while(size >= 1024 && i < units.length-1) { size/=1024; i++; }
  return `${size.toFixed(2)} ${units[i]}`;
}

async function main() {
  const args = process.argv.slice(2);
  const keepArg = args.find(a => a.startsWith('--keep='));
  const keep = keepArg ? parseInt(keepArg.split('=')[1],10) : 30;
  const dryRun = args.includes('--dry-run');

  const base = path.join(__dirname, 'baileys_auth');
  try {
    const stat = await fs.stat(base);
    if (!stat.isDirectory()) throw new Error('`baileys_auth` não é um diretório.');
  } catch (e) {
    console.error('[ERROR] Diretório `baileys_auth` não encontrado. Nada a fazer.');
    process.exit(1);
  }

  // Verificações de segurança
  const mustKeep = ['creds.json'];
  for (const f of mustKeep) {
    try { await fs.access(path.join(base,f)); } catch(e) {
      console.error(`[ERROR] Arquivo essencial faltando: ${f}. Aborting.`);
      process.exit(1);
    }
  }

  const files = await fs.readdir(base);
  const preKeys = files.filter(f => /^pre-key-\d+\.json$/.test(f));
  if (preKeys.length <= keep) {
    console.log(`[OK] Existem ${preKeys.length} pre-key arquivos — menor ou igual a --keep=${keep}. Nada a remover.`);
    return;
  }

  // Ordena por número (ex: pre-key-1.json ... pre-key-150.json)
  preKeys.sort((a,b) => {
    const na = parseInt(a.match(/(\d+)/)[0],10);
    const nb = parseInt(b.match(/(\d+)/)[0],10);
    return na - nb;
  });

  const toRemove = preKeys.slice(0, preKeys.length - keep);
  if (toRemove.length === 0) { console.log('[OK] Nada a remover.'); return; }

  // Calcula tamanho total e lista
  let totalBytes = 0;
  for (const f of toRemove) {
    const s = await fs.stat(path.join(base,f));
    totalBytes += s.size;
  }

  console.log(`Encontrados ${preKeys.length} arquivos pre-key. Irei manter ${keep} e arquivar ${toRemove.length} (total aprox ${human(totalBytes)}).`);
  if (dryRun) {
    console.log('--- DRY RUN (não será feita nenhuma mudança) ---');
    toRemove.forEach(f => console.log(`  - ${f}`));
    console.log('Use `--dry-run` para listar ou rode sem `--dry-run` para executar.');
    return;
  }

  const archivedDir = path.join(base, 'archived');
  await fs.mkdir(archivedDir, { recursive: true });

  let saved = 0;
  let archivedCnt = 0;

  for (const f of toRemove) {
    const src = path.join(base, f);
    const dest = path.join(archivedDir, f + '.gz');
    try {
      await gzipFile(src, dest);
      const srcStat = await fs.stat(src);
      const destStat = await fs.stat(dest);
      saved += (srcStat.size - destStat.size);
      await fs.unlink(src);
      archivedCnt++;
      console.log(`[ARCHIVED] ${f} -> archived/${f}.gz (${human(srcStat.size)} -> ${human(destStat.size)})`);
    } catch (e) {
      console.error(`[ERROR] Falha ao arquivar ${f}:`, e.message);
    }
  }

  console.log('--- Resumo ---');
  console.log(`Arquivados: ${archivedCnt}`);
  console.log(`Espaço economizado (aprox): ${human(saved)}`);
  console.log('Backup ficou em `baileys_auth/archived/`.');
  console.log('Se algo der errado, você pode extrair os .gz para recuperar os arquivos originais.');
}

main().catch(e => { console.error('[ERROR] Falha inesperada:', e); process.exit(1); });
