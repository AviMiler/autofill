// Collapsible snippets section at the top of the manager (key af_snippets).
// Snippets are plain storage (no __afStorage helper), shared with content/snippet.js.
// Adds to window.__afMgr: loadSnippets(), saveSnippets(list)  (also used by backup.js).

(() => {
  const { el, showToast } = window.__afMgr;
  const SNIPPET_KEY = 'af_snippets';
  const UI_KEY = 'af_ui_snippets_open';

  async function loadSnippets() {
    const data = await chrome.storage.local.get(SNIPPET_KEY);
    return data[SNIPPET_KEY] || [];
  }

  function saveSnippets(list) {
    return chrome.storage.local.set({ [SNIPPET_KEY]: list });
  }

  let editingId = null; // snippet row currently open for editing

  function buildEditRow(snippet) {
    const row = el('div', 'af-snippet-row');
    const triggerIn = el('input', 'af-input');
    const valueIn = el('input', 'af-input');
    [triggerIn.type, valueIn.type] = ['text', 'text'];
    [triggerIn.dir, valueIn.dir] = ['ltr', 'ltr'];
    triggerIn.value = snippet.trigger;
    valueIn.value = snippet.value;
    triggerIn.style.flex = '0 0 150px';

    const close = () => { editingId = null; render(); };
    const saveBtn = el('button', 'af-btn primary', 'שמור');
    const cancelBtn = el('button', 'af-btn', 'בטל');
    cancelBtn.addEventListener('click', close);
    saveBtn.addEventListener('click', async () => {
      const trigger = triggerIn.value.trim();
      const value = valueIn.value.trim();
      if (!trigger) { triggerIn.focus(); return; }
      if (!value) { valueIn.focus(); return; }
      // Re-read so a snippet deleted/changed elsewhere meanwhile is never resurrected or clobbered.
      try {
        const current = await loadSnippets();
        if (current.some(s => s.id === snippet.id)) {
          await saveSnippets(current.map(s => (s.id === snippet.id ? { ...s, trigger, value } : s)));
        }
        close();
      } catch (err) {
        console.error('[snippets] save failed:', err);
        showToast('השמירה נכשלה');
      }
    });
    row.addEventListener('keydown', e => {
      if (e.key === 'Escape') close();
      else if (e.key === 'Enter' && e.target.tagName === 'INPUT') saveBtn.click();
    });
    row.append(triggerIn, valueIn, saveBtn, cancelBtn);
    setTimeout(() => valueIn.focus(), 0);
    return row;
  }

  async function render() {
    const snippets = await loadSnippets();
    const listEl = document.getElementById('af-snippet-list');
    document.getElementById('af-snip-count').textContent = snippets.length ? `(${snippets.length})` : '';
    listEl.innerHTML = '';
    if (!snippets.length) listEl.appendChild(el('div', 'af-snippet-empty', 'אין קיצורים עדיין.'));

    snippets.forEach(snippet => {
      if (snippet.id === editingId) {
        listEl.appendChild(buildEditRow(snippet));
        return;
      }
      const row = el('div', 'af-snippet-row');
      const editBtn = el('button', 'af-icon-btn', '✏️');
      editBtn.title = 'ערוך';
      editBtn.addEventListener('click', () => { editingId = snippet.id; render(); });
      const delBtn = el('button', 'af-icon-btn del', '🗑');
      delBtn.title = 'מחק';
      delBtn.addEventListener('click', async () => {
        await saveSnippets((await loadSnippets()).filter(s => s.id !== snippet.id));
        showToast(`הקיצור ${snippet.trigger} נמחק`, async () => {
          const current = await loadSnippets();
          if (!current.some(s => s.id === snippet.id)) await saveSnippets([...current, snippet]);
        });
      });
      row.append(el('span', 'af-snippet-trigger', snippet.trigger), el('span', 'af-snippet-value', snippet.value), editBtn, delBtn);
      listEl.appendChild(row);
    });
  }

  async function addSnippet(event) {
    event.preventDefault();
    const triggerIn = document.getElementById('af-snip-trigger');
    const valueIn = document.getElementById('af-snip-value');
    const trigger = triggerIn.value.trim();
    const value = valueIn.value.trim();
    if (!trigger || !value) return;
    const all = await loadSnippets();
    all.push({ id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, trigger, value, created: Date.now() });
    await saveSnippets(all);
    triggerIn.value = '';
    valueIn.value = '';
    triggerIn.focus();
  }

  async function init() {
    const details = document.getElementById('af-snippets-section');
    try {
      const saved = (await chrome.storage.local.get(UI_KEY))[UI_KEY];
      details.open = saved !== false; // open by default
    } catch (err) {
      console.error('[snippets] reading UI state failed:', err);
    }
    details.addEventListener('toggle', () => chrome.storage.local.set({ [UI_KEY]: details.open }));
    document.getElementById('af-snippet-form').addEventListener('submit', addSnippet);
    chrome.storage.onChanged.addListener((changes, area) => {
      // An open editor would be wiped by a re-render; it re-renders itself on close.
      if (area === 'local' && changes[SNIPPET_KEY] && !editingId) render();
    });
    render();
  }

  Object.assign(window.__afMgr, { loadSnippets, saveSnippets });
  init();
})();
