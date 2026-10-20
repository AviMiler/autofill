// Manager page (single place to manage entries, snippets, backup). Opened by the toolbar icon
// (background.js) in one tab, optionally pre-filtered via the URL hash: #url=<page url>&sel=<css selector>.
// Related files: dom.js (helpers/toast), entry-editor.js (inline edit), snippets.js, backup.js.

const KEY = 'af_entries';

const { el, scopeBadge, showToast, buildEditor } = window.__afMgr;
const { loadEntries, updateEntry, deleteEntry, restoreEntries, appliesToUrl } = window.__afStorage;

const state = {
  entries: [],
  search: '',
  pageUrl: '',      // page the icon was clicked on ('' = none)
  selector: '',     // exact-selector filter coming from the in-page panel
  chip: 'all',      // 'all' | 'global' | 'page' | 'domain'
  domain: '',       // used when chip === 'domain'
  editingId: null,  // entry being edited inline
  adding: false,
};

const bodyEl = document.getElementById('af-body');
const countEl = document.getElementById('af-count');
const chipsEl = document.getElementById('af-chips');

function hostOf(url) {
  try { return new URL(url).hostname || url; } catch { return url; }
}

function applyHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  state.pageUrl = params.get('url') || '';
  state.selector = params.get('sel') || '';
  state.chip = state.pageUrl && !state.selector ? 'page' : 'all';
  state.domain = '';
  renderAll();
}

function passesChip(entry) {
  if (state.chip === 'global') return (entry.matchType || 'global') === 'global';
  if (state.chip === 'page') return appliesToUrl(entry, state.pageUrl);
  if (state.chip === 'domain') return entry.matchType === 'domain' && entry.matchValue === state.domain;
  return true;
}

function passesSearch(entry) {
  if (!state.search) return true;
  const q = state.search.toLowerCase();
  return [entry.fieldLabel, entry.name, entry.value, entry.selector, entry.matchValue]
    .some(s => s && s.toLowerCase().includes(q));
}

function passesAll(entry) {
  return (!state.selector || entry.selector === state.selector) && passesChip(entry) && passesSearch(entry);
}

function renderChips() {
  chipsEl.innerHTML = '';
  const base = state.entries.filter(e => !state.selector || e.selector === state.selector);
  const add = (id, text, count) => {
    const chip = el('button', `af-chip${state.chip === id ? ' active' : ''}`, `${text} (${count})`);
    chip.addEventListener('click', () => { state.chip = id; renderAll(); });
    chipsEl.appendChild(chip);
  };
  add('all', 'הכל', base.length);
  add('global', '🌐 גלובלי', base.filter(e => (e.matchType || 'global') === 'global').length);
  if (state.pageUrl) {
    add('page', `📍 ${hostOf(state.pageUrl)}`, base.filter(e => appliesToUrl(e, state.pageUrl)).length);
  }

  const domains = [...new Set(base.filter(e => e.matchType === 'domain').map(e => e.matchValue))].sort();
  if (domains.length) {
    const select = el('select', `af-chip${state.chip === 'domain' ? ' active' : ''}`);
    const placeholder = el('option', '', 'לפי דומיין…');
    placeholder.value = '';
    select.appendChild(placeholder);
    domains.forEach(d => {
      const opt = el('option', '', d);
      opt.value = d;
      select.appendChild(opt);
    });
    select.value = state.chip === 'domain' ? state.domain : '';
    select.addEventListener('change', () => {
      state.chip = select.value ? 'domain' : 'all';
      state.domain = select.value;
      renderAll();
    });
    chipsEl.appendChild(select);
  }
}

function renderSelectorFilter() {
  const slot = document.getElementById('af-sel-filter');
  slot.innerHTML = '';
  if (!state.selector) return;
  const pill = el('div', 'af-sel-pill');
  const clear = el('button', '', '✕');
  clear.title = 'נקה סינון שדה';
  clear.addEventListener('click', () => { state.selector = ''; history.replaceState(null, '', location.pathname); renderAll(); });
  pill.append(el('span', '', 'מסונן לשדה:'), el('code', '', state.selector), clear);
  slot.appendChild(pill);
}

function renderList() {
  bodyEl.innerHTML = '';
  const filtered = state.entries.filter(passesAll);
  const isFiltered = state.search || state.selector || state.chip !== 'all';
  countEl.textContent = isFiltered ? `${filtered.length} מתוך ${state.entries.length}` : `${state.entries.length} מילויים`;

  if (!filtered.length) {
    bodyEl.appendChild(el('div', 'af-empty', isFiltered ? 'לא נמצאו מילויים בסינון הזה.' : 'אין מילויים שמורים עדיין.'));
    return;
  }

  const groups = new Map();
  filtered.forEach(e => {
    const key = e.selector || '';
    if (!groups.has(key)) groups.set(key, { label: e.fieldLabel || key || '(ללא שם)', entries: [] });
    groups.get(key).entries.push(e);
  });

  groups.forEach(({ label, entries }, key) => {
    const group = el('div', 'af-group');
    const title = el('div', 'af-group-title');
    title.append(el('span', '', label), el('span', 'af-group-sel', key));
    group.appendChild(title);
    entries.forEach(entry => group.appendChild(
      entry.id === state.editingId
        ? buildEditor(entry, { onClose: closeEditors })
        : buildEntryRow(entry)));
    bodyEl.appendChild(group);
  });
}

function renderAll() {
  renderChips();
  renderSelectorFilter();
  renderNewSlot();
  renderList();
}

function renderNewSlot() {
  const slot = document.getElementById('af-new-slot');
  slot.innerHTML = '';
  if (!state.adding) return;
  // Pre-fill the field when the view is narrowed to a single selector.
  const sample = state.selector ? state.entries.find(e => e.selector === state.selector) : null;
  const defaults = state.selector ? { selector: state.selector, fieldLabel: sample?.fieldLabel || '' } : {};
  slot.appendChild(buildEditor(null, { defaults, onClose: closeEditors }));
}

function closeEditors() {
  state.editingId = null;
  state.adding = false;
  renderAll();
}

function buildEntryRow(entry) {
  const row = el('div', `af-entry${entry.enabled === false ? ' off' : ''}`);

  const toggle = el('label', 'af-toggle');
  const cb = el('input');
  cb.type = 'checkbox';
  cb.checked = entry.enabled !== false;
  cb.addEventListener('change', async () => {
    row.classList.toggle('off', !cb.checked);
    await updateEntry({ id: entry.id, enabled: cb.checked });
  });
  toggle.append(cb, el('span', 'af-slider'));

  const info = el('div', 'af-entry-info');
  info.appendChild(el('div', 'af-entry-name', entry.name || entry.value));
  if (entry.name) info.appendChild(el('div', 'af-entry-value', entry.value));

  const editBtn = el('button', 'af-icon-btn', '✏️');
  editBtn.title = 'ערוך';
  editBtn.addEventListener('click', () => { state.editingId = entry.id; state.adding = false; renderAll(); });

  const delBtn = el('button', 'af-icon-btn del', '🗑');
  delBtn.title = 'מחק';
  delBtn.addEventListener('click', async () => {
    await deleteEntry(entry.id);
    showToast('המילוי נמחק', () => restoreEntries([entry]));
  });

  const actions = el('div', 'af-row-actions');
  actions.append(editBtn, delBtn);
  row.append(toggle, info, scopeBadge(entry), actions);
  return row;
}

document.getElementById('af-search').addEventListener('input', e => {
  state.search = e.target.value;
  renderList();
});

document.getElementById('af-add-btn').addEventListener('click', () => {
  state.adding = true;
  state.editingId = null;
  renderAll();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[KEY]) return;
  state.entries = changes[KEY].newValue || [];
  // Don't rebuild the page under an open editor: it would wipe what the user is typing.
  if (state.editingId || state.adding) return;
  renderAll();
});

window.addEventListener('hashchange', applyHash);

(async () => {
  state.entries = await loadEntries();
  applyHash();
})();
