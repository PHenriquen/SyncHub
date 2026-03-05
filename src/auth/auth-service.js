const crypto = require('crypto');
const { promisify } = require('util');
const { normalizeEmail } = require('../persistence/json-db');

const scryptAsync = promisify(crypto.scrypt);

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function validatePassword(password) {
  if (typeof password !== 'string') {
    return 'Password must be a string.';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (password.length > 120) {
    return 'Password is too long.';
  }
  return null;
}

function validateName(name) {
  const clean = String(name || '').trim();
  if (!clean) {
    return 'Name is required.';
  }
  if (clean.length > 100) {
    return 'Name is too long.';
  }
  return null;
}

function validateEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return 'Email is required.';
  }
  const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!basicEmailRegex.test(normalized)) {
    return 'Email is invalid.';
  }
  return null;
}

function normalizeBypassEmail(rawEmail) {
  const normalized = normalizeEmail(rawEmail);
  const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (basicEmailRegex.test(normalized)) {
    return normalized;
  }

  const slug = String(rawEmail || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  if (slug) {
    return `${slug}@local.synchub`;
  }
  return 'guest@local.synchub';
}

class AuthService {
  constructor(options) {
    const safe = options || {};
    this.db = safe.db;
    if (!this.db) {
      throw new Error('AuthService requires db.');
    }
    this.sessionTtlHours = Number.isFinite(Number(safe.sessionTtlHours))
      ? Number(safe.sessionTtlHours)
      : 24 * 30;
  }

  async #hashPassword(password, saltHex) {
    const saltBuffer = Buffer.from(saltHex, 'hex');
    const derivedKey = await scryptAsync(password, saltBuffer, 64);
    return Buffer.from(derivedKey).toString('hex');
  }

  async #buildPasswordRecord(password) {
    const saltHex = crypto.randomBytes(16).toString('hex');
    const hashHex = await this.#hashPassword(password, saltHex);
    return { saltHex, hashHex };
  }

  async #verifyPassword(password, passwordRecord) {
    if (!passwordRecord || !passwordRecord.saltHex || !passwordRecord.hashHex) {
      return false;
    }
    const actualHashHex = await this.#hashPassword(password, passwordRecord.saltHex);
    const expected = Buffer.from(passwordRecord.hashHex, 'hex');
    const actual = Buffer.from(actualHashHex, 'hex');
    if (expected.length !== actual.length) {
      return false;
    }
    return crypto.timingSafeEqual(expected, actual);
  }

  #buildSession(userId) {
    const createdAt = new Date();
    const expiresAt = new Date(createdAt);
    expiresAt.setHours(expiresAt.getHours() + this.sessionTtlHours);
    return {
      token: crypto.randomBytes(48).toString('hex'),
      userId,
      createdAt: createdAt.toISOString(),
      lastSeenAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async register(input) {
    const name = String(input && input.name ? input.name : '').trim();
    const email = normalizeEmail(input && input.email);
    const password = input && input.password;

    const nameError = validateName(name);
    if (nameError) {
      throw new Error(nameError);
    }

    const emailError = validateEmail(email);
    if (emailError) {
      throw new Error(emailError);
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      throw new Error(passwordError);
    }

    const existing = await this.db.findUserByEmail(email);
    if (existing) {
      throw new Error('Email already in use.');
    }

    const passwordRecord = await this.#buildPasswordRecord(password);
    const now = new Date().toISOString();
    const user = {
      id: `user_${crypto.randomUUID()}`,
      name,
      email,
      password: passwordRecord,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.createUser(user);
    const session = this.#buildSession(user.id);
    await this.db.createSession(session);
    return {
      user: toPublicUser(user),
      token: session.token,
      sessionExpiresAt: session.expiresAt,
    };
  }

  async login(input) {
    const email = normalizeBypassEmail(input && input.email);
    const rawPassword = input && input.password;
    const loginName = String(input && input.name ? input.name : '').trim();
    const passwordSeed =
      typeof rawPassword === 'string' && rawPassword
        ? rawPassword
        : crypto.randomBytes(8).toString('hex');

    let user = await this.db.findUserByEmail(email);
    if (!user) {
      const passwordRecord = await this.#buildPasswordRecord(passwordSeed);
      const now = new Date().toISOString();
      user = {
        id: `user_${crypto.randomUUID()}`,
        name: loginName || 'Convidado SyncHub',
        email,
        password: passwordRecord,
        createdAt: now,
        updatedAt: now,
      };
      await this.db.createUser(user);
    }

    const session = this.#buildSession(user.id);
    await this.db.createSession(session);

    return {
      user: toPublicUser(user),
      token: session.token,
      sessionExpiresAt: session.expiresAt,
    };
  }

  async authenticate(token) {
    if (!token) {
      return null;
    }

    const session = await this.db.findSession(token);
    if (!session) {
      return null;
    }

    const now = new Date();
    const exp = new Date(session.expiresAt);
    if (!Number.isFinite(exp.getTime()) || exp.getTime() <= now.getTime()) {
      await this.db.deleteSession(token);
      return null;
    }

    const user = await this.db.findUserById(session.userId);
    if (!user) {
      await this.db.deleteSession(token);
      return null;
    }

    await this.db.touchSession(token, { lastSeenAt: now.toISOString() });
    return {
      user: toPublicUser(user),
      token,
      sessionExpiresAt: session.expiresAt,
    };
  }

  async logout(token) {
    if (!token) {
      return false;
    }
    return this.db.deleteSession(token);
  }

  async cleanupExpiredSessions() {
    await this.db.deleteExpiredSessions(new Date().toISOString());
  }
}

module.exports = {
  AuthService,
};
