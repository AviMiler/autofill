// Text-expansion shortcuts: user types a trigger (e.g. "@TZ") in any field
// and gets offered the stored value. Exports window.__afSnippet.

(() => {
  if (window.__afSnippet) return; // double injection guard — must stay before anything else

  // Kill switch: set to false to disable snippet suggestions entirely.
  // (Inside the IIFE so a second injection can't hit a top-level redeclaration SyntaxError.)
  const AF_SNIPPET_ENABLED = true;
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
  // (at most MAX_TOKEN_LEN chars), or '' if none or if the run is longer than that —
  // a run that long is not a trigger, and truncating it would make a selection eat only its tail.
  function getToken(el) {
    let textBeforeCursor;
    if (el.isContentEditable) {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return '';
      const node = sel.focusNode;
      if (!node || node.nodeType !== Node.TEXT_NODE) return '';
      textBeforeCursor = node.textContent.slice(0, sel.focusOffset);
    } else {
      // type=email/number expose no selection (null) — assume the cursor is at the end.
      const cursor = el.selectionStart ?? el.value.length;
      textBeforeCursor = el.value.slice(0, cursor);
    }
    const tail = textBeforeCursor.slice(-(MAX_TOKEN_LEN + 1));
    const match = tail.match(/\S+$/);
    return match && match[0].length <= MAX_TOKEN_LEN ? match[0] : '';
  }

  function findMatches(token) {
    if (!token || token.length < 2) return [];
    return _cache.filter(s => s.trigger && s.trigger.length <= MAX_TOKEN_LEN && s.trigger.startsWith(token));
  }

  window.__afSnippet = { getToken, findMatches };
})();
