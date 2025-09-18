// src/lib/storage.js  (replace existing implementations)
window.DB = {
  // return all problems object
  async listProblems() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['problems'], (data) => resolve(data.problems || {}));
    });
  },

  async getProblem(slug) {
    const problems = await this.listProblems();
    return problems[slug] || null;
  },

  async upsertProblem(slug, patch = {}) {
    const problems = await this.listProblems();
    problems[slug] = { ...(problems[slug] || {}), ...patch };
    return new Promise((resolve) => {
      chrome.storage.local.set({ problems }, () => resolve(problems[slug]));
    });
  },

  // MARK SOLVED - pushes a timestamped record into solves[]
  async markSolved(slug, site = 'unknown', meta = {}) {
    const problems = await this.listProblems();
    const prev = problems[slug] || {};
    const nowISO = new Date().toISOString();
    const solves = (prev.solves || []).slice(); // copy
    solves.push({ at: nowISO, site, ...meta });
    problems[slug] = { ...prev, solved: true, site, solves };
    return new Promise((resolve) => {
      chrome.storage.local.set({ problems }, () => resolve(problems[slug]));
    });
  },

  // (small helper) set/get arbitrary key in local storage
  async set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => resolve());
    });
  },
  async get(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (data) => resolve(data[key]));
    });
  },

  // Settings in sync store
  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['reminderTime', 'preferLC', 'cfHandle'], (data) => resolve(data || {}));
    });
  },

  async setSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.sync.set(settings, () => resolve());
    });
  }
};
