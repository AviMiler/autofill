// Manager shared helpers. Namespace: window.__afMgr (manager page only, never a content script).
// el(tag, className?, text?)        → HTMLElement   (text goes through textContent: never HTML)
// icon(name, size?)                 → SVGElement    (from window.__afIcons, content/icons.js)
// hydrateIcons(root?)               → void          (fills every [data-icon] placeholder in static HTML)
// iconButton(name, title, cls?)     → HTMLButtonElement  (icon-only button with title + aria-label)
// toggle(checked, onChange, label)  → HTMLLabelElement   (switch; onChange(checked))
// scopeBadge(entry)                 → HTMLElement   (globe = all sites / site = domain / link = URL contains)
// copyButton(getText)               → HTMLButtonElement  (copies to clipboard, shows a check for 1.2s)
// emptyState(iconName, title, text) → HTMLElement
// showToast(message, onUndo?)       → void          (6s toast with optional "ביטול" button)

(() => {
  const TOAST_MS = 6000;
  const COPIED_MS = 1200;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  const icon = (name, size) => window.__afIcons.node(name, size);

  function hydrateIcons(root = document) {
    root.querySelectorAll('[data-icon]:empty').forEach(slot => {
      slot.appendChild(icon(slot.dataset.icon, Number(slot.dataset.size) || 16));
    });
  }

  function iconButton(name, title, cls = '') {
    const b = el('button', `icon-btn ${cls}`.trim());
    b.type = 'button';
    b.title = title;
    b.setAttribute('aria-label', title);
    b.appendChild(icon(name, 16));
    return b;
  }

  function toggle(checked, onChange, label) {
    const wrap = el('label', 'switch');
    wrap.title = label;
    const cb = el('input');
    cb.type = 'checkbox';
    cb.checked = checked;
    cb.setAttribute('aria-label', label);
    cb.addEventListener('change', () => onChange(cb.checked));
    wrap.append(cb, el('span'));
    return wrap;
  }

  function scopeBadge(entry) {
    const type = entry.matchType || 'global';
    const badge = el('span', 'scope');
    const text = type === 'global' ? el('span', '', 'כל האתרים') : el('span', '', entry.matchValue);
    if (type !== 'global') text.dir = 'ltr';
    badge.title = type === 'global' ? 'מופיע בכל האתרים'
      : type === 'domain' ? `רק באתר ${entry.matchValue}` : `בכתובות שמכילות: ${entry.matchValue}`;
    badge.append(icon(type === 'global' ? 'globe' : type === 'domain' ? 'site' : 'link', 13), text);
    return badge;
  }

  function copyButton(getText) {
    const b = iconButton('copy', 'העתקת הערך');
    let timer = 0;
    b.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(getText());
      } catch (err) {
        console.error('[manager] copy failed:', err);
        showToast('ההעתקה נכשלה');
        return;
      }
      clearTimeout(timer);
      b.replaceChildren(icon('check', 16));
      b.classList.add('done');
      timer = setTimeout(() => { b.replaceChildren(icon('copy', 16)); b.classList.remove('done'); }, COPIED_MS);
    });
    return b;
  }

  function emptyState(iconName, title, text) {
    const box = el('div', 'empty');
    const badge = el('div', 'empty-icon');
    badge.appendChild(icon(iconName, 20));
    box.append(badge, el('h3', '', title));
    if (text) box.appendChild(el('p', '', text));
    return box;
  }

  function showToast(message, onUndo) {
    const toast = el('div', 'toast');
    toast.setAttribute('role', 'status');
    toast.appendChild(el('span', '', message));
    const dismiss = () => toast.remove();
    if (onUndo) {
      const undoBtn = el('button', '', 'ביטול');
      undoBtn.type = 'button';
      undoBtn.addEventListener('click', async () => {
        dismiss();
        try { await onUndo(); } catch (err) { console.error('[manager] undo failed:', err); }
      });
      toast.appendChild(undoBtn);
    }
    document.getElementById('af-toast-host').appendChild(toast);
    setTimeout(dismiss, TOAST_MS);
  }

  window.__afMgr = { el, icon, hydrateIcons, iconButton, toggle, scopeBadge, copyButton, emptyState, showToast };
})();
