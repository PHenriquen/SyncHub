const { calculatePriority } = require('./priority-engine');
const { maybeExtractTaskFromMessage } = require('./task-extractor');
const { AutomationEngine } = require('../automation/automation-engine');
const { MODULE_CATALOG, getModule } = require('../modules/catalog');

const DEFAULT_MAX_ITEMS = 2500;
const INTEGRATION_CATALOG = Object.freeze({
  whatsapp: {
    id: 'whatsapp',
    name: 'WhatsApp',
    category: 'Messaging',
    status: 'beta',
    phase: 1,
  },
  telegram: {
    id: 'telegram',
    name: 'Telegram',
    category: 'Messaging',
    status: 'planned',
    phase: 2,
  },
  discord: {
    id: 'discord',
    name: 'Discord',
    category: 'Messaging',
    status: 'beta',
    phase: 1,
  },
  slack: {
    id: 'slack',
    name: 'Slack',
    category: 'Messaging',
    status: 'planned',
    phase: 3,
  },
  teams: {
    id: 'teams',
    name: 'Microsoft Teams',
    category: 'Messaging',
    status: 'planned',
    phase: 3,
  },
  gmail: {
    id: 'gmail',
    name: 'Gmail',
    category: 'Email',
    status: 'planned',
    phase: 2,
  },
  outlook: {
    id: 'outlook',
    name: 'Outlook',
    category: 'Email',
    status: 'planned',
    phase: 2,
  },
  google_calendar: {
    id: 'google_calendar',
    name: 'Google Calendar',
    category: 'Calendar',
    status: 'planned',
    phase: 1,
  },
  notion: {
    id: 'notion',
    name: 'Notion',
    category: 'Planning',
    status: 'planned',
    phase: 2,
  },
  trello: {
    id: 'trello',
    name: 'Trello',
    category: 'Planning',
    status: 'planned',
    phase: 2,
  },
  clickup: {
    id: 'clickup',
    name: 'ClickUp',
    category: 'Planning',
    status: 'planned',
    phase: 2,
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    category: 'Leads',
    status: 'planned',
    phase: 4,
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    category: 'Leads',
    status: 'planned',
    phase: 4,
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    category: 'Leads',
    status: 'planned',
    phase: 4,
  },
});

const WORK_SOURCES = new Set([
  'gmail',
  'outlook',
  'discord',
  'slack',
  'teams',
  'notion',
  'trello',
  'clickup',
  'linkedin',
  'instagram',
  'youtube',
]);

const PERSONAL_HINTS = ['familia', 'amigo', 'pessoal', 'casa', 'festa', 'viagem'];
const AUTO_HINTS = ['automatico', 'bot', 'sistema', 'notificacao', 'lembrete'];
const WORK_HINTS = ['cliente', 'reuniao', 'projeto', 'entrega', 'orcamento', 'prazo', 'sla'];
const NEGATIVE_HINTS = ['urgente', 'atrasado', 'problema', 'erro', 'critico', 'reclamacao'];
const POSITIVE_HINTS = ['obrigado', 'parabens', 'sucesso', 'fechado', 'aprovado', 'otimo'];

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeIsoDate(value) {
  const parsed = new Date(value || Date.now());
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function capArraySize(array, maxItems) {
  if (array.length > maxItems) {
    array.length = maxItems;
  }
}

function normalizeSource(source) {
  const normalized = String(source || 'manual').trim().toLowerCase();
  return normalized || 'manual';
}

function normalizeModuleList(rawModuleList) {
  if (!Array.isArray(rawModuleList)) {
    return [];
  }
  return rawModuleList.map((moduleId) => String(moduleId).trim()).filter(Boolean);
}

function mergeKeywordBoost(modules) {
  const merged = {};
  for (const moduleDef of modules) {
    if (!moduleDef || !moduleDef.keywordBoost) {
      continue;
    }
    for (const [keyword, value] of Object.entries(moduleDef.keywordBoost)) {
      merged[keyword] = (merged[keyword] || 0) + value;
    }
  }
  return merged;
}

function mergeSenderRoleBoost(modules) {
  const merged = {};
  for (const moduleDef of modules) {
    if (!moduleDef || !moduleDef.senderRoleBoost) {
      continue;
    }
    for (const [senderRole, value] of Object.entries(moduleDef.senderRoleBoost)) {
      merged[senderRole] = (merged[senderRole] || 0) + value;
    }
  }
  return merged;
}

function parseCounterFromIds(items, prefix) {
  if (!Array.isArray(items)) {
    return 0;
  }
  let max = 0;
  for (const item of items) {
    const id = String(item && item.id ? item.id : '');
    const matched = id.match(new RegExp(`^${prefix}(\\d+)$`));
    if (!matched) {
      continue;
    }
    const value = Number(matched[1]);
    if (Number.isFinite(value) && value > max) {
      max = value;
    }
  }
  return max;
}

function buildInitialIntegrations(rawState) {
  const base = {};
  const source = rawState && typeof rawState === 'object' ? rawState : {};
  const now = new Date().toISOString();

  for (const [integrationId, integrationInfo] of Object.entries(INTEGRATION_CATALOG)) {
    const saved = source[integrationId] && typeof source[integrationId] === 'object'
      ? source[integrationId]
      : {};
    base[integrationId] = {
      connected: Boolean(saved.connected),
      accountLabel: saved.accountLabel ? String(saved.accountLabel) : null,
      connectedAt: saved.connectedAt || null,
      disconnectedAt: saved.disconnectedAt || null,
      lastSyncAt: saved.lastSyncAt || null,
      status: saved.status ? String(saved.status) : 'idle',
      lastError: saved.lastError ? String(saved.lastError) : null,
      updatedAt: saved.updatedAt || now,
      version: integrationInfo.status,
    };
  }

  return base;
}

function containsAnyWord(text, words) {
  const normalized = String(text || '').toLowerCase();
  return words.some((word) => normalized.includes(word));
}

function detectEmotion(text) {
  if (containsAnyWord(text, NEGATIVE_HINTS)) {
    return 'negative';
  }
  if (containsAnyWord(text, POSITIVE_HINTS)) {
    return 'positive';
  }
  return 'neutral';
}

function detectIntent(text) {
  const normalized = String(text || '').toLowerCase();
  if (normalized.includes('orcamento') || normalized.includes('proposta')) {
    return 'commercial';
  }
  if (normalized.includes('reuniao') || normalized.includes('agenda')) {
    return 'meeting';
  }
  if (normalized.includes('prazo') || normalized.includes('entrega')) {
    return 'deadline';
  }
  if (normalized.includes('duvida') || normalized.includes('pergunta')) {
    return 'question';
  }
  return 'general';
}

function detectInboxBucket({ source, senderRole, text, priorityLevel }) {
  const normalizedSource = String(source || '').toLowerCase();
  const normalizedRole = String(senderRole || '').toLowerCase();
  const normalizedText = String(text || '').toLowerCase();

  if (priorityLevel === 'critical' || priorityLevel === 'high') {
    return 'urgent';
  }

  if (containsAnyWord(normalizedText, AUTO_HINTS) || normalizedSource === 'calendar') {
    return 'automatic';
  }

  if (
    WORK_SOURCES.has(normalizedSource) ||
    ['client', 'manager', 'professor', 'lead', 'gestor'].includes(normalizedRole) ||
    containsAnyWord(normalizedText, WORK_HINTS)
  ) {
    return 'work';
  }

  if (containsAnyWord(normalizedText, PERSONAL_HINTS)) {
    return 'personal';
  }

  return 'work';
}

class SyncHubCore {
  constructor(options) {
    const safeOptions = options || {};
    this.maxItems = Number.isFinite(Number(safeOptions.maxItems))
      ? Number(safeOptions.maxItems)
      : DEFAULT_MAX_ITEMS;

    this.messages = [];
    this.tasks = [];
    this.notifications = [];
    this.events = [];
    this.notes = [];
    this.messageCounter = 0;
    this.taskCounter = 0;
    this.notificationCounter = 0;
    this.eventCounter = 0;
    this.noteCounter = 0;
    this.integrations = buildInitialIntegrations(safeOptions.integrationsState);
    this.privacyMode = safeOptions.privacyMode === 'strict' ? 'strict' : 'balanced';

    this.focusMode = {
      enabled: false,
      threshold: Number.isFinite(Number(safeOptions.focusThreshold))
        ? clamp(Number(safeOptions.focusThreshold), 1, 100)
        : 70,
    };

    this.activeModules = new Set();
    for (const moduleId of normalizeModuleList(safeOptions.activeModules)) {
      this.activateModule(moduleId);
    }

    this.automation =
      safeOptions.automationSnapshot && typeof safeOptions.automationSnapshot === 'object'
        ? new AutomationEngine(safeOptions.automationSnapshot)
        : new AutomationEngine();

    const shouldInstallDefaultRules = safeOptions.installDefaultRules !== false;
    if (shouldInstallDefaultRules && this.automation.listRules().length === 0) {
      this.installDefaultAutomationRules();
    }
  }

  installDefaultAutomationRules() {
    this.automation.addRule({
      name: 'Lead com palavra orcamento',
      trigger: {
        containsAny: ['orcamento'],
        minPriority: 55,
      },
      actions: [
        {
          type: 'create_task',
          payload: {
            titlePrefix: 'Follow-up comercial',
          },
        },
        {
          type: 'notify_channel',
          payload: {
            channel: 'sales-pipeline',
            message: 'Lead novo detectado com palavra-chave de orcamento.',
          },
        },
        {
          type: 'auto_reply',
          payload: {
            message:
              'Recebemos sua solicitacao e vamos enviar o orcamento com os proximos passos.',
          },
        },
      ],
    });
  }

  activateModule(moduleId) {
    if (!getModule(moduleId)) {
      return false;
    }
    this.activeModules.add(moduleId);
    return true;
  }

  deactivateModule(moduleId) {
    return this.activeModules.delete(moduleId);
  }

  listActiveModules() {
    return Array.from(this.activeModules)
      .map((moduleId) => MODULE_CATALOG[moduleId])
      .filter(Boolean)
      .map((moduleDef) => ({
        id: moduleDef.id,
        name: moduleDef.name,
        description: moduleDef.description,
      }));
  }

  pickDefaultModule(moduleId) {
    if (moduleId && getModule(moduleId)) {
      return moduleId;
    }
    if (this.activeModules.size === 0) {
      return null;
    }
    return Array.from(this.activeModules)[0];
  }

  getBoostContext(moduleId) {
    const modulesInContext = [];
    for (const activeModuleId of this.activeModules) {
      const moduleDef = getModule(activeModuleId);
      if (moduleDef) {
        modulesInContext.push(moduleDef);
      }
    }
    if (moduleId && !this.activeModules.has(moduleId)) {
      const extraModule = getModule(moduleId);
      if (extraModule) {
        modulesInContext.push(extraModule);
      }
    }

    return {
      moduleKeywordBoost: mergeKeywordBoost(modulesInContext),
      moduleSenderRoleBoost: mergeSenderRoleBoost(modulesInContext),
    };
  }

  buildTags(message) {
    const tags = [];

    if (message.priority.level === 'critical' || message.priority.level === 'high') {
      tags.push('high-priority');
    }

    if (message.moduleId) {
      tags.push(`module:${message.moduleId}`);
    }

    if (Array.isArray(message.priority.matchedKeywords)) {
      tags.push(
        ...message.priority.matchedKeywords.slice(0, 3).map((keyword) => `keyword:${keyword}`)
      );
    }

    return Array.from(new Set(tags));
  }

  ingestMessage(rawInput) {
    const input = rawInput && typeof rawInput === 'object' ? rawInput : {};
    const text = String(input.text || '').trim();
    if (!text) {
      throw new Error('Message text is required.');
    }

    const moduleId = this.pickDefaultModule(input.moduleId);
    const source = normalizeSource(input.source);
    const createdAt = sanitizeIsoDate(input.createdAt);
    const boostContext = this.getBoostContext(moduleId);

    const priority = calculatePriority({
      text,
      source,
      senderRole: input.senderRole,
      createdAt,
      moduleKeywordBoost: boostContext.moduleKeywordBoost,
      moduleSenderRoleBoost: boostContext.moduleSenderRoleBoost,
      focusModeEnabled: this.focusMode.enabled,
    });

    const message = {
      id: `msg_${++this.messageCounter}`,
      source,
      channel: String(input.channel || source).trim() || source,
      sender: String(input.sender || 'unknown'),
      senderRole: String(input.senderRole || '').trim() || null,
      text,
      moduleId,
      createdAt,
      metadata:
        input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
          ? input.metadata
          : {},
      priority,
      tags: [],
      automation: [],
      bucket: detectInboxBucket({
        source,
        senderRole: input.senderRole,
        text,
        priorityLevel: priority.level,
      }),
      intelligence: {
        emotion: detectEmotion(text),
        intent: detectIntent(text),
      },
    };

    message.tags = this.buildTags(message);
    this.messages.unshift(message);
    capArraySize(this.messages, this.maxItems);

    const createdTasks = [];
    const extractedTask = maybeExtractTaskFromMessage(message);
    if (extractedTask) {
      createdTasks.push(this.createTask(extractedTask));
    }

    const automationExecutions = this.automation.evaluate(message);
    const automationLog = [];

    for (const execution of automationExecutions) {
      for (const action of execution.actions) {
        const logEntry = this.executeAction(action, message);
        automationLog.push({
          ruleId: execution.ruleId,
          ruleName: execution.ruleName,
          actionType: action.type,
          result: logEntry,
        });

        if (action.type === 'create_task' && logEntry && logEntry.taskId) {
          const task = this.tasks.find((candidate) => candidate.id === logEntry.taskId);
          if (task) {
            createdTasks.push(task);
          }
        }
      }
    }

    message.automation = automationLog;
    return {
      message,
      createdTasks,
      automation: automationLog,
    };
  }

  executeAction(action, message) {
    if (!action || !action.type) {
      return { status: 'ignored', reason: 'Invalid action.' };
    }

    if (action.type === 'create_task') {
      const titlePrefix = String(action.payload && action.payload.titlePrefix ? action.payload.titlePrefix : '')
        .trim();
      const task = this.createTask({
        title: titlePrefix ? `${titlePrefix}: ${message.text.slice(0, 60)}` : message.text,
        sourceMessageId: message.id,
        source: message.source,
        moduleId: message.moduleId,
        priorityLevel: message.priority.level,
      });
      return { status: 'created', taskId: task.id };
    }

    if (action.type === 'notify_channel') {
      const notification = this.createNotification({
        type: 'channel',
        channel: String(action.payload && action.payload.channel ? action.payload.channel : 'general'),
        message:
          String(action.payload && action.payload.message ? action.payload.message : '').trim() ||
          `Mensagem prioritaria recebida de ${message.sender}.`,
        sourceMessageId: message.id,
      });
      return { status: 'sent', notificationId: notification.id };
    }

    if (action.type === 'auto_reply') {
      const notification = this.createNotification({
        type: 'auto-reply',
        channel: message.channel,
        message:
          String(action.payload && action.payload.message ? action.payload.message : '').trim() ||
          'Mensagem recebida e processada automaticamente.',
        sourceMessageId: message.id,
      });
      return { status: 'queued', notificationId: notification.id };
    }

    if (action.type === 'tag_message') {
      const tag = String(action.payload && action.payload.tag ? action.payload.tag : '').trim();
      if (!tag) {
        return { status: 'ignored', reason: 'Tag not provided.' };
      }
      message.tags = Array.from(new Set([...message.tags, tag]));
      return { status: 'tagged', tag };
    }

    return { status: 'ignored', reason: 'Unsupported action type.' };
  }

  createNotification(rawInput) {
    const input = rawInput && typeof rawInput === 'object' ? rawInput : {};
    const notification = {
      id: `notif_${++this.notificationCounter}`,
      type: String(input.type || 'system'),
      channel: input.channel ? String(input.channel) : 'general',
      message: String(input.message || 'Nova notificacao'),
      sourceMessageId: input.sourceMessageId || null,
      createdAt: new Date().toISOString(),
    };
    this.notifications.unshift(notification);
    capArraySize(this.notifications, this.maxItems);
    return notification;
  }

  findMessageById(messageId) {
    if (!messageId) {
      return null;
    }
    return this.messages.find((message) => message.id === messageId) || null;
  }

  createTaskFromMessage(messageId, titleOverride) {
    const message = this.findMessageById(messageId);
    if (!message) {
      throw new Error('Message not found.');
    }
    const title = String(titleOverride || message.text || '').trim() || 'Nova tarefa';
    return this.createTask({
      title,
      source: message.source,
      moduleId: message.moduleId || null,
      priorityLevel: message.priority && message.priority.level ? message.priority.level : 'medium',
      sourceMessageId: message.id,
    });
  }

  createTask(rawInput) {
    const input = rawInput && typeof rawInput === 'object' ? rawInput : {};
    const title = String(input.title || 'Nova tarefa').replace(/\s+/g, ' ').trim();
    const dueDate = input.dueDate ? sanitizeIsoDate(input.dueDate) : null;

    const task = {
      id: `task_${++this.taskCounter}`,
      title: title || 'Nova tarefa',
      status: 'open',
      source: String(input.source || 'core'),
      moduleId: input.moduleId || null,
      priorityLevel: String(input.priorityLevel || 'medium'),
      dueDate,
      sourceMessageId: input.sourceMessageId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.tasks.unshift(task);
    capArraySize(this.tasks, this.maxItems);
    return task;
  }

  updateTask(taskId, rawUpdates) {
    const updates = rawUpdates && typeof rawUpdates === 'object' ? rawUpdates : {};
    const task = this.tasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      throw new Error('Task not found.');
    }

    if (updates.status !== undefined) {
      const status = String(updates.status).trim().toLowerCase();
      const allowed = new Set(['open', 'in_progress', 'done', 'canceled']);
      if (!allowed.has(status)) {
        throw new Error('Invalid task status.');
      }
      task.status = status;
    }

    if (updates.title !== undefined) {
      const nextTitle = String(updates.title || '').replace(/\s+/g, ' ').trim();
      if (!nextTitle) {
        throw new Error('Task title is required.');
      }
      task.title = nextTitle;
    }

    task.updatedAt = new Date().toISOString();
    return task;
  }

  sendManualReply(messageId, replyText) {
    const message = this.findMessageById(messageId);
    if (!message) {
      throw new Error('Message not found.');
    }

    const text = String(replyText || '').trim();
    if (!text) {
      throw new Error('Reply text is required.');
    }

    return this.createNotification({
      type: 'manual-reply',
      channel: message.channel,
      message: text,
      sourceMessageId: message.id,
    });
  }

  listTasks(filters) {
    const safeFilters = filters || {};
    let items = [...this.tasks];
    if (safeFilters.status) {
      items = items.filter((task) => task.status === safeFilters.status);
    }
    if (safeFilters.moduleId) {
      items = items.filter((task) => task.moduleId === safeFilters.moduleId);
    }
    return items;
  }

  setFocusMode(enabled, threshold) {
    this.focusMode.enabled = Boolean(enabled);
    if (Number.isFinite(Number(threshold))) {
      this.focusMode.threshold = clamp(Number(threshold), 1, 100);
    }
    return this.getFocusModeState();
  }

  getFocusModeState() {
    return {
      enabled: this.focusMode.enabled,
      threshold: this.focusMode.threshold,
    };
  }

  getInbox(options) {
    const safeOptions = options || {};
    const limit = clamp(Number(safeOptions.limit) || 50, 1, 500);
    const focus = safeOptions.focus === true || this.focusMode.enabled;
    let items = [...this.messages];

    if (focus) {
      items = items.filter((message) => message.priority.score >= this.focusMode.threshold);
    }

    items.sort((left, right) => {
      if (right.priority.score !== left.priority.score) {
        return right.priority.score - left.priority.score;
      }
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });

    return items.slice(0, limit);
  }

  getInboxBuckets(options) {
    const safeOptions = options || {};
    const limit = clamp(Number(safeOptions.limit) || 200, 1, 2000);
    const items = this.getInbox({ limit, focus: safeOptions.focus });
    const buckets = {
      urgent: [],
      work: [],
      personal: [],
      automatic: [],
    };

    for (const item of items) {
      const bucket = buckets[item.bucket] ? item.bucket : 'work';
      buckets[bucket].push(item);
    }

    return {
      counts: {
        urgent: buckets.urgent.length,
        work: buckets.work.length,
        personal: buckets.personal.length,
        automatic: buckets.automatic.length,
      },
      buckets,
    };
  }

  setPrivacyMode(mode) {
    const normalized = String(mode || '').trim().toLowerCase();
    if (!['balanced', 'strict'].includes(normalized)) {
      throw new Error('Invalid privacy mode.');
    }
    this.privacyMode = normalized;
    return this.privacyMode;
  }

  getPrivacyMode() {
    return this.privacyMode;
  }

  createEventFromMessage(messageId, rawInput) {
    const message = this.findMessageById(messageId);
    if (!message) {
      throw new Error('Message not found.');
    }

    const input = rawInput && typeof rawInput === 'object' ? rawInput : {};
    const startsAt = input.startsAt
      ? sanitizeIsoDate(input.startsAt)
      : new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const event = {
      id: `event_${++this.eventCounter}`,
      title: String(input.title || message.text).slice(0, 120),
      startsAt,
      source: message.source,
      sourceMessageId: message.id,
      contact: message.sender,
      createdAt: new Date().toISOString(),
    };

    this.events.unshift(event);
    capArraySize(this.events, this.maxItems);
    return event;
  }

  createNoteFromMessage(messageId, rawInput) {
    const message = this.findMessageById(messageId);
    if (!message) {
      throw new Error('Message not found.');
    }

    const input = rawInput && typeof rawInput === 'object' ? rawInput : {};
    const note = {
      id: `note_${++this.noteCounter}`,
      title: String(input.title || `Nota de ${message.sender}`).slice(0, 120),
      body: String(input.body || message.text),
      source: message.source,
      sourceMessageId: message.id,
      contact: message.sender,
      createdAt: new Date().toISOString(),
    };

    this.notes.unshift(note);
    capArraySize(this.notes, this.maxItems);
    return note;
  }

  convertMessage(messageId, targetType, rawInput) {
    const type = String(targetType || '').trim().toLowerCase();
    if (type === 'task') {
      return { type, item: this.createTaskFromMessage(messageId, rawInput && rawInput.title) };
    }
    if (type === 'event') {
      return { type, item: this.createEventFromMessage(messageId, rawInput) };
    }
    if (type === 'note') {
      return { type, item: this.createNoteFromMessage(messageId, rawInput) };
    }
    throw new Error('Unsupported conversion type.');
  }

  listEvents(limit) {
    const safeLimit = clamp(Number(limit) || 100, 1, 1000);
    return this.events.slice(0, safeLimit);
  }

  listNotes(limit) {
    const safeLimit = clamp(Number(limit) || 100, 1, 1000);
    return this.notes.slice(0, safeLimit);
  }

  getUnifiedContext(contactRef) {
    const ref = String(contactRef || '').trim().toLowerCase();
    if (!ref) {
      throw new Error('contactRef is required.');
    }

    const relatedMessages = this.messages
      .filter((message) => String(message.sender || '').toLowerCase().includes(ref))
      .slice(0, 8);
    const relatedMessageIds = new Set(relatedMessages.map((message) => message.id));

    const relatedTasks = this.tasks
      .filter(
        (task) =>
          relatedMessageIds.has(task.sourceMessageId) ||
          String(task.title || '').toLowerCase().includes(ref)
      )
      .slice(0, 6);

    const relatedEvents = this.events
      .filter(
        (event) =>
          relatedMessageIds.has(event.sourceMessageId) ||
          String(event.contact || '').toLowerCase().includes(ref)
      )
      .slice(0, 4);

    const relatedNotes = this.notes
      .filter(
        (note) =>
          relatedMessageIds.has(note.sourceMessageId) ||
          String(note.contact || '').toLowerCase().includes(ref)
      )
      .slice(0, 4);

    return {
      contactRef: ref,
      summary: {
        messages: relatedMessages.length,
        tasks: relatedTasks.length,
        events: relatedEvents.length,
        notes: relatedNotes.length,
      },
      lastMessages: relatedMessages,
      relatedTasks,
      relatedEvents,
      relatedNotes,
    };
  }

  getProductivityScore(referenceDate) {
    const now = referenceDate ? new Date(referenceDate) : new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    const messagesToday = this.messages.filter(
      (message) => new Date(message.createdAt).getTime() >= dayStart.getTime()
    );
    const totalToday = messagesToday.length || 1;
    const urgentToday = messagesToday.filter(
      (message) => message.priority.level === 'critical' || message.priority.level === 'high'
    ).length;

    const tasksToday = this.tasks.filter(
      (task) => new Date(task.createdAt).getTime() >= dayStart.getTime()
    );
    const doneToday = tasksToday.filter((task) => task.status === 'done').length;
    const taskCompletionRatio = tasksToday.length > 0 ? doneToday / tasksToday.length : 0.6;

    const urgentPressure = urgentToday / totalToday;
    const focusBonus = this.focusMode.enabled ? 0.15 : 0;

    const score = clamp(
      Math.round((taskCompletionRatio * 55 + (1 - urgentPressure) * 30 + focusBonus * 100)),
      5,
      100
    );

    return {
      score,
      factors: {
        taskCompletionRatio: Number(taskCompletionRatio.toFixed(2)),
        urgentPressure: Number(urgentPressure.toFixed(2)),
        focusModeEnabled: this.focusMode.enabled,
      },
    };
  }

  getWeeklyReport(referenceDate) {
    const end = referenceDate ? new Date(referenceDate) : new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    const weekMessages = this.messages.filter((message) => {
      const ts = new Date(message.createdAt).getTime();
      return ts >= start.getTime() && ts <= end.getTime();
    });

    const weekTasks = this.tasks.filter((task) => {
      const ts = new Date(task.createdAt).getTime();
      return ts >= start.getTime() && ts <= end.getTime();
    });

    const doneTasks = weekTasks.filter((task) => task.status === 'done').length;
    const productivity = this.getProductivityScore(end);
    const connectedIntegrations = this.listIntegrations().filter(
      (integration) => integration.state && integration.state.connected
    ).length;

    const insights = [];
    if (weekMessages.length > 0) {
      insights.push(`Voce recebeu ${weekMessages.length} mensagens na semana.`);
    }
    if (weekTasks.length > 0) {
      insights.push(`Concluiu ${doneTasks} de ${weekTasks.length} tarefas criadas nesta semana.`);
    }
    if (connectedIntegrations >= 4) {
      insights.push('Seu ecossistema esta bem conectado para automacoes avancadas.');
    } else {
      insights.push('Conectar mais apps aumenta o contexto da IA e a qualidade da priorizacao.');
    }
    if (productivity.score >= 75) {
      insights.push('Seu score de produtividade semanal esta forte.');
    } else {
      insights.push('Ha espaco para melhorar foco e ritmo de entrega na proxima semana.');
    }

    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
      metrics: {
        messages: weekMessages.length,
        tasksCreated: weekTasks.length,
        tasksDone: doneTasks,
        connectedIntegrations,
      },
      productivity,
      insights,
    };
  }

  getDailyOverview(referenceDate) {
    const now = referenceDate ? new Date(referenceDate) : new Date();
    const validNow = Number.isNaN(now.getTime()) ? new Date() : now;
    const start = new Date(validNow);
    start.setHours(0, 0, 0, 0);
    const end = new Date(validNow);
    end.setHours(23, 59, 59, 999);

    const messagesToday = this.messages.filter((message) => {
      const ts = new Date(message.createdAt).getTime();
      return ts >= start.getTime() && ts <= end.getTime();
    });

    const priorityBreakdown = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    const sourceBreakdown = {};
    const bucketBreakdown = {
      urgent: 0,
      work: 0,
      personal: 0,
      automatic: 0,
    };
    for (const message of messagesToday) {
      priorityBreakdown[message.priority.level] += 1;
      sourceBreakdown[message.source] = (sourceBreakdown[message.source] || 0) + 1;
      const bucket = bucketBreakdown[message.bucket] !== undefined ? message.bucket : 'work';
      bucketBreakdown[bucket] += 1;
    }

    const pendingTasks = this.tasks.filter((task) => task.status !== 'done');
    const overdueTasks = pendingTasks.filter((task) => {
      if (!task.dueDate) {
        return false;
      }
      return new Date(task.dueDate).getTime() < validNow.getTime();
    });

    const dueTodayTasks = pendingTasks.filter((task) => {
      if (!task.dueDate) {
        return false;
      }
      const due = new Date(task.dueDate).getTime();
      return due >= start.getTime() && due <= end.getTime();
    });
    const productivity = this.getProductivityScore(validNow);

    return {
      date: start.toISOString().slice(0, 10),
      focusMode: this.getFocusModeState(),
      privacyMode: this.getPrivacyMode(),
      activeModules: this.listActiveModules(),
      inbox: {
        totalMessages: this.messages.length,
        messagesToday: messagesToday.length,
        priorityBreakdown,
        sourceBreakdown,
        bucketBreakdown,
      },
      tasks: {
        total: this.tasks.length,
        pending: pendingTasks.length,
        dueToday: dueTodayTasks.length,
        overdue: overdueTasks.length,
      },
      conversions: {
        events: this.events.length,
        notes: this.notes.length,
      },
      smart: {
        productivity,
      },
      topPriorityMessages: this.getInbox({ limit: 5, focus: true }).map((message) => ({
        id: message.id,
        source: message.source,
        sender: message.sender,
        text: message.text,
        priority: message.priority,
      })),
      automationRules: this.automation.listRules().length,
    };
  }

  addAutomationRule(rule) {
    return this.automation.addRule(rule);
  }

  listAutomationRules() {
    return this.automation.listRules();
  }

  removeAutomationRule(ruleId) {
    return this.automation.removeRule(ruleId);
  }

  listNotifications(limit) {
    const safeLimit = clamp(Number(limit) || 50, 1, 500);
    return this.notifications.slice(0, safeLimit);
  }

  seedSampleData() {
    const samples = [
      {
        source: 'whatsapp',
        channel: 'clientes',
        sender: 'Cliente XPTO',
        senderRole: 'client',
        moduleId: 'freelancer',
        text: 'Precisamos de um orcamento urgente para landing page ate 20/03/2026.',
      },
      {
        source: 'gmail',
        channel: 'inbox',
        sender: 'Professor Ana',
        senderRole: 'professor',
        moduleId: 'student',
        text: 'Lembrete: prova final de algoritmos amanha as 08:00.',
      },
      {
        source: 'discord',
        channel: 'squad-backend',
        sender: 'NOC',
        senderRole: 'manager',
        moduleId: 'company',
        text: 'Incidente critico em producao. Servico de notificacao fora do ar.',
      },
    ];

    const ingestResults = [];
    for (const sample of samples) {
      ingestResults.push(this.ingestMessage(sample));
    }
    return ingestResults;
  }

  listIntegrations() {
    return Object.values(INTEGRATION_CATALOG).map((integrationInfo) => ({
      ...integrationInfo,
      state: this.integrations[integrationInfo.id],
    }));
  }

  connectIntegration(rawInput) {
    const input = rawInput && typeof rawInput === 'object' ? rawInput : {};
    const integrationId = String(input.integrationId || '').trim();
    if (!INTEGRATION_CATALOG[integrationId]) {
      throw new Error('Integration not found.');
    }

    const now = new Date().toISOString();
    const current = this.integrations[integrationId] || {};
    this.integrations[integrationId] = {
      ...current,
      connected: true,
      status: 'connected',
      accountLabel: input.accountLabel ? String(input.accountLabel).trim() : current.accountLabel,
      connectedAt: current.connectedAt || now,
      disconnectedAt: null,
      lastSyncAt: now,
      lastError: null,
      updatedAt: now,
      version: INTEGRATION_CATALOG[integrationId].status,
    };

    return {
      integration: {
        ...INTEGRATION_CATALOG[integrationId],
        state: this.integrations[integrationId],
      },
    };
  }

  disconnectIntegration(rawInput) {
    const input = rawInput && typeof rawInput === 'object' ? rawInput : {};
    const integrationId = String(input.integrationId || '').trim();
    if (!INTEGRATION_CATALOG[integrationId]) {
      throw new Error('Integration not found.');
    }

    const now = new Date().toISOString();
    const current = this.integrations[integrationId] || {};
    this.integrations[integrationId] = {
      ...current,
      connected: false,
      status: 'disconnected',
      disconnectedAt: now,
      updatedAt: now,
      version: INTEGRATION_CATALOG[integrationId].status,
    };

    return {
      integration: {
        ...INTEGRATION_CATALOG[integrationId],
        state: this.integrations[integrationId],
      },
    };
  }

  toSnapshot() {
    return {
      version: 1,
      maxItems: this.maxItems,
      messageCounter: this.messageCounter,
      taskCounter: this.taskCounter,
      notificationCounter: this.notificationCounter,
      eventCounter: this.eventCounter,
      noteCounter: this.noteCounter,
      focusMode: this.getFocusModeState(),
      privacyMode: this.getPrivacyMode(),
      activeModules: Array.from(this.activeModules),
      messages: cloneJson(this.messages),
      tasks: cloneJson(this.tasks),
      notifications: cloneJson(this.notifications),
      events: cloneJson(this.events),
      notes: cloneJson(this.notes),
      integrations: cloneJson(this.integrations),
      automation: this.automation.toSnapshot(),
      updatedAt: new Date().toISOString(),
    };
  }

  static fromSnapshot(snapshot, fallbackOptions) {
    const safeSnapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const safeFallback = fallbackOptions || {};

    const maxItems =
      Number.isFinite(Number(safeSnapshot.maxItems)) && Number(safeSnapshot.maxItems) > 0
        ? Number(safeSnapshot.maxItems)
        : safeFallback.maxItems;

    const focusThreshold =
      safeSnapshot.focusMode && Number.isFinite(Number(safeSnapshot.focusMode.threshold))
        ? Number(safeSnapshot.focusMode.threshold)
        : safeFallback.focusThreshold;

    const activeModules = Array.isArray(safeSnapshot.activeModules)
      ? safeSnapshot.activeModules
      : safeFallback.activeModules;

    const core = new SyncHubCore({
      maxItems,
      activeModules,
      focusThreshold,
      installDefaultRules: false,
      automationSnapshot: safeSnapshot.automation,
      integrationsState: safeSnapshot.integrations,
      privacyMode: safeSnapshot.privacyMode,
    });

    core.messages = Array.isArray(safeSnapshot.messages) ? cloneJson(safeSnapshot.messages) : [];
    core.tasks = Array.isArray(safeSnapshot.tasks) ? cloneJson(safeSnapshot.tasks) : [];
    core.notifications = Array.isArray(safeSnapshot.notifications)
      ? cloneJson(safeSnapshot.notifications)
      : [];
    core.events = Array.isArray(safeSnapshot.events) ? cloneJson(safeSnapshot.events) : [];
    core.notes = Array.isArray(safeSnapshot.notes) ? cloneJson(safeSnapshot.notes) : [];

    capArraySize(core.messages, core.maxItems);
    capArraySize(core.tasks, core.maxItems);
    capArraySize(core.notifications, core.maxItems);
    capArraySize(core.events, core.maxItems);
    capArraySize(core.notes, core.maxItems);

    core.messageCounter = Number.isFinite(Number(safeSnapshot.messageCounter))
      ? Number(safeSnapshot.messageCounter)
      : parseCounterFromIds(core.messages, 'msg_');
    core.taskCounter = Number.isFinite(Number(safeSnapshot.taskCounter))
      ? Number(safeSnapshot.taskCounter)
      : parseCounterFromIds(core.tasks, 'task_');
    core.notificationCounter = Number.isFinite(Number(safeSnapshot.notificationCounter))
      ? Number(safeSnapshot.notificationCounter)
      : parseCounterFromIds(core.notifications, 'notif_');
    core.eventCounter = Number.isFinite(Number(safeSnapshot.eventCounter))
      ? Number(safeSnapshot.eventCounter)
      : parseCounterFromIds(core.events, 'event_');
    core.noteCounter = Number.isFinite(Number(safeSnapshot.noteCounter))
      ? Number(safeSnapshot.noteCounter)
      : parseCounterFromIds(core.notes, 'note_');

    core.focusMode.enabled = Boolean(
      safeSnapshot.focusMode && safeSnapshot.focusMode.enabled
    );
    core.focusMode.threshold = Number.isFinite(Number(focusThreshold))
      ? clamp(Number(focusThreshold), 1, 100)
      : 70;
    core.privacyMode = safeSnapshot.privacyMode === 'strict' ? 'strict' : 'balanced';

    if (core.automation.listRules().length === 0) {
      core.installDefaultAutomationRules();
    }

    return core;
  }
}

module.exports = {
  SyncHubCore,
};
