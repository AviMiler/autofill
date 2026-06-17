// PUBLIC API: window.__afConfig
// show(element, existingRule | null) → void   — opens config panel for element
// hide()                             → void

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
    input[type=text], textarea {
      width: 100%; box-sizing: border-box;
      border: 1px solid #ddd; border-radius: 6px;
      padding: 7px 10px; font-size: 13px;
      outline: none; transition: border-color .15s;
    }
    input[type=text]:focus, textarea:focus { border-color: #4f7aff; }
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
    .af-opts-list { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
    .af-opt-row { display: flex; gap: 6px; align-items: center; }
    .af-opt-name { flex: 0 0 95px; }
    .af-opt-value { flex: 1; }
    .af-opt-del {
      border: none; background: none; cursor: pointer;
      color: #c00; font-size: 16px; padding: 0 4px; line-height: 1;
    }
    .af-opt-del:hover { color: #900; }
    .af-add-btn {
      margin-top: 8px; background: none; border: 1px dashed #bbb;
      border-radius: 6px; padding: 6px 12px; cursor: pointer;
      font-size: 12px; color: #555; width: 100%;
    }
    .af-add-btn:hover { border-color: #4f7aff; color: #4f7aff; }
    .af-actions { display: flex; gap: 8px; margin-top: 22px; }
    .af-btn {
      padding: 8px 18px; border-radius: 6px; font-size: 13px;
      cursor: pointer; border: none; font-family: inherit;
    }
    .af-btn-save  { background: #4f7aff; color: #fff; flex: 1; }
    .af-btn-save:hover  { background: #3a63e0; }
    .af-btn-cancel { background: #f2f2f2; color: #444; }
    .af-btn-cancel:hover { background: #e5e5e5; }
    .af-btn-delete { background: #fff0f0; color: #c00; margin-right: auto; }
    .af-btn-delete:hover { background: #ffd5d5; }
  `;

  let host = null;
  let lastPanelFocus = null;
  let focusTrapHandler = null;
  let inertedSiblings = [];

  function show(element, existingRule) {
    hide();

    host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = CSS;
    shadow.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'af-overlay';
    shadow.appendChild(overlay);

    // Prevent host-page handlers from stealing focus / hijacking clicks.
    // Some sites listen globally for focusin/mousedown and refocus their own
    // input — without this, the user can't type into the panel's fields.
    ['mousedown', 'pointerdown', 'mouseup', 'click', 'focusin', 'focusout', 'keydown', 'keyup', 'keypress', 'input']
      .forEach(ev => overlay.addEventListener(ev, e => e.stopPropagation()));

    // Track focus inside the panel — used by the trap below.
    overlay.addEventListener('focusin', e => {
      const path = e.composedPath();
      const inputEl = path.find(n => n.tagName === 'INPUT' || n.tagName === 'TEXTAREA');
      if (inputEl) {
        lastPanelFocus = inputEl;
        console.log('[AutoFill] panel focus IN:', inputEl.className || inputEl.id || inputEl.tagName);
      }
    });

    const panel = document.createElement('div');
    panel.className = 'af-panel';
    overlay.appendChild(panel);

    const isNew = !existingRule;
    const hostname = location.hostname;
    const generatedSel = window.__afSelector.generate(element);

    // Resolve current matchType/matchValue (backward-compat with old domain-only rules).
    const curMatchType = existingRule?.matchType
      || (existingRule?.domain === '*' ? 'global' : existingRule?.domain ? 'domain' : 'global');
    const curMatchValue = existingRule?.matchValue
      ?? (curMatchType === 'domain' ? existingRule?.domain : '');

    panel.innerHTML = `
      <h2>${isNew ? '➕ הוסף autofill לשדה' : '✏️ ערוך autofill'}</h2>

      <label>שם השדה (לתצוגה בלבד)</label>
      <input type="text" id="af-label" value="${escHtml(existingRule?.label || '')}" placeholder="למשל: אימייל, שם מלא">

      <label>CSS Selector</label>
      <div class="af-sel-row">
        <input type="text" id="af-selector" value="${escHtml(existingRule?.selector || generatedSel)}">
        <span id="af-sel-badge" class="af-badge"></span>
      </div>

      <label>הופעל כאשר</label>
      <div class="af-scope">
        <label>
          <input type="radio" name="af-scope" value="global" ${curMatchType === 'global' ? 'checked' : ''}>
          כל האתרים
        </label>
        <label>
          <input type="radio" name="af-scope" value="domain" ${curMatchType === 'domain' ? 'checked' : ''}>
          רק ב-${escHtml(hostname)}
        </label>
        <label>
          <input type="radio" name="af-scope" value="url-contains" ${curMatchType === 'url-contains' ? 'checked' : ''}>
          ה-URL מכיל את:
        </label>
        <input type="text" id="af-url-pattern" class="af-url-input"
          value="${escHtml(curMatchType === 'url-contains' ? curMatchValue : '')}"
          placeholder="למשל: /admin/ או ?lang=he">
        <div class="af-hint">מתאים לכל דף שה-URL שלו מכיל את הטקסט (case-sensitive)</div>
      </div>

      <label>אפשרויות מילוי</label>
      <div class="af-opts-list" id="af-opts"></div>
      <button class="af-add-btn" id="af-add-opt">+ הוסף אפשרות</button>

      <div class="af-actions">
        ${!isNew ? '<button class="af-btn af-btn-delete" id="af-delete">מחק כלל</button>' : ''}
        <button class="af-btn af-btn-cancel" id="af-cancel">בטל</button>
        <button class="af-btn af-btn-save" id="af-save">שמור</button>
      </div>
    `;

    const optsList = panel.querySelector('#af-opts');
    const initialOpts = existingRule?.options?.length ? existingRule.options : [{}];
    initialOpts.forEach(o => addOptionRow(optsList, normalizeOpt(o)));

    panel.querySelector('#af-add-opt').addEventListener('click', () => addOptionRow(optsList, {}));

    // Selector uniqueness badge.
    const selInput = panel.querySelector('#af-selector');
    const badge = panel.querySelector('#af-sel-badge');
    updateBadge(selInput.value, badge);
    selInput.addEventListener('input', () => updateBadge(selInput.value, badge));

    // Enable/disable URL pattern input based on selected scope.
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

    // Close / cancel.
    overlay.addEventListener('mousedown', e => { if (e.target === overlay) hide(); });
    panel.querySelector('#af-cancel').addEventListener('click', hide);

    // Delete.
    panel.querySelector('#af-delete')?.addEventListener('click', async () => {
      if (existingRule?.id) await window.__afStorage.deleteRule(existingRule.id);
      hide();
      window.__afContent?.refreshRules();
    });

    // Save.
    panel.querySelector('#af-save').addEventListener('click', async () => {
      const label = panel.querySelector('#af-label').value.trim();
      const selector = panel.querySelector('#af-selector').value.trim();
      const matchType = panel.querySelector('input[name="af-scope"]:checked')?.value || 'global';
      let matchValue = '';
      if (matchType === 'domain') matchValue = hostname;
      if (matchType === 'url-contains') matchValue = urlInput.value.trim();
      const options = Array.from(panel.querySelectorAll('.af-opt-row'))
        .map(row => ({
          name: row.querySelector('.af-opt-name').value.trim(),
          value: row.querySelector('.af-opt-value').value.trim(),
        }))
        .filter(o => o.value);

      if (!selector) { selInput.focus(); return; }
      if (matchType === 'url-contains' && !matchValue) { urlInput.focus(); return; }
      if (!options.length) { panel.querySelector('.af-opt-value')?.focus(); return; }

      const rule = { label, selector, matchType, matchValue, options };
      if (isNew) {
        await window.__afStorage.addRule(rule);
      } else {
        // Strip legacy `domain` field if present.
        const { domain, ...rest } = existingRule;
        await window.__afStorage.updateRule({ ...rest, ...rule });
      }
      hide();
      window.__afContent?.refreshRules();
    });

    document.body.appendChild(host);

    // Disable all other top-level DOM via `inert` so site frameworks
    // (e.g. SAP UI5's Popup.onFocusEvent) can't steal focus back to their
    // inputs — inert elements can't be focused and don't fire focus events.
    // Active element was inside one of those siblings → it auto-blurs to body.
    inertedSiblings = Array.from(document.body.children).filter(
      c => c !== host && !c.hasAttribute('inert')
    );
    inertedSiblings.forEach(el => el.setAttribute('inert', ''));
    console.log('[AutoFill] inerted siblings:', inertedSiblings.length);

    // Focus trap: if a site's capture-phase handler refocuses ITS field
    // after the user clicked into our panel, pull focus back to the last
    // panel input. We use a microtask so we run AFTER the site's handler.
    focusTrapHandler = (e) => {
      if (!host) return;
      // If focus moved to something outside our host while the panel is open,
      // and we previously had focus inside the panel, restore it.
      if (e.target !== host && !host.contains(e.target) && lastPanelFocus) {
        const stealer = e.target;
        const target = lastPanelFocus;
        console.warn('[AutoFill] focus stolen by:', {
          tag: stealer?.tagName,
          id: stealer?.id,
          name: stealer?.name,
          class: stealer?.className,
          selector: stealer?.tagName ? describe(stealer) : '?',
        });
        // Defer so the site's own focus() call completes first.
        setTimeout(() => {
          if (host && document.contains(target)) {
            target.focus();
            console.log('[AutoFill] focus restored to:', target.className || target.tagName);
          }
        }, 0);
      }
    };
    document.addEventListener('focusin', focusTrapHandler, true);
    console.log('[AutoFill] config panel opened, focus trap armed');
  }

  function describe(el) {
    if (el.id) return `#${el.id}`;
    if (el.name) return `${el.tagName.toLowerCase()}[name="${el.name}"]`;
    return el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ').join('.') : '');
  }

  function addOptionRow(list, opt) {
    const row = document.createElement('div');
    row.className = 'af-opt-row';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'af-opt-name';
    nameInput.value = opt.name || '';
    nameInput.placeholder = 'שם (אופציונלי)';

    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.className = 'af-opt-value';
    valueInput.value = opt.value || '';
    valueInput.placeholder = 'ערך למילוי...';

    const del = document.createElement('button');
    del.className = 'af-opt-del';
    del.textContent = '×';
    del.addEventListener('click', () => row.remove());

    row.appendChild(nameInput);
    row.appendChild(valueInput);
    row.appendChild(del);
    list.appendChild(row);
    if (!opt.value) valueInput.focus();
  }

  // Accepts an option as either a string (legacy) or an object {name, value}.
  function normalizeOpt(o) {
    if (typeof o === 'string') return { name: '', value: o };
    return { name: o?.name || '', value: o?.value || '' };
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
    console.log('[AutoFill] config panel closed');
  }

  window.__afConfig = { show, hide };
})();
