const GLOBAL_KEYWORD_WEIGHTS = Object.freeze({
  urgente: 34,
  imediato: 26,
  prioridade: 22,
  atrasado: 24,
  hoje: 14,
  amanha: 10,
  prazo: 18,
  vencimento: 20,
  reuniao: 14,
  cliente: 14,
  problema: 20,
  bug: 22,
  erro: 18,
  bloqueado: 22,
  incidente: 28,
  critica: 22,
  aprovar: 14,
  revisar: 10,
});

const SOURCE_BASE_SCORE = Object.freeze({
  whatsapp: 10,
  telegram: 9,
  discord: 8,
  gmail: 12,
  calendar: 20,
  slack: 11,
  teams: 11,
  manual: 6,
});

const SENDER_ROLE_BOOST = Object.freeze({
  boss: 24,
  manager: 20,
  client: 22,
  professor: 20,
  family: 14,
  vip: 18,
});

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function sumKeywordScore(normalizedText, keywordMap) {
  let score = 0;
  const matches = [];
  const entries = Object.entries(keywordMap || {});
  for (const [keyword, weight] of entries) {
    if (normalizedText.includes(keyword)) {
      score += weight;
      matches.push(keyword);
    }
  }
  return { score, matches };
}

function getRecencyBoost(createdAtIso) {
  const createdAt = new Date(createdAtIso);
  if (Number.isNaN(createdAt.getTime())) {
    return 0;
  }
  const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  if (ageHours <= 1) {
    return 16;
  }
  if (ageHours <= 6) {
    return 10;
  }
  if (ageHours <= 24) {
    return 6;
  }
  if (ageHours <= 48) {
    return 2;
  }
  return -6;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getPriorityLevel(score) {
  if (score >= 85) {
    return 'critical';
  }
  if (score >= 65) {
    return 'high';
  }
  if (score >= 40) {
    return 'medium';
  }
  return 'low';
}

function getNotificationPolicy(level, focusModeEnabled) {
  if (level === 'critical') {
    return 'instant';
  }
  if (level === 'high') {
    return focusModeEnabled ? 'instant' : 'fast';
  }
  if (level === 'medium') {
    return focusModeEnabled ? 'digest' : 'normal';
  }
  return focusModeEnabled ? 'silent' : 'digest';
}

function calculatePriority(input) {
  const normalizedText = normalizeText(input.text);
  const source = String(input.source || 'manual').toLowerCase();
  const senderRole = normalizeText(input.senderRole);
  const moduleKeywordBoost = input.moduleKeywordBoost || {};
  const moduleSenderRoleBoost = input.moduleSenderRoleBoost || {};

  let score = 10;
  const matchedKeywords = [];

  score += SOURCE_BASE_SCORE[source] || SOURCE_BASE_SCORE.manual;

  const globalKeywordResult = sumKeywordScore(normalizedText, GLOBAL_KEYWORD_WEIGHTS);
  score += globalKeywordResult.score;
  matchedKeywords.push(...globalKeywordResult.matches);

  const moduleKeywordResult = sumKeywordScore(normalizedText, moduleKeywordBoost);
  score += moduleKeywordResult.score;
  matchedKeywords.push(...moduleKeywordResult.matches);

  if (senderRole) {
    score += SENDER_ROLE_BOOST[senderRole] || 0;
    score += moduleSenderRoleBoost[senderRole] || 0;
  }

  score += getRecencyBoost(input.createdAt);
  score = clamp(score, 0, 100);

  const level = getPriorityLevel(score);
  const notification = getNotificationPolicy(level, Boolean(input.focusModeEnabled));

  return {
    score,
    level,
    notification,
    matchedKeywords: Array.from(new Set(matchedKeywords)),
    normalizedText,
  };
}

module.exports = {
  calculatePriority,
  getPriorityLevel,
  normalizeText,
};

