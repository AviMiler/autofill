// PUBLIC API: window.__afDropdown
// show(anchorEl, items, onSelect, onEdit) → void
//   items: array of { name?, value } objects
//          OR array of strings (treated as { value: s })
//   Render: name present → two-line (bold name on top, gray value below).
//           name absent  → single-line value.
//   onSelect receives the value (always a string).
// hide()                                    → void
// isVisible()                               → boolean
// getAnchor()                               → element | null  — currently anchored field

(() => {
  const CSS = `
    :host { all: initial; }
    .af-drop {
      position: fixed;
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,.15);
      min-width: 220px;
      max-width: 360px;
      z-index: 2147483647;
      overflow: hidden;
      font-family: system-ui, sans-serif;
      direction: rtl;
    }
    .af-item {
      padding: 8px 14px;
      cursor: pointer;
      border-bottom: 1px solid #f2f2f2;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .af-item:last-of-type { border-bottom: none; }
    .af-item:hover, .af-item.focused {
      background: #f0f4ff;
    }
    .af-name {
      font-size: 13px;
      font-weight: 600;
      color: #1a1a1a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .af-value {
      font-size: 11px;
      color: #888;
      font-family: ui-monospace, "SF Mono", Consolas, monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .af-value-only {
      font-size: 13px;
      color: #222;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .af-edit {
      padding: 8px 14px;
      cursor: pointer;
      border-top: 1px solid #e8e8e8;
      background: #fafafa;
      color: #666;
      font-size: 12px;
    }
    .af-edit:hover, .af-edit.focused {
      background: #f0f0f0;
      color: #333;
    }
  `;

  let host = null;
  let shadow = null;
  let dropdown = null;
  let anchorEl = null;
  let focusedIdx = -1;
  let allItems = [];
  let onAnchorInput = null;

  // Events that — if they leak out of our shadow root — let host-page handlers
  // steal focus or trigger their own UI. We stop them at the shadow boundary.
  const ISOLATED_EVENTS = ['mousedown', 'pointerdown', 'mouseup', 'click', 'focusin', 'focusout', 'keydown', 'keyup', 'keypress'];
  function isolateShadow(root) {
    ISOLATED_EVENTS.forEach(ev =>
      root.addEventListener(ev, e => e.stopPropagation())
    );
  }

  function show(anchor, options, onSelect, onEdit) {
    hide();
    anchorEl = anchor;

    host = document.createElement('div');
    shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = CSS;
    shadow.appendChild(style);

    dropdown = document.createElement('div');
    dropdown.className = 'af-drop';
    shadow.appendChild(dropdown);

    isolateShadow(dropdown);

    allItems = [];

    options.forEach((raw) => {
      const opt = typeof raw === 'string' ? { name: '', value: raw } : { name: raw.name || '', value: raw.value };
      const item = document.createElement('div');
      item.className = 'af-item';
      item.title = opt.value;

      if (opt.name) {
        const nameEl = document.createElement('div');
        nameEl.className = 'af-name';
        nameEl.textContent = opt.name;
        const valueEl = document.createElement('div');
        valueEl.className = 'af-value';
        valueEl.textContent = opt.value;
        item.appendChild(nameEl);
        item.appendChild(valueEl);
      } else {
        const valueEl = document.createElement('div');
        valueEl.className = 'af-value-only';
        valueEl.textContent = opt.value;
        item.appendChild(valueEl);
      }

      item.addEventListener('mousedown', e => {
        e.preventDefault(); // prevent field blur
        onSelect(opt.value);
        hide();
      });
      dropdown.appendChild(item);
      allItems.push(item);
    });

    const editBtn = document.createElement('div');
    editBtn.className = 'af-item af-edit';
    editBtn.textContent = '⚙️ ערוך אפשרויות';
    editBtn.addEventListener('mousedown', e => {
      e.preventDefault();
      hide();
      onEdit();
    });
    dropdown.appendChild(editBtn);
    allItems.push(editBtn);

    positionDropdown(anchor);
    document.body.appendChild(host);

    // Close on outside click or Escape.
    document.addEventListener('mousedown', onOutsideClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    // Only close on a real user-typed input — some sites (e.g. google.com search)
    // fire synthetic `input` events on focus, which would close us immediately.
    onAnchorInput = (e) => { if (e.isTrusted) hide(); };
    anchor.addEventListener('input', onAnchorInput);
  }

  function positionDropdown(anchor) {
    const rect = anchor.getBoundingClientRect();
    dropdown.style.top = `${rect.bottom + 4}px`;
    dropdown.style.left = `${rect.left}px`;
    // Ensure it doesn't overflow viewport bottom.
    requestAnimationFrame(() => {
      const dr = dropdown.getBoundingClientRect();
      if (dr.bottom > window.innerHeight - 8) {
        dropdown.style.top = `${rect.top - dr.height - 4}px`;
      }
    });
  }

  function hide() {
    if (!host) return;
    document.removeEventListener('mousedown', onOutsideClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    if (anchorEl && onAnchorInput) anchorEl.removeEventListener('input', onAnchorInput);
    onAnchorInput = null;
    host.remove();
    host = null;
    shadow = null;
    dropdown = null;
    anchorEl = null;
    focusedIdx = -1;
    allItems = [];
  }

  function isVisible() {
    return host !== null;
  }

  function onOutsideClick(e) {
    if (host && !host.contains(e.target) && e.target !== anchorEl) hide();
  }

  function onKeyDown(e) {
    if (!isVisible()) return;
    if (e.key === 'Escape') { hide(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocus(focusedIdx + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocus(focusedIdx - 1);
    } else if (e.key === 'Enter' && focusedIdx >= 0) {
      e.preventDefault();
      allItems[focusedIdx]?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    }
  }

  function setFocus(idx) {
    allItems.forEach(i => i.classList.remove('focused'));
    focusedIdx = Math.max(0, Math.min(idx, allItems.length - 1));
    allItems[focusedIdx]?.classList.add('focused');
  }

  function getAnchor() { return anchorEl; }

  window.__afDropdown = { show, hide, isVisible, getAnchor };
})();
