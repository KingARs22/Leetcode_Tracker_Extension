// src/lib/storage.js
window.DB = {
    async getProblem(slug) {
        return new Promise(resolve => {
            chrome.storage.local.get([slug], (res) => resolve(res[slug] || null));
        });
    },

    async upsertProblem(slug, data) {
        return new Promise(resolve => {
            chrome.storage.local.get([slug], (res) => {
                const old = res[slug] || {};
                const merged = { ...old, ...data };
                chrome.storage.local.set({ [slug]: merged }, () => resolve(merged));
            });
        });
    },

    async markSolved(slug, site, opts = {}) {
        return this.upsertProblem(slug, { solved: true, site, ...opts });
    },

    async getSettings() {
        return new Promise(resolve => {
            chrome.storage.sync.get(['reminderTime', 'preferLC', 'cfHandle'], (res) => resolve(res || {}));
        });
    },

    async setSettings(data) {
        return new Promise(resolve => {
            chrome.storage.sync.set(data, () => resolve());
        });
    }
};
