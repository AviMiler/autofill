// Text-expansion shortcuts: user types a trigger (e.g. "@TZ") in any field
// and gets offered the stored value. Exports window.__afSnippet.

// Kill switch: set to false to disable snippet suggestions entirely.
const AF_SNIPPET_ENABLED = true;

(() => {
  if (window.__afSnippet) return;
  if (!AF_SNIPPET_ENABLED) return;

  const KEY = 'af_snippets';
  const MAX_TOKEN_LEN = 20;
  let _cache = [];

  chrome.storage.local.get(KEY, res => { _cache = res[KEY] || []; });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[KEY]) {
      _cache = changes[KEY].newValue || [];
    }
  });

  // Returns the run of non-whitespace characters ending at the cursor
  // (up to MAX_TOKEN_LEN chars), or '' if none.
  function getToken(el) {
    let textBeforeCursor;
    if (el.isContentEditable) {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return '';
      const node = sel.focusNode;
      if (!node || node.nodeType !== Node.TEXT_NODE) return '';
      textBeforeCursor = node.textContent.slice(0, sel.focusOffset);
    } else {
      const cursor = el.selectionStart;
      if (cursor == null) return '';
      textBeforeCursor = el.value.slice(0, cursor);
    }
    const tail = textBeforeCursor.slice(-MAX_TOKEN_LEN);
    const match = tail.match(/\S+$/);
    return match ? match[0] : '';
  }

  function findMatches(token) {
    if (!token || token.length < 2) return [];
    return _cache.filter(s => s.trigger && s.trigger.startsWith(token));
  }

  window.__afSnippet = { getToken, findMatches };
})();
