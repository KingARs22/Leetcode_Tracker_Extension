// src/background.js (replace alarm/notification parts)

const CF_API = 'https://codeforces.com/api';
const NOTIF_MAP = new Map(); // notifId -> url
const CF_CONTEST_API = 'https://codeforces.com/api/contest.list?gym=false';
const LC_CONTEST_API = 'https://kontests.net/api/v1/leetcode';
const CONTEST_ALARM_PREFIX = 'contest-';

function log(...args) { try { console.log('[LCCF-bg]', ...args); } catch(e) {} }

async function scheduleDaily(name = 'dailyReminder') {
  chrome.storage.sync.get(['reminderTime'], (data) => {
    const reminderTime = data.reminderTime || '20:00';
    const [hh, mm] = (reminderTime.split(':').map(Number));
    const now = new Date();
    const next = new Date();
    next.setHours(hh, mm, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);

    // create a repeating daily alarm to be safe
    chrome.alarms.clear(name, () => {
      chrome.alarms.create(name, { when: +next, periodInMinutes: 24 * 60 });
      log('Scheduled daily alarm', name, 'next at', next.toString());
    });
  });
}

// Install/startup handlers
chrome.runtime.onInstalled.addListener(() => scheduleDaily());
chrome.runtime.onStartup.addListener(() => scheduleDaily());

// single notification click handler
chrome.notifications.onClicked.addListener((notifId) => {
  const url = NOTIF_MAP.get(notifId);
  if (url) chrome.tabs.create({ url });
});

// alarm handler
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'dailyReminder') return;
  // reschedule is handled by periodInMinutes, but keep scheduleDaily to be safe
  scheduleDaily('dailyReminder');

  chrome.storage.sync.get(['preferLC', 'cfHandle'], async (settings) => {
    const preferLC = settings?.preferLC ?? true;
    const notifId = `lccf-${Date.now()}`;
    if (preferLC) {
      const url = 'https://leetcode.com/problemset/all/';
      NOTIF_MAP.set(notifId, url);
      chrome.notifications.create(notifId, {
        type: 'basic', iconUrl: 'assets/icon128.png', title: 'Daily LC Suggestion',
        message: "Time to solve one! Click to open problemset.", priority: 2
      }, () => log('LC notification created', notifId));
      return;
    }

    // prefer CF: fetch random
    try {
      const res = await fetch(`${CF_API}/problemset.problems`);
      const data = await res.json();
      const probs = data?.result?.problems || [];
      const pick = probs[Math.floor(Math.random() * probs.length)];
      const url = pick ? `https://codeforces.com/problemset/problem/${pick.contestId}/${pick.index}` : 'https://codeforces.com/problemset';
      NOTIF_MAP.set(notifId, url);
      chrome.notifications.create(notifId, {
        type: 'basic', iconUrl: 'assets/icon128.png', title: 'Daily CF Suggestion',
        message: pick ? `${pick.name} — Click to open` : 'Open problemset', priority: 2
      }, () => log('CF notification created', notifId));
    } catch (e) {
      const url = 'https://codeforces.com/problemset';
      NOTIF_MAP.set(notifId, url);
      chrome.notifications.create(notifId, {
        type: 'basic', iconUrl: 'assets/icon128.png', title: 'Daily CF Suggestion',
        message: 'Open CF problemset', priority: 2
      }, () => log('CF fallback notif', notifId));
    }
  });
});

// message handler to update settings (reschedule)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'setSettings') {
    chrome.storage.sync.set(msg.payload || {}, () => {
      scheduleDaily();
      sendResponse({ ok: true });
    });
    return true; // async sendResponse
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
    return true;
  }
});


// background.js

async function fetchContests() {
  try {
    // --- Codeforces contests ---
    const cfResp = await fetch("https://codeforces.com/api/contest.list?gym=false");
    const cfData = await cfResp.json();
    const cfContests = (cfData.result || [])
      .filter(c => c.phase === "BEFORE")
      .map(c => ({
        site: "Codeforces",
        name: c.name,
        start: c.startTimeSeconds * 1000,
        url: `https://codeforces.com/contest/${c.id}`
      }));

    // --- LeetCode contests (via kontests.net) ---
    let lcContests = [];
    try {
      const lcResp = await fetch("https://kontests.net/api/v1/leet_code");
      const lcData = await lcResp.json();
      lcContests = (lcData || []).map(c => ({
        site: "LeetCode",
        name: c.name,
        start: new Date(c.start_time).getTime(),
        url: c.url
      }));
    } catch (err) {
      console.warn("LeetCode fetch failed", err);
    }

    // --- Merge + sort ---
    let contests = [...cfContests, ...lcContests]
      .sort((a, b) => a.start - b.start)
      .slice(0, 3); // nearest 3 only

    await chrome.storage.local.set({ contests });
    console.log("Contests saved", contests);
    return contests;
  } catch (err) {
    console.error("Contest fetch error:", err);
    return [];
  }
}

// Fetch once on startup & every 6h
chrome.runtime.onStartup.addListener(fetchContests);
chrome.runtime.onInstalled.addListener(fetchContests);
chrome.alarms.create("contestRefresh", { periodInMinutes: 360 });
chrome.alarms.onAlarm.addListener(a => {
  if (a.name === "contestRefresh") fetchContests();
});




// Refresh contests every 6 hours
chrome.runtime.onInstalled.addListener(() => {
  fetchContests();
  chrome.alarms.create("refreshContests", { periodInMinutes: 360 });
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "refreshContests") fetchContests();
});

// Handle reminder setting from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "setContestReminder") {
    const contest = msg.payload;
    // Schedule reminder 10 minutes before contest
    const when = new Date(contest.start - 10 * 60 * 1000);
    if (when > Date.now()) {
      chrome.alarms.create(`contest-${contest.name}`, { when: when.getTime() });
      sendResponse({ ok: true, scheduled: when.toString() });
    } else {
      sendResponse({ ok: false, reason: "Contest already started" });
    }
  }
});

// Show notification when alarm triggers
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith("contest-")) {
    const contestName = alarm.name.replace("contest-", "");
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon.png",
      title: "Contest Reminder",
      message: `${contestName} starts soon!`
    });
  }
});
