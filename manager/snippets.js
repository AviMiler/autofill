// Snippets view of the manager (key af_snippets): add form, list, inline edit, delete with undo.
// Snippets are plain storage (no __afStorage helper), shared with content/snippet.js.
// Adds to window.__afMgr: loadSnippets(), saveSnippets(list)  (also used by backup.js).

(() => {
  const { el, iconButton, copyButton, emptyState, showToast } = window.__afMgr;
  const SNIPPET_KEY = 'af_snippets';

  async function loadSnippets() {
    const data = await chrome.storage.local.get(SNIPPET_KEY);
    return data[SNIPPET_KEY] || [];
  }

  function saveSnippets(list) {
    return chrome.storage.local.set({ [SNIPPET_KEY]: list });
  }

  let editingId = null; // snippet row currently open for editing

  function input(value, cls, dir) {
    const i = el('input', cls);
    i.type = 'text';
    i.dir = dir;
    i.spellcheck = false;
    i.autocomplete = 'off';
    i.value = value;
    return i;
  }

  function buildEditRow(snippet) {
    const row = el('div', 'snippet-row editing');
    const triggerIn = input(snippet.trigger, 'input mono', 'ltr');
    const valueIn = input(snippet.value, 'input', 'auto');

    const close = () => { editingId = null; render(); };
    const saveBtn = el('button', 'btn primary', 'שמירה');
    saveBtn.type = 'button';
    const cancelBtn = el('button', 'btn ghost', 'ביטול');
    cancelBtn.type = 'button';
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
    row.append(triggerIn, valueIn, cancelBtn, saveBtn);
    setTimeout(() => valueIn.focus(), 0);
    return row;
  }

  function buildRow(snippet) {
    const row = el('div', 'snippet-row');
    const trigger = el('span', 'snippet-trigger', snippet.trigger);
    trigger.title = snippet.trigger;
    const value = el('span', 'snippet-value', snippet.value);
    value.title = snippet.value;

    const editBtn = iconButton('pencil', 'עריכה');
    editBtn.addEventListener('click', () => { editingId = snippet.id; render(); });
    const delBtn = iconButton('trash', 'מחיקה', 'danger');
    delBtn.addEventListener('click', async () => {
      await saveSnippets((await loadSnippets()).filter(s => s.id !== snippet.id));
      showToast(`הקיצור ${snippet.trigger} נמחק`, async () => {
        const current = await loadSnippets();
        if (!current.some(s => s.id === snippet.id)) await saveSnippets([...current, snippet]);
      });
    });
    const actions = el('div', 'entry-actions');
    actions.append(copyButton(() => snippet.value), editBtn, delBtn);
    row.append(trigger, value, actions);
    return row;
  }

  async function render() {
    const snippets = await loadSnippets();
    document.getElementById('af-nav-snippets').textContent = snippets.length || '';
    const listEl = document.getElementById('af-snippet-list');
    listEl.replaceChildren();
    if (!snippets.length) {
      listEl.appendChild(emptyState('zap', 'עדיין אין קיצורים', 'הוסיפו קיצור למעלה, למשל @TZ למספר תעודת זהות.'));
      return;
    }
    const card = el('div', 'card snippet-list');
    snippets.forEach(snippet => card.appendChild(snippet.id === editingId ? buildEditRow(snippet) : buildRow(snippet)));
    listEl.appendChild(card);
  }

  async function addSnippet(event) {
    event.preventDefault();
    const triggerIn = document.getElementById('af-snip-trigger');
    const valueIn = document.getElementById('af-snip-value');
    const trigger = triggerIn.value.trim();
    const value = valueIn.value.trim();
    if (!trigger) { triggerIn.focus(); return; }
    if (!value) { valueIn.focus(); return; }
    const all = await loadSnippets();
    all.push({ id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, trigger, value, created: Date.now() });
    await saveSnippets(all);
    triggerIn.value = '';
    valueIn.value = '';
    triggerIn.focus();
  }

  function init() {
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
