# SyncHub

SyncHub é um projeto local de rastreabilidade de desenvolvimento que liga repositórios do GitHub, tarefas e histórico de entregas.

A ideia é conseguir olhar para uma tarefa e entender quais commits ou pull requests realmente fizeram parte daquela entrega. Chaves como `SYNC-12` podem ser encontradas no texto de commits/PRs e associadas ao trabalho correspondente.

> Versão atual: `0.4.0`. O foco é o uso local; o projeto não é tratado como um SaaS em produção.

## O que funciona nesta versão

- conexão de um repositório GitHub com um projeto;
- recebimento de webhooks assinados de `push`, `pull_request` e workflows;
- deduplicação das entregas recebidas;
- associação de commits e pull requests a tarefas;
- histórico de sincronizações e erros;
- reconciliação manual de uma conexão.

## Inicialização local no Windows

`SYNCHUB.bat` continua na raiz como o único atalho principal. Ele chama o fluxo de preparação/inicialização que fica em `scripts/oneclick.ps1`.

Na primeira execução, esse fluxo pode preparar Node/npm, configuração local, banco SQLite e dependências antes de iniciar a API e a interface.

Também é possível trabalhar direto pelos scripts npm:

```powershell
npm install
npm run check
npm run test
npm run dev
```

Endereços padrão:

- interface: `http://localhost:3000`
- API: `http://localhost:3333/api/v1`
- Swagger: `http://localhost:3333/docs`

## Estrutura

```text
apps/api           API NestJS e Prisma
apps/web           interface Next.js
packages/contracts contratos Zod compartilhados
scripts            inicialização, backup e verificações
tests              testes do código-fonte
```

O modo local usa SQLite e não exige PostgreSQL ou Redis para começar.

## Utilitários do Windows

Os atalhos de manutenção não ficam mais espalhados na raiz. Eles estão em `scripts/windows/`:

- `backup.bat`
- `restore.bat`
- `release.bat`
- `doctor.bat`

Os scripts PowerShell correspondentes continuam em `scripts/`.

## SyncHub e SincroHub

São projetos diferentes apesar dos nomes parecidos.

**SyncHub** trabalha com sincronização/rastreabilidade de desenvolvimento no GitHub. **SincroHub** é um projeto posterior de monitoramento operacional, telemetria e incidentes.

## Mais detalhes

Consulte `STATUS.md` para o estado atual da implementação e `docs/HANDOFF.md` para as anotações técnicas.
