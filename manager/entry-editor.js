// Inline entry editor (replaces the old modal). Adds to window.__afMgr:
// buildEditor(entry | null, { defaults?, onClose }) → HTMLElement
//   entry null → creates a new entry on save (addEntry); otherwise updates it.
//   Saves send only {id} + form fields, so enabled/created changed elsewhere are never reverted.
//   If the entry was deleted elsewhere meanwhile, save just closes (nothing is re-created).

(() => {
  const { el } = window.__afMgr;
  const { loadEntries, addEntry, updateEntry } = window.__afStorage;

  function field(labelText, input, wide) {
    const wrap = el('div', wide ? 'wide' : '');
    wrap.append(el('label', '', labelText), input);
    return wrap;
  }

  function textInput(value, placeholder) {
    const input = el('input', 'af-input');
    input.type = 'text';
    input.value = value || '';
    if (placeholder) input.placeholder = placeholder;
    return input;
  }

  function buildEditor(entry, { defaults = {}, onClose }) {
    const src = entry || defaults;
    const root = el('div', 'af-editor');

    const nameIn = textInput(src.name, 'למשל: אישי, עבודה');
    const valueIn = textInput(src.value, 'הערך שימולא בשדה...');
    valueIn.dir = 'auto';

    const scopeSel = el('select', 'af-input');
    [['global', '🌐 כל האתרים'], ['domain', '🌍 דומיין'], ['url-contains', '🔗 URL מכיל']].forEach(([v, t]) => {
      const opt = el('option', '', t);
      opt.value = v;
      scopeSel.appendChild(opt);
    });
    scopeSel.value = src.matchType || 'global';
    const scopeIn = textInput(src.matchValue, '');
    scopeIn.dir = 'ltr';
    const syncScope = () => {
      scopeIn.disabled = scopeSel.value === 'global';
      scopeIn.placeholder = scopeSel.value === 'domain' ? 'למשל: example.com' : 'למשל: /admin/ או ?lang=he';
      if (scopeIn.disabled) scopeIn.value = '';
    };
    scopeSel.addEventListener('change', () => { syncScope(); if (!scopeIn.disabled) scopeIn.focus(); });
    syncScope();
    const scopeRow = el('div', 'af-scope-row');
    scopeRow.append(scopeSel, scopeIn);

    const labelIn = textInput(src.fieldLabel, 'למשל: אימייל, שם מלא');
    const selectorIn = textInput(src.selector, "למשל: input[name='email']");
    selectorIn.classList.add('af-selector');
    const advanced = el('details', 'wide');
    advanced.appendChild(el('summary', '', 'מתקדם (שם שדה ו-selector)'));
    const advBody = el('div');
    advBody.append(field('שם השדה (לתצוגה)', labelIn), field('CSS Selector', selectorIn));
    advanced.appendChild(advBody);
    // A new entry has no selector to inherit, so the advanced block must be visible.
    if (!entry && !src.selector) advanced.open = true;

    const saveBtn = el('button', 'af-btn primary', 'שמור');
    const cancelBtn = el('button', 'af-btn', 'בטל');
    const actions = el('div', 'af-editor-actions');
    actions.append(cancelBtn, saveBtn);

    root.append(field('שם האפשרות (אופציונלי)', nameIn), field('ערך למילוי', valueIn),
      field('הופעל כאשר', scopeRow, true), advanced, actions);

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
