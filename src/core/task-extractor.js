const { normalizeText } = require('./priority-engine');

const TASK_HINT_WORDS = [
  'fazer',
  'entregar',
  'responder',
  'agendar',
  'enviar',
  'prazo',
  'reuniao',
  'revisar',
  'aprovar',
  'ajustar',
];

function parseIsoDateMaybe(rawValue) {
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function parseDueDateFromText(rawText, referenceDate) {
  const normalized = normalizeText(rawText);
  const reference = new Date(referenceDate || Date.now());

  const isoMatch = normalized.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    return parseIsoDateMaybe(`${isoMatch[1]}T23:59:59.000Z`);
  }

  const brMatch = normalized.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (!brMatch) {
    return null;
  }

  const day = Number(brMatch[1]);
  const month = Number(brMatch[2]) - 1;
  let year = Number(brMatch[3]);
  if (!Number.isFinite(year) || year <= 0) {
    year = reference.getUTCFullYear();
  }
  if (year < 100) {
    year += 2000;
  }

  const candidate = new Date(Date.UTC(year, month, day, 23, 59, 59));
  if (Number.isNaN(candidate.getTime())) {
    return null;
  }

  if (!brMatch[3] && candidate.getTime() < reference.getTime()) {
    const nextYearCandidate = new Date(Date.UTC(year + 1, month, day, 23, 59, 59));
    return nextYearCandidate.toISOString();
  }

  return candidate.toISOString();
}

function buildTaskTitleFromMessage(messageText) {
  const clean = String(messageText || '').replace(/\s+/g, ' ').trim();
  if (!clean) {
    return 'Nova tarefa automatica';
  }

  if (clean.length <= 70) {
    return clean;
  }
  return `${clean.slice(0, 67)}...`;
}

function maybeExtractTaskFromMessage(message) {
  const rawText = String(message.text || '');
  const normalized = normalizeText(rawText);
  const hasHint = TASK_HINT_WORDS.some((word) => normalized.includes(word));
  const isImportant = message.priority && message.priority.score >= 65;

  if (!hasHint && !isImportant) {
    return null;
  }

  return {
    title: buildTaskTitleFromMessage(rawText),
    dueDate: parseDueDateFromText(rawText, message.createdAt),
    sourceMessageId: message.id,
    source: message.source,
    moduleId: message.moduleId || null,
    priorityLevel: message.priority ? message.priority.level : 'medium',
  };
}

module.exports = {
  maybeExtractTaskFromMessage,
  parseDueDateFromText,
};

