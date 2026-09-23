// PUBLIC API: window.__afConfig
// show(element) → void   — opens "add new entry" panel for element
// hide()        → void

(() => {
  const CSS = `
    :host { all: initial; }
    .af-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,.4);
      z-index: 2147483646;
      display: flex; align-items: center; justify-content: center;
      font-family: system-ui, sans-serif;
    }
    .af-panel {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 8px 40px rgba(0,0,0,.25);
      width: 420px; max-width: 95vw;
      max-height: 90vh;
      overflow-y: auto;
      padding: 24px;
      direction: rtl;
    }
    h2 { margin: 0 0 18px; font-size: 16px; color: #111; }
    label { display: block; font-size: 12px; color: #555; margin-bottom: 4px; margin-top: 14px; }
    input[type=text] {
      width: 100%; box-sizing: border-box;
      border: 1px solid #ddd; border-radius: 6px;
      padding: 7px 10px; font-size: 13px;
      outline: none; transition: border-color .15s;
    }
    input[type=text]:focus { border-color: #4f7aff; }
    .af-sel-row { display: flex; gap: 6px; align-items: center; }
    .af-sel-row input { flex: 1; }
    .af-badge {
      font-size: 11px; padding: 2px 6px; border-radius: 10px; white-space: nowrap;
    }
    .af-badge.ok  { background: #e6f9ee; color: #1a7a3c; }
    .af-badge.warn { background: #fff7e0; color: #a06000; }
    .af-scope { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; font-size: 13px; }
    .af-scope label { margin: 0; display: flex; align-items: center; gap: 4px; color: #333; }
    .af-url-input { margin: 6px 0 0 22px; width: calc(100% - 22px); }
    .af-url-input[disabled] { background: #f5f5f5; color: #aaa; }
    .af-hint { font-size: 11px; color: #888; margin: 4px 0 0 22px; }
    .af-actions { display: flex; gap: 8px; margin-top: 22px; }
    .af-btn {
      padding: 8px 18px; border-radius: 6px; font-size: 13px;
      cursor: pointer; border: none; font-family: inherit;
    }
    .af-btn-save  { background: #4f7aff; color: #fff; flex: 1; }
    .af-btn-save:hover  { background: #3a63e0; }
    .af-btn-cancel { background: #f2f2f2; color: #444; }
    .af-btn-cancel:hover { background: #e5e5e5; }
    .af-btn-manage { background: #fff; color: #4f7aff; border: 1px solid #4f7aff; }
    .af-btn-manage:hover { background: #f0f4ff; }
    .af-sub {
      position: fixed; inset: 0; background: rgba(0,0,0,.35);
      display: flex; align-items: center; justify-content: center;
    }
    .af-sub-panel {
      background: #fff; border-radius: 12px; width: 460px; max-width: 95vw;
      max-height: 80vh; overflow-y: auto; padding: 20px; direction: rtl;
      box-shadow: 0 8px 40px rgba(0,0,0,.3);
    }
    .af-sub-panel h2 { margin: 0 0 4px; font-size: 15px; }
    .af-sub-sel { font-family: ui-monospace, monospace; font-size: 11px; color: #999; margin-bottom: 14px; word-break: break-all; }
    .af-row {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px; border: 1px solid #eee; border-radius: 8px; margin-bottom: 6px;
    }
    .af-row-info { flex: 1; min-width: 0; }
    .af-row-name { font-size: 13px; font-weight: 600; }
    .af-row-val { font-size: 12px; color: #888; font-family: ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .af-row input[type=text] { margin-bottom: 4px; }
    .af-icon { border: none; background: none; cursor: pointer; font-size: 14px; padding: 4px 6px; border-radius: 5px; color: #999; }
    .af-icon:hover { background: #f0f0f0; color: #222; }
    .af-empty { text-align: center; color: #aaa; font-size: 13px; padding: 24px 0; }
  `;

  let host = null;
  let lastPanelFocus = null;
  let focusTrapHandler = null;
  let inertedSiblings = [];

  function show(element) {
    hide();

    host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = CSS;
    shadow.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'af-overlay';
    shadow.appendChild(overlay);

    ['mousedown', 'pointerdown', 'mouseup', 'click', 'focusin', 'focusout', 'keydown', 'keyup', 'keypress', 'input']
      .forEach(ev => overlay.addEventListener(ev, e => e.stopPropagation()));

    overlay.addEventListener('focusin', e => {
      const inputEl = e.composedPath().find(n => n.tagName === 'INPUT');
      if (inputEl) lastPanelFocus = inputEl;
    });

    const panel = document.createElement('div');
    panel.className = 'af-panel';
    overlay.appendChild(panel);

    const hostname = location.hostname;
    const generatedSel = element ? window.__afSelector.generate(element) : '';

    panel.innerHTML = `
      <h2>➕ הוסף מילוי אוטומטי</h2>

      <button class="af-btn af-btn-manage" id="af-manage" style="width:100%">📋 הצג את כל המילויים השמורים לשדה זה</button>

      <label>שם השדה (לתצוגה בלבד)</label>
      <input type="text" id="af-fieldLabel" placeholder="למשל: אימייל, שם מלא">

      <label>CSS Selector</label>
      <div class="af-sel-row">
        <input type="text" id="af-selector" value="${escHtml(generatedSel)}">
        <span id="af-sel-badge" class="af-badge"></span>
      </div>

      <label>שם האפשרות (אופציונלי)</label>
      <input type="text" id="af-name" placeholder="למשל: אישי, עבודה">

      <label>ערך למילוי</label>
      <input type="text" id="af-value" placeholder="הערך שימולא בשדה...">

      <label>הופעל כאשר</label>
      <div class="af-scope">
        <label><input type="radio" name="af-scope" value="global" checked> כל האתרים</label>
        <label><input type="radio" name="af-scope" value="domain"> רק ב-${escHtml(hostname)}</label>
        <label><input type="radio" name="af-scope" value="url-contains"> ה-URL מכיל את:</label>
        <input type="text" id="af-url-pattern" class="af-url-input"
          placeholder="למשל: /admin/ או ?lang=he">
        <div class="af-hint">מתאים לכל דף שה-URL שלו מכיל את הטקסט (case-sensitive)</div>
      </div>

      <div class="af-actions">
        <button class="af-btn af-btn-cancel" id="af-cancel">בטל</button>
        <button class="af-btn af-btn-save" id="af-save">שמור</button>
      </div>
    `;

    // Pre-fill fieldLabel from existing entries for this selector
    window.__afStorage.loadEntries().then(entries => {
      const existing = entries.find(e => e.selector === generatedSel);
      if (existing?.fieldLabel) {
        panel.querySelector('#af-fieldLabel').value = existing.fieldLabel;
      }
    });

    const selInput = panel.querySelector('#af-selector');
    const badge = panel.querySelector('#af-sel-badge');
    updateBadge(selInput.value, badge);
    selInput.addEventListener('input', () => updateBadge(selInput.value, badge));

    const urlInput = panel.querySelector('#af-url-pattern');
    const syncUrlInput = (userTriggered) => {
      const checked = panel.querySelector('input[name="af-scope"]:checked')?.value;
      urlInput.disabled = checked !== 'url-contains';
      if (userTriggered && checked === 'url-contains') urlInput.focus();
    };
    panel.querySelectorAll('input[name="af-scope"]').forEach(r =>
      r.addEventListener('change', () => syncUrlInput(true))
    );
    syncUrlInput(false);

    overlay.addEventListener('mousedown', e => { if (e.target === overlay) hide(); });
    panel.querySelector('#af-cancel').addEventListener('click', hide);
    panel.querySelector('#af-manage').addEventListener('click', () => {
      openFieldList(overlay, selInput.value.trim());
    });

    panel.querySelector('#af-save').addEventListener('click', async () => {
      const selector = selInput.value.trim();
      const value = panel.querySelector('#af-value').value.trim();
      if (!selector) { selInput.focus(); return; }
      if (!value) { panel.querySelector('#af-value').focus(); return; }

      const matchType = panel.querySelector('input[name="af-scope"]:checked')?.value || 'global';
      let matchValue = '';
      if (matchType === 'domain') matchValue = hostname;
      if (matchType === 'url-contains') {
        matchValue = urlInput.value.trim();
        if (!matchValue) { urlInput.focus(); return; }
      }

      await window.__afStorage.addEntry({
        selector,
        fieldLabel: panel.querySelector('#af-fieldLabel').value.trim(),
        name: panel.querySelector('#af-name').value.trim(),
        value,
        matchType,
        matchValue,
      });

      hide();
      window.__afContent?.refreshEntries();
    });

    document.body.appendChild(host);

    inertedSiblings = Array.from(document.body.children).filter(
      c => c !== host && !c.hasAttribute('inert')
    );
    inertedSiblings.forEach(el => el.setAttribute('inert', ''));

    focusTrapHandler = (e) => {
      if (!host) return;
      if (e.target !== host && !host.contains(e.target) && lastPanelFocus) {
        const target = lastPanelFocus;
        setTimeout(() => { if (host && document.contains(target)) target.focus(); }, 0);
      }
    };
    document.addEventListener('focusin', focusTrapHandler, true);
  }

  function openFieldList(overlay, selector) {
    overlay.querySelector('.af-sub')?.remove();

    const sub = document.createElement('div');
    sub.className = 'af-sub';
    const box = document.createElement('div');
    box.className = 'af-sub-panel';
    sub.appendChild(box);
    sub.addEventListener('mousedown', e => { if (e.target === sub) sub.remove(); });

    async function render() {
      const all = await window.__afStorage.loadEntries();
      const list = all.filter(e => e.selector === selector);
      box.innerHTML = '';

      const h = document.createElement('h2');
      h.textContent = '📋 מילויים שמורים לשדה זה';
      const s = document.createElement('div');
      s.className = 'af-sub-sel';
      s.textContent = selector;
      box.append(h, s);

      if (!list.length) {
        const empty = document.createElement('div');
        empty.className = 'af-empty';
        empty.textContent = 'אין מילויים שמורים לשדה זה.';
        box.appendChild(empty);
      }

      list.forEach(entry => box.appendChild(buildRow(entry, render)));

      const close = document.createElement('button');
      close.className = 'af-btn af-btn-cancel';
      close.style.marginTop = '12px';
      close.textContent = 'סגור';
      close.addEventListener('click', () => sub.remove());
      box.appendChild(close);
    }

    overlay.appendChild(sub);
    render();
  }

  function buildRow(entry, rerender) {
    const row = document.createElement('div');
    row.className = 'af-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = entry.enabled !== false;
    cb.title = 'פעיל';
    cb.addEventListener('change', async () => {
      await window.__afStorage.updateEntry({ ...entry, enabled: cb.checked });
      window.__afContent?.refreshEntries();
    });

    const info = document.createElement('div');
    info.className = 'af-row-info';
    const n = document.createElement('div');
    n.className = 'af-row-name';
    n.textContent = entry.name || entry.value;
    info.appendChild(n);
    if (entry.name) {
      const v = document.createElement('div');
      v.className = 'af-row-val';
      v.textContent = entry.value;
      info.appendChild(v);
    }

    const edit = document.createElement('button');
    edit.className = 'af-icon';
    edit.textContent = '✏️';
    edit.title = 'ערוך';
    let nameIn = null;
    let valIn = null;
    edit.addEventListener('click', async () => {
      if (!nameIn) {
        info.innerHTML = '';
        nameIn = document.createElement('input');
        nameIn.type = 'text';
        nameIn.placeholder = 'שם (אופציונלי)';
        nameIn.value = entry.name || '';
        valIn = document.createElement('input');
        valIn.type = 'text';
        valIn.placeholder = 'ערך';
        valIn.value = entry.value || '';
        info.append(nameIn, valIn);
        edit.textContent = '💾';
        edit.title = 'שמור';
        valIn.focus();
        return;
      }
      const value = valIn.value.trim();
      if (!value) { valIn.focus(); return; }
      await window.__afStorage.updateEntry({ ...entry, name: nameIn.value.trim(), value });
      window.__afContent?.refreshEntries();
      rerender();
    });

    const del = document.createElement('button');
    del.className = 'af-icon';
    del.textContent = '🗑';
    del.title = 'מחק';
    del.addEventListener('click', async () => {
      if (!confirm('למחוק מילוי זה?')) return;
      await window.__afStorage.deleteEntry(entry.id);
      window.__afContent?.refreshEntries();
      rerender();
    });

    row.append(cb, info, edit, del);
    return row;
  }

  function updateBadge(selector, badge) {
    if (!selector.trim()) { badge.textContent = ''; return; }
    const unique = window.__afSelector.isUnique(selector.trim());
    badge.className = `af-badge ${unique ? 'ok' : 'warn'}`;
    badge.textContent = unique ? '✓ ייחודי' : '⚠ לא ייחודי';
  }

  function escHtml(str) {
    return String(str).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  function hide() {
    if (!host) return;
    if (focusTrapHandler) {
      document.removeEventListener('focusin', focusTrapHandler, true);
      focusTrapHandler = null;
    }
    inertedSiblings.forEach(el => el.removeAttribute('inert'));
    inertedSiblings = [];
    lastPanelFocus = null;
    host.remove();
    host = null;
  }

  window.__afConfig = { show, hide };
})();
