# SyncHub 2026 - Master Plan

## Status de implementacao (04 de marco de 2026)
Ja implementado no repositorio:
1. Core API com inbox, prioridade, foco, tarefas e automacao por regras
2. Persistencia local por usuario (JSON DB)
3. Autenticacao com cadastro/login/sessao Bearer
4. Base multiusuario com estado isolado por conta
5. Interface web inicial de Lobby de Integracoes (`/app`)
6. Inbox inteligente por buckets e conversao em task/event/note
7. Contexto unificado por contato + relatorio semanal com score de produtividade

## 1. Produto
SyncHub e uma plataforma de organizacao, comunicacao e automacao que centraliza canais digitais em uma camada inteligente unica.

Pilares:
1. Centralizacao de mensagens e eventos
2. Priorizacao com contexto
3. Foco e reducao de ruido
4. Automacao configuravel por regras
5. Modulos por perfil de uso

## 2. Problema resolvido
Usuarios distribuem comunicacao em WhatsApp, Telegram, Discord, e-mail, calendario e apps de tarefas.
Resultado: perda de contexto, baixa priorizacao e queda de produtividade.

SyncHub resolve com:
- inbox unificada
- score de prioridade
- modo foco
- tarefas geradas automaticamente
- gatilhos de automacao

## 3. Perfis e modulos
1. Estudante
2. Freelancer
3. Empresa
4. Criador de conteudo

Cada modulo adiciona contexto de prioridade, automacoes e relatorios especificos.

## 4. Escopo de MVP (Fase 1)
Itens obrigatorios:
1. Ingestao de mensagens normalizadas
2. Score de prioridade em tempo real
3. Modo foco (filtragem por limiar)
4. Conversao de mensagem em tarefa
5. Overview diario
6. Regras de automacao basicas
7. API para operacao do core

Itens pos-MVP:
1. Persistencia SQL/NoSQL
2. Front-end web
3. Integracoes oficiais multi-plataforma
4. IA semantica por LLM
5. Workflow visual (SyncHub Pro)

## 5. Arquitetura alvo
Camadas:
1. Connectors: ingestao de canais externos
2. SyncHub Core: normalizacao, prioridade, foco, tarefas
3. Automation Engine: gatilhos e acoes
4. API/Interface: endpoints e dashboards
5. Analytics: relatorios e indicadores

## 6. Modelo de dados minimo
Entidades:
1. Message
2. Task
3. Notification
4. AutomationRule
5. UserModuleState

## 7. Indicadores de sucesso
1. Taxa de leitura de itens criticos
2. Tempo medio de resposta por prioridade
3. Reducao de notificacoes irrelevantes
4. Taxa de conclusao de tarefas geradas automaticamente
5. Uso de automacoes por usuario

## 8. Roadmap 2026 sugerido
Datas de referencia:
- Inicio de execucao: 4 de marco de 2026

Fase 1 (marco a abril de 2026):
1. Core API + priorizacao + foco + tarefas
2. Integracao legado WhatsApp/Discord operando em paralelo

Fase 2 (maio a junho de 2026):
1. Persistencia e autenticacao
2. Integracao Gmail + Google Calendar
3. Dashboard diario inicial

Fase 3 (julho a setembro de 2026):
1. Workflows visuais
2. Regras com condicoes compostas
3. Modulos por vertical com templates

Fase 4 (outubro a dezembro de 2026):
1. Pacote empresa (Slack + Teams)
2. Dashboard de operacao em equipe
3. Pacote enterprise (governanca e admin)

## 9. Monetizacao
Plano Free:
- conectores basicos
- limite de automacoes
- overview simples

Plano Pro:
- automacao avancada
- modulos liberados
- regras customizadas

Plano Enterprise:
- integracoes corporativas
- observabilidade de times
- governanca e suporte dedicado
