// PUBLIC API: window.__afManager
// show(opts?)  → void   opts: { selector? } — open manager, optionally filter to selector
// hide()       → void

(() => {
  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .af-manager {
      position: fixed; inset: 0; z-index: 2147483647;
      background: #f7f8fa;
      font-family: system-ui, sans-serif;
      direction: rtl;
      display: flex; flex-direction: column; overflow: hidden;
    }
    .af-header {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 20px; background: #fff;
      border-bottom: 1px solid #e5e5e5; flex-shrink: 0;
    }
    .af-title { font-size: 16px; font-weight: 700; color: #111; white-space: nowrap; }
    .af-search {
      flex: 1; padding: 7px 14px; border: 1px solid #ddd;
      border-radius: 20px; font-size: 13px; outline: none; direction: rtl;
    }
    .af-search:focus { border-color: #4f7aff; }
    .af-close-btn {
      border: none; background: none; cursor: pointer;
      font-size: 20px; color: #aaa; line-height: 1; padding: 2px 6px;
    }
    .af-close-btn:hover { color: #333; }
    .af-toolbar {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 20px; background: #fff;
      border-bottom: 1px solid #f0f0f0; flex-shrink: 0;
    }
    .af-filter-btn {
      padding: 4px 14px; border: 1px solid #ddd; border-radius: 14px;
      background: #fff; font-size: 12px; cursor: pointer; color: #555;
    }
    .af-filter-btn.active { background: #4f7aff; color: #fff; border-color: #4f7aff; }
    .af-add-btn {
      margin-right: auto; padding: 6px 16px; border: none;
      border-radius: 6px; background: #4f7aff; color: #fff;
      font-size: 13px; cursor: pointer; font-family: inherit;
    }
    .af-add-btn:hover { background: #3a63e0; }
    .af-body { flex: 1; overflow-y: auto; padding: 16px 20px; }
    .af-group { margin-bottom: 22px; }
    .af-group-title {
      font-size: 11px; font-weight: 700; color: #999;
      text-transform: uppercase; letter-spacing: .4px;
      margin-bottom: 8px; display: flex; align-items: baseline; gap: 8px;
    }
    .af-group-sel {
      font-family: ui-monospace, monospace; font-size: 11px;
      color: #bbb; font-weight: 400;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 280px;
    }
    .af-entry {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px; background: #fff;
      border: 1px solid #eee; border-radius: 8px; margin-bottom: 6px;
    }
    .af-entry:hover { border-color: #ccc; }
    .af-entry-info { flex: 1; min-width: 0; }
    .af-entry-name { font-size: 13px; font-weight: 600; color: #111; }
    .af-entry-value {
      font-size: 12px; color: #888; font-family: ui-monospace, monospace;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .af-scope-badge {
      font-size: 11px; padding: 2px 9px; border-radius: 10px; white-space: nowrap; flex-shrink: 0;
    }
    .s-global { background: #e8f4e8; color: #1a7a3c; }
    .s-domain  { background: #e8eeff; color: #2a4ad0; }
    .s-url     { background: #fff8e1; color: #a06000; }
    .af-toggle {
      position: relative; width: 32px; height: 18px; flex-shrink: 0;
    }
    .af-toggle input { opacity: 0; width: 0; height: 0; }
    .af-slider {
      position: absolute; inset: 0; background: #ccc;
      border-radius: 18px; cursor: pointer; transition: .2s;
    }
    .af-slider:before {
      content: ''; position: absolute;
      height: 13px; width: 13px; right: 2.5px; bottom: 2.5px;
      background: #fff; border-radius: 50%; transition: .2s;
    }
    input:checked + .af-slider { background: #4f7aff; }
    input:checked + .af-slider:before { transform: translateX(-14px); }
    .af-row-actions { display: flex; gap: 2px; flex-shrink: 0; }
    .af-icon-btn {
      border: none; background: none; cursor: pointer;
      font-size: 14px; padding: 4px 6px; border-radius: 5px; color: #bbb;
    }
    .af-icon-btn:hover { background: #f0f0f0; color: #333; }
    .af-icon-btn.del:hover { color: #c00; background: #fff0f0; }
    .af-empty { text-align: center; color: #aaa; font-size: 14px; padding: 60px 0; }

    /* Edit modal */
    .af-modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,.5);
      z-index: 2; display: flex; align-items: center; justify-content: center;
    }
    .af-modal {
      background: #fff; border-radius: 12px;
      box-shadow: 0 8px 40px rgba(0,0,0,.25);
      width: 440px; max-width: 95vw; max-height: 90vh;
      overflow-y: auto; padding: 24px; direction: rtl;
    }
    .af-modal h3 { margin: 0 0 18px; font-size: 15px; color: #111; }
    .af-modal label { display: block; font-size: 12px; color: #555; margin: 14px 0 4px; }
    .af-modal input[type=text] {
      width: 100%; box-sizing: border-box; border: 1px solid #ddd;
      border-radius: 6px; padding: 7px 10px; font-size: 13px; outline: none;
      font-family: inherit;
    }
    .af-modal input[type=text]:focus { border-color: #4f7aff; }
    .af-modal .af-scope-opts { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; font-size: 13px; }
    .af-modal .af-scope-opts label { margin: 0; display: flex; align-items: center; gap: 6px; color: #333; }
    .af-modal .af-url-val { margin: 6px 0 0 24px; width: calc(100% - 24px); }
    .af-modal .af-url-val[disabled] { background: #f5f5f5; color: #aaa; }
    .af-modal-actions { display: flex; gap: 8px; margin-top: 22px; }
    .af-modal-actions button {
      padding: 8px 18px; border-radius: 6px; border: none;
      font-size: 13px; cursor: pointer; font-family: inherit;
    }
    .btn-save   { background: #4f7aff; color: #fff; flex: 1; }
    .btn-save:hover { background: #3a63e0; }
    .btn-cancel { background: #f2f2f2; color: #444; }
    .btn-cancel:hover { background: #e5e5e5; }
    .btn-del    { background: #fff0f0; color: #c00; margin-right: auto; }
    .btn-del:hover { background: #ffd5d5; }
    .af-sel-row { display: flex; gap: 6px; align-items: center; }
    .af-sel-row input { flex: 1; }
    .af-badge { font-size: 11px; padding: 2px 6px; border-radius: 10px; white-space: nowrap; }
    .af-badge.ok   { background: #e6f9ee; color: #1a7a3c; }
    .af-badge.warn { background: #fff7e0; color: #a06000; }
  `;

  let host = null;
  let shadow = null;
  let bodyEl = null;
  let allEntries = [];
  let searchQuery = '';
  let filterMode = 'all';
  let storageListener = null;

  async function show(opts = {}) {
    hide();
    allEntries = await window.__afStorage.loadEntries();

    host = document.createElement('div');
    shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = CSS;
    shadow.appendChild(style);

    buildUI(opts);
    document.body.appendChild(host);

    storageListener = (changes, area) => {
      if (area === 'local' && changes['af_entries'] && host) {
        allEntries = changes['af_entries'].newValue || [];
        renderList(opts.selector);
      }
    };
    chrome.storage.onChanged.addListener(storageListener);
  }

  function hide() {
    if (storageListener) {
      chrome.storage.onChanged.removeListener(storageListener);
      storageListener = null;
    }
    if (host) { host.remove(); host = null; shadow = null; bodyEl = null; }
    searchQuery = '';
    filterMode = 'all';
  }

  function buildUI(opts) {
    const manager = document.createElement('div');
    manager.className = 'af-manager';
    shadow.appendChild(manager);

    // Header
    const header = document.createElement('div');
    header.className = 'af-header';

    const title = document.createElement('div');
    title.className = 'af-title';
    title.textContent = '🗂 ניהול מילויים אוטומטיים';

    const search = document.createElement('input');
    search.className = 'af-search';
    search.placeholder = '🔍 חיפוש לפי שם, ערך, שדה או URL...';
    search.type = 'text';
    search.addEventListener('input', () => {
      searchQuery = search.value;
      renderList(opts.selector);
    });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'af-close-btn';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', hide);

    header.appendChild(title);
    header.appendChild(search);
    header.appendChild(closeBtn);
    manager.appendChild(header);

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'af-toolbar';

    const pageCount = () => allEntries.filter(e => urlMatchesEntry(e)).length;

    const allBtn = document.createElement('button');
    allBtn.className = 'af-filter-btn active';
    allBtn.textContent = `הכל (${allEntries.length})`;

    const pageBtn = document.createElement('button');
    pageBtn.className = 'af-filter-btn';
    pageBtn.textContent = `דף זה (${pageCount()})`;

    allBtn.addEventListener('click', () => {
      filterMode = 'all';
      allBtn.className = 'af-filter-btn active';
      pageBtn.className = 'af-filter-btn';
      renderList(opts.selector);
    });
    pageBtn.addEventListener('click', () => {
      filterMode = 'page';
      pageBtn.className = 'af-filter-btn active';
      allBtn.className = 'af-filter-btn';
      renderList(opts.selector);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'af-add-btn';
    addBtn.textContent = '+ הוסף מילוי חדש';
    addBtn.addEventListener('click', () => openModal(null, opts.selector));

    toolbar.appendChild(allBtn);
    toolbar.appendChild(pageBtn);
    toolbar.appendChild(addBtn);
    manager.appendChild(toolbar);

    bodyEl = document.createElement('div');
    bodyEl.className = 'af-body';
    manager.appendChild(bodyEl);

    renderList(opts.selector);

    document.addEventListener('keydown', onKeyDown);
  }

  function onKeyDown(e) {
    if (!host) { document.removeEventListener('keydown', onKeyDown); return; }
    if (e.key === 'Escape' && !shadow.querySelector('.af-modal-backdrop')) hide();
  }

  function urlMatchesEntry(e) {
    const mt = e.matchType || 'global';
    if (mt === 'global') return true;
    if (mt === 'domain') return location.hostname === e.matchValue;
    if (mt === 'url-contains') return e.matchValue && location.href.includes(e.matchValue);
    return false;
  }

  function entryMatchesSearch(e) {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return [e.fieldLabel, e.name, e.value, e.selector, e.matchValue]
      .some(s => s && s.toLowerCase().includes(q));
  }

  function renderList(initialSelector) {
    if (!bodyEl) return;
    bodyEl.innerHTML = '';

    const filtered = allEntries.filter(e =>
      (filterMode === 'all' || urlMatchesEntry(e)) && entryMatchesSearch(e)
    );

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'af-empty';
      empty.textContent = searchQuery ? 'לא נמצאו תוצאות.' : 'אין מילויים שמורים עדיין.';
      bodyEl.appendChild(empty);
      return;
    }

    // Group by selector
    const groups = new Map();
    filtered.forEach(e => {
      const key = e.selector || '';
      if (!groups.has(key)) groups.set(key, { label: e.fieldLabel || key || '(ללא שם)', entries: [] });
      groups.get(key).entries.push(e);
    });

    // If initialSelector, sort it first
    const keys = [...groups.keys()];
    if (initialSelector && groups.has(initialSelector)) {
      keys.sort((a, b) => a === initialSelector ? -1 : b === initialSelector ? 1 : 0);
    }

    keys.forEach(key => {
      const { label, entries } = groups.get(key);
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
    cb.addEventListener('change', () => window.__afStorage.updateEntry({ ...entry, enabled: cb.checked }));
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
    delBtn.textContent = '🗑';
    delBtn.title = 'מחק';
    delBtn.addEventListener('click', async () => {
      if (!confirm('למחוק מילוי זה?')) return;
      await window.__afStorage.deleteEntry(entry.id);
      window.__afContent?.refreshEntries();
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    row.appendChild(toggle);
    row.appendChild(info);
    row.appendChild(badge);
    row.appendChild(actions);
    return row;
  }

  function openModal(entry, defaultSelector) {
    shadow.querySelector('.af-modal-backdrop')?.remove();

    const isNew = !entry;
    const hostname = location.hostname;
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
      <div class="af-sel-row">
        <input type="text" id="af-selector" value="${escHtml(entry?.selector || defaultSelector || '')}">
        <span id="af-sel-badge" class="af-badge"></span>
      </div>

      <label>שם האפשרות (אופציונלי)</label>
      <input type="text" id="af-name" value="${escHtml(entry?.name || '')}" placeholder="למשל: אישי, עבודה">

      <label>ערך למילוי</label>
      <input type="text" id="af-value" value="${escHtml(entry?.value || '')}" placeholder="הערך שימולא בשדה...">

      <label>הופעל כאשר</label>
      <div class="af-scope-opts">
        <label><input type="radio" name="af-scope" value="global" ${curMatchType === 'global' ? 'checked' : ''}> כל האתרים</label>
        <label><input type="radio" name="af-scope" value="domain" ${curMatchType === 'domain' ? 'checked' : ''}> רק ב-${escHtml(hostname)}</label>
        <label><input type="radio" name="af-scope" value="url-contains" ${curMatchType === 'url-contains' ? 'checked' : ''}> ה-URL מכיל:</label>
        <input type="text" id="af-url-val" class="af-url-val"
          value="${escHtml(curMatchType === 'url-contains' ? curMatchValue : '')}"
          placeholder="למשל: /admin/ או ?lang=he">
      </div>

      <div class="af-modal-actions">
        ${!isNew ? '<button class="btn-del" id="af-del">מחק</button>' : ''}
        <button class="btn-cancel" id="af-cancel">בטל</button>
        <button class="btn-save" id="af-save">שמור</button>
      </div>
    `;

    const selInput = modal.querySelector('#af-selector');
    const badge = modal.querySelector('#af-sel-badge');
    const updateBadge = () => {
      const sel = selInput.value.trim();
      if (!sel) { badge.textContent = ''; return; }
      const unique = window.__afSelector.isUnique(sel);
      badge.className = `af-badge ${unique ? 'ok' : 'warn'}`;
      badge.textContent = unique ? '✓ ייחודי' : '⚠ לא ייחודי';
    };
    updateBadge();
    selInput.addEventListener('input', updateBadge);

    const urlInput = modal.querySelector('#af-url-val');
    const syncUrl = () => {
      const checked = modal.querySelector('input[name="af-scope"]:checked')?.value;
      urlInput.disabled = checked !== 'url-contains';
    };
    modal.querySelectorAll('input[name="af-scope"]').forEach(r => r.addEventListener('change', syncUrl));
    syncUrl();

    backdrop.addEventListener('mousedown', e => { if (e.target === backdrop) backdrop.remove(); });
    modal.querySelector('#af-cancel').addEventListener('click', () => backdrop.remove());

    modal.querySelector('#af-del')?.addEventListener('click', async () => {
      if (!confirm('למחוק?')) return;
      await window.__afStorage.deleteEntry(entry.id);
      backdrop.remove();
      window.__afContent?.refreshEntries();
    });

    modal.querySelector('#af-save').addEventListener('click', async () => {
      const selector = selInput.value.trim();
      const value = modal.querySelector('#af-value').value.trim();
      if (!selector || !value) return;

      const matchType = modal.querySelector('input[name="af-scope"]:checked')?.value || 'global';
      let matchValue = '';
      if (matchType === 'domain') matchValue = hostname;
      if (matchType === 'url-contains') { matchValue = urlInput.value.trim(); if (!matchValue) return; }

      const data = {
        ...(entry || {}),
        selector,
        fieldLabel: modal.querySelector('#af-fieldLabel').value.trim(),
        name: modal.querySelector('#af-name').value.trim(),
        value,
        matchType,
        matchValue,
      };

      if (isNew) await window.__afStorage.addEntry(data);
      else await window.__afStorage.updateEntry(data);

      backdrop.remove();
      window.__afContent?.refreshEntries();
    });

    backdrop.appendChild(modal);
    shadow.appendChild(backdrop);
    modal.querySelector('#af-fieldLabel').focus();
  }

  function escHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  window.__afManager = { show, hide };
})();
