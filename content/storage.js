// PUBLIC API: window.__afStorage
// loadRules()           → Promise<Rule[]>
// saveRules(rules)      → Promise
// addRule(rule)         → Promise<Rule>   — generates id + created timestamp
// updateRule(rule)      → Promise
// deleteRule(id)        → Promise
//
// Rule shape: { id, domain, selector, label, options[], enabled, created }
// domain: '*' = global, 'example.com' = site-specific

(() => {
  const KEY = 'af_rules';
  let _cache = null; // in-memory cache, kept in sync via onChanged

  async function loadRules() {
    if (_cache) return _cache;
    const data = await chrome.storage.local.get(KEY);
    _cache = data[KEY] || [];
    return _cache;
  }

  async function saveRules(rules) {
    _cache = rules;
    await chrome.storage.local.set({ [KEY]: rules });
  }

  async function addRule(rule) {
    const rules = await loadRules();
    const newRule = {
      id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      created: Date.now(),
      enabled: true,
      ...rule,
    };
    await saveRules([...rules, newRule]);
    return newRule;
  }

  async function updateRule(updated) {
    const rules = await loadRules();
    await saveRules(rules.map(r => (r.id === updated.id ? { ...r, ...updated } : r)));
  }

  async function deleteRule(id) {
    const rules = await loadRules();
    await saveRules(rules.filter(r => r.id !== id));
  }

  // Keep cache in sync if another context (popup) modifies storage.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[KEY]) {
      _cache = changes[KEY].newValue || [];
    }
  });

  window.__afStorage = { loadRules, saveRules, addRule, updateRule, deleteRule };
})();
