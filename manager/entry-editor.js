// Inline entry editor. Adds to window.__afMgr:
// buildEditor(entry | null, { defaults?, onClose }) → HTMLElement
//   entry null → creates a new entry on save (addEntry); otherwise updates it.
//   Saves send only {id} + form fields, so enabled/created changed elsewhere are never reverted.
//   If the entry was deleted elsewhere meanwhile, save just closes (nothing is re-created).
//   Layout: value + display name, scope (select + domain/pattern input), "מתקדם" (field label + selector),
//   collapsed unless a new entry has no selector to inherit. Enter saves, Esc cancels.

(() => {
  const { el, icon } = window.__afMgr;
  const { loadEntries, addEntry, updateEntry } = window.__afStorage;

  function field(labelText, input, { wide, optional } = {}) {
    const wrap = el('div', wide ? 'wide' : '');
    const label = el('label', 'field-label');
    label.appendChild(el('span', '', labelText));
    if (optional) label.appendChild(el('span', 'opt', 'אופציונלי'));
    wrap.append(label, input);
    return wrap;
  }

  function textInput(value, placeholder) {
    const input = el('input', 'input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.value = value || '';
    if (placeholder) input.placeholder = placeholder;
    return input;
  }

  function buildEditor(entry, { defaults = {}, onClose }) {
    const src = entry || defaults;
    const root = el('div', 'editor');
    if (!entry) root.appendChild(el('h2', 'editor-title', 'מילוי חדש'));

    const valueIn = textInput(src.value, 'הערך שימולא בשדה');
    valueIn.dir = 'auto';
    const nameIn = textInput(src.name, 'למשל: אישי, עבודה');

    const scopeSel = el('select', 'input');
    [['global', 'כל האתרים'], ['domain', 'אתר מסוים'], ['url-contains', 'כתובת שמכילה…']].forEach(([v, t]) => {
      const opt = el('option', '', t);
      opt.value = v;
      scopeSel.appendChild(opt);
    });
    scopeSel.value = src.matchType || 'global';
    const scopeIn = textInput(src.matchValue, '');
    scopeIn.dir = 'ltr';
    scopeIn.classList.add('mono');
    const scopeRow = el('div', 'scope-row');
    scopeRow.append(scopeSel, scopeIn);
    const syncScope = () => {
      const global = scopeSel.value === 'global';
      scopeIn.hidden = global;
      scopeRow.classList.toggle('global', global);
      scopeIn.placeholder = scopeSel.value === 'domain' ? 'example.com' : '/admin/ או ?lang=he';
      if (global) scopeIn.value = '';
    };
    scopeSel.addEventListener('change', () => { syncScope(); if (!scopeIn.hidden) scopeIn.focus(); });
    syncScope();

    const labelIn = textInput(src.fieldLabel, 'למשל: אימייל, שם מלא');
    const selectorIn = textInput(src.selector, "input[name='email']");
    selectorIn.classList.add('mono', 'selector-input');
    selectorIn.dir = 'ltr';
    const advanced = el('details');
    const summary = el('summary');
    summary.append(icon('chevron', 14), 'מתקדם');
    const advBody = el('div');
    advBody.append(field('שם השדה (לכותרת הקבוצה)', labelIn), field('CSS Selector', selectorIn));
    advanced.append(summary, advBody);
    // A new entry has no selector to inherit, so the advanced block must be visible.
    if (!entry && !src.selector) advanced.open = true;

    const saveBtn = el('button', 'btn primary', 'שמירה');
    saveBtn.type = 'button';
    const cancelBtn = el('button', 'btn ghost', 'ביטול');
    cancelBtn.type = 'button';
    const hint = el('span', 'editor-hint');
    const k1 = el('kbd', '', 'Enter');
    const k2 = el('kbd', '', 'Esc');
    hint.append(k1, ' שמירה · ', k2, ' ביטול');
    const actions = el('div', 'editor-actions');
    actions.append(hint, cancelBtn, saveBtn);

    root.append(
      field('ערך', valueIn),
      field('שם לתצוגה', nameIn, { optional: true }),
      field('יופיע ב', scopeRow, { wide: true }),
      advanced, actions);

    cancelBtn.addEventListener('click', onClose);
    root.addEventListener('keydown', e => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'Enter' && e.target.tagName === 'INPUT') saveBtn.click();
    });

    saveBtn.addEventListener('click', async () => {
      const selector = selectorIn.value.trim();
      const value = valueIn.value.trim();
      if (!selector) { advanced.open = true; selectorIn.focus(); return; }
      if (!value) { valueIn.focus(); return; }
      const matchType = scopeSel.value;
      const matchValue = matchType === 'global' ? '' : scopeIn.value.trim();
      if (matchType !== 'global' && !matchValue) { scopeIn.focus(); return; }

      const data = { selector, fieldLabel: labelIn.value.trim(), name: nameIn.value.trim(), value, matchType, matchValue };
      saveBtn.disabled = true;
      try {
        if (!entry) await addEntry(data);
        else if ((await loadEntries()).some(e => e.id === entry.id)) await updateEntry({ id: entry.id, ...data });
        onClose();
      } catch (err) {
        console.error('[entry-editor] save failed:', err);
        saveBtn.disabled = false;
      }
    });

    setTimeout(() => (entry ? valueIn : (src.selector ? valueIn : selectorIn)).focus(), 0);
    return root;
  }

  window.__afMgr.buildEditor = buildEditor;
})();
