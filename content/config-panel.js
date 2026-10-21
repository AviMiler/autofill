// PUBLIC API: window.__afConfig
// show(element) → void   — opens the "add new entry" popover anchored to element
// hide()        → void
//
// Layout: a card anchored below the field (flips above, clamped into the viewport; centered when the
// viewport is narrow or the field is out of view). A transparent full-page overlay catches outside clicks
// (→ close), and the page is made inert while it is open (focus trap).
// Views: "add" (value + display name visible; scope as one select defaulting to "this site";
//        field label + selector under a collapsed "מתקדם") and "list" (saved entries for the
//        selector in the selector input: toggle / inline edit / two-step delete / open in manager).
// Light/dark follows prefers-color-scheme. Icons: window.__afIcons.

(() => {
  const CSS = `
    :host { all: initial; }
    .af-overlay {
      position: fixed; inset: 0;
      z-index: 2147483646;
      font: 400 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    }
    .af-pop {
      --bg: #ffffff; --fg: #18181b; --muted: #71717a; --subtle: #a1a1aa;
      --line: rgba(24, 24, 27, .09); --field: #ffffff; --field-line: #e4e4e7; --hover: #f4f4f5;
      --accent: #18181b; --accent-fg: #ffffff; --ring: rgba(24, 24, 27, .12);
      --ok: #15803d; --warn: #b45309; --danger: #dc2626; --danger-bg: #fef2f2;
      position: fixed;
      width: 344px; max-width: calc(100vw - 16px);
      max-height: calc(100vh - 16px);
      overflow-y: auto;
      box-sizing: border-box;
      background: var(--bg); color: var(--fg);
      border: 1px solid var(--line);
      border-radius: 14px;
      box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 16px 40px -8px rgba(0,0,0,.22);
      direction: rtl; text-align: right;
      animation: af-in .14s ease-out;
    }
    @media (prefers-color-scheme: dark) {
      .af-pop {
        --bg: #18181b; --fg: #fafafa; --muted: #a1a1aa; --subtle: #71717a;
        --line: rgba(255, 255, 255, .09); --field: #0f0f11; --field-line: #2e2e33; --hover: #27272a;
        --accent: #fafafa; --accent-fg: #18181b; --ring: rgba(250, 250, 250, .14);
        --ok: #4ade80; --warn: #fbbf24; --danger: #f87171; --danger-bg: rgba(248, 113, 113, .12);
        box-shadow: 0 1px 2px rgba(0,0,0,.3), 0 16px 40px -8px rgba(0,0,0,.7);
      }
    }
    @keyframes af-in { from { opacity: 0; transform: translateY(-3px) scale(.99); } }
    @media (prefers-reduced-motion: reduce) { .af-pop { animation: none; } }
    *, *::before, *::after { box-sizing: border-box; }
    svg { display: block; flex-shrink: 0; }
    [hidden] { display: none !important; }

    .af-head { display: flex; align-items: flex-start; gap: 8px; padding: 14px 16px 4px; }
    .af-head-text { flex: 1; min-width: 0; }
    .af-title { font-size: 14px; font-weight: 600; margin: 0; }
    .af-sub {
      margin-top: 2px; font-size: 12px; color: var(--muted);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .af-sub.mono { font-family: ui-monospace, "SF Mono", Consolas, monospace; direction: ltr; text-align: right; }
    .af-body { padding: 8px 16px 4px; }

    .af-label { display: flex; align-items: baseline; gap: 6px; font-size: 12px; font-weight: 500; color: var(--muted); margin: 10px 0 5px; }
    .af-label .opt { font-weight: 400; color: var(--subtle); }
    input[type=text], select {
      width: 100%; height: 34px; padding: 0 10px;
      border: 1px solid var(--field-line); border-radius: 8px;
      background: var(--field); color: var(--fg);
      font: inherit; font-size: 13px; outline: none;
      transition: border-color .12s, box-shadow .12s;
    }
    input[type=text]:focus, select:focus { border-color: var(--muted); box-shadow: 0 0 0 3px var(--ring); }
    input[type=text]::placeholder { color: var(--subtle); }
    select { appearance: none; padding-inline-start: 30px; cursor: pointer;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: left 10px center; }
    .mono { font-family: ui-monospace, "SF Mono", Consolas, monospace; }
    .ltr { direction: ltr; text-align: left; }
    .af-hint { font-size: 11.5px; color: var(--subtle); margin-top: 5px; overflow-wrap: anywhere; }
    .af-hint.ltr { text-align: right; }

    details { margin-top: 12px; border-top: 1px solid var(--line); }
    summary {
      display: flex; align-items: center; gap: 6px;
      padding: 10px 0 2px; list-style: none; cursor: pointer;
      font-size: 12px; font-weight: 500; color: var(--muted);
    }
    summary::-webkit-details-marker { display: none; }
    summary svg { transition: transform .15s; }
    details:not([open]) summary svg { transform: rotate(90deg); }
    .af-sel-row { position: relative; }
    .af-sel-row input { padding-inline-start: 74px; }
    .af-badge {
      position: absolute; left: 6px; top: 50%; transform: translateY(-50%);
      display: inline-flex; align-items: center; gap: 3px;
      font-size: 11px; font-weight: 500; padding: 2px 6px; border-radius: 6px; background: var(--hover);
    }
    .af-badge.ok { color: var(--ok); }
    .af-badge.warn { color: var(--warn); }

    .af-foot { display: flex; align-items: center; gap: 6px; padding: 14px 16px 14px; }
    .af-spacer { flex: 1; }
    button { font: inherit; }
    .af-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      height: 32px; padding: 0 12px; border-radius: 8px;
      border: 1px solid transparent; background: transparent; color: var(--fg);
      font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap;
      transition: background .12s, border-color .12s, opacity .12s;
    }
    .af-btn:focus-visible, .af-icon:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }
    .af-btn.primary { background: var(--accent); color: var(--accent-fg); }
    .af-btn.primary:hover { opacity: .88; }
    .af-btn.secondary { border-color: var(--field-line); }
    .af-btn.secondary:hover, .af-btn.ghost:hover { background: var(--hover); }
    .af-btn.ghost { color: var(--muted); padding: 0 8px; }
    .af-btn.ghost:hover { color: var(--fg); }
    .af-count { color: var(--subtle); font-weight: 400; }
    .af-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; padding: 0; flex-shrink: 0;
      border: none; border-radius: 7px; background: transparent; color: var(--subtle); cursor: pointer;
      transition: background .12s, color .12s;
    }
    .af-icon:hover { background: var(--hover); color: var(--fg); }
    .af-icon.danger:hover { color: var(--danger); background: var(--danger-bg); }
    .af-icon.confirm { width: auto; padding: 0 8px; gap: 4px; font-size: 12px; font-weight: 500; color: var(--danger); background: var(--danger-bg); }

    .af-rows { padding: 6px 8px 0; }
    .af-row { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 10px; }
    .af-row:hover { background: var(--hover); }
    .af-row.off-page .af-row-info { opacity: .5; }
    .af-row.disabled .af-row-name, .af-row.disabled .af-row-val { opacity: .45; }
    .af-row-info { flex: 1; min-width: 0; }
    .af-row-name, .af-row-val, .af-row-scope { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .af-row-name { font-size: 13px; font-weight: 500; }
    .af-row-val { font-size: 12px; color: var(--muted); font-family: ui-monospace, "SF Mono", Consolas, monospace; unicode-bidi: plaintext; }
    .af-row-scope { display: flex; align-items: center; gap: 4px; margin-top: 2px; font-size: 11.5px; color: var(--subtle); }
    .af-row-scope.here { color: var(--muted); }
    .af-row-edit { display: flex; flex-direction: column; gap: 4px; }
    .af-row-edit input { height: 30px; }
    .af-row-actions { display: flex; gap: 2px; }
    .af-empty { text-align: center; color: var(--subtle); font-size: 13px; padding: 28px 0 18px; }

    .af-switch { position: relative; width: 30px; height: 18px; flex-shrink: 0; }
    .af-switch input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; z-index: 1; }
    .af-switch span { position: absolute; inset: 0; border-radius: 9px; background: var(--field-line); transition: background .15s; }
    .af-switch span::after {
      content: ''; position: absolute; top: 2px; right: 2px; width: 14px; height: 14px;
      border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.2); transition: transform .15s;
    }
    .af-switch input:checked + span { background: var(--accent); }
    .af-switch input:checked + span::after { transform: translateX(-12px); background: var(--bg); }
    .af-switch input:focus-visible + span { box-shadow: 0 0 0 3px var(--ring); }
  `;

  const POP_GAP = 6;
  const NARROW_VIEWPORT = 420;

  let host = null;
  let pop = null;
  let anchorEl = null;
  let lastPanelFocus = null;
  let focusTrapHandler = null;
  let inertedSiblings = [];
  let rafId = 0;

  const icon = (name, size) => window.__afIcons.node(name, size);

  function h(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function button(className, iconName, text, title) {
    const b = h('button', className);
    b.type = 'button';
    if (iconName) b.appendChild(icon(iconName, 15));
    if (text) b.append(text);
    if (title) { b.title = title; b.setAttribute('aria-label', title); }
    return b;
  }

  function show(element) {
    hide();
    anchorEl = element || null;

    host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = CSS;
    shadow.appendChild(style);

    const overlay = h('div', 'af-overlay');
    shadow.appendChild(overlay);

    ['mousedown', 'pointerdown', 'mouseup', 'click', 'focusin', 'focusout', 'keydown', 'keyup', 'keypress', 'input']
      .forEach(ev => overlay.addEventListener(ev, e => e.stopPropagation()));

    overlay.addEventListener('focusin', e => {
      const target = e.composedPath().find(n => ['INPUT', 'SELECT', 'BUTTON'].includes(n.tagName));
      if (target) lastPanelFocus = target;
    });
    overlay.addEventListener('mousedown', e => { if (e.target === overlay) hide(); });

    pop = h('div', 'af-pop');
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-modal', 'true');
    overlay.appendChild(pop);

    const ctx = {
      hostname: location.hostname,
      // Full URL without #fragment (often transient SPA state). Stored as a 'url-contains' scope.
      pageUrl: location.href.split('#')[0],
      selector: element ? window.__afSelector.generate(element) : '',
      draft: null, // add-view state kept while the list view is open
    };
    renderAddView(ctx);

    document.body.appendChild(host);
    position();
    window.addEventListener('scroll', scheduleReposition, { capture: true, passive: true });
    window.addEventListener('resize', scheduleReposition, { passive: true });

    inertedSiblings = Array.from(document.body.children).filter(
      c => c !== host && !c.hasAttribute('inert')
    );
    inertedSiblings.forEach(el => el.setAttribute('inert', ''));

    focusTrapHandler = (e) => {
      if (!host) return;
      if (e.target !== host && !host.contains(e.target) && lastPanelFocus) {
        const target = lastPanelFocus;
        setTimeout(() => { if (host && target.isConnected) target.focus(); }, 0);
      }
    };
    document.addEventListener('focusin', focusTrapHandler, true);
  }

  // ── add view ──────────────────────────────────────────────────────────────────

  function renderAddView(ctx) {
    pop.replaceChildren();
    pop.setAttribute('aria-label', 'מילוי חדש');
    const d = ctx.draft || {};

    const head = h('div', 'af-head');
    const headText = h('div', 'af-head-text');
    const subtitle = h('div', 'af-sub', 'לשדה הזה');
    headText.append(h('h2', 'af-title', 'מילוי חדש'), subtitle);
    const closeBtn = button('af-icon', 'x', '', 'סגירה');
    closeBtn.addEventListener('click', hide);
    head.append(headText, closeBtn);

    const body = h('div', 'af-body');

    const valueIn = textInput('הערך שימולא בשדה', d.value);
    valueIn.dir = 'auto';
    const nameIn = textInput('למשל: אישי, עבודה', d.name);

    const scopeSel = h('select');
    const scopes = [];
    if (ctx.hostname) scopes.push(['domain', `האתר הזה · ${ctx.hostname}`]);
    scopes.push(['url-full', 'הדף הזה בלבד'], ['global', 'כל האתרים'], ['url-contains', 'כתובת שמכילה…']);
    scopes.forEach(([v, t]) => {
      const opt = h('option', '', t);
      opt.value = v;
      scopeSel.appendChild(opt);
    });
    scopeSel.value = d.scope || scopes[0][0];
    const pageHint = h('div', 'af-hint ltr', ctx.pageUrl);
    pageHint.dir = 'ltr';
    const urlIn = textInput('למשל: /admin/ או ?lang=he', d.urlPattern);
    urlIn.dir = 'ltr';
    urlIn.style.marginTop = '6px';
    const urlHint = h('div', 'af-hint', 'מתאים לכל דף שהכתובת שלו מכילה את הטקסט (רגיש לאותיות גדולות/קטנות)');
    const syncScope = (userTriggered) => {
      pageHint.hidden = scopeSel.value !== 'url-full';
      urlIn.hidden = urlHint.hidden = scopeSel.value !== 'url-contains';
      if (userTriggered && !urlIn.hidden) urlIn.focus();
      scheduleReposition();
    };
    scopeSel.addEventListener('change', () => syncScope(true));
    syncScope(false);

    const labelIn = textInput('למשל: אימייל, שם מלא', d.fieldLabel);
    const selIn = textInput('', d.selector ?? ctx.selector);
    selIn.classList.add('mono', 'ltr');
    selIn.dir = 'ltr';
    const badge = h('span', 'af-badge');
    const selRow = h('div', 'af-sel-row');
    selRow.append(selIn, badge);

    const advanced = h('details');
    const summary = h('summary');
    summary.append(icon('chevron', 14), 'מתקדם');
    advanced.append(summary,
      label('שם השדה', 'לתצוגה בלבד'), labelIn,
      label('CSS Selector'), selRow);
    advanced.open = !!d.advancedOpen;
    advanced.addEventListener('toggle', scheduleReposition);

    body.append(
      label('ערך'), valueIn,
      label('שם לתצוגה', 'אופציונלי'), nameIn,
      label('יופיע ב'), scopeSel, pageHint, urlIn, urlHint,
      advanced);

    const foot = h('div', 'af-foot');
    const listBtn = button('af-btn ghost', 'list', 'שמורים לשדה ');
    const listCount = h('span', 'af-count');
    listBtn.appendChild(listCount);
    const cancelBtn = button('af-btn secondary', '', 'ביטול');
    const saveBtn = button('af-btn primary', '', 'שמירה');
    foot.append(listBtn, h('div', 'af-spacer'), cancelBtn, saveBtn);

    pop.append(head, body, foot);

    // Field label + saved count come from storage; fall back to the page's own label text.
    let entries = [];
    const refreshSelectorInfo = () => {
      const sel = selIn.value.trim();
      const forSel = entries.filter(e => e.selector === sel);
      listCount.textContent = `(${forSel.length})`;
      updateBadge(sel, badge);
    };
    window.__afStorage.loadEntries().then(all => {
      entries = all;
      if (!ctx.draft) {
        const existing = entries.find(e => e.selector === ctx.selector && e.fieldLabel);
        labelIn.value = existing?.fieldLabel || guessLabel(anchorEl);
      }
      subtitle.textContent = labelIn.value.trim() || 'לשדה הזה';
      refreshSelectorInfo();
    }).catch(() => {});
    refreshSelectorInfo();
    selIn.addEventListener('input', refreshSelectorInfo);
    labelIn.addEventListener('input', () => { subtitle.textContent = labelIn.value.trim() || 'לשדה הזה'; });

    const saveDraft = () => {
      ctx.draft = {
        value: valueIn.value, name: nameIn.value, scope: scopeSel.value, urlPattern: urlIn.value,
        fieldLabel: labelIn.value, selector: selIn.value, advancedOpen: advanced.open,
      };
    };

    cancelBtn.addEventListener('click', hide);
    listBtn.addEventListener('click', () => {
      saveDraft();
      renderListView(ctx, selIn.value.trim());
    });

    saveBtn.addEventListener('click', async () => {
      const selector = selIn.value.trim();
      const value = valueIn.value.trim();
      if (!selector) { advanced.open = true; selIn.focus(); return; }
      if (!value) { valueIn.focus(); return; }

      const choice = scopeSel.value;
      let matchValue = '';
      if (choice === 'domain') matchValue = ctx.hostname;
      if (choice === 'url-full') matchValue = ctx.pageUrl;
      if (choice === 'url-contains') {
        matchValue = urlIn.value.trim();
        if (!matchValue) { urlIn.focus(); return; }
      }

      saveBtn.disabled = true;
      try {
        await window.__afStorage.addEntry({
          selector,
          fieldLabel: labelIn.value.trim(),
          name: nameIn.value.trim(),
          value,
          matchType: choice === 'url-full' ? 'url-contains' : choice,
          matchValue,
        });
      } catch (err) {
        console.error('[config-panel] save failed:', err);
        saveBtn.disabled = false;
        return;
      }
      hide();
      window.__afContent?.refreshEntries();
    });

    pop.onkeydown = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); hide(); }
      else if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); saveBtn.click(); }
    };

    setTimeout(() => valueIn.focus(), 0);
    scheduleReposition();
  }

  // Best-effort human label for a field: <label for>, wrapping <label>, aria-label, placeholder, name.
  function guessLabel(el) {
    if (!el) return '';
    const clean = s => (s || '').replace(/\s+/g, ' ').replace(/[*:]\s*$/, '').trim().slice(0, 40);
    try {
      const fromLabels = el.labels?.[0]?.textContent;
      if (clean(fromLabels)) return clean(fromLabels);
    } catch {}
    return clean(el.getAttribute?.('aria-label')) || clean(el.getAttribute?.('placeholder')) || clean(el.getAttribute?.('name'));
  }

  function label(text, optional) {
    const l = h('div', 'af-label');
    l.appendChild(h('span', '', text));
    if (optional) l.appendChild(h('span', 'opt', optional));
    return l;
  }

  function textInput(placeholder, value) {
    const input = h('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    if (placeholder) input.placeholder = placeholder;
    if (value) input.value = value;
    return input;
  }

  function updateBadge(selector, badge) {
    badge.replaceChildren();
    if (!selector) { badge.hidden = true; return; }
    badge.hidden = false;
    let unique = false;
    try { unique = window.__afSelector.isUnique(selector); } catch {}
    badge.className = `af-badge ${unique ? 'ok' : 'warn'}`;
    badge.append(icon(unique ? 'check' : 'x', 12), unique ? 'ייחודי' : 'לא ייחודי');
    badge.title = unique ? 'ה-selector מתאים לשדה אחד בדיוק בדף' : 'ה-selector מתאים לכמה שדות (או לאף אחד) בדף';
  }

  // ── list view (saved entries for one selector) ────────────────────────────────

  function renderListView(ctx, selector) {
    pop.replaceChildren();
    pop.setAttribute('aria-label', 'מילויים שמורים לשדה');

    const head = h('div', 'af-head');
    const backBtn = button('af-icon', 'back', '', 'חזרה');
    backBtn.addEventListener('click', () => renderAddView(ctx));
    const headText = h('div', 'af-head-text');
    const sub = h('div', 'af-sub mono', selector);
    sub.title = selector;
    headText.append(h('h2', 'af-title', 'מילויים שמורים לשדה'), sub);
    const closeBtn = button('af-icon', 'x', '', 'סגירה');
    closeBtn.addEventListener('click', hide);
    head.append(backBtn, headText, closeBtn);

    const rows = h('div', 'af-rows');

    const foot = h('div', 'af-foot');
    const manageBtn = button('af-btn secondary', 'external', 'פתיחה במנהל');
    manageBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'open-manager', selector });
    });
    const doneBtn = button('af-btn ghost', '', 'חזרה למילוי חדש');
    doneBtn.addEventListener('click', () => renderAddView(ctx));
    foot.append(manageBtn, h('div', 'af-spacer'), doneBtn);

    pop.append(head, rows, foot);

    let editingId = null;
    async function render() {
      const all = await window.__afStorage.loadEntries();
      const list = all.filter(e => e.selector === selector);
      rows.replaceChildren();
      if (!list.length) rows.appendChild(h('div', 'af-empty', 'אין עדיין מילויים שמורים לשדה הזה.'));
      list.forEach(entry => rows.appendChild(buildRow(entry, editingId === entry.id, {
        startEdit: () => { editingId = entry.id; render(); },
        endEdit: () => { editingId = null; render(); },
        rerender: render,
      })));
      scheduleReposition();
    }

    pop.onkeydown = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (editingId) { editingId = null; render(); } else renderAddView(ctx);
    };

    render();
    setTimeout(() => backBtn.focus(), 0);
  }

  function buildRow(entry, editing, { startEdit, endEdit, rerender }) {
    const appliesHere = window.__afStorage.appliesToUrl(entry, location.href);
    const row = h('div', 'af-row');
    if (!appliesHere) { row.classList.add('off-page'); row.title = 'לא חל על הדף הנוכחי'; }
    if (entry.enabled === false) row.classList.add('disabled');

    const sw = h('label', 'af-switch');
    sw.title = 'פעיל';
    const cb = h('input');
    cb.type = 'checkbox';
    cb.checked = entry.enabled !== false;
    cb.setAttribute('aria-label', 'פעיל');
    cb.addEventListener('change', async () => {
      row.classList.toggle('disabled', !cb.checked);
      await window.__afStorage.updateEntry({ id: entry.id, enabled: cb.checked });
      window.__afContent?.refreshEntries();
    });
    sw.append(cb, h('span'));

    const info = h('div', 'af-row-info');
    const actions = h('div', 'af-row-actions');

    if (editing) {
      const edit = h('div', 'af-row-edit');
      const nameIn = textInput('שם לתצוגה (אופציונלי)', entry.name);
      const valIn = textInput('ערך', entry.value);
      valIn.dir = 'auto';
      edit.append(nameIn, valIn);
      info.appendChild(edit);
      const save = async () => {
        const value = valIn.value.trim();
        if (!value) { valIn.focus(); return; }
        await window.__afStorage.updateEntry({ id: entry.id, name: nameIn.value.trim(), value });
        window.__afContent?.refreshEntries();
        endEdit();
      };
      edit.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); save(); }
      });
      const saveBtn = button('af-icon', 'check', '', 'שמירה');
      saveBtn.addEventListener('click', save);
      const cancelBtn = button('af-icon', 'x', '', 'ביטול עריכה');
      cancelBtn.addEventListener('click', endEdit);
      actions.append(saveBtn, cancelBtn);
      setTimeout(() => valIn.focus(), 0);
    } else {
      info.appendChild(h('div', 'af-row-name', entry.name || entry.value));
      if (entry.name) info.appendChild(h('div', 'af-row-val', entry.value));
      const scope = h('div', `af-row-scope${appliesHere ? ' here' : ''}`);
      const [scopeIcon, scopeText] = describeScope(entry);
      scope.append(icon(scopeIcon, 12), h('span', '', scopeText));
      info.appendChild(scope);

      const editBtn = button('af-icon', 'pencil', '', 'עריכה');
      editBtn.addEventListener('click', startEdit);
      // Two-step delete instead of confirm(): first click arms the button, second deletes.
      const delBtn = button('af-icon danger', 'trash', '', 'מחיקה');
      let armTimer = 0;
      delBtn.addEventListener('click', async () => {
        if (!delBtn.classList.contains('confirm')) {
          delBtn.classList.add('confirm');
          delBtn.append('למחוק?');
          armTimer = setTimeout(() => rerender(), 3000);
          return;
        }
        clearTimeout(armTimer);
        await window.__afStorage.deleteEntry(entry.id);
        window.__afContent?.refreshEntries();
        rerender();
      });
      actions.append(editBtn, delBtn);
    }

    row.append(sw, info, actions);
    return row;
  }

  function describeScope(entry) {
    const type = entry.matchType || 'global';
    if (type === 'global') return ['globe', 'כל האתרים'];
    if (type === 'domain') return ['site', entry.matchValue];
    return ['link', `כתובת מכילה: ${entry.matchValue}`];
  }

  // ── positioning ───────────────────────────────────────────────────────────────

  function position() {
    if (!pop) return;
    const viewW = document.documentElement.clientWidth;
    const viewH = document.documentElement.clientHeight;
    const pr = pop.getBoundingClientRect();
    const rect = anchorEl?.isConnected ? anchorEl.getBoundingClientRect() : null;
    const inView = rect && rect.width + rect.height > 0 && rect.bottom > 0 && rect.top < viewH;

    let top;
    let left;
    if (!inView || viewW < NARROW_VIEWPORT) {
      top = (viewH - pr.height) / 2;
      left = (viewW - pr.width) / 2;
    } else {
      top = rect.bottom + POP_GAP;
      if (top + pr.height > viewH - 8 && rect.top - pr.height - POP_GAP >= 8) top = rect.top - pr.height - POP_GAP;
      const isRtl = getComputedStyle(anchorEl).direction === 'rtl';
      left = isRtl ? rect.right - pr.width : rect.left;
    }
    top = Math.max(8, Math.min(top, viewH - pr.height - 8));
    left = Math.max(8, Math.min(left, viewW - pr.width - 8));
    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;
  }

  function scheduleReposition() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => { rafId = 0; position(); });
  }

  function hide() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    if (!host) return;
    window.removeEventListener('scroll', scheduleReposition, { capture: true });
    window.removeEventListener('resize', scheduleReposition);
    if (focusTrapHandler) {
      document.removeEventListener('focusin', focusTrapHandler, true);
      focusTrapHandler = null;
    }
    inertedSiblings.forEach(el => el.removeAttribute('inert'));
    inertedSiblings = [];
    lastPanelFocus = null;
    host.remove();
    host = null;
    pop = null;
    anchorEl = null;
  }

  window.__afConfig = { show, hide };
})();
