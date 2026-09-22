// PUBLIC API: window.__afStorage
// loadEntries()            → Promise<Entry[]>
// saveEntries(entries)     → Promise
// addEntry(entry)          → Promise<Entry>   — auto-generates id + created
// updateEntry(entry)       → Promise
// deleteEntry(id)          → Promise
//
// Entry shape:
// { id, selector, fieldLabel, name, value, matchType, matchValue, enabled, created }
// matchType: 'global' | 'domain' | 'url-contains'
//
// Migration: first load converts legacy af_rules format automatically.

(() => {
  const KEY = 'af_entries';
  const LEGACY_KEY = 'af_rules';
  let _cache = null;

  function _genId() {
    return `e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function _migrateFromRules(rules) {
    const entries = [];
    for (const rule of rules) {
      const matchType = rule.matchType
        || (rule.domain === '*' ? 'global' : rule.domain ? 'domain' : 'global');
      const matchValue = rule.matchValue
        ?? (matchType === 'domain' ? rule.domain : '') ?? '';
      for (const opt of (rule.options || [])) {
        const o = typeof opt === 'string' ? { name: '', value: opt } : opt;
        if (!o.value) continue;
        entries.push({
          id: _genId(),
          selector: rule.selector || '',
          fieldLabel: rule.label || '',
          name: o.name || '',
          value: o.value,
          matchType,
          matchValue,
          enabled: rule.enabled !== false,
          created: rule.created || Date.now(),
        });
      }
    }
    return entries;
  }

  async function loadEntries() {
    if (_cache) return _cache;
    const data = await chrome.storage.local.get([KEY, LEGACY_KEY]);
    if (data[KEY]) {
      _cache = data[KEY];
      return _cache;
    }
    if (data[LEGACY_KEY]?.length) {
      _cache = _migrateFromRules(data[LEGACY_KEY]);
      await chrome.storage.local.set({ [KEY]: _cache });
    } else {
      _cache = [];
    }
    return _cache;
  }

  async function saveEntries(entries) {
    _cache = entries;
    await chrome.storage.local.set({ [KEY]: entries });
  }

  async function addEntry(entry) {
    const entries = await loadEntries();
    const newEntry = {
      matchType: 'global',
      matchValue: '',
      enabled: true,
      ...entry,
      id: _genId(),
      created: Date.now(),
    };
    await saveEntries([...entries, newEntry]);
    return newEntry;
  }

  async function updateEntry(updated) {
    const entries = await loadEntries();
    await saveEntries(entries.map(e => e.id === updated.id ? { ...e, ...updated } : e));
  }

  async function deleteEntry(id) {
    const entries = await loadEntries();
    await saveEntries(entries.filter(e => e.id !== id));
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[KEY]) {
      _cache = changes[KEY].newValue || [];
    }
  });

  window.__afStorage = { loadEntries, saveEntries, addEntry, updateEntry, deleteEntry };
})();
