const KEY = 'af_entries';

async function loadEntries() {
  const data = await chrome.storage.local.get(KEY);
  return data[KEY] || [];
}

async function saveEntries(entries) {
  await chrome.storage.local.set({ [KEY]: entries });
}

async function render() {
  const entries = await loadEntries();
  const list = document.getElementById('entries-list');
  const countEl = document.getElementById('total-count');

  countEl.textContent = entries.length;
  list.innerHTML = '';

  if (!entries.length) {
    list.innerHTML = '<div class="empty">אין מילויים עדיין.<br>לחץ ימני על שדה כלשהו כדי להתחיל.</div>';
    return;
  }

  const groups = new Map();
  entries.forEach(e => {
    const key = e.selector || '';
    if (!groups.has(key)) groups.set(key, { label: e.fieldLabel || key || '(ללא שם)', entries: [] });
    groups.get(key).entries.push(e);
  });

  const scopeLabel = e => {
    const mt = e.matchType || 'global';
    if (mt === 'global') return '🌐';
    if (mt === 'domain') return `🌍 ${e.matchValue}`;
    return `🔗 ${e.matchValue}`;
  };

  groups.forEach(({ label, entries: groupEntries }) => {
    const titleEl = document.createElement('div');
    titleEl.className = 'af-group-title';
    titleEl.textContent = label;
    list.appendChild(titleEl);

    groupEntries.forEach(entry => {
      const row = document.createElement('div');
      row.className = 'af-entry-row';

      row.innerHTML = `
        <div class="af-entry-info">
          <div class="af-entry-name">${escHtml(entry.name || entry.value)}</div>
          <div class="af-entry-meta">${entry.name ? escHtml(entry.value) + ' · ' : ''}${escHtml(scopeLabel(entry))}</div>
        </div>
        <label class="af-toggle">
          <input type="checkbox" ${entry.enabled !== false ? 'checked' : ''} data-id="${entry.id}">
          <span class="af-slider"></span>
        </label>
        <button class="af-del-btn" data-id="${entry.id}" title="מחק">×</button>
      `;

      row.querySelector('input[type=checkbox]').addEventListener('change', async ev => {
        const all = await loadEntries();
        await saveEntries(all.map(e => e.id === entry.id ? { ...e, enabled: ev.target.checked } : e));
      });

      row.querySelector('.af-del-btn').addEventListener('click', async () => {
        const all = await loadEntries();
        await saveEntries(all.filter(e => e.id !== entry.id));
        render();
      });

      list.appendChild(row);
    });
  });
}

function escHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

render();

// Open manager in a dedicated new tab (works on any page, never overlays it)
document.getElementById('open-manager').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('manager/manager.html') });
  window.close();
});

// Snippets section — text-expansion shortcuts (e.g. "@TZ" → "123456789")
const SNIPPET_KEY = 'af_snippets';

async function loadSnippets() {
  const data = await chrome.storage.local.get(SNIPPET_KEY);
  return data[SNIPPET_KEY] || [];
}

async function saveSnippets(snippets) {
  await chrome.storage.local.set({ [SNIPPET_KEY]: snippets });
}

async function renderSnippets() {
  const snippets = await loadSnippets();
  const list = document.getElementById('snippet-list');
  list.innerHTML = '';

  if (!snippets.length) {
    list.innerHTML = '<div class="empty-small">אין קיצורים עדיין.</div>';
    return;
  }

  snippets.forEach(s => {
    const row = document.createElement('div');
    row.className = 'snippet-row';
    row.innerHTML = `
      <div class="snippet-info">
        <span class="snippet-trigger">${escHtml(s.trigger)}</span>
        <span class="snippet-value">${escHtml(s.value)}</span>
      </div>
      <button class="af-del-btn" data-id="${s.id}" title="מחק">×</button>
    `;
    row.querySelector('.af-del-btn').addEventListener('click', async () => {
      const all = await loadSnippets();
      await saveSnippets(all.filter(x => x.id !== s.id));
      renderSnippets();
    });
    list.appendChild(row);
  });
}

document.getElementById('snip-add').addEventListener('click', async () => {
  const triggerInput = document.getElementById('snip-trigger');
  const valueInput = document.getElementById('snip-value');
  const trigger = triggerInput.value.trim();
  const value = valueInput.value.trim();
  if (!trigger || !value) return;

  const all = await loadSnippets();
  all.push({
    id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trigger, value, created: Date.now(),
  });
  await saveSnippets(all);
  triggerInput.value = '';
  valueInput.value = '';
  triggerInput.focus();
  renderSnippets();
});

renderSnippets();
