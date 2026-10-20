// Orchestrator: listens for focus events, matches entries, shows dropdown.
// Exposes window.__afContent for callbacks.
//
// Depends on (loaded before this file):
//   __afStorage, __afSelector, __afFill, __afDropdown, __afConfig, __afSnippet

(() => {
  if (window.__afContentLoaded) return;
  window.__afContentLoaded = true;

  let entries = [];
  let lastRightClickTarget = null;
  let snippetModeActive = false;

  async function init() {
    document.addEventListener('focus', tryShow, true);
    document.addEventListener('click', tryShow, true);
    document.addEventListener('input', trySnippet, true);
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

  // A click inside a rich contentEditable targets a descendant, but focus/blur events (and
  // document.activeElement) belong to the editing host — anchor the dropdown on the host.
  function toEditingHost(el) {
    while (el.isContentEditable && el.parentElement?.isContentEditable) el = el.parentElement;
    return el;
  }

  function tryShow(e) {
    if (!isEditableField(e.target)) return;
    const el = toEditingHost(e.target);
    if (window.__afDropdown.isVisible() && window.__afDropdown.getAnchor() === el) return;

    snippetModeActive = false;
    const matched = matchingEntries(el);

    const seen = new Set();
    const options = matched
      .filter(e => e.value && !seen.has(e.value) && seen.add(e.value))
      .map(e => ({ name: e.name, value: e.value }));

    if (!options.length) {
      // Focus moved to a field with nothing to offer: don't leave the old field's dropdown open.
      if (window.__afDropdown.isVisible() && window.__afDropdown.getAnchor() !== el) window.__afDropdown.hide();
      return;
    }

    window.__afDropdown.show(
      el,
      options,
      value => window.__afFill.fillField(el, value),
      { onAdd: () => window.__afConfig.show(el) }
    );
  }

  // type=email/number expose no cursor, so getToken assumes it is at the end. A typed
  // character that did not land at the end of the value proves that assumption wrong.
  function isEditAwayFromEnd(e, el) {
    if (el.isContentEditable || el.selectionStart !== null) return false;
    return e.inputType === 'insertText' && !!e.data && !el.value.endsWith(e.data);
  }

  function trySnippet(e) {
    if (!window.__afSnippet) return;
    const el = e.target;
    if (!isEditableField(el)) return;

    const token = isEditAwayFromEnd(e, el) ? '' : window.__afSnippet.getToken(el);
    const matches = window.__afSnippet.findMatches(token);

    if (!matches.length) {
      if (snippetModeActive && window.__afDropdown.isVisible() && window.__afDropdown.getAnchor() === el) {
        window.__afDropdown.hide();
        snippetModeActive = false;
      }
      return;
    }

    window.__afDropdown.show(
      el,
      matches.map(s => ({ name: s.trigger, value: s.value })),
      value => window.__afFill.replaceTextBeforeCursor(el, token, value),
      { suppressAutoHideOnInput: true }
    );
    snippetModeActive = true;
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
  }

  function refreshEntries() {
    window.__afStorage.loadEntries().then(e => { entries = e; }).catch(() => {});
  }

  window.__afContent = { refreshEntries };

  init();
})();
