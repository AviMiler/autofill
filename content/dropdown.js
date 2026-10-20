// PUBLIC API: window.__afDropdown
// show(anchorEl, items, onSelect, opts?) → void
//   items: array of { name?, value } objects
//          OR array of strings (treated as { value: s })
//   Render: name present → two-line (bold name on top, gray value below).
//           name absent  → single-line value.
//   onSelect receives the value (always a string).
//   opts.suppressAutoHideOnInput: true → skip auto-hide on input events
//     (needed by snippet suggestions that re-show() on every keystroke)
//   opts.onAdd: function → adds a bottom "add new entry" button that calls it
//   Closes itself when the anchor loses focus to anything outside the dropdown, and its
//   keyboard handler only acts while the anchor is document.activeElement.
//   While shown, the dropdown follows the anchor (window resize + scroll of any ancestor,
//   rAF-coalesced), flips above on bottom overflow, is clamped into the viewport
//   horizontally, and hides itself if the anchor is removed or scrolled out of view.
// hide()                                    → void   (also removes all tracking listeners)
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
    .af-item:has(+ .af-footer) { border-bottom: none; }
    .af-footer {
      border-top: 1px solid #e8e8e8;
    }
    .af-footer-btn {
      padding: 8px 10px;
      cursor: pointer;
      background: #fafafa;
      color: #4f7aff;
      font-size: 12px;
      text-align: center;
    }
    .af-footer-btn:hover { background: #f0f4ff; }
    .af-close {
      position: absolute;
      top: 4px;
      left: 4px;
      width: 20px;
      height: 20px;
      border: none;
      background: transparent;
      color: #999;
      font-size: 14px;
      line-height: 20px;
      text-align: center;
      cursor: pointer;
      border-radius: 4px;
      padding: 0;
      z-index: 1;
    }
    .af-close:hover {
      background: #eee;
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
  let rafId = 0;
  let removalObserver = null;

  const ISOLATED_EVENTS = ['mousedown', 'pointerdown', 'mouseup', 'click', 'focusin', 'focusout', 'keydown', 'keyup', 'keypress'];
  function isolateShadow(root) {
    ISOLATED_EVENTS.forEach(ev =>
      root.addEventListener(ev, e => e.stopPropagation())
    );
  }

  function show(anchor, options, onSelect, opts = {}) {
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

    const closeBtn = document.createElement('button');
    closeBtn.className = 'af-close';
    closeBtn.textContent = '✕';
    closeBtn.tabIndex = -1; // keep Tab from the field going to the dropdown (it lives at the end of <body>)
    closeBtn.addEventListener('mousedown', e => {
      e.preventDefault();
      hide();
    });
    dropdown.appendChild(closeBtn);

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
        e.preventDefault();
        onSelect(opt.value);
        hide();
      });
      dropdown.appendChild(item);
      allItems.push(item);
    });

    if (opts.onAdd) {
      const footer = document.createElement('div');
      footer.className = 'af-footer';
      const addBtn = document.createElement('div');
      addBtn.className = 'af-footer-btn';
      addBtn.textContent = '➕ הוסף מילוי חדש';
      addBtn.addEventListener('mousedown', e => {
        e.preventDefault();
        hide();
        opts.onAdd();
      });
      footer.appendChild(addBtn);
      dropdown.appendChild(footer);
    }

    document.body.appendChild(host);
    positionDropdown();
    if (!host) return; // anchor not visible → positionDropdown() already hid us

    document.addEventListener('mousedown', onOutsideClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    // Capture phase so scrolls of any ancestor scroller (which don't bubble) are seen.
    window.addEventListener('scroll', scheduleReposition, { capture: true, passive: true });
    window.addEventListener('resize', scheduleReposition, { passive: true });

    // Focus left the anchor for something outside the dropdown (Tab, click elsewhere,
    // window blur) → close. Dropdown items use mousedown+preventDefault, so interacting
    // with them never moves focus and never triggers this.
    anchor.addEventListener('focusout', onAnchorFocusOut);
    // A removed/re-rendered anchor fires no scroll/resize/blur; watch the DOM instead.
    removalObserver = new MutationObserver(() => { if (anchorEl && !anchorEl.isConnected) hide(); });
    removalObserver.observe(document.documentElement, { childList: true, subtree: true });

    if (!opts.suppressAutoHideOnInput) {
      onAnchorInput = (e) => { if (e.isTrusted) hide(); };
      anchor.addEventListener('input', onAnchorInput);
    }
  }

  // True when the anchor has no visible area: zero-size (display:none) or fully
  // outside the viewport or outside the visible box of any clipping ancestor.
  function isAnchorOutOfView(rect) {
    if (rect.width === 0 && rect.height === 0) return true;
    let { top, bottom, left, right } = rect;
    const view = document.documentElement;
    top = Math.max(top, 0);
    left = Math.max(left, 0);
    bottom = Math.min(bottom, view.clientHeight);
    right = Math.min(right, view.clientWidth);
    for (let el = anchorEl.parentElement; el && el !== document.body && el !== view; el = el.parentElement) {
      const cs = getComputedStyle(el);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const r = el.getBoundingClientRect();
      top = Math.max(top, r.top);
      left = Math.max(left, r.left);
      bottom = Math.min(bottom, r.bottom);
      right = Math.min(right, r.right);
    }
    return bottom <= top || right <= left;
  }

  function positionDropdown() {
    const rect = anchorEl.getBoundingClientRect();
    if (isAnchorOutOfView(rect)) { hide(); return; }

    // Measure at left:0 so the width isn't squeezed by the space remaining to the right of the anchor.
    dropdown.style.left = '0px';
    dropdown.style.top = '0px';
    const dr = dropdown.getBoundingClientRect();
    const viewW = document.documentElement.clientWidth;
    const viewH = document.documentElement.clientHeight;

    let top = rect.bottom + 4;
    if (top + dr.height > viewH - 8 && rect.top - dr.height - 4 >= 0) {
      top = rect.top - dr.height - 4;
    }
    // The dropdown is RTL: on an RTL field align right edges, otherwise left edges.
    const isRtl = getComputedStyle(anchorEl).direction === 'rtl';
    let left = isRtl ? rect.right - dr.width : rect.left;
    left = Math.max(8, Math.min(left, viewW - dr.width - 8));
    dropdown.style.top = `${top}px`;
    dropdown.style.left = `${left}px`;
  }

  function scheduleReposition() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      if (!host || !anchorEl) return;
      if (!anchorEl.isConnected) { hide(); return; }
      positionDropdown();
    });
  }

  function hide() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    if (!host) return;
    document.removeEventListener('mousedown', onOutsideClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('scroll', scheduleReposition, { capture: true });
    window.removeEventListener('resize', scheduleReposition);
    if (removalObserver) { removalObserver.disconnect(); removalObserver = null; }
    if (anchorEl) anchorEl.removeEventListener('focusout', onAnchorFocusOut);
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

  function onAnchorFocusOut(e) {
    if (e.relatedTarget && host && host.contains(e.relatedTarget)) return;
    hide();
  }

  function onKeyDown(e) {
    if (!isVisible()) return;
    // Keys typed elsewhere must never drive (or fill) a dropdown anchored to another field.
    if (document.activeElement !== anchorEl) { hide(); return; }
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
