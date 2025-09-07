// src/content/leetcode.js

(function () {
    const slug = window.location.pathname.split('/problems/')[1]?.replace('/', '');
    if (!slug) return;

    // --- 1️⃣ Notes injection and toggle ---
    function injectNotesPanel() {
        let textarea = document.getElementById('lc-helper-notes');
        if (textarea) {
            textarea.style.display = textarea.style.display === 'none' ? 'block' : 'none';
            return;
        }

        textarea = document.createElement('textarea');
        textarea.id = 'lc-helper-notes';
        textarea.placeholder = 'Your notes...';
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
        chrome.storage.local.get([slug], (data) => {
            textarea.value = data[slug] || '';
        });

        // Save notes on blur
        textarea.addEventListener('blur', () => {
            const val = textarea.value;
            chrome.storage.local.set({ [slug]: val });
        });

        document.body.appendChild(textarea);
    }

    // --- 2️⃣ Notes button ---
    function addNotesButton() {
        if (document.getElementById('lc-helper-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'lc-helper-btn';
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

        btn.onclick = injectNotesPanel;
        document.body.appendChild(btn);
    }

    // --- 3️⃣ Solved badge ---
    function highlightSolved() {
        chrome.storage.local.get(['problems'], (data) => {
            const rec = data.problems?.[slug];
            if (rec?.solved) {
                const titleEl = document.querySelector('div[data-cy="question-title"]') || document.querySelector('h1');
                if (titleEl && !document.getElementById('lc-solved-badge')) {
                    const badge = document.createElement('span');
                    badge.id = 'lc-solved-badge';
                    badge.textContent = ' [Solved]';
                    badge.style.color = 'white';
                    badge.style.backgroundColor = 'green';
                    badge.style.padding = '2px 5px';
                    badge.style.marginLeft = '5px';
                    badge.style.borderRadius = '3px';
                    titleEl.appendChild(badge);
                }
            }
        });
    }

    // --- 4️⃣ Mark problem as solved ---
    function markSolved() {
        chrome.storage.local.get(['problems'], (data) => {
            const problems = data.problems || {};
            problems[slug] = { ...(problems[slug] || {}), solved: true, site: 'leetcode' };
            chrome.storage.local.set({ problems }, highlightSolved);
        });
    }

    // --- 5️⃣ MutationObserver to detect Accepted submissions ---
    const observer = new MutationObserver(() => {
        const verdictNode = document.querySelector('span[data-e2e-locator="submission-result"]');
        if (verdictNode && /Accepted/.test(verdictNode.textContent)) {
            markSolved();
        }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });

    // --- 6️⃣ SPA-friendly: detect URL changes ---
    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            init();
        }
    }).observe(document, { subtree: true, childList: true });

    // --- 7️⃣ Initialize ---
    function init() {
        addNotesButton();
        highlightSolved();
    }

    // Run on page load
    init();

})();
