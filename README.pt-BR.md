# Synchub

Central inteligente de desenvolvimento que conecta projetos, tarefas, equipe e GitHub em um
único fluxo operacional. A versão 0.4.0 introduz o Sync Engine: commits e pull requests podem
ser associados automaticamente a tarefas por chaves como `SYNC-12`.

## O que sincroniza nesta versão

- repositórios do GitHub conectados a projetos;
- eventos assinados de `push`, `pull_request` e workflows;
- commits e pull requests ligados automaticamente às tarefas;
- histórico de execuções, erros e último pulso de cada conexão;
- atividades da entrega exibidas para toda a equipe;
- reconciliação manual pelo botão **Sync now**.

Acesse **Sync center** na navegação lateral para acompanhar a rede.

## Inicialização em um clique

No Windows, extraia a pasta e execute apenas:

```text
SYNCHUB.bat
```

Na primeira execução, o mesmo arquivo:

1. instala o Node.js LTS automaticamente quando ele não estiver presente;
2. cria o ambiente local e segredos de sessão;
3. instala os pacotes npm;
4. cria o banco SQLite local;
5. aplica o modelo do banco e cria os dados iniciais;
6. executa verificações, testes e build;
7. inicia API e interface;
8. abre o navegador.

Nas próximas execuções, `SYNCHUB.bat` apenas verifica se algo mudou e inicia o projeto. **Docker,
PostgreSQL e Redis não são necessários para este modo local.**

## Endereços

- Interface: `http://localhost:3000`
- API: `http://localhost:3333/api/v1`
- Swagger: `http://localhost:3333/docs`

Conta inicial:

- e-mail: `demo@synchub.local`
- senha: `Synchub123!`

## Arquivos importantes

- `SYNCHUB.bat`: único iniciador e instalador;
- `data/synchub.db`: banco local, ignorado pelo Git;
- `CRIAR_BACKUP_SYNCHUB.bat`: cria backup do banco, ambiente e código;
- `RESTAURAR_BACKUP_SYNCHUB.bat`: restaura um backup;
- `VERIFICAR_SYNCHUB.bat`: mostra o diagnóstico do ambiente.

## Estrutura

```text
apps/api          API NestJS
apps/web          interface Next.js
packages/contracts validações e contratos compartilhados
apps/api/prisma   modelo Prisma para SQLite local
scripts           instalação, inicialização, backup e validação
```

## Desenvolvimento manual

Após a primeira execução:

```powershell
npm run dev
npm run check
npm run test
npm run build
```

Leia `STATUS.md` e `docs/HANDOFF.md` antes de retomar o próximo marco.
