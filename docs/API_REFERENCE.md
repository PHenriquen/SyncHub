# SyncHub Core API Reference

Base URL local:
`http://localhost:8080`

Interface web:
`http://localhost:8080/app`

## Auth
Todos os endpoints (exceto `health`, `register` e `login`) exigem:
`Authorization: Bearer <token>`

### `POST /api/auth/register`
Body:
```json
{
  "name": "Henri",
  "email": "henri@example.com",
  "password": "SenhaForte123"
}
```

### `POST /api/auth/login`
Body:
```json
{
  "email": "henri@example.com",
  "password": "SenhaForte123"
}
```

### `GET /api/auth/me`
Retorna usuario autenticado e validade da sessao.

### `POST /api/auth/logout`
Invalida token atual.

## Health
### `GET /api/health`
Retorna status da API.

## Modules
### `GET /api/modules`
Lista modulos disponiveis e modulos ativos.

### `POST /api/modules/activate`
Body:
```json
{
  "moduleId": "freelancer"
}
```

### `POST /api/modules/deactivate`
Body:
```json
{
  "moduleId": "freelancer"
}
```

## Integrations
### `GET /api/integrations`
Lista conectores e estado atual por usuario.

### `POST /api/integrations/connect`
Body:
```json
{
  "integrationId": "gmail",
  "accountLabel": "time@empresa.com"
}
```

### `POST /api/integrations/disconnect`
Body:
```json
{
  "integrationId": "gmail"
}
```

## Focus Mode
### `GET /api/focus-mode`
Consulta estado atual do foco.

### `POST /api/focus-mode`
Body:
```json
{
  "enabled": true,
  "threshold": 75
}
```

## Messages
### `POST /api/messages`
Body minimo:
```json
{
  "source": "whatsapp",
  "sender": "Cliente XPTO",
  "text": "Preciso de orcamento urgente."
}
```

Campos opcionais:
- `senderRole`
- `channel`
- `moduleId`
- `createdAt`
- `metadata`

### `GET /api/inbox`
Query params:
- `limit` (default 50)
- `focus` (`true|false`)

### `GET /api/inbox/buckets`
Retorna inbox inteligente separada por:
- `urgent`
- `work`
- `personal`
- `automatic`

Query params:
- `limit` (default 200)
- `focus` (`true|false`)

### `POST /api/inbox/:messageId/task`
Converte mensagem da inbox em tarefa.

Body opcional:
```json
{
  "title": "Follow-up comercial"
}
```

### `POST /api/inbox/:messageId/reply`
Registra resposta rapida no fluxo de notificacoes.

Body:
```json
{
  "message": "Recebido, retorno hoje ate 18h."
}
```

### `POST /api/inbox/:messageId/convert`
Conversao automatica com 1 clique.

Body:
```json
{
  "type": "task"
}
```

`type` aceitos:
- `task`
- `event`
- `note`

## Tasks
### `POST /api/tasks`
Body:
```json
{
  "title": "Enviar proposta comercial",
  "source": "manual",
  "moduleId": "freelancer",
  "priorityLevel": "high",
  "dueDate": "2026-03-10T23:59:59.000Z"
}
```

### `GET /api/tasks`
Query params:
- `status`
- `moduleId`

### `PATCH /api/tasks/:taskId`
Atualiza status/titulo da tarefa.

Body:
```json
{
  "status": "done"
}
```

## Notifications
### `GET /api/notifications`
Query params:
- `limit`

## Events and Notes
### `GET /api/events`
Lista eventos convertidos da inbox.

### `GET /api/notes`
Lista notas convertidas da inbox.

## Unified Context
### `GET /api/context/:contactRef`
Retorna mini CRM pessoal (mensagens, tarefas, eventos e notas relacionadas ao contato).

## Weekly Report
### `GET /api/reports/weekly`
Retorna score de produtividade e insights semanais.

## Privacy Mode
### `GET /api/privacy-mode`
Consulta modo atual (`balanced` ou `strict`).

### `POST /api/privacy-mode`
Body:
```json
{
  "mode": "strict"
}
```

## Daily Overview
### `GET /api/daily-overview`
Query params:
- `date` (ISO, opcional)

## Automation Rules
### `GET /api/automations/rules`
Lista regras cadastradas.

### `POST /api/automations/rules`
Body:
```json
{
  "name": "Lead comercial",
  "trigger": {
    "containsAny": ["orcamento", "proposta"],
    "source": "whatsapp",
    "minPriority": 55
  },
  "actions": [
    { "type": "create_task", "payload": { "titlePrefix": "Comercial" } },
    { "type": "notify_channel", "payload": { "channel": "sales", "message": "Novo lead" } },
    { "type": "auto_reply", "payload": { "message": "Retornaremos em breve." } }
  ]
}
```

### `DELETE /api/automations/rules/:id`
Remove regra por id.

## Seeder
### `POST /api/seed/sample`
Injeta mensagens de exemplo para testes locais.
