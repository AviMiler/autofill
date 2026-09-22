// Orchestrator: listens for focus events, matches entries, shows dropdown.
// Exposes window.__afContent for callbacks.
//
// Depends on (loaded before this file):
//   __afStorage, __afSelector, __afFill, __afDropdown, __afConfig, __afCredential, __afManager

(() => {
  if (window.__afContentLoaded) return;
  window.__afContentLoaded = true;

  let entries = [];
  let lastRightClickTarget = null;

  async function init() {
    document.addEventListener('focus', tryShow, true);
    document.addEventListener('click', tryShow, true);
    window.addEventListener('contextmenu', onContextMenu, true);
    chrome.runtime.onMessage.addListener(onMessage);

    entries = await window.__afStorage.loadEntries();

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes['af_entries']) {
        entries = changes['af_entries'].newValue || [];
      }
    });

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

  function urlMatchesEntry(entry) {
    const mt = entry.matchType || 'global';
    const mv = entry.matchValue || '';
    if (mt === 'global') return true;
    if (mt === 'domain') return location.hostname === mv;
    if (mt === 'url-contains') return mv && location.href.includes(mv);
    return false;
  }

  function matchingEntries(el) {
    return entries.filter(e => {
      if (!e.enabled) return false;
      if (!urlMatchesEntry(e)) return false;
      try { return el.matches(e.selector); } catch { return false; }
    });
  }

  function tryShow(e) {
    const el = e.target;
    if (!isEditableField(el)) return;
    if (window.__afDropdown.isVisible() && window.__afDropdown.getAnchor() === el) return;

    const matched = matchingEntries(el);

    // Credential fields: prepend saved credential items.
    if (window.__afCredential) {
      const isCred = window.__afCredential.isPasswordField(el) || window.__afCredential.isUsernameField(el);
      if (isCred) {
        window.__afCredential.load().then(cred => {
          const credItems = cred
            ? (window.__afCredential.isPasswordField(el)
                ? [{ name: 'סיסמה שמורה', value: cred.password }]
                : [{ name: 'שם משתמש שמור', value: cred.username }])
            : [];
          const seen = new Set();
          const entryItems = matched
            .filter(e => e.value && !seen.has(e.value) && seen.add(e.value))
            .map(e => ({ name: e.name, value: e.value }));
          const merged = [...credItems, ...entryItems];
          if (merged.length) {
            window.__afDropdown.show(
              el, merged,
              v => window.__afFill.fillField(el, v),
              () => window.__afConfig.show(el),
              () => window.__afManager.show({ selector: window.__afSelector.generate(el) })
            );
          }
        });
        return;
      }
    }

    const seen = new Set();
    const options = matched
      .filter(e => e.value && !seen.has(e.value) && seen.add(e.value))
      .map(e => ({ name: e.name, value: e.value }));

    if (!options.length) return;

    window.__afDropdown.show(
      el,
      options,
      value => window.__afFill.fillField(el, value),
      () => window.__afConfig.show(el),
      () => window.__afManager.show({ selector: window.__afSelector.generate(el) })
    );
  }

  function onContextMenu(e) {
    lastRightClickTarget = e.target;
  }

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
    if (msg.action === 'open-config') {
      const el = findEditableTarget(lastRightClickTarget);
      if (el) window.__afConfig.show(el);
    }
    if (msg.action === 'open-manager') {
      window.__afManager.show();
    }
  }

  function refreshEntries() {
    window.__afStorage.loadEntries().then(e => { entries = e; });
  }

  window.__afContent = { refreshEntries };

  init();
})();
