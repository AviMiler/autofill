// JSON export / import of entries + snippets.
// File shape: { app: 'autofill', version: 1, exportedAt, entries: Entry[], snippets: Snippet[] }
// Import MERGES (never deletes): items whose id already exists are skipped.

(() => {
  const { showToast, loadSnippets, saveSnippets } = window.__afMgr;
  const { loadEntries, restoreEntries } = window.__afStorage;
  const MATCH_TYPES = ['global', 'domain', 'url-contains'];

  const newId = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const str = v => (typeof v === 'string' ? v : '');

  // Imported files are untrusted input: rebuild every item from known string fields only.
  function sanitizeEntry(raw) {
    if (!raw || typeof raw !== 'object' || !str(raw.selector).trim() || !str(raw.value)) return null;
    const matchType = MATCH_TYPES.includes(raw.matchType) ? raw.matchType : 'global';
    const matchValue = matchType === 'global' ? '' : str(raw.matchValue);
    if (matchType !== 'global' && !matchValue) return null;
    return {
      id: str(raw.id) || newId('e'), selector: raw.selector.trim(), fieldLabel: str(raw.fieldLabel),
      name: str(raw.name), value: raw.value, matchType, matchValue,
      enabled: raw.enabled !== false, created: Number.isFinite(raw.created) ? raw.created : Date.now(),
    };
  }

  function sanitizeSnippet(raw) {
    if (!raw || typeof raw !== 'object' || !str(raw.trigger).trim() || !str(raw.value)) return null;
    return { id: str(raw.id) || newId('s'), trigger: raw.trigger.trim(), value: raw.value, created: Number.isFinite(raw.created) ? raw.created : Date.now() };
  }

  async function exportAll() {
    const payload = {
      app: 'autofill', version: 1, exportedAt: new Date().toISOString(),
      entries: await loadEntries(), snippets: await loadSnippets(),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `autofill-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importFile(file) {
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch (err) {
      console.error('[backup] invalid JSON:', err);
      showToast('הקובץ אינו JSON תקין');
      return;
    }
    if (!data || data.app !== 'autofill' || !Array.isArray(data.entries || [])) {
      showToast('זה לא קובץ גיבוי של AutoFill');
      return;
    }
    const entries = (data.entries || []).map(sanitizeEntry).filter(Boolean);
    const snippets = (Array.isArray(data.snippets) ? data.snippets : []).map(sanitizeSnippet).filter(Boolean);

    const knownEntryIds = new Set((await loadEntries()).map(e => e.id));
    await restoreEntries(entries);
    const currentSnippets = await loadSnippets();
    const knownSnippetIds = new Set(currentSnippets.map(s => s.id));
    const newSnippets = snippets.filter(s => !knownSnippetIds.has(s.id));
    if (newSnippets.length) await saveSnippets([...currentSnippets, ...newSnippets]);

    const addedEntries = entries.filter(e => !knownEntryIds.has(e.id)).length;
    showToast(`יובאו ${addedEntries} מילויים ו-${newSnippets.length} קיצורים`);
  }

  const fileInput = document.getElementById('af-import-file');
  document.getElementById('af-export').addEventListener('click', () => {
    exportAll().catch(err => console.error('[backup] export failed:', err));
  });
  document.getElementById('af-import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (file) importFile(file).catch(err => { console.error('[backup] import failed:', err); showToast('הייבוא נכשל'); });
  });
})();
