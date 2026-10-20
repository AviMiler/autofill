// Manager shared helpers. Namespace: window.__afMgr (manager page only, never a content script).
// el(tag, className?, text?)        → HTMLElement   (text goes through textContent: never HTML)
// scopeBadge(entry)                 → HTMLElement   (🌐 / 🌍 domain / 🔗 url pill)
// showToast(message, onUndo?)       → void          (6s toast with optional "בטל" button)

(() => {
  const TOAST_MS = 6000;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function scopeBadge(entry) {
    const type = entry.matchType || 'global';
    if (type === 'global') return el('span', 'af-scope-badge s-global', '🌐 גלובלי');
    if (type === 'domain') return el('span', 'af-scope-badge s-domain', `🌍 ${entry.matchValue}`);
    return el('span', 'af-scope-badge s-url', `🔗 ${entry.matchValue}`);
  }

  function showToast(message, onUndo) {
    const toast = el('div', 'af-toast');
    toast.appendChild(el('span', '', message));
    const dismiss = () => toast.remove();
    if (onUndo) {
      const undoBtn = el('button', '', 'בטל');
      undoBtn.addEventListener('click', async () => {
        dismiss();
        try { await onUndo(); } catch (err) { console.error('[manager] undo failed:', err); }
      });
      toast.appendChild(undoBtn);
    }
    document.getElementById('af-toast-host').appendChild(toast);
    setTimeout(dismiss, TOAST_MS);
  }

  window.__afMgr = { el, scopeBadge, showToast };
})();
