// Standalone manager page (opened in its own browser tab from the popup).
// Full CRUD over entries (af_entries). No page-context selector validation —
// this page runs at chrome-extension://, not on the page the field lives on.

const KEY = 'af_entries';

async function loadEntries() {
  const data = await chrome.storage.local.get(KEY);
  return data[KEY] || [];
}

async function saveEntries(entries) {
  await chrome.storage.local.set({ [KEY]: entries });
}

function genId() {
  return `e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

let allEntries = [];
let searchQuery = '';

const bodyEl = document.getElementById('af-body');
const countEl = document.getElementById('af-count');
const searchEl = document.getElementById('af-search');
const addBtn = document.getElementById('af-add-btn');

searchEl.addEventListener('input', () => {
  searchQuery = searchEl.value;
  renderList();
});

addBtn.addEventListener('click', () => openModal(null));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[KEY]) {
    allEntries = changes[KEY].newValue || [];
    renderList();
  }
});

function entryMatchesSearch(e) {
  if (!searchQuery) return true;
  const q = searchQuery.toLowerCase();
  return [e.fieldLabel, e.name, e.value, e.selector, e.matchValue]
    .some(s => s && s.toLowerCase().includes(q));
}

function renderList() {
  bodyEl.innerHTML = '';
  countEl.textContent = `${allEntries.length} מילויים`;

  const filtered = allEntries.filter(entryMatchesSearch);

  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'af-empty';
    empty.textContent = searchQuery ? 'לא נמצאו תוצאות.' : 'אין מילויים שמורים עדיין.';
    bodyEl.appendChild(empty);
    return;
  }

  const groups = new Map();
  filtered.forEach(e => {
    const key = e.selector || '';
    if (!groups.has(key)) groups.set(key, { label: e.fieldLabel || key || '(ללא שם)', entries: [] });
    groups.get(key).entries.push(e);
  });

  groups.forEach(({ label, entries }, key) => {
    const group = document.createElement('div');
    group.className = 'af-group';

    const titleEl = document.createElement('div');
    titleEl.className = 'af-group-title';
    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    const selSpan = document.createElement('span');
    selSpan.className = 'af-group-sel';
    selSpan.textContent = key;
    titleEl.appendChild(labelSpan);
    titleEl.appendChild(selSpan);
    group.appendChild(titleEl);

    entries.forEach(entry => group.appendChild(buildEntryRow(entry)));
    bodyEl.appendChild(group);
  });
}

function buildEntryRow(entry) {
  const row = document.createElement('div');
  row.className = 'af-entry';

  const toggle = document.createElement('label');
  toggle.className = 'af-toggle';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = entry.enabled !== false;
  cb.addEventListener('change', async () => {
    const all = await loadEntries();
    await saveEntries(all.map(e => e.id === entry.id ? { ...e, enabled: cb.checked } : e));
  });
  const slider = document.createElement('span');
  slider.className = 'af-slider';
  toggle.appendChild(cb);
  toggle.appendChild(slider);

  const info = document.createElement('div');
  info.className = 'af-entry-info';
  const nameEl = document.createElement('div');
  nameEl.className = 'af-entry-name';
  nameEl.textContent = entry.name || entry.value;
  info.appendChild(nameEl);
  if (entry.name) {
    const valEl = document.createElement('div');
    valEl.className = 'af-entry-value';
    valEl.textContent = entry.value;
    info.appendChild(valEl);
  }

  const badge = document.createElement('span');
  badge.className = 'af-scope-badge';
  const mt = entry.matchType || 'global';
  if (mt === 'global') { badge.className += ' s-global'; badge.textContent = '🌐 גלובלי'; }
  else if (mt === 'domain') { badge.className += ' s-domain'; badge.textContent = `🌍 ${entry.matchValue}`; }
  else { badge.className += ' s-url'; badge.textContent = `🔗 ${entry.matchValue}`; }

  const actions = document.createElement('div');
  actions.className = 'af-row-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'af-icon-btn';
  editBtn.textContent = '✏️';
  editBtn.title = 'ערוך';
  editBtn.addEventListener('click', () => openModal(entry));

  const delBtn = document.createElement('button');
  delBtn.className = 'af-icon-btn del';
  delBtn.title = 'מחק';
  delBtn.textContent = '🗑';
  delBtn.addEventListener('click', async () => {
    if (!confirm('למחוק מילוי זה?')) return;
    const all = await loadEntries();
    await saveEntries(all.filter(e => e.id !== entry.id));
  });

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  row.appendChild(toggle);
  row.appendChild(info);
  row.appendChild(badge);
  row.appendChild(actions);
  return row;
}

function openModal(entry) {
  document.querySelector('.af-modal-backdrop')?.remove();

  const isNew = !entry;
  const curMatchType = entry?.matchType || 'global';
  const curMatchValue = entry?.matchValue || '';

  const backdrop = document.createElement('div');
  backdrop.className = 'af-modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'af-modal';

  modal.innerHTML = `
    <h3>${isNew ? '➕ הוסף מילוי חדש' : '✏️ ערוך מילוי'}</h3>

    <label>שם השדה (לתצוגה)</label>
    <input type="text" id="af-fieldLabel" value="${escHtml(entry?.fieldLabel || '')}" placeholder="למשל: אימייל, שם מלא">

    <label>CSS Selector</label>
    <input type="text" id="af-selector" value="${escHtml(entry?.selector || '')}" placeholder="למשל: input[name='email']">

    <label>שם האפשרות (אופציונלי)</label>
    <input type="text" id="af-name" value="${escHtml(entry?.name || '')}" placeholder="למשל: אישי, עבודה">

    <label>ערך למילוי</label>
    <input type="text" id="af-value" value="${escHtml(entry?.value || '')}" placeholder="הערך שימולא בשדה...">

    <label>הופעל כאשר</label>
    <div class="af-scope-opts">
      <label><input type="radio" name="af-scope" value="global" ${curMatchType === 'global' ? 'checked' : ''}> כל האתרים</label>
      <label><input type="radio" name="af-scope" value="domain" ${curMatchType === 'domain' ? 'checked' : ''}> דומיין מסוים</label>
      <label><input type="radio" name="af-scope" value="url-contains" ${curMatchType === 'url-contains' ? 'checked' : ''}> ה-URL מכיל:</label>
      <input type="text" id="af-url-val" class="af-url-val"
        value="${escHtml(curMatchType !== 'global' ? curMatchValue : '')}"
        placeholder="${curMatchType === 'domain' ? 'למשל: example.com' : 'למשל: /admin/ או ?lang=he'}">
    </div>

    <div class="af-modal-actions">
      ${!isNew ? '<button class="btn-del" id="af-del">מחק</button>' : ''}
      <button class="btn-cancel" id="af-cancel">בטל</button>
      <button class="btn-save" id="af-save">שמור</button>
    </div>
  `;

  const urlInput = modal.querySelector('#af-url-val');
  const syncUrl = () => {
    const checked = modal.querySelector('input[name="af-scope"]:checked')?.value;
    urlInput.disabled = checked === 'global';
    urlInput.placeholder = checked === 'domain' ? 'למשל: example.com' : 'למשל: /admin/ או ?lang=he';
  };
  modal.querySelectorAll('input[name="af-scope"]').forEach(r => r.addEventListener('change', syncUrl));
  syncUrl();

  backdrop.addEventListener('mousedown', e => { if (e.target === backdrop) backdrop.remove(); });
  modal.querySelector('#af-cancel').addEventListener('click', () => backdrop.remove());

  modal.querySelector('#af-del')?.addEventListener('click', async () => {
    if (!confirm('למחוק?')) return;
    const all = await loadEntries();
    await saveEntries(all.filter(e => e.id !== entry.id));
    backdrop.remove();
  });

  modal.querySelector('#af-save').addEventListener('click', async () => {
    const selector = modal.querySelector('#af-selector').value.trim();
    const value = modal.querySelector('#af-value').value.trim();
    if (!selector || !value) return;

    const matchType = modal.querySelector('input[name="af-scope"]:checked')?.value || 'global';
    let matchValue = '';
    if (matchType !== 'global') {
      matchValue = urlInput.value.trim();
      if (!matchValue) return;
    }

    const data = {
      ...(entry || {}),
      selector,
      fieldLabel: modal.querySelector('#af-fieldLabel').value.trim(),
      name: modal.querySelector('#af-name').value.trim(),
      value,
      matchType,
      matchValue,
    };

    const all = await loadEntries();
    if (isNew) {
      await saveEntries([...all, { enabled: true, ...data, id: genId(), created: Date.now() }]);
    } else {
      await saveEntries(all.map(e => e.id === data.id ? { ...e, ...data } : e));
    }

    backdrop.remove();
  });

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  modal.querySelector('#af-fieldLabel').focus();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelector('.af-modal-backdrop')?.remove();
});

function escHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

(async () => {
  allEntries = await loadEntries();
  renderList();
})();
