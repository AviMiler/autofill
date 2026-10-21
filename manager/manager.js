// Manager page (single place to manage entries, snippets, backup). Opened by the toolbar icon
// (background.js) in one tab, optionally pre-filtered via the URL hash: #url=<page url>&sel=<css selector>.
// Layout: sidebar (views: entries / snippets / backup + "filter by site" list) and a main column.
// Related files: dom.js (helpers/toast), entry-editor.js (inline edit), snippets.js, backup.js.

const KEY = 'af_entries';

const { el, hydrateIcons, iconButton, toggle, scopeBadge, copyButton, emptyState, showToast, buildEditor } = window.__afMgr;
const { loadEntries, updateEntry, deleteEntry, restoreEntries, appliesToUrl } = window.__afStorage;

const state = {
  view: 'entries',  // 'entries' | 'snippets' | 'backup'
  entries: [],
  search: '',
  pageUrl: '',      // page the icon was clicked on ('' = none)
  selector: '',     // exact-selector filter coming from the in-page panel
  site: 'all',      // 'all' | 'global' | 'page' | 'domain' | 'url'
  domain: '',       // used when site === 'domain'
  editingId: null,  // entry being edited inline
  adding: false,
};

const bodyEl = document.getElementById('af-body');
const countEl = document.getElementById('af-count');
const sitesEl = document.getElementById('af-sites');

function hostOf(url) {
  try { return new URL(url).hostname || url; } catch { return url; }
}

function applyHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  state.pageUrl = params.get('url') || '';
  state.selector = params.get('sel') || '';
  state.site = state.pageUrl && !state.selector ? 'page' : 'all';
  state.domain = '';
  setView('entries');
}

// ── views ─────────────────────────────────────────────────────────────────

function setView(view) {
  state.view = view;
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  ['entries', 'snippets', 'backup'].forEach(v => { document.getElementById(`view-${v}`).hidden = v !== view; });
  renderAll();
}

document.getElementById('af-nav').addEventListener('click', e => {
  const item = e.target.closest('.nav-item');
  if (item) setView(item.dataset.view);
});

// ── filtering ─────────────────────────────────────────────────────────────

const typeOf = entry => entry.matchType || 'global';

function passesSite(entry) {
  if (state.site === 'global') return typeOf(entry) === 'global';
  if (state.site === 'page') return appliesToUrl(entry, state.pageUrl);
  if (state.site === 'domain') return typeOf(entry) === 'domain' && entry.matchValue === state.domain;
  if (state.site === 'url') return typeOf(entry) === 'url-contains';
  return true;
}

function passesSearch(entry) {
  if (!state.search) return true;
  const q = state.search.toLowerCase();
  return [entry.fieldLabel, entry.name, entry.value, entry.selector, entry.matchValue]
    .some(s => s && s.toLowerCase().includes(q));
}

function passesAll(entry) {
  return (!state.selector || entry.selector === state.selector) && passesSite(entry) && passesSearch(entry);
}

// ── sidebar: filter by site ───────────────────────────────────────────────

function renderSites() {
  document.getElementById('af-sites-section').hidden = state.view !== 'entries';
  sitesEl.replaceChildren();
  const base = state.entries.filter(e => !state.selector || e.selector === state.selector);

  const add = (id, iconName, text, count, { domain = '', ltr = false } = {}) => {
    const active = state.site === id && (id !== 'domain' || state.domain === domain);
    const item = el('button', `site-item${active ? ' active' : ''}`);
    item.type = 'button';
    const label = el('span', 'site-text', text);
    if (ltr) label.dir = 'ltr';
    item.append(window.__afMgr.icon(iconName, 15), label, el('span', 'site-count', String(count)));
    item.title = text;
    item.addEventListener('click', () => { state.site = id; state.domain = domain; renderAll(); });
    sitesEl.appendChild(item);
  };

  add('all', 'layers', 'הכל', base.length);
  if (state.pageUrl) add('page', 'pin', `הדף הנוכחי · ${hostOf(state.pageUrl)}`, base.filter(e => appliesToUrl(e, state.pageUrl)).length);
  add('global', 'globe', 'כל האתרים', base.filter(e => typeOf(e) === 'global').length);

  const byDomain = new Map();
  base.filter(e => typeOf(e) === 'domain').forEach(e => byDomain.set(e.matchValue, (byDomain.get(e.matchValue) || 0) + 1));
  const urlCount = base.filter(e => typeOf(e) === 'url-contains').length;
  if (byDomain.size || urlCount) sitesEl.appendChild(el('div', 'site-sep'));
  [...byDomain.keys()].sort().forEach(d => add('domain', 'site', d, byDomain.get(d), { domain: d, ltr: true }));
  if (urlCount) add('url', 'link', 'כתובות מותאמות', urlCount);
}

function renderNavCounts() {
  document.getElementById('af-nav-entries').textContent = state.entries.length || '';
}

function renderSelectorFilter() {
  const slot = document.getElementById('af-sel-filter');
  slot.replaceChildren();
  if (!state.selector) return;
  const pill = el('div', 'filter-pill');
  const code = el('code', '', state.selector);
  code.title = state.selector;
  const clear = iconButton('x', 'ניקוי סינון השדה');
  clear.addEventListener('click', () => { state.selector = ''; history.replaceState(null, '', location.pathname); renderAll(); });
  pill.append(el('span', '', 'מסונן לשדה'), code, clear);
  slot.appendChild(pill);
}

// ── list ──────────────────────────────────────────────────────────────────

function siteFilterLabel() {
  if (state.site === 'page') return hostOf(state.pageUrl);
  if (state.site === 'global') return 'כל האתרים';
  if (state.site === 'domain') return state.domain;
  if (state.site === 'url') return 'כתובות מותאמות';
  return '';
}

function renderList() {
  bodyEl.replaceChildren();
  const filtered = state.entries.filter(passesAll);
  const isFiltered = state.search || state.selector || state.site !== 'all';
  const total = state.entries.length;
  countEl.textContent = !total ? 'ערכים שמורים שמופיעים כהצעה כשנכנסים לשדה.'
    : isFiltered ? `${filtered.length} מתוך ${total} מילויים${siteFilterLabel() ? ` · ${siteFilterLabel()}` : ''}`
    : `${total} מילויים שמורים`;

  if (!filtered.length) {
    bodyEl.appendChild(total
      ? emptyState('search', 'לא נמצאו מילויים', 'נסו חיפוש אחר או בחרו "הכל" בסינון לפי אתר.')
      : emptyState('field', 'עדיין אין מילויים', 'לוחצים קליק ימני על שדה בכל אתר ← "AutoFill: הגדר אפשרויות לשדה זה", או "מילוי חדש" למעלה.'));
    return;
  }

  const groups = new Map();
  filtered.forEach(e => {
    const key = e.selector || '';
    if (!groups.has(key)) groups.set(key, { label: e.fieldLabel || '', entries: [] });
    const g = groups.get(key);
    if (!g.label && e.fieldLabel) g.label = e.fieldLabel;
    g.entries.push(e);
  });

  groups.forEach(({ label, entries }, key) => {
    const group = el('section', 'group');
    const head = el('div', 'group-head');
    const sel = el('span', 'group-sel', key);
    sel.title = key;
    head.append(el('h3', 'group-title', label || key || 'ללא שם'), el('span', 'group-count', String(entries.length)), sel);
    const body = el('div', 'card group-body');
    entries.forEach(entry => body.appendChild(
      entry.id === state.editingId
        ? buildEditor(entry, { onClose: closeEditors })
        : buildEntryRow(entry)));
    group.append(head, body);
    bodyEl.appendChild(group);
  });
}

function renderNewSlot() {
  const slot = document.getElementById('af-new-slot');
  slot.replaceChildren();
  if (!state.adding) return;
  // Pre-fill the field when the view is narrowed to a single selector, and the scope from the site filter.
  const sample = state.selector ? state.entries.find(e => e.selector === state.selector) : null;
  const defaults = state.selector ? { selector: state.selector, fieldLabel: sample?.fieldLabel || '' } : {};
  if (state.site === 'domain') Object.assign(defaults, { matchType: 'domain', matchValue: state.domain });
  if (state.site === 'page' && hostOf(state.pageUrl)) Object.assign(defaults, { matchType: 'domain', matchValue: hostOf(state.pageUrl) });
  const card = el('div', 'card editor-card');
  card.appendChild(buildEditor(null, { defaults, onClose: closeEditors }));
  slot.appendChild(card);
}

function renderAll() {
  renderNavCounts();
  renderSites();
  if (state.view !== 'entries') return;
  renderSelectorFilter();
  renderNewSlot();
  renderList();
}

function closeEditors() {
  state.editingId = null;
  state.adding = false;
  renderAll();
}

function buildEntryRow(entry) {
  const row = el('div', `entry${entry.enabled === false ? ' off' : ''}`);

  const sw = toggle(entry.enabled !== false, async checked => {
    row.classList.toggle('off', !checked);
    await updateEntry({ id: entry.id, enabled: checked });
  }, 'פעיל');

  const info = el('div', 'entry-info');
  info.appendChild(el('div', 'entry-name', entry.name || entry.value));
  if (entry.name) info.appendChild(el('div', 'entry-value', entry.value));
  info.title = entry.value;

  const editBtn = iconButton('pencil', 'עריכה');
  editBtn.addEventListener('click', () => { state.editingId = entry.id; state.adding = false; renderAll(); });

  const delBtn = iconButton('trash', 'מחיקה', 'danger');
  delBtn.addEventListener('click', async () => {
    await deleteEntry(entry.id);
    showToast('המילוי נמחק', () => restoreEntries([entry]));
  });

  const actions = el('div', 'entry-actions');
  actions.append(copyButton(() => entry.value), editBtn, delBtn);
  row.append(sw, info, scopeBadge(entry), actions);
  return row;
}

// ── events ────────────────────────────────────────────────────────────────

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
  if (state.editingId || state.adding) { renderNavCounts(); return; }
  renderAll();
});

window.addEventListener('hashchange', applyHash);

hydrateIcons();
document.getElementById('af-version').textContent = `v${chrome.runtime.getManifest().version}`;

(async () => {
  state.entries = await loadEntries();
  applyHash();
})();
