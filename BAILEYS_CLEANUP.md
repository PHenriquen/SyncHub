BAILEYS_AUTH - Guia de limpeza segura

Objetivo: reduzir o espaço usado pela pasta `baileys_auth` sem perder sessão (evitar refazer pareamento).

O que o script faz:
- Mantém arquivos essenciais: `creds.json` (obrigatório), `device-list-*.json`, `app-state-sync-*`, `lid-mapping-*` (não removidos).
- Compacta (gzip) e move arquivos `pre-key-*.json` antigos para `baileys_auth/archived/`.
- Evita apagar qualquer `creds.json` — se faltar, o script aborta.

Uso:
- Listar o que seria removido (modo seguro):
  node prune_baileys_auth.js --keep=30 --dry-run

- Executar a limpeza (mantém 30 pre-keys por padrão):
  node prune_baileys_auth.js --keep=30

Notas e recomendações:
- Ajuste `--keep=N` conforme desejar. Recomendo manter pelo menos N>=10 para segurança.
- Os arquivos arquivados são `.gz` e podem ser descompactados quando necessário.
- Faça um backup adicional antes, se preferir (por exemplo, copiar `baileys_auth` para outro local).

Se quiser, eu posso executar primeiro um dry-run e te mostrar a lista antes de compactar de fato.