const fs = require('fs').promises;
const path = require('path');

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function buildDefaultState() {
  const now = new Date().toISOString();
  return {
    meta: {
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
    users: [],
    sessions: [],
    userStates: [],
  };
}

class JsonDb {
  constructor(filePath) {
    this.filePath = filePath;
    this.writeQueue = Promise.resolve();
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      await fs.access(this.filePath);
    } catch {
      const initial = buildDefaultState();
      await this.#writeState(initial);
    }
  }

  async #readState() {
    const raw = await fs.readFile(this.filePath, 'utf8');
    if (!raw.trim()) {
      return buildDefaultState();
    }
    const parsed = JSON.parse(raw);
    return {
      meta: parsed.meta || {},
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      userStates: Array.isArray(parsed.userStates) ? parsed.userStates : [],
    };
  }

  async #writeState(nextState) {
    const now = new Date().toISOString();
    const state = {
      meta: {
        version: 1,
        createdAt:
          nextState.meta && nextState.meta.createdAt ? nextState.meta.createdAt : now,
        updatedAt: now,
      },
      users: Array.isArray(nextState.users) ? nextState.users : [],
      sessions: Array.isArray(nextState.sessions) ? nextState.sessions : [],
      userStates: Array.isArray(nextState.userStates) ? nextState.userStates : [],
    };
    const tempPath = `${this.filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(state, null, 2), 'utf8');
    await fs.rename(tempPath, this.filePath);
  }

  async #mutate(mutator) {
    const operation = this.writeQueue.then(async () => {
      const state = await this.#readState();
      const maybeNextState = await mutator(state);
      const nextState = maybeNextState || state;
      await this.#writeState(nextState);
      return deepClone(nextState);
    });
    this.writeQueue = operation.then(
      () => undefined,
      () => undefined
    );
    return operation;
  }

  async getSnapshot() {
    const state = await this.#readState();
    return deepClone(state);
  }

  async findUserByEmail(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      return null;
    }
    const state = await this.#readState();
    const user = state.users.find((candidate) => normalizeEmail(candidate.email) === normalized);
    return user ? deepClone(user) : null;
  }

  async findUserById(userId) {
    const state = await this.#readState();
    const user = state.users.find((candidate) => candidate.id === userId);
    return user ? deepClone(user) : null;
  }

  async createUser(userRecord) {
    const cleanRecord = deepClone(userRecord);
    await this.#mutate((state) => {
      state.users.push(cleanRecord);
      return state;
    });
    return deepClone(cleanRecord);
  }

  async createSession(sessionRecord) {
    const cleanRecord = deepClone(sessionRecord);
    await this.#mutate((state) => {
      state.sessions.push(cleanRecord);
      return state;
    });
    return deepClone(cleanRecord);
  }

  async findSession(token) {
    if (!token) {
      return null;
    }
    const state = await this.#readState();
    const session = state.sessions.find((candidate) => candidate.token === token);
    return session ? deepClone(session) : null;
  }

  async touchSession(token, updates) {
    await this.#mutate((state) => {
      const idx = state.sessions.findIndex((candidate) => candidate.token === token);
      if (idx < 0) {
        return state;
      }
      state.sessions[idx] = {
        ...state.sessions[idx],
        ...deepClone(updates || {}),
      };
      return state;
    });
  }

  async deleteSession(token) {
    let removed = false;
    await this.#mutate((state) => {
      const previousCount = state.sessions.length;
      state.sessions = state.sessions.filter((candidate) => candidate.token !== token);
      removed = state.sessions.length !== previousCount;
      return state;
    });
    return removed;
  }

  async deleteExpiredSessions(referenceIso) {
    const nowTs = new Date(referenceIso || Date.now()).getTime();
    await this.#mutate((state) => {
      state.sessions = state.sessions.filter((session) => {
        const exp = new Date(session.expiresAt).getTime();
        return Number.isFinite(exp) && exp > nowTs;
      });
      return state;
    });
  }

  async getUserState(userId) {
    const state = await this.#readState();
    const userState = state.userStates.find((candidate) => candidate.userId === userId);
    if (!userState) {
      return null;
    }
    return deepClone(userState.state);
  }

  async setUserState(userId, nextCoreState) {
    const stateCopy = deepClone(nextCoreState);
    await this.#mutate((state) => {
      const idx = state.userStates.findIndex((candidate) => candidate.userId === userId);
      const payload = {
        userId,
        state: stateCopy,
        updatedAt: new Date().toISOString(),
      };
      if (idx < 0) {
        state.userStates.push(payload);
      } else {
        state.userStates[idx] = payload;
      }
      return state;
    });
  }
}

module.exports = {
  JsonDb,
  normalizeEmail,
};

