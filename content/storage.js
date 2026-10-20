// PUBLIC API: window.__afStorage
// loadEntries()            → Promise<Entry[]>
// saveEntries(entries)     → Promise
// addEntry(entry)          → Promise<Entry>   — auto-generates id + created
// updateEntry(entry)       → Promise
// deleteEntry(id)          → Promise
// restoreEntries(entries)  → Promise          — re-adds full entries (keeps id/created), skips known ids
// appliesToUrl(entry, url) → boolean          — does the entry's URL scope cover this URL
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
    // Cache only after the write lands, so a rejected set() (e.g. quota) leaves no phantom entry.
    await chrome.storage.local.set({ [KEY]: entries });
    _cache = entries;
  }

  // Mutations re-read storage (never the cache) and run one at a time, so
  // overlapping add/update/delete calls can't overwrite each other's changes.
  let _queue = Promise.resolve();
  function _mutate(fn) {
    const run = _queue.then(async () => {
      _cache = null;
      await saveEntries(fn(await loadEntries()));
    });
    _queue = run.catch(() => {});
    return run;
  }

  async function addEntry(entry) {
    const newEntry = {
      matchType: 'global',
      matchValue: '',
      enabled: true,
      ...entry,
      id: _genId(),
      created: Date.now(),
    };
    await _mutate(entries => [...entries, newEntry]);
    return newEntry;
  }

  function updateEntry(updated) {
    return _mutate(entries => entries.map(e => e.id === updated.id ? { ...e, ...updated } : e));
  }

  function deleteEntry(id) {
    return _mutate(entries => entries.filter(e => e.id !== id));
  }

  // Re-inserts complete entries keeping their id/created (undo-delete, JSON import).
  // Entries whose id already exists are skipped, so it is safe to call twice.
  function restoreEntries(restored) {
    return _mutate(entries => {
      const known = new Set(entries.map(e => e.id));
      return [...entries, ...restored.filter(e => !known.has(e.id) && known.add(e.id))];
    });
  }

  // True when `entry`'s URL scope covers `url` (a full URL string). Shared by the content
  // script (live page), the config panel (dimming) and the manager (site filter).
  function appliesToUrl(entry, url) {
    const mt = entry.matchType || 'global';
    const mv = entry.matchValue || '';
    if (mt === 'global') return true;
    if (mt === 'domain') {
      try { return new URL(url).hostname === mv; } catch { return false; }
    }
    if (mt === 'url-contains') return Boolean(mv) && url.includes(mv);
    return false;
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[KEY]) {
      _cache = changes[KEY].newValue || [];
    }
  });

  window.__afStorage = {
    loadEntries, saveEntries, addEntry, updateEntry, deleteEntry, restoreEntries, appliesToUrl,
  };
})();
