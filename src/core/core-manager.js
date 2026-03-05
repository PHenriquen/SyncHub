const { SyncHubCore } = require('./synchub-core');

class CoreManager {
  constructor(options) {
    const safe = options || {};
    if (!safe.db) {
      throw new Error('CoreManager requires db.');
    }

    this.db = safe.db;
    this.defaultActiveModules = Array.isArray(safe.defaultActiveModules)
      ? safe.defaultActiveModules
      : ['freelancer'];
    this.defaultFocusThreshold = Number.isFinite(Number(safe.defaultFocusThreshold))
      ? Number(safe.defaultFocusThreshold)
      : 70;
    this.cache = new Map();
  }

  async getUserCore(userId) {
    if (this.cache.has(userId)) {
      return this.cache.get(userId);
    }

    const snapshot = await this.db.getUserState(userId);
    let core;
    if (snapshot) {
      core = SyncHubCore.fromSnapshot(snapshot, {
        activeModules: this.defaultActiveModules,
        focusThreshold: this.defaultFocusThreshold,
      });
    } else {
      core = new SyncHubCore({
        activeModules: this.defaultActiveModules,
        focusThreshold: this.defaultFocusThreshold,
      });
      await this.db.setUserState(userId, core.toSnapshot());
    }

    this.cache.set(userId, core);
    return core;
  }

  async saveUserCore(userId) {
    const core = await this.getUserCore(userId);
    await this.db.setUserState(userId, core.toSnapshot());
  }

  async run(userId, handler, options) {
    const safeOptions = options || {};
    const core = await this.getUserCore(userId);
    const result = await handler(core);
    if (safeOptions.persist) {
      await this.db.setUserState(userId, core.toSnapshot());
    }
    return result;
  }
}

module.exports = {
  CoreManager,
};

