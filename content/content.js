// Orchestrator: listens for focus events, matches rules, shows dropdown.
// Exposes window.__afContent for config-panel callbacks.
//
// Depends on (loaded before this file):
//   __afStorage, __afSelector, __afFill, __afDropdown, __afConfig

(() => {
  if (window.__afContentLoaded) return;
  window.__afContentLoaded = true;

  let rules = [];
  let lastRightClickTarget = null;

  async function init() {
    // Register listeners FIRST so we don't miss events while rules load.
    // Critical for pages that auto-focus an input on load (e.g. google.com search).
    document.addEventListener('focus', tryShow, true);
    document.addEventListener('click', tryShow, true);
    // Use window (not document) so we run before any site-level capture
    // listeners (e.g. SAP UI5) that call stopPropagation on contextmenu.
    window.addEventListener('contextmenu', onContextMenu, true);
    chrome.runtime.onMessage.addListener(onMessage);

    rules = await window.__afStorage.loadRules();

    // Keep rules fresh when storage changes (popup edits, other tabs).
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes['af_rules']) {
        rules = changes['af_rules'].newValue || [];
      }
    });

    // If a field was already focused before rules loaded, try it now.
    const active = document.activeElement;
    if (active && isEditableField(active)) tryShow({ target: active });
  }

  function isEditableField(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'TEXTAREA') return true;
    if (tag === 'INPUT') {
      const type = el.type?.toLowerCase() || 'text';
      return !['checkbox', 'radio', 'file', 'submit', 'button', 'image', 'range', 'color'].includes(type);
    }
    return el.isContentEditable;
  }

  // Resolves a rule's URL match: returns true if the current page satisfies it.
  // Backward-compatible with old rules that only have a `domain` field.
  function urlMatches(rule) {
    const matchType = rule.matchType || (rule.domain === '*' ? 'global' : 'domain');
    const matchValue = rule.matchValue ?? rule.domain ?? '';
    if (matchType === 'global') return true;
    if (matchType === 'domain') return location.hostname === matchValue;
    if (matchType === 'url-contains') return matchValue && location.href.includes(matchValue);
    return false;
  }

  function matchingRules(el) {
    return rules.filter(r => {
      if (!r.enabled) return false;
      if (!urlMatches(r)) return false;
      try { return el.matches(r.selector); } catch { return false; }
    });
  }

  function tryShow(e) {
    const el = e.target;
    if (!isEditableField(el)) return;

    // If dropdown is already open for this field, don't flicker.
    if (window.__afDropdown.isVisible() && window.__afDropdown.getAnchor() === el) return;

    const matched = matchingRules(el);

    // Flatten + normalize options. Legacy strings become {name:'', value:str}.
    // Dedupe by value (first occurrence wins, preserves order).
    const seen = new Set();
    const options = matched
      .flatMap(r => r.options || [])
      .map(o => typeof o === 'string' ? { name: '', value: o } : { name: o?.name || '', value: o?.value || '' })
      .filter(o => o.value && !seen.has(o.value) && seen.add(o.value));

    // Credential fields: prepend saved credential option, then show merged dropdown.
    if (window.__afCredential) {
      const isCred = window.__afCredential.isPasswordField(el) || window.__afCredential.isUsernameField(el);
      if (isCred) {
        window.__afCredential.load().then(cred => {
          const credItems = cred
            ? (window.__afCredential.isPasswordField(el)
                ? [{ name: 'סיסמה שמורה', value: cred.password }]
                : [{ name: 'שם משתמש שמור', value: cred.username }])
            : [];
          const merged = [...credItems, ...options];
          if (merged.length) {
            window.__afDropdown.show(el, merged, v => window.__afFill.fillField(el, v), () => openConfig(el));
          }
        });
        return;
      }
    }

    if (!options.length) return;

    window.__afDropdown.show(
      el,
      options,
      value => window.__afFill.fillField(el, value),
      () => openConfig(el)
    );
  }

  function onContextMenu(e) {
    lastRightClickTarget = e.target;
    console.log('[AutoFill] contextmenu on:', {
      tag: e.target?.tagName,
      id: e.target?.id,
      type: e.target?.type,
      isEditable: isEditableField(e.target),
    });
  }

  // Walk up from el (and through shadow roots via composedPath) to find
  // the nearest editable ancestor. Handles cases where the right-click
  // target is an overlay div on top of an input (e.g. Google search suggestions).
  function findEditableTarget(el) {
    if (!el) return null;
    let node = el;
    while (node && node !== document.body) {
      if (isEditableField(node)) return node;
      node = node.parentElement;
    }
    return null;
  }

  function onMessage(msg) {
    console.log('[AutoFill] message received:', msg.action);
    if (msg.action === 'open-config') {
      console.log('[AutoFill] lastRightClickTarget:', lastRightClickTarget?.tagName, lastRightClickTarget?.id);
      const el = findEditableTarget(lastRightClickTarget);
      console.log('[AutoFill] findEditableTarget result:', el?.tagName, el?.id);
      if (!el) {
        console.warn('[AutoFill] open-config: no editable field found near right-click target', lastRightClickTarget);
        return;
      }
      openConfig(el);
    }
  }

  function openConfig(el) {
    const matched = matchingRules(el);
    // If multiple rules match, edit the first one; if none, create new.
    window.__afConfig.show(el, matched[0] || null);
  }

  // Called by config-panel after save/delete so dropdown uses fresh rules.
  function refreshRules() {
    window.__afStorage.loadRules().then(r => { rules = r; });
  }

  window.__afContent = { refreshRules };

  init();
})();
