// src/content/codeforces.js

(function () {
    let lastUrl = location.href;
    let solvedProblems = new Set();
    let cfHandle = ''; // Will load from settings later

    // --- 1️⃣ Fetch solved problems from CF API ---
    async function fetchSolvedProblems() {
        if (!cfHandle) return;
        try {
            const res = await fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(cfHandle)}`);
            const data = await res.json();
            if (data.status === "OK") {
                solvedProblems.clear();
                data.result.forEach(submission => {
                    if (submission.verdict === "OK") {
                        const pid = `${submission.problem.contestId}-${submission.problem.index}`;
                        solvedProblems.add(pid);
                    }
                });
            }
        } catch (err) {
            console.error("CF API fetch error:", err);
        }
    }

    // --- 2️⃣ Get problemId from URL ---
    function getProblemId() {
        let match = window.location.pathname.match(/\/problemset\/problem\/(\d+)\/([A-Z]\d?)/);
        if (match) return `${match[1]}-${match[2]}`;

        match = window.location.pathname.match(/\/contest\/(\d+)\/problem\/([A-Z]\d?)/);
        if (match) return `${match[1]}-${match[2]}`;

        return null;
    }

    // --- 3️⃣ Inject Notes Panel ---
    function injectNotesPanel(problemId) {
        if (!problemId) return;

        let textarea = document.getElementById('cf-helper-notes');

        if (textarea) {
            // Toggle visibility
            textarea.style.display = textarea.style.display === 'none' ? 'block' : 'none';
            return;
        }

        textarea = document.createElement('textarea');
        textarea.id = 'cf-helper-notes';
        textarea.placeholder = "Your notes...";
        textarea.style.position = 'fixed';
        textarea.style.top = '80px';
        textarea.style.right = '20px';
        textarea.style.width = '300px';
        textarea.style.height = '200px';
        textarea.style.zIndex = 9999;
        textarea.style.backgroundColor = '#f0f0f0';
        textarea.style.padding = '8px';
        textarea.style.border = '1px solid #ccc';
        textarea.style.borderRadius = '5px';

        // Load saved notes
        chrome.storage.local.get([problemId], (data) => {
            textarea.value = data[problemId] || '';
        });

        // Save notes on blur
        textarea.addEventListener('blur', () => {
            const val = textarea.value;
            chrome.storage.local.set({ [problemId]: val });
        });

        document.body.appendChild(textarea);
    }

    // --- 4️⃣ Floating Notes Button ---
    function addOpener(problemId) {
        if (document.getElementById('cf-helper-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'cf-helper-btn';
        btn.textContent = 'Notes';
        btn.style.position = 'fixed';
        btn.style.top = '80px';
        btn.style.right = '16px';
        btn.style.zIndex = 2147483647;
        btn.style.padding = '8px 12px';
        btn.style.backgroundColor = '#3b82f6';
        btn.style.color = '#fff';
        btn.style.border = 'none';
        btn.style.borderRadius = '5px';
        btn.style.cursor = 'pointer';
        btn.style.fontWeight = '600';

        btn.onclick = () => injectNotesPanel(problemId);
        document.body.appendChild(btn);
    }

    // --- 5️⃣ Highlight solved problem ---
    function highlightSolved(problemId) {
        if (solvedProblems.has(problemId)) {
            const titleEl = document.querySelector('.title');
            if (titleEl) {
                titleEl.style.color = 'green';
                const badge = document.createElement('span');
                badge.innerText = " [Solved]";
                badge.style.color = "white";
                badge.style.backgroundColor = "green";
                badge.style.padding = "2px 5px";
                badge.style.marginLeft = "5px";
                badge.style.borderRadius = "3px";
                titleEl.appendChild(badge);
            }
        }
    }

    // --- 6️⃣ Main handler ---
    async function handlePage() {
        const problemId = getProblemId();
        if (!problemId) return;

        addOpener(problemId);
        highlightSolved(problemId);
    }

    // --- 7️⃣ Load CF handle from settings ---
    chrome.storage.sync.get(['cfHandle'], (data) => {
        cfHandle = data.cfHandle || '';
        fetchSolvedProblems().then(handlePage);
    });

    // --- 8️⃣ Detect SPA-like URL changes ---
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            fetchSolvedProblems().then(handlePage);
        }
    }).observe(document, { subtree: true, childList: true });

    // Optional: Refresh solved problems every 5 minutes
    setInterval(fetchSolvedProblems, 5 * 60 * 1000);

})();
