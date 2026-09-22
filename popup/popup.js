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

  // Group by selector
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

  groups.forEach(({ label, entries: groupEntries }, selector) => {
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

// Open manager in active tab
document.getElementById('open-manager').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'open-manager' });
      window.close();
    }
  });
});

