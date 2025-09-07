// src/popup/popup.js
const $ = (s) => document.querySelector(s);

// --- Refresh stats in popup ---
function refreshStats() {
    chrome.storage.local.get(['problems'], (data) => {
        const problems = data.problems || {};
        const entries = Object.entries(problems);

        const lc = entries.filter(([k, v]) => v.site === 'leetcode');
        const cf = entries.filter(([k, v]) => v.site === 'codeforces');
        const solved = entries.filter(([k, v]) => v.solved).length;

        const days = new Set(
            entries.flatMap(([k, v]) => (v.solves || []).map(s => new Date(s.at).toDateString()))
        );

        const streak = calcStreak(days);

        chrome.storage.sync.get(['reminderTime', 'preferLC', 'cfHandle'], (settings) => {
            $('#stats').innerHTML = `
                <div class="stat"><span class="badge">Total</span> ${entries.length} tracked</div>
                <div class="stat"><span class="badge">Solved</span> ${solved}</div>
                <div class="stat"><span class="badge">LC</span> ${lc.length} tracked</div>
                <div class="stat"><span class="badge">CF</span> ${cf.length} tracked</div>
                <div class="stat"><span class="badge">Streak</span> ${streak} days</div>
            `;

            $('#reminderTime').value = settings.reminderTime || '20:00';
            $('#preferLC').checked = settings.preferLC ?? true;
            $('#cfHandle').value = settings.cfHandle || '';

            // Fetch live CF stats if handle set
            if (settings.cfHandle) {
                chrome.runtime.sendMessage({ type: 'getCFStats', handle: settings.cfHandle }, (resp) => {
                    if (resp?.ok) {
                        const el = document.createElement('div');
                        el.className = 'stat';
                        el.innerHTML = `<span class="badge">CF OK</span> ${resp.solvedCount} solved (API)`;
                        $('#stats').appendChild(el);
                    }
                });
            }
        });
    });
}

// --- Calculate streak ---
function calcStreak(daySet) {
    let streak = 0;
    const today = new Date();
    for (let i = 0; ; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = d.toDateString();
        if (daySet.has(key)) streak++;
        else break;
    }
    return streak;
}

// --- Save settings ---
$('#save').addEventListener('click', () => {
    const reminderTime = $('#reminderTime').value;
    const preferLC = $('#preferLC').checked;
    const cfHandle = $('#cfHandle').value.trim();

    chrome.storage.sync.set({ reminderTime, preferLC, cfHandle }, () => {
        chrome.runtime.sendMessage({
            type: 'setSettings',
            payload: { reminderTime, preferLC, cfHandle }
        }, (resp) => console.log('Settings saved', resp));
    });
});

// --- Open LC / CF tabs ---
$('#openLC').addEventListener('click', () => chrome.tabs.create({ url: 'https://leetcode.com/problemset/all/' }));
$('#openCF').addEventListener('click', () => chrome.tabs.create({ url: 'https://codeforces.com/problemset' }));

// --- Export problems ---
$('#export').addEventListener('click', () => {
    chrome.storage.local.get(['problems'], (data) => {
        const blob = new Blob([JSON.stringify(data.problems || {}, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lccf-data.json';
        a.click();
        URL.revokeObjectURL(url);
    });
});

// --- Import problems ---
$('#import').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    const json = JSON.parse(text);
    chrome.storage.local.set({ problems: json }, refreshStats);
});

// --- Initial refresh ---
refreshStats();
