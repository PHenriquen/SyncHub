const { normalizeText } = require('../core/priority-engine');

const ALLOWED_ACTION_TYPES = new Set([
  'create_task',
  'notify_channel',
  'auto_reply',
  'tag_message',
]);

function normalizeStringArray(rawArray) {
  if (!Array.isArray(rawArray)) {
    return [];
  }
  return rawArray
    .map((value) => normalizeText(value))
    .filter(Boolean);
}

function normalizeActionList(rawActions) {
  if (!Array.isArray(rawActions)) {
    return [];
  }
  return rawActions
    .filter((rawAction) => rawAction && ALLOWED_ACTION_TYPES.has(rawAction.type))
    .map((rawAction) => ({
      type: rawAction.type,
      payload: rawAction.payload && typeof rawAction.payload === 'object' ? rawAction.payload : {},
    }));
}

function normalizeTrigger(rawTrigger) {
  const trigger = rawTrigger && typeof rawTrigger === 'object' ? rawTrigger : {};
  const minPriority =
    Number.isFinite(Number(trigger.minPriority)) ? Number(trigger.minPriority) : null;
  return {
    containsAny: normalizeStringArray(trigger.containsAny),
    source: trigger.source ? normalizeText(trigger.source) : null,
    moduleId: trigger.moduleId ? String(trigger.moduleId).trim() : null,
    senderRole: trigger.senderRole ? normalizeText(trigger.senderRole) : null,
    minPriority,
  };
}

function parseRuleIndex(ruleId) {
  const matched = String(ruleId || '').match(/^rule_(\d+)$/);
  if (!matched) {
    return 0;
  }
  const value = Number(matched[1]);
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value;
}

function toPublicRule(rule) {
  return {
    id: rule.id,
    name: rule.name,
    enabled: rule.enabled,
    trigger: rule.trigger,
    actions: rule.actions,
    createdAt: rule.createdAt,
  };
}

function matchesRule(rule, message) {
  if (!rule.enabled) {
    return false;
  }

  if (rule.trigger.source && normalizeText(message.source) !== rule.trigger.source) {
    return false;
  }

  if (rule.trigger.moduleId && String(message.moduleId || '') !== rule.trigger.moduleId) {
    return false;
  }

  if (
    rule.trigger.senderRole &&
    normalizeText(message.senderRole || '') !== rule.trigger.senderRole
  ) {
    return false;
  }

  if (
    Number.isFinite(rule.trigger.minPriority) &&
    (!message.priority || message.priority.score < rule.trigger.minPriority)
  ) {
    return false;
  }

  if (rule.trigger.containsAny.length > 0) {
    const messageText = message.priority
      ? message.priority.normalizedText
      : normalizeText(message.text || '');
    const found = rule.trigger.containsAny.some((word) => messageText.includes(word));
    if (!found) {
      return false;
    }
  }

  return true;
}

class AutomationEngine {
  constructor(snapshot) {
    this.rules = [];
    this.ruleCounter = 0;
    if (snapshot && typeof snapshot === 'object') {
      this.loadSnapshot(snapshot);
    }
  }

  nextRuleId() {
    this.ruleCounter += 1;
    return `rule_${this.ruleCounter}`;
  }

  addRule(rawRule, options) {
    const safeOptions = options || {};
    const name = String(rawRule && rawRule.name ? rawRule.name : '').trim();
    if (!name) {
      throw new Error('Rule name is required.');
    }

    const ruleId = safeOptions.id ? String(safeOptions.id) : this.nextRuleId();
    const forcedIndex = parseRuleIndex(ruleId);
    if (forcedIndex > this.ruleCounter) {
      this.ruleCounter = forcedIndex;
    }

    const rule = {
      id: ruleId,
      name,
      enabled: rawRule.enabled !== false,
      trigger: normalizeTrigger(rawRule.trigger),
      actions: normalizeActionList(rawRule.actions),
      createdAt: safeOptions.createdAt || new Date().toISOString(),
    };

    if (rule.actions.length === 0) {
      throw new Error('Rule requires at least one valid action.');
    }

    this.rules.push(rule);
    return toPublicRule(rule);
  }

  listRules() {
    return this.rules.map((rule) => toPublicRule(rule));
  }

  toSnapshot() {
    return {
      ruleCounter: this.ruleCounter,
      rules: this.rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        enabled: rule.enabled,
        trigger: rule.trigger,
        actions: rule.actions,
        createdAt: rule.createdAt,
      })),
    };
  }

  loadSnapshot(snapshot) {
    const safeSnapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
    this.rules = [];
    this.ruleCounter = Number.isFinite(Number(safeSnapshot.ruleCounter))
      ? Number(safeSnapshot.ruleCounter)
      : 0;

    const rawRules = Array.isArray(safeSnapshot.rules) ? safeSnapshot.rules : [];
    for (const rawRule of rawRules) {
      try {
        this.addRule(rawRule, {
          id: rawRule.id,
          createdAt: rawRule.createdAt,
        });
      } catch {
        // Ignore invalid saved rules and keep loading valid ones.
      }
    }
  }

  removeRule(ruleId) {
    const previousCount = this.rules.length;
    this.rules = this.rules.filter((rule) => rule.id !== ruleId);
    return this.rules.length !== previousCount;
  }

  evaluate(message) {
    const executions = [];

    for (const rule of this.rules) {
      if (!matchesRule(rule, message)) {
        continue;
      }
      executions.push({
        ruleId: rule.id,
        ruleName: rule.name,
        actions: rule.actions.map((action) => ({ ...action })),
      });
    }

    return executions;
  }
}

module.exports = {
  AutomationEngine,
};
