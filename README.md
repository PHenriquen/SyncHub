# SyncHub 2026

Plataforma inteligente de organizacao, comunicacao e automacao.

## Resumo rapido
O SyncHub centraliza mensagens, tarefas, calendario e automacoes em um unico fluxo operacional.
A proposta e reduzir ruido digital e transformar entradas dispersas em decisoes e acoes claras.

## 1. Visao geral
O **SyncHub** nasce como um organizador pessoal avancado e evolui para uma camada inteligente entre o usuario e seu ecossistema digital.

Direcao do produto:
- Centralizar comunicacao multicanal
- Priorizar o que importa em tempo real
- Converter mensagens em execucao (tarefas, eventos, notas)
- Automatizar processos com regras simples e escalaveis

Visao de longo prazo:
- Ser o "sistema operacional" de comunicacao e produtividade do usuario.

## 2. Problema que o SyncHub resolve
Hoje o usuario opera em varios apps ao mesmo tempo:
- Mensagens (WhatsApp, Telegram, Discord, Slack, Teams)
- E-mail
- Calendario
- Ferramentas de tarefas
- Redes sociais

Isso gera:
- Sobrecarga de notificacoes
- Perda de mensagens importantes
- Falta de prioridade
- Desorganizacao de compromissos
- Queda de produtividade

O SyncHub resolve isso com uma camada unica de organizacao, contexto e automacao.

## 3. Estrutura do produto
### 3.1 SyncHub Core (nucleo universal)
Base comum para todos os perfis:
- Inbox unificada com priorizacao automatica
- Buckets inteligentes (`urgent`, `work`, `personal`, `automatic`)
- Modo foco com limiar configuravel
- Conversao de mensagem para tarefa/evento/nota
- Contexto unificado por contato
- Relatorio semanal com score de produtividade
- Dashboard diario com indicadores operacionais

### 3.2 Interface Web (MVP funcional)
A interface web (`/app`) inclui:
- Login/cadastro em modo demo
- Visao Hoje (KPIs, resumo, timeline e distribuicoes)
- Inbox com acoes rapidas e painel de contexto
- Tarefas, Eventos e Notas
- Automacoes, Integracoes, Modulos e Configuracoes
- Tema claro/escuro/auto

### 3.3 Integracoes estrategicas no catalogo
Comunicacao:
- WhatsApp
- Telegram
- Discord
- Slack
- Microsoft Teams

Profissional e organizacao:
- Gmail
- Outlook
- Google Calendar
- Notion
- Trello
- ClickUp

Criadores e leads:
- LinkedIn
- Instagram
- YouTube

## 4. Sistema modular
O SyncHub permite ativacao por perfil:
- **Estudante**: prazos, provas e rotina de estudo
- **Freelancer**: clientes, follow-up e projetos
- **Empresa**: comunicacao de equipe e operacao
- **Criador**: mensagens sociais, leads e oportunidades

## 5. Evolucao para SyncHub Pro
Camada avancada planejada:
- Criador visual de workflows
- Gatilhos inteligentes com IA
- Regras entre apps
- Respostas automaticas contextuais
- Automacao personalizada por perfil

Exemplo de fluxo:
- "Se receber mensagem com 'orcamento' -> criar tarefa -> notificar canal -> enviar resposta"

## 6. Diferencial competitivo
O SyncHub nao e apenas integracao tecnica.
Ele combina no mesmo produto:
1. Centralizacao de comunicacao
2. Organizacao inteligente
3. Priorizacao operacional
4. Automacao simples para uso real

## 7. Modelo de negocio (direcao)
- **Free**: integracoes basicas, IA limitada, centralizacao simples
- **Pro**: automacao avancada, workflows, modulos e relatorios
- **Enterprise**: integracoes corporativas, dashboard de equipe e controle administrativo

## 8. Estado atual implementado neste repositorio
### Backend
- API HTTP do Core em `src/main.js`
- Auth com sessao Bearer em `src/auth/auth-service.js`
- Persistencia local por usuario em `data/synchub-db.json`
- Motor de prioridade em `src/core/priority-engine.js`
- Motor de automacao em `src/automation/automation-engine.js`
- Isolamento multiusuario por core em `src/core/core-manager.js`

### Frontend
- Aplicacao web em `src/web/` (arquivos consolidados)
- Dashboard com KPIs, timeline e distribuicoes
- Inbox com formulario de entrada e conversoes diretas
- Views para Tarefas, Eventos e Notas
- Contexto de contato integrado

### Observacao de ambiente
- O login atual esta em **modo demo**: aceita qualquer email/senha e cria usuario automaticamente.
- Isso acelera validacao de produto.

## 9. Endpoints principais
Auth:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Core:
- `GET /api/health`
- `GET /api/daily-overview`
- `GET /api/reports/weekly`
- `GET/POST /api/focus-mode`
- `GET/POST /api/privacy-mode`

Inbox e conversoes:
- `POST /api/messages`
- `GET /api/inbox`
- `GET /api/inbox/buckets`
- `POST /api/inbox/:messageId/reply`
- `POST /api/inbox/:messageId/task`
- `POST /api/inbox/:messageId/convert`
- `GET /api/context/:contactRef`

Execucao:
- `POST /api/tasks`
- `GET /api/tasks`
- `PATCH /api/tasks/:taskId`
- `GET /api/events`
- `GET /api/notes`

Automacao/modulos/integracoes:
- `GET/POST/DELETE /api/automations/rules`
- `GET /api/modules`
- `POST /api/modules/activate`
- `POST /api/modules/deactivate`
- `GET /api/integrations`
- `POST /api/integrations/connect`
- `POST /api/integrations/disconnect`

Utilitario:
- `POST /api/seed/sample`

## 10. Como executar
1. Instalar dependencias:
```bash
npm install
```

2. Copiar ambiente:
```bash
copy .env.example .env
```

3. Subir Core API:
```bash
npm run start:core
```

4. Abrir app web:
```text
http://localhost:8080/app
```

5. Opcional: bridge legado WhatsApp -> Discord:
```bash
npm run start:bridge
```

## 11. Estrutura de pastas
- `src/`: codigo do SyncHub Core e app web
- `docs/`: documentacao funcional e tecnica
- `data/`: base local JSON
- `baileys_auth/`: estado da bridge legado

## 12. Roadmap estrategico (proximas fases)
Fase 1 - Refino do MVP:
- estabilizacao da inbox universal
- melhorias de UX e confiabilidade de automacoes

Fase 2 - Integracoes reais:
- conectores oficiais (gmail/calendar/telegram/slack/teams)
- sincronizacao incremental

Fase 3 - Camada Pro:
- workflow visual
- automacoes multiapp
- regras por equipe e perfil

Fase 4 - Escala:
- persistencia em PostgreSQL/Redis
- recursos enterprise (governanca, auditoria e administracao)

## 13. Documentacao complementar
- `docs/PROJECT_MASTER_PLAN.md`
- `docs/API_REFERENCE.md`
- `docs/DB_SCHEMA.sql`
- `docs/BRAND_IDENTITY.md`
- `docs/RELATORIO_SYNCHUB_2026.md`
