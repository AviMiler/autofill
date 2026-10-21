// PUBLIC API: window.__afDropdown
// show(anchorEl, items, onSelect, opts?) → void
//   items: array of { name?, value } objects
//          OR array of strings (treated as { value: s })
//   Render: name present → two-line (name on top, muted monospace value below).
//           name absent  → single-line value.
//   onSelect receives the value (always a string).
//   The first item is pre-selected, so Enter fills it right away.
//   opts.suppressAutoHideOnInput: true → skip auto-hide on input events
//     (needed by snippet suggestions that re-show() on every keystroke)
//   opts.onAdd: function → adds an "add new entry" button to the footer that calls it
//   opts.highlight: string → items whose name starts with it get that prefix emphasized and
//     the name is rendered as a monospace trigger (snippet suggestions)
//   Footer: optional add button, keyboard hints (↑↓ / Enter / Esc) and the close button.
//   Closes itself when the anchor loses focus to anything outside the dropdown, and its
//   keyboard handler only acts while the anchor is document.activeElement.
//   While shown, the dropdown follows the anchor (window resize + scroll of any ancestor,
//   rAF-coalesced), flips above on bottom overflow, is clamped into the viewport
//   horizontally, and hides itself if the anchor is removed or scrolled out of view.
//   Light/dark follows prefers-color-scheme. Icons come from window.__afIcons (content/icons.js).
// hide()                                    → void   (also removes all tracking listeners)
// isVisible()                               → boolean
// getAnchor()                               → element | null  — currently anchored field

(() => {
  const CSS = `
    :host { all: initial; }
    .af-drop {
      --bg: #ffffff; --fg: #18181b; --muted: #71717a; --subtle: #a1a1aa;
      --line: rgba(24, 24, 27, .08); --hover: #f4f4f5; --kbd: #f4f4f5; --mark: #18181b;
      position: fixed;
      z-index: 2147483647;
      min-width: 288px;
      max-width: 360px;
      background: var(--bg);
      color: var(--fg);
      border: 1px solid var(--line);
      border-radius: 12px;
      box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 12px 32px -8px rgba(0,0,0,.18);
      overflow: hidden;
      font: 400 13px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
      direction: rtl;
      text-align: right;
      animation: af-in .12s ease-out;
    }
    @media (prefers-color-scheme: dark) {
      .af-drop {
        --bg: #18181b; --fg: #fafafa; --muted: #a1a1aa; --subtle: #71717a;
        --line: rgba(255, 255, 255, .09); --hover: #27272a; --kbd: #27272a; --mark: #fafafa;
        box-shadow: 0 1px 2px rgba(0,0,0,.3), 0 12px 32px -8px rgba(0,0,0,.6);
      }
    }
    @keyframes af-in { from { opacity: 0; transform: translateY(-2px); } }
    @media (prefers-reduced-motion: reduce) { .af-drop { animation: none; } }

    .af-list { max-height: 296px; overflow-y: auto; padding: 4px; scrollbar-width: thin; }
    .af-item {
      display: flex; flex-direction: column; gap: 1px;
      padding: 7px 10px;
      border-radius: 8px;
      cursor: pointer;
      min-width: 0;
    }
    .af-item.focused { background: var(--hover); }
    .af-name, .af-value, .af-value-only {
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .af-name { font-size: 13px; font-weight: 500; color: var(--fg); }
    .af-name.trigger { font-family: ui-monospace, "SF Mono", Consolas, monospace; font-size: 12.5px; color: var(--muted); direction: ltr; text-align: right; }
    .af-name.trigger b { color: var(--mark); font-weight: 600; }
    .af-value {
      font-size: 12px; color: var(--muted);
      font-family: ui-monospace, "SF Mono", Consolas, monospace;
      direction: ltr; text-align: right; unicode-bidi: plaintext;
    }
    .af-value-only { font-size: 13px; color: var(--fg); unicode-bidi: plaintext; }

    .af-footer {
      display: flex; align-items: center; gap: 8px;
      padding: 4px 6px 4px 4px;
      border-top: 1px solid var(--line);
      font-size: 11px; color: var(--subtle);
    }
    .af-add {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 4px 8px; border-radius: 6px;
      color: var(--fg); font-weight: 500; font-size: 12px; cursor: pointer;
    }
    .af-add:hover { background: var(--hover); }
    .af-hints { display: flex; align-items: center; gap: 8px; margin-inline-start: auto; white-space: nowrap; }
    .af-hints span { display: inline-flex; align-items: center; gap: 3px; }
    kbd {
      font: 500 10px/1 ui-monospace, "SF Mono", Consolas, monospace;
      min-width: 16px; padding: 2px 4px; box-sizing: border-box; text-align: center;
      background: var(--kbd); color: var(--muted); border-radius: 4px;
    }
    .af-close {
      display: inline-flex; align-items: center; justify-content: center;
      width: 22px; height: 22px; padding: 0;
      border: none; border-radius: 6px; background: transparent;
      color: var(--subtle); cursor: pointer;
    }
    .af-close:hover { background: var(--hover); color: var(--fg); }
    svg { display: block; flex-shrink: 0; }
  `;

  const icon = (name, size) => window.__afIcons.node(name, size);

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

    const list = document.createElement('div');
    list.className = 'af-list';
    dropdown.appendChild(list);

    allItems = [];
    const highlight = opts.highlight || '';

    options.forEach((raw) => {
      const opt = typeof raw === 'string' ? { name: '', value: raw } : { name: raw.name || '', value: raw.value };
      const item = document.createElement('div');
      item.className = 'af-item';
      item.title = opt.value;

      if (opt.name) {
        const nameEl = document.createElement('div');
        nameEl.className = 'af-name';
        if (highlight && opt.name.startsWith(highlight)) {
          nameEl.classList.add('trigger');
          const typed = document.createElement('b');
          typed.textContent = highlight;
          nameEl.append(typed, opt.name.slice(highlight.length));
        } else {
          nameEl.textContent = opt.name;
        }
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
      item.addEventListener('mousemove', () => {
        const idx = allItems.indexOf(item);
        if (idx !== focusedIdx) setFocus(idx, false);
      });
      list.appendChild(item);
      allItems.push(item);
    });

    // Footer buttons are divs/tabIndex=-1 + mousedown/preventDefault: focus must stay on the field.
    const footer = document.createElement('div');
    footer.className = 'af-footer';
    if (opts.onAdd) {
      const addBtn = document.createElement('div');
      addBtn.className = 'af-add';
      addBtn.append(icon('plus', 14), 'מילוי חדש');
      addBtn.addEventListener('mousedown', e => {
        e.preventDefault();
        hide();
        opts.onAdd();
      });
      footer.appendChild(addBtn);
    }
    const hints = document.createElement('div');
    hints.className = 'af-hints';
    [['↑↓', 'ניווט'], ['↵', 'מילוי'], ['esc', 'סגירה']].forEach(([key, text]) => {
      const hint = document.createElement('span');
      const kbd = document.createElement('kbd');
      kbd.textContent = key;
      hint.append(kbd, text);
      hints.appendChild(hint);
    });
    const closeBtn = document.createElement('button');
    closeBtn.className = 'af-close';
    closeBtn.title = 'סגירה';
    closeBtn.appendChild(icon('x', 14));
    closeBtn.tabIndex = -1; // keep Tab from the field going to the dropdown (it lives at the end of <body>)
    closeBtn.addEventListener('mousedown', e => {
      e.preventDefault();
      hide();
    });
    footer.append(hints, closeBtn);
    dropdown.appendChild(footer);
    setFocus(0, false);

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

  function setFocus(idx, scroll = true) {
    allItems.forEach(i => i.classList.remove('focused'));
    focusedIdx = Math.max(0, Math.min(idx, allItems.length - 1));
    allItems[focusedIdx]?.classList.add('focused');
    if (scroll) allItems[focusedIdx]?.scrollIntoView({ block: 'nearest' });
  }

  function getAnchor() { return anchorEl; }

  window.__afDropdown = { show, hide, isVisible, getAnchor };
})();
