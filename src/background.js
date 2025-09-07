// src/background.js

const CF_API = 'https://codeforces.com/api';

// Schedule daily reminder
async function scheduleDaily(name = 'dailyReminder') {
    chrome.storage.sync.get(['reminderTime'], (data) => {
        const [hh, mm] = (data.reminderTime || '20:00').split(':').map(Number);
        const now = new Date();
        const next = new Date();
        next.setHours(hh, mm, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 1);
        chrome.alarms.clear(name, () => {
            chrome.alarms.create(name, { when: +next });
        });
    });
}

// Setup on install/startup
chrome.runtime.onInstalled.addListener(() => scheduleDaily());
chrome.runtime.onStartup.addListener(() => scheduleDaily());

// Alarm listener
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== 'dailyReminder') return;
    scheduleDaily('dailyReminder');

    chrome.storage.sync.get(['preferLC', 'cfHandle'], async (settings) => {
        const preferLC = settings?.preferLC ?? true;
        const notifId = `lccf-${Date.now()}`;

        if (preferLC) {
            chrome.notifications.create(notifId, {
                type: 'basic',
                iconUrl: 'assets/icon128.png',
                title: 'Daily LC Suggestion',
                message: 'Time to solve one! Click for today\'s problem set.',
                priority: 2
            });
            chrome.notifications.onClicked.addListener((id) => {
                if (id === notifId)
                    chrome.tabs.create({ url: 'https://leetcode.com/problemset/all/?difficulty=EASY%2CMEDIUM%2CHARD' });
            });
            return;
        }

        // Codeforces daily suggestion
        try {
            const res = await fetch(`${CF_API}/problemset.problems`);
            const data = await res.json();
            const problems = data?.result?.problems || [];
            const pick = problems[Math.floor(Math.random() * problems.length)];
            const url = pick ? `https://codeforces.com/problemset/problem/${pick.contestId}/${pick.index}` : 'https://codeforces.com/problemset';
            chrome.notifications.create(notifId, {
                type: 'basic',
                iconUrl: 'assets/icon128.png',
                title: 'Daily CF Suggestion',
                message: pick ? `${pick.name} — Click to open` : 'Open problemset',
                priority: 2
            });
            chrome.notifications.onClicked.addListener((id) => {
                if (id === notifId) chrome.tabs.create({ url });
            });
        } catch (e) {
            chrome.notifications.create(notifId, {
                type: 'basic',
                iconUrl: 'assets/icon128.png',
                title: 'Daily CF Suggestion',
                message: 'Open CF problemset',
                priority: 2
            });
            chrome.notifications.onClicked.addListener((id) => {
                if (id === notifId) chrome.tabs.create({ url: 'https://codeforces.com/problemset' });
            });
        }
    });
});

// Message listener for settings and CF stats
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'setSettings') {
        chrome.storage.sync.set(msg.payload || {}, () => {
            scheduleDaily();
            sendResponse({ ok: true });
        });
    }
    if (msg.type === 'getCFStats') {
        const handle = msg.handle;
        if (!handle) return sendResponse({ ok: false, error: 'no-handle' });
        fetch(`${CF_API}/user.status?handle=${encodeURIComponent(handle)}`)
            .then(r => r.json())
            .then(j => {
                const accepted = (j.result || []).filter(x => x.verdict === 'OK');
                const solved = new Set(accepted.map(x => `${x.contestId}-${x.problem.index}`));
                sendResponse({ ok: true, solvedCount: solved.size });
            })
            .catch(e => sendResponse({ ok: false, error: String(e) }));
    }
    return true; // keep channel open for async
});
