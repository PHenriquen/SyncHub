(function attachSyncHubRender(global) {
  function buildRenderers(context) {
    const {
      state,
      el,
      escapeHtml,
      toDateLabel,
      getPriorityPill,
      applySearch,
      normalizeThemeMode,
    } = context;
    function renderSession() {
      if (!state.user) {
        return;
      }

      el.sessionUser.textContent = `${state.user.name} | ${state.user.email}`;
      el.settingsUser.textContent = state.user.name;
      el.settingsEmail.textContent = state.user.email;
      el.settingsExpire.textContent = toDateLabel(state.sessionExpiresAt);
      el.focusToggle.checked = Boolean(state.focusMode.enabled);
      el.focusThreshold.value = String(state.focusMode.threshold);
      el.focusThresholdLabel.textContent = String(state.focusMode.threshold);
      el.privacyMode.value = state.privacyMode;
      el.themeMode.value = normalizeThemeMode(state.themeMode);
    }

    function renderKpis() {
      if (!state.overview) {
        el.kpiGrid.innerHTML = '';
        return;
      }

      const criticalAndHigh =
        state.overview.inbox.priorityBreakdown.critical +
        state.overview.inbox.priorityBreakdown.high;
      const connectedIntegrations = state.integrations.filter(
        (item) => item.state && item.state.connected
      ).length;
      const productivityScore =
        state.overview.smart && state.overview.smart.productivity
          ? state.overview.smart.productivity.score
          : '-';

      const items = [
        ['Mensagens hoje', state.overview.inbox.messagesToday],
        ['Prioridade alta', criticalAndHigh],
        ['Tarefas pendentes', state.overview.tasks.pending],
        ['Automações', state.overview.automationRules],
        ['Produtividade', productivityScore],
        ['Conectores ativos', connectedIntegrations],
      ];

      el.kpiGrid.innerHTML = items
        .map(
          ([label, value]) =>
            `<article class="kpi-card"><p>${escapeHtml(label)}</p><strong>${escapeHtml(
              value
            )}</strong></article>`
        )
        .join('');
    }

    function renderAiSummary() {
      if (!state.overview) {
        el.aiSummary.innerHTML = '<li>Sem dados para resumir.</li>';
        return;
      }

      const highlights = [];
      const critical = state.overview.inbox.priorityBreakdown.critical;
      const high = state.overview.inbox.priorityBreakdown.high;

      if (critical > 0) {
        highlights.push(
          `${critical} item(ns) crítico(s) exigem ação imediata na inbox.`
        );
      } else {
        highlights.push('Nenhum item crítico no momento.');
      }

      if (high > 0) {
        highlights.push(`${high} item(ns) de alta prioridade aguardam resposta.`);
      }

      if (state.overview.tasks.overdue > 0) {
        highlights.push(
          `${state.overview.tasks.overdue} tarefa(s) atrasada(s). Priorize conclusão hoje.`
        );
      } else {
        highlights.push('Sem tarefas atrasadas. Fluxo de entrega está saudável.');
      }

      if (!state.focusMode.enabled) {
        highlights.push('Ative o modo foco para reduzir ruído operacional.');
      } else {
        highlights.push(
          `Modo foco ativo com limiar ${state.focusMode.threshold}.`
        );
      }

      const bucketBreakdown = state.overview.inbox.bucketBreakdown || {};
      if ((bucketBreakdown.personal || 0) > 0) {
        highlights.push(
          `${bucketBreakdown.personal} item(ns) pessoais na inbox.`
        );
      }

      el.aiSummary.innerHTML = highlights
        .slice(0, 4)
        .map((text) => `<li>${escapeHtml(text)}</li>`)
        .join('');
    }

    function renderTimeline() {
      const timelineItems = [];
      const now = new Date();

      const dueSoonTasks = state.tasks
        .filter((task) => task.status !== 'done' && task.dueDate)
        .sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime())
        .slice(0, 4);

      for (const task of dueSoonTasks) {
        timelineItems.push({
          when: toDateLabel(task.dueDate),
          text: `Entrega: ${task.title}`,
        });
      }

      const nextInbox = state.inbox.slice(0, 3);
      for (const message of nextInbox) {
        timelineItems.push({
          when: toDateLabel(message.createdAt),
          text: `Inbox ${message.priority.level}: ${message.sender}`,
        });
      }

      if (timelineItems.length === 0) {
        timelineItems.push({
          when: toDateLabel(now.toISOString()),
          text: 'Sem eventos em timeline.',
        });
      }

      el.timelineList.innerHTML = timelineItems
        .slice(0, 6)
        .map((item) => `<li><strong>${escapeHtml(item.when)}</strong><br>${escapeHtml(item.text)}</li>`)
        .join('');
    }

    function renderMiniIntegrations() {
      const connected = state.integrations
        .filter((integration) => integration.state && integration.state.connected)
        .slice(0, 6);

      if (connected.length === 0) {
        el.miniIntegrations.innerHTML = '<li>Nenhuma integração conectada.</li>';
        return;
      }

      el.miniIntegrations.innerHTML = connected
        .map(
          (integration) =>
            `<li>${escapeHtml(integration.name)} | sync ${escapeHtml(
              toDateLabel(integration.state.lastSyncAt)
            )}</li>`
        )
        .join('');
    }

    function toSourceLabel(source) {
      const dictionary = {
        whatsapp: 'WhatsApp',
        telegram: 'Telegram',
        discord: 'Discord',
        slack: 'Slack',
        teams: 'Microsoft Teams',
        gmail: 'Gmail',
        outlook: 'Outlook',
        google_calendar: 'Google Calendar',
        notion: 'Notion',
        trello: 'Trello',
        clickup: 'ClickUp',
        linkedin: 'LinkedIn',
        instagram: 'Instagram',
        youtube: 'YouTube',
        calendar: 'Calendar',
      };
      if (dictionary[source]) {
        return dictionary[source];
      }
      return String(source || 'Outro')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (match) => match.toUpperCase());
    }

    function renderBarChart(container, rows, emptyText) {
      if (!container) {
        return;
      }

      const normalizedRows = rows
        .map((row) => ({
          label: String(row.label || ''),
          value: Number.isFinite(Number(row.value)) ? Number(row.value) : 0,
          tone: String(row.tone || 'default'),
        }))
        .filter((row) => row.value > 0);

      if (normalizedRows.length === 0) {
        container.innerHTML = `<p class="chart-empty">${escapeHtml(emptyText)}</p>`;
        return;
      }

      const total = normalizedRows.reduce((sum, row) => sum + row.value, 0) || 1;
      const max = Math.max(...normalizedRows.map((row) => row.value), 1);

      container.innerHTML = normalizedRows
        .map((row) => {
          const width = Math.max(9, Math.round((row.value / max) * 100));
          const percentage = Math.round((row.value / total) * 100);
          return `
            <div class="chart-row">
              <span class="chart-label">${escapeHtml(row.label)}</span>
              <div class="chart-track">
                <span class="chart-fill ${escapeHtml(row.tone)}" style="width:${width}%"></span>
              </div>
              <span class="chart-value">${escapeHtml(row.value)} (${escapeHtml(percentage)}%)</span>
            </div>
          `;
        })
        .join('');
    }

    function renderDashboardCharts() {
      if (!state.overview || !state.overview.inbox) {
        renderBarChart(el.priorityBars, [], 'Sem dados de prioridade hoje.');
        renderBarChart(el.sourceBars, [], 'Sem dados de origem hoje.');
        return;
      }

      const priorityBreakdown = state.overview.inbox.priorityBreakdown || {};
      const sourceBreakdown = state.overview.inbox.sourceBreakdown || {};
      const sourceRows = Object.entries(sourceBreakdown)
        .sort((left, right) => Number(right[1]) - Number(left[1]))
        .slice(0, 6)
        .map(([source, value]) => ({
          label: toSourceLabel(source),
          value,
          tone: 'default',
        }));

      renderBarChart(
        el.priorityBars,
        [
          { label: 'Crítica', value: priorityBreakdown.critical || 0, tone: 'critical' },
          { label: 'Alta', value: priorityBreakdown.high || 0, tone: 'high' },
          { label: 'Média', value: priorityBreakdown.medium || 0, tone: 'medium' },
          { label: 'Baixa', value: priorityBreakdown.low || 0, tone: 'low' },
        ],
        'Sem mensagens priorizadas hoje.'
      );
      renderBarChart(el.sourceBars, sourceRows, 'Sem mensagens por origem hoje.');
    }

    function renderWeeklyInsights() {
      if (!state.weeklyReport || !Array.isArray(state.weeklyReport.insights)) {
        el.weeklyInsights.innerHTML = '<li>Sem dados da semana.</li>';
        return;
      }

      const lines = [...state.weeklyReport.insights];
      lines.push(
        `Score semanal: ${state.weeklyReport.productivity.score}`
      );

      el.weeklyInsights.innerHTML = lines
        .slice(0, 5)
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join('');
    }

    function getBucketListForFilter() {
      if (!state.inboxBuckets || !state.inboxBuckets.buckets) {
        return state.inbox;
      }
      if (state.inboxBucketFilter === 'all') {
        return state.inbox;
      }
      return state.inboxBuckets.buckets[state.inboxBucketFilter] || [];
    }

    function renderInboxBuckets() {
      const counts =
        state.inboxBuckets && state.inboxBuckets.counts
          ? state.inboxBuckets.counts
          : { urgent: 0, work: 0, personal: 0, automatic: 0 };

      const options = [
        ['all', `Todos (${state.inbox.length})`],
        ['urgent', `Urgente (${counts.urgent || 0})`],
        ['work', `Trabalho (${counts.work || 0})`],
        ['personal', `Pessoal (${counts.personal || 0})`],
        ['automatic', `Automático (${counts.automatic || 0})`],
      ];

      el.inboxBuckets.innerHTML = options
        .map(
          ([value, label]) =>
            `<button class="bucket-btn ${
              state.inboxBucketFilter === value ? 'active' : ''
            }" data-bucket-filter="${value}" type="button">${escapeHtml(label)}</button>`
        )
        .join('');
    }

    function renderInbox() {
      const bucketBase = getBucketListForFilter();
      const visible = bucketBase.filter(
        (message) => !state.dismissedMessageIds.has(message.id)
      );
      const filtered = applySearch(
        visible,
        (message) =>
          `${message.sender} ${message.text} ${message.source} ${message.priority.level}`
      );

      if (filtered.length === 0) {
        el.inboxList.innerHTML = '<article class="list-item">Inbox vazia para os filtros atuais.</article>';
        return;
      }

      el.inboxList.innerHTML = filtered
        .map((message) => {
          const pill = getPriorityPill(message.priority.level);
          return `
            <article class="list-item">
              <div class="list-head">
                <h4 class="list-title">${escapeHtml(message.sender)} | ${escapeHtml(message.source)}</h4>
                <span class="pill ${pill}">${escapeHtml(message.priority.level)} (${escapeHtml(
            message.priority.score
          )})</span>
              </div>
              <p>${escapeHtml(message.text)}</p>
              <p class="meta">Canal: ${escapeHtml(message.channel)} | ${escapeHtml(
            toDateLabel(message.createdAt)
          )}</p>
              <div class="item-actions">
                <button class="btn ghost" data-inbox-action="reply" data-message-id="${escapeHtml(
                  message.id
                )}">Responder</button>
                <button class="btn ghost" data-inbox-action="convert-task" data-message-id="${escapeHtml(
                  message.id
                )}">Para tarefa</button>
                <button class="btn ghost" data-inbox-action="convert-event" data-message-id="${escapeHtml(
                  message.id
                )}">Para evento</button>
                <button class="btn ghost" data-inbox-action="convert-note" data-message-id="${escapeHtml(
                  message.id
                )}">Para nota</button>
                <button class="btn ghost" data-inbox-action="context" data-message-id="${escapeHtml(
                  message.id
                )}" data-message-sender="${escapeHtml(message.sender)}">Contexto</button>
                <button class="btn danger" data-inbox-action="dismiss" data-message-id="${escapeHtml(
                  message.id
                )}">Silenciar</button>
              </div>
            </article>
          `;
        })
        .join('');
    }

    function renderContactContext() {
      if (!el.contactContext) {
        return;
      }

      const context = state.contactContext;
      if (!context || !context.summary) {
        el.contactContext.innerHTML =
          '<p class="meta">Selecione "Contexto" em uma mensagem para abrir detalhes.</p>';
        return;
      }

      const summary = context.summary || {};
      const lastMessages = Array.isArray(context.lastMessages) ? context.lastMessages.slice(0, 3) : [];
      const relatedTasks = Array.isArray(context.relatedTasks) ? context.relatedTasks.slice(0, 3) : [];
      const relatedEvents = Array.isArray(context.relatedEvents) ? context.relatedEvents.slice(0, 2) : [];
      const relatedNotes = Array.isArray(context.relatedNotes) ? context.relatedNotes.slice(0, 2) : [];

      el.contactContext.innerHTML = `
        <p><strong>Contato:</strong> ${escapeHtml(context.contactRef || '-')}</p>
        <p class="meta">
          Mensagens: ${escapeHtml(summary.messages || 0)} |
          Tarefas: ${escapeHtml(summary.tasks || 0)} |
          Eventos: ${escapeHtml(summary.events || 0)} |
          Notas: ${escapeHtml(summary.notes || 0)}
        </p>
        <div class="context-grid">
          <div>
            <h5>Últimas mensagens</h5>
            <ul class="plain-list compact">
              ${
                lastMessages.length
                  ? lastMessages
                      .map(
                        (item) =>
                          `<li>${escapeHtml(item.text)}</li>`
                      )
                      .join('')
                  : '<li>Sem histórico.</li>'
              }
            </ul>
          </div>
          <div>
            <h5>Tarefas relacionadas</h5>
            <ul class="plain-list compact">
              ${
                relatedTasks.length
                  ? relatedTasks
                      .map(
                        (item) =>
                          `<li>${escapeHtml(item.title)} (${escapeHtml(item.status)})</li>`
                      )
                      .join('')
                  : '<li>Sem tarefas.</li>'
              }
            </ul>
          </div>
          <div>
            <h5>Eventos</h5>
            <ul class="plain-list compact">
              ${
                relatedEvents.length
                  ? relatedEvents
                      .map((item) => `<li>${escapeHtml(item.title)}</li>`)
                      .join('')
                  : '<li>Sem eventos.</li>'
              }
            </ul>
          </div>
          <div>
            <h5>Notas</h5>
            <ul class="plain-list compact">
              ${
                relatedNotes.length
                  ? relatedNotes
                      .map((item) => `<li>${escapeHtml(item.title)}</li>`)
                      .join('')
                  : '<li>Sem notas.</li>'
              }
            </ul>
          </div>
        </div>
      `;
    }

    function renderTasks() {
      const filtered = applySearch(
        state.tasks,
        (task) => `${task.title} ${task.status} ${task.priorityLevel} ${task.source}`
      );

      if (filtered.length === 0) {
        el.tasksList.innerHTML = '<article class="list-item">Sem tarefas para mostrar.</article>';
        return;
      }

      el.tasksList.innerHTML = filtered
        .map((task) => {
          const statusPill = task.status === 'done' ? 'low' : task.priorityLevel;
          return `
            <article class="list-item">
              <div class="list-head">
                <h4 class="list-title">${escapeHtml(task.title)}</h4>
                <span class="pill ${getPriorityPill(statusPill)}">${escapeHtml(task.status)}</span>
              </div>
              <p class="meta">Prioridade: ${escapeHtml(task.priorityLevel)} | origem: ${escapeHtml(
            task.source
          )}</p>
              <p class="meta">Prazo: ${escapeHtml(toDateLabel(task.dueDate))}</p>
              <div class="item-actions">
                <button class="btn ghost" data-task-action="progress" data-task-id="${escapeHtml(
                  task.id
                )}">Em andamento</button>
                <button class="btn ghost" data-task-action="done" data-task-id="${escapeHtml(
                  task.id
                )}">Concluir</button>
                <button class="btn danger" data-task-action="reopen" data-task-id="${escapeHtml(
                  task.id
                )}">Reabrir</button>
              </div>
            </article>
          `;
        })
        .join('');
    }

    function renderEvents() {
      const filtered = applySearch(
        state.events || [],
        (event) => `${event.title} ${event.source} ${event.contact || ''}`
      );

      if (!el.eventsList) {
        return;
      }

      if (filtered.length === 0) {
        el.eventsList.innerHTML = '<article class="list-item">Sem eventos para mostrar.</article>';
        return;
      }

      el.eventsList.innerHTML = filtered
        .map(
          (event) => `
            <article class="list-item">
              <div class="list-head">
                <h4 class="list-title">${escapeHtml(event.title)}</h4>
                <span class="pill medium">${escapeHtml(event.source)}</span>
              </div>
              <p class="meta">Início: ${escapeHtml(toDateLabel(event.startsAt))}</p>
              <p class="meta">Contato: ${escapeHtml(event.contact || '-')}</p>
            </article>
          `
        )
        .join('');
    }

    function renderNotes() {
      const filtered = applySearch(
        state.notes || [],
        (note) => `${note.title} ${note.body} ${note.source} ${note.contact || ''}`
      );

      if (!el.notesList) {
        return;
      }

      if (filtered.length === 0) {
        el.notesList.innerHTML = '<article class="list-item">Sem notas para mostrar.</article>';
        return;
      }

      el.notesList.innerHTML = filtered
        .map(
          (note) => `
            <article class="list-item">
              <div class="list-head">
                <h4 class="list-title">${escapeHtml(note.title)}</h4>
                <span class="pill low">${escapeHtml(note.source)}</span>
              </div>
              <p>${escapeHtml(String(note.body || '').slice(0, 220))}</p>
              <p class="meta">Contato: ${escapeHtml(note.contact || '-')}</p>
            </article>
          `
        )
        .join('');
    }

    function renderRules() {
      const filtered = applySearch(
        state.rules,
        (rule) => `${rule.name} ${rule.trigger.source || ''} ${rule.id}`
      );

      if (filtered.length === 0) {
        el.rulesList.innerHTML = '<article class="list-item">Nenhuma regra cadastrada.</article>';
        return;
      }

      el.rulesList.innerHTML = filtered
        .map((rule) => {
          const triggerWords = Array.isArray(rule.trigger.containsAny)
            ? rule.trigger.containsAny.join(', ')
            : '-';
          return `
            <article class="list-item">
              <div class="list-head">
                <h4 class="list-title">${escapeHtml(rule.name)}</h4>
                <span class="pill ${rule.enabled ? 'medium' : 'low'}">${rule.enabled ? 'ativa' : 'inativa'}</span>
              </div>
              <p class="meta">Origem: ${escapeHtml(rule.trigger.source || 'qualquer')} | Min prioridade: ${escapeHtml(
            rule.trigger.minPriority ?? '-'
          )}</p>
              <p class="meta">Palavras: ${escapeHtml(triggerWords || '-')}</p>
              <div class="item-actions">
                <button class="btn danger" data-rule-action="delete" data-rule-id="${escapeHtml(
                  rule.id
                )}">Remover</button>
              </div>
            </article>
          `;
        })
        .join('');
    }

    function renderIntegrations() {
      const filtered = applySearch(
        state.integrations,
        (item) =>
          `${item.name} ${item.category} ${item.state && item.state.accountLabel ? item.state.accountLabel : ''}`
      );

      if (filtered.length === 0) {
        el.integrationsGrid.innerHTML = '<article class="integration-card">Nenhuma integração.</article>';
        return;
      }

      el.integrationsGrid.innerHTML = filtered
        .map((item) => {
          const connected = Boolean(item.state && item.state.connected);
          const status = connected ? 'conectado' : item.state.status || 'pronto';
          return `
            <article class="integration-card">
              <h4>${escapeHtml(item.name)}</h4>
              <p class="meta">${escapeHtml(item.category)} | versão ${escapeHtml(item.status)}</p>
              <p class="meta">Conta: ${escapeHtml(item.state.accountLabel || '-')}</p>
              <p class="meta">Status: ${escapeHtml(status)} | sync ${escapeHtml(
            toDateLabel(item.state.lastSyncAt)
          )}</p>
              <div class="item-actions">
                <button class="btn ghost" data-integration-action="connect" data-integration-id="${escapeHtml(
                  item.id
                )}">${connected ? 'Reconectar' : 'Conectar'}</button>
                <button class="btn danger" data-integration-action="disconnect" data-integration-id="${escapeHtml(
                  item.id
                )}" ${connected ? '' : 'disabled'}>Desconectar</button>
              </div>
            </article>
          `;
        })
        .join('');
    }

    function renderModules() {
      const activeIds = new Set((state.modules.activeModules || []).map((moduleDef) => moduleDef.id));
      const filtered = applySearch(
        state.modules.availableModules || [],
        (moduleDef) => `${moduleDef.name} ${moduleDef.description}`
      );

      if (filtered.length === 0) {
        el.modulesGrid.innerHTML = '<article class="module-card">Nenhum módulo.</article>';
        return;
      }

      el.modulesGrid.innerHTML = filtered
        .map((moduleDef) => {
          const active = activeIds.has(moduleDef.id);
          return `
            <article class="module-card">
              <h4>${escapeHtml(moduleDef.name)}</h4>
              <p class="meta">${escapeHtml(moduleDef.description)}</p>
              <div class="item-actions">
                <button class="btn ${active ? 'danger' : 'primary'}" data-module-action="${
                  active ? 'deactivate' : 'activate'
                }" data-module-id="${escapeHtml(moduleDef.id)}">
                  ${active ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </article>
          `;
        })
        .join('');
    }

    function renderAll() {
      renderSession();
      renderKpis();
      renderAiSummary();
      renderTimeline();
      renderMiniIntegrations();
      renderWeeklyInsights();
      renderDashboardCharts();
      renderInboxBuckets();
      renderContactContext();
      renderInbox();
      renderTasks();
      renderEvents();
      renderNotes();
      renderRules();
      renderIntegrations();
      renderModules();
    }
    return {
      renderSession,
      renderKpis,
      renderAiSummary,
      renderTimeline,
      renderMiniIntegrations,
      renderWeeklyInsights,
      renderInboxBuckets,
      renderContactContext,
      renderInbox,
      renderTasks,
      renderEvents,
      renderNotes,
      renderRules,
      renderIntegrations,
      renderModules,
      renderAll,
    };
  }

  global.SyncHubRender = {
    buildRenderers,
  };
})(window);


const tokenKey = 'synchub_token';
const themeModeKey = 'synchub_theme_mode';
const autoThemeTickMs = 60 * 1000;

const state = {
  mode: 'login',
  token: localStorage.getItem(tokenKey) || '',
  user: null,
  sessionExpiresAt: null,
  activeView: 'dashboard',
  searchQuery: '',
  focusMode: { enabled: false, threshold: 70 },
  overview: null,
  weeklyReport: null,
  inbox: [],
  inboxBuckets: null,
  inboxBucketFilter: 'all',
  contactContext: null,
  tasks: [],
  events: [],
  notes: [],
  rules: [],
  integrations: [],
  modules: { availableModules: [], activeModules: [] },
  privacyMode: 'balanced',
  themeMode: localStorage.getItem(themeModeKey) || 'auto',
  dismissedMessageIds: new Set(),
};

const el = {
  authScreen: document.getElementById('auth-screen'),
  appRoot: document.getElementById('app-root'),
  authForm: document.getElementById('auth-form'),
  authFeedback: document.getElementById('auth-feedback'),
  modeLogin: document.getElementById('mode-login'),
  modeRegister: document.getElementById('mode-register'),
  fieldName: document.getElementById('field-name'),
  authSubmit: document.getElementById('auth-submit'),
  authName: document.getElementById('auth-name'),
  authEmail: document.getElementById('auth-email'),
  authPassword: document.getElementById('auth-password'),
  viewNav: document.getElementById('view-nav'),
  sessionUser: document.getElementById('session-user'),
  logoutBtn: document.getElementById('logout-btn'),
  globalSearch: document.getElementById('global-search'),
  quickNewTask: document.getElementById('quick-new-task'),
  quickNewRule: document.getElementById('quick-new-rule'),
  focusToggle: document.getElementById('focus-toggle'),
  refreshBtn: document.getElementById('refresh-btn'),
  kpiGrid: document.getElementById('kpi-grid'),
  aiSummary: document.getElementById('ai-summary'),
  timelineList: document.getElementById('timeline-list'),
  miniIntegrations: document.getElementById('mini-integrations'),
  weeklyInsights: document.getElementById('weekly-insights'),
  priorityBars: document.getElementById('priority-bars'),
  sourceBars: document.getElementById('source-bars'),
  inboxBuckets: document.getElementById('inbox-buckets'),
  messageForm: document.getElementById('message-form'),
  messageSender: document.getElementById('message-sender'),
  messageChannel: document.getElementById('message-channel'),
  messageSource: document.getElementById('message-source'),
  messageRole: document.getElementById('message-role'),
  messageText: document.getElementById('message-text'),
  seedSampleBtn: document.getElementById('seed-sample-btn'),
  contactContext: document.getElementById('contact-context'),
  inboxList: document.getElementById('inbox-list'),
  taskForm: document.getElementById('task-form'),
  taskTitle: document.getElementById('task-title'),
  taskDueDate: document.getElementById('task-due-date'),
  tasksList: document.getElementById('tasks-list'),
  eventsList: document.getElementById('events-list'),
  notesList: document.getElementById('notes-list'),
  ruleForm: document.getElementById('rule-form'),
  ruleName: document.getElementById('rule-name'),
  ruleKeywords: document.getElementById('rule-keywords'),
  ruleSource: document.getElementById('rule-source'),
  rulePriority: document.getElementById('rule-priority'),
  rulesList: document.getElementById('rules-list'),
  integrationsGrid: document.getElementById('integrations-grid'),
  modulesGrid: document.getElementById('modules-grid'),
  settingsUser: document.getElementById('settings-user'),
  settingsEmail: document.getElementById('settings-email'),
  settingsExpire: document.getElementById('settings-expire'),
  focusThreshold: document.getElementById('focus-threshold'),
  focusThresholdLabel: document.getElementById('focus-threshold-label'),
  privacyMode: document.getElementById('privacy-mode'),
  themeMode: document.getElementById('theme-mode'),
  savePrivacy: document.getElementById('save-privacy'),
  saveTheme: document.getElementById('save-theme'),
  saveFocus: document.getElementById('save-focus'),
};

let autoThemeTimer = null;

function showAuth() {
  el.authScreen.classList.remove('hidden');
  el.appRoot.classList.add('hidden');
}

function showApp() {
  el.authScreen.classList.add('hidden');
  el.appRoot.classList.remove('hidden');
}

function setAuthMode(mode) {
  const isRegister = mode === 'register';
  state.mode = isRegister ? 'register' : 'login';
  el.modeLogin.classList.toggle('active', !isRegister);
  el.modeRegister.classList.toggle('active', isRegister);
  el.fieldName.classList.toggle('hidden', !isRegister);
  el.authSubmit.textContent = isRegister ? 'Criar conta' : 'Entrar';
}

function setFeedback(message, kind) {
  el.authFeedback.textContent = message || '';
  el.authFeedback.classList.remove('error', 'ok');
  if (kind) {
    el.authFeedback.classList.add(kind);
  }
}

function setToken(token) {
  state.token = token || '';
  if (state.token) {
    localStorage.setItem(tokenKey, state.token);
  } else {
    localStorage.removeItem(tokenKey);
  }
}

function normalizeThemeMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['auto', 'light', 'dark'].includes(normalized)) {
    return normalized;
  }
  return 'auto';
}

function getThemeByClock(date) {
  const now = date instanceof Date ? date : new Date();
  const hour = now.getHours();
  if (hour >= 19 || hour < 7) {
    return 'dark';
  }
  return 'light';
}

function resolveTheme(mode) {
  const normalized = normalizeThemeMode(mode);
  if (normalized === 'auto') {
    return getThemeByClock();
  }
  return normalized;
}

function applyTheme() {
  const resolvedTheme = resolveTheme(state.themeMode);
  document.documentElement.dataset.theme = resolvedTheme;
  if (el.themeMode) {
    el.themeMode.value = normalizeThemeMode(state.themeMode);
  }
}

function persistThemeMode(mode) {
  state.themeMode = normalizeThemeMode(mode);
  localStorage.setItem(themeModeKey, state.themeMode);
  applyTheme();
}

function startThemeTicker() {
  if (autoThemeTimer) {
    window.clearInterval(autoThemeTimer);
  }
  autoThemeTimer = window.setInterval(() => {
    if (state.themeMode === 'auto') {
      applyTheme();
    }
  }, autoThemeTickMs);
}

function dismissedStorageKey() {
  if (!state.user || !state.user.id) {
    return 'synchub_dismissed_anonymous';
  }
  return `synchub_dismissed_${state.user.id}`;
}

function loadDismissedIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(dismissedStorageKey()) || '[]');
    state.dismissedMessageIds = new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    state.dismissedMessageIds = new Set();
  }
}

function saveDismissedIds() {
  localStorage.setItem(
    dismissedStorageKey(),
    JSON.stringify(Array.from(state.dismissedMessageIds))
  );
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toDateLabel(isoDate) {
  if (!isoDate) {
    return '-';
  }
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }
  return parsed.toLocaleString('pt-BR');
}

async function api(path, options) {
  const safe = options || {};
  const method = safe.method || 'GET';
  const auth = safe.auth !== false;
  const headers = {};

  if (safe.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (auth && state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, {
    method,
    headers,
    body: safe.body !== undefined ? JSON.stringify(safe.body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  let payload = null;
  if (contentType.includes('application/json')) {
    payload = await response.json();
  }

  if (!response.ok) {
    const message =
      payload && payload.error ? payload.error : `Erro ${response.status} na requisição`;
    if (response.status === 401 && auth) {
      handleSessionExpired();
    }
    throw new Error(message);
  }

  return payload;
}

function handleSessionExpired() {
  setToken('');
  state.user = null;
  showAuth();
  setFeedback('Sessão expirada. Faça login novamente.', 'error');
}

function setView(viewId) {
  state.activeView = viewId;
  document.querySelectorAll('.nav-btn').forEach((node) => {
    node.classList.toggle('active', node.dataset.view === viewId);
  });
  document.querySelectorAll('.view').forEach((node) => {
    node.classList.toggle('active', node.id === `view-${viewId}`);
  });
}

function getPriorityPill(level) {
  const normalized = String(level || 'low').toLowerCase();
  if (['critical', 'high', 'medium', 'low'].includes(normalized)) {
    return normalized;
  }
  return 'low';
}

function applySearch(items, projector) {
  const query = state.searchQuery.trim().toLowerCase();
  if (!query) {
    return items;
  }
  return items.filter((item) => projector(item).toLowerCase().includes(query));
}

if (!window.SyncHubRender || typeof window.SyncHubRender.buildRenderers !== 'function') {
  throw new Error('SyncHub renderer nao carregado.');
}

const {
  renderAll,
  renderContactContext,
  renderInboxBuckets,
  renderInbox,
  renderTasks,
  renderEvents,
  renderNotes,
  renderRules,
  renderIntegrations,
  renderModules,
} = window.SyncHubRender.buildRenderers({
  state,
  el,
  escapeHtml,
  toDateLabel,
  getPriorityPill,
  applySearch,
  normalizeThemeMode,
});

async function refreshAllData() {
  const [
    me,
    focus,
    overview,
    weeklyReport,
    inbox,
    inboxBuckets,
    tasks,
    events,
    notes,
    rules,
    integrations,
    modules,
    privacyMode,
  ] = await Promise.all([
    api('/api/auth/me'),
    api('/api/focus-mode'),
    api('/api/daily-overview'),
    api('/api/reports/weekly'),
    api('/api/inbox?limit=200'),
    api('/api/inbox/buckets?limit=200'),
    api('/api/tasks'),
    api('/api/events?limit=150'),
    api('/api/notes?limit=150'),
    api('/api/automations/rules'),
    api('/api/integrations'),
    api('/api/modules'),
    api('/api/privacy-mode'),
  ]);

  state.user = me.user;
  state.sessionExpiresAt = me.sessionExpiresAt;
  state.focusMode = focus;
  state.overview = overview;
  state.weeklyReport = weeklyReport;
  state.inbox = Array.isArray(inbox.items) ? inbox.items : [];
  state.inboxBuckets = inboxBuckets || null;
  state.tasks = Array.isArray(tasks.items) ? tasks.items : [];
  state.events = Array.isArray(events.items) ? events.items : [];
  state.notes = Array.isArray(notes.items) ? notes.items : [];
  state.rules = Array.isArray(rules.items) ? rules.items : [];
  state.integrations = Array.isArray(integrations.items) ? integrations.items : [];
  state.modules = modules || { availableModules: [], activeModules: [] };
  state.privacyMode = privacyMode && privacyMode.mode ? privacyMode.mode : 'balanced';
  if (!['all', 'urgent', 'work', 'personal', 'automatic'].includes(state.inboxBucketFilter)) {
    state.inboxBucketFilter = 'all';
  }
  loadDismissedIds();
  renderAll();
}

async function bootstrapSession() {
  if (!state.token) {
    showAuth();
    return;
  }
  try {
    await refreshAllData();
    showApp();
  } catch {
    handleSessionExpired();
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  setFeedback('');

  const email = el.authEmail.value.trim();
  const password = el.authPassword.value;
  const name = el.authName.value.trim();

  if (!email || !password) {
    setFeedback('Preencha e-mail e senha.', 'error');
    return;
  }

  if (state.mode === 'register' && !name) {
    setFeedback('Preencha seu nome para cadastrar.', 'error');
    return;
  }

  const route = state.mode === 'register' ? '/api/auth/register' : '/api/auth/login';
  const body = state.mode === 'register' ? { name, email, password } : { email, password };

  try {
    const result = await api(route, { method: 'POST', body, auth: false });
    setToken(result.token);
    state.user = result.user;
    state.sessionExpiresAt = result.sessionExpiresAt;
    await refreshAllData();
    showApp();
    setFeedback(state.mode === 'register' ? 'Conta criada com sucesso.' : 'Login realizado.', 'ok');
  } catch (error) {
    setFeedback(error.message, 'error');
  }
}

async function handleLogout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {
    // noop
  }
  setToken('');
  state.user = null;
  showAuth();
}

async function handleFocusToggle() {
  const enabled = Boolean(el.focusToggle.checked);
  try {
    state.focusMode = await api('/api/focus-mode', {
      method: 'POST',
      body: {
        enabled,
        threshold: state.focusMode.threshold,
      },
    });
    await refreshAllData();
  } catch (error) {
    alert(error.message);
    el.focusToggle.checked = !enabled;
  }
}

async function handleSaveFocus() {
  const threshold = Number(el.focusThreshold.value);
  el.focusThresholdLabel.textContent = String(threshold);
  try {
    state.focusMode = await api('/api/focus-mode', {
      method: 'POST',
      body: {
        enabled: state.focusMode.enabled,
        threshold,
      },
    });
    await refreshAllData();
  } catch (error) {
    alert(error.message);
  }
}

async function handleSavePrivacy() {
  const mode = String(el.privacyMode.value || 'balanced');
  try {
    const result = await api('/api/privacy-mode', {
      method: 'POST',
      body: { mode },
    });
    state.privacyMode = result.mode;
    await refreshAllData();
  } catch (error) {
    alert(error.message);
  }
}

function handleSaveTheme() {
  const mode = normalizeThemeMode(el.themeMode.value);
  persistThemeMode(mode);
}

async function handleCreateTask(event) {
  event.preventDefault();
  const title = el.taskTitle.value.trim();
  const dueDate = el.taskDueDate.value ? `${el.taskDueDate.value}T23:59:59.000Z` : null;

  if (!title) {
    return;
  }

  try {
    await api('/api/tasks', {
      method: 'POST',
      body: {
        title,
        dueDate,
        source: 'manual',
      },
    });
    el.taskForm.reset();
    await refreshAllData();
    setView('tasks');
  } catch (error) {
    alert(error.message);
  }
}

async function handleCreateMessage(event) {
  event.preventDefault();

  const sender = el.messageSender.value.trim();
  const text = el.messageText.value.trim();
  const source = el.messageSource.value.trim();
  const channel = el.messageChannel.value.trim();
  const senderRole = el.messageRole.value.trim();

  if (!sender || !text || !source) {
    return;
  }

  try {
    await api('/api/messages', {
      method: 'POST',
      body: {
        sender,
        text,
        source,
        channel: channel || source,
        senderRole: senderRole || undefined,
      },
    });
    el.messageForm.reset();
    el.messageSource.value = 'whatsapp';
    await refreshAllData();
    setView('inbox');
  } catch (error) {
    alert(error.message);
  }
}

async function handleSeedSample() {
  try {
    await api('/api/seed/sample', { method: 'POST' });
    await refreshAllData();
    setView('dashboard');
  } catch (error) {
    alert(error.message);
  }
}

async function handleCreateRule(event) {
  event.preventDefault();

  const name = el.ruleName.value.trim();
  const source = el.ruleSource.value.trim();
  const minPriority = Number(el.rulePriority.value);
  const keywords = el.ruleKeywords.value
    .split(',')
    .map((word) => word.trim())
    .filter(Boolean);

  if (!name) {
    return;
  }

  const trigger = {
    containsAny: keywords,
    minPriority: Number.isFinite(minPriority) ? minPriority : 60,
  };
  if (source) {
    trigger.source = source;
  }

  try {
    await api('/api/automations/rules', {
      method: 'POST',
      body: {
        name,
        trigger,
        actions: [
          {
            type: 'create_task',
            payload: {
              titlePrefix: 'Auto',
            },
          },
          {
            type: 'notify_channel',
            payload: {
              channel: 'operations',
              message: `Regra ${name} acionada.`,
            },
          },
        ],
      },
    });
    el.ruleForm.reset();
    el.rulePriority.value = '60';
    await refreshAllData();
    setView('automations');
  } catch (error) {
    alert(error.message);
  }
}

async function handleInboxAction(action, messageId) {
  if (!action || !messageId) {
    return;
  }

  try {
    if (action === 'dismiss') {
      state.dismissedMessageIds.add(messageId);
      saveDismissedIds();
      renderInbox();
      return;
    }

    if (action === 'reply') {
      const reply = prompt('Resposta rápida:');
      if (!reply || !reply.trim()) {
        return;
      }
      await api(`/api/inbox/${encodeURIComponent(messageId)}/reply`, {
        method: 'POST',
        body: { message: reply.trim() },
      });
      alert('Resposta registrada no fluxo de notificações.');
      await refreshAllData();
      return;
    }

    if (action.startsWith('convert-')) {
      const type = action.replace('convert-', '');
      if (!['task', 'event', 'note'].includes(type)) {
        return;
      }
      await api(`/api/inbox/${encodeURIComponent(messageId)}/convert`, {
        method: 'POST',
        body: { type },
      });
      await refreshAllData();
      if (type === 'task') {
        setView('tasks');
      } else if (type === 'event') {
        setView('events');
      } else if (type === 'note') {
        setView('notes');
      }
      return;
    }

    if (action === 'context') {
      const message = state.inbox.find((item) => item.id === messageId);
      const sender = message ? message.sender : '';
      if (!sender) {
        return;
      }
      const context = await api(`/api/context/${encodeURIComponent(sender)}`);
      state.contactContext = context;
      renderContactContext();
      return;
    }
  } catch (error) {
    alert(error.message);
  }
}

async function handleTaskAction(action, taskId) {
  if (!action || !taskId) {
    return;
  }

  const statusMap = {
    done: 'done',
    progress: 'in_progress',
    reopen: 'open',
  };
  const status = statusMap[action];
  if (!status) {
    return;
  }

  try {
    await api(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PATCH',
      body: { status },
    });
    await refreshAllData();
  } catch (error) {
    alert(error.message);
  }
}

async function handleRuleAction(action, ruleId) {
  if (action !== 'delete' || !ruleId) {
    return;
  }
  const shouldDelete = confirm('Remover esta regra?');
  if (!shouldDelete) {
    return;
  }
  try {
    await api(`/api/automations/rules/${encodeURIComponent(ruleId)}`, {
      method: 'DELETE',
    });
    await refreshAllData();
  } catch (error) {
    alert(error.message);
  }
}

async function handleIntegrationAction(action, integrationId) {
  if (!action || !integrationId) {
    return;
  }

  try {
    if (action === 'connect') {
      const accountLabel = prompt('Conta desta integração (opcional):') || '';
      await api('/api/integrations/connect', {
        method: 'POST',
        body: {
          integrationId,
          accountLabel: accountLabel.trim() || undefined,
        },
      });
      await refreshAllData();
      return;
    }

    if (action === 'disconnect') {
      await api('/api/integrations/disconnect', {
        method: 'POST',
        body: { integrationId },
      });
      await refreshAllData();
    }
  } catch (error) {
    alert(error.message);
  }
}

async function handleModuleAction(action, moduleId) {
  if (!action || !moduleId) {
    return;
  }

  const endpoint =
    action === 'activate' ? '/api/modules/activate' : '/api/modules/deactivate';

  try {
    await api(endpoint, {
      method: 'POST',
      body: { moduleId },
    });
    await refreshAllData();
  } catch (error) {
    alert(error.message);
  }
}

function attachDelegatedEvents() {
  el.inboxBuckets.addEventListener('click', (event) => {
    const target = event.target.closest('[data-bucket-filter]');
    if (!target) {
      return;
    }
    state.inboxBucketFilter = target.dataset.bucketFilter;
    renderInboxBuckets();
    renderInbox();
  });

  el.inboxList.addEventListener('click', (event) => {
    const target = event.target.closest('[data-inbox-action]');
    if (!target) {
      return;
    }
    handleInboxAction(target.dataset.inboxAction, target.dataset.messageId);
  });

  el.tasksList.addEventListener('click', (event) => {
    const target = event.target.closest('[data-task-action]');
    if (!target) {
      return;
    }
    handleTaskAction(target.dataset.taskAction, target.dataset.taskId);
  });

  el.rulesList.addEventListener('click', (event) => {
    const target = event.target.closest('[data-rule-action]');
    if (!target) {
      return;
    }
    handleRuleAction(target.dataset.ruleAction, target.dataset.ruleId);
  });

  el.integrationsGrid.addEventListener('click', (event) => {
    const target = event.target.closest('[data-integration-action]');
    if (!target) {
      return;
    }
    handleIntegrationAction(target.dataset.integrationAction, target.dataset.integrationId);
  });

  el.modulesGrid.addEventListener('click', (event) => {
    const target = event.target.closest('[data-module-action]');
    if (!target) {
      return;
    }
    handleModuleAction(target.dataset.moduleAction, target.dataset.moduleId);
  });
}

function attachEvents() {
  el.modeLogin.addEventListener('click', () => setAuthMode('login'));
  el.modeRegister.addEventListener('click', () => setAuthMode('register'));
  el.authForm.addEventListener('submit', handleAuthSubmit);
  el.logoutBtn.addEventListener('click', handleLogout);
  el.focusToggle.addEventListener('change', handleFocusToggle);
  el.refreshBtn.addEventListener('click', refreshAllData);
  el.taskForm.addEventListener('submit', handleCreateTask);
  el.messageForm.addEventListener('submit', handleCreateMessage);
  el.seedSampleBtn.addEventListener('click', handleSeedSample);
  el.ruleForm.addEventListener('submit', handleCreateRule);
  el.saveFocus.addEventListener('click', handleSaveFocus);
  el.savePrivacy.addEventListener('click', handleSavePrivacy);
  el.saveTheme.addEventListener('click', handleSaveTheme);
  el.focusThreshold.addEventListener('input', () => {
    el.focusThresholdLabel.textContent = String(el.focusThreshold.value);
  });

  el.globalSearch.addEventListener('input', () => {
    state.searchQuery = el.globalSearch.value.trim();
    renderInbox();
    renderTasks();
    renderEvents();
    renderNotes();
    renderRules();
    renderIntegrations();
    renderModules();
  });

  el.quickNewTask.addEventListener('click', () => {
    setView('tasks');
    el.taskTitle.focus();
  });

  el.quickNewRule.addEventListener('click', () => {
    setView('automations');
    el.ruleName.focus();
  });

  el.viewNav.addEventListener('click', (event) => {
    const target = event.target.closest('.nav-btn');
    if (!target) {
      return;
    }
    setView(target.dataset.view);
  });

  attachDelegatedEvents();
}

function init() {
  state.themeMode = normalizeThemeMode(state.themeMode);
  applyTheme();
  startThemeTicker();
  setAuthMode('login');
  setView('dashboard');
  attachEvents();
  bootstrapSession();
}

init();


