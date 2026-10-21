// Tutorial overlay, injected into every page (Playwright addInitScript, main world) while recording.
// window.__tour: caption / card / cursor / ripple / spot / contextMenu / toolbar / setMode.
// Mode 'video' draws everything; mode 'frames' hides the cursor, captions and cards (the HTML player
// draws its own) but keeps the "scene" parts: highlight ring, fake context menu, fake toolbar.
// Lives on <html> (not <body>), pointer-events:none, so the extension's popover (which makes body
// children inert) and the page never interact with it.
(() => {
  if (window.__tour) return;
  const CSS = `
    #__tour, #__tour * { box-sizing: border-box; }
    #__tour { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;
      font: 400 16px/1.45 'Rubik', system-ui, -apple-system, 'Segoe UI', sans-serif; direction: rtl; }
    #__tour.frames .t-cap, #__tour.frames .t-cur, #__tour.frames .t-rip, #__tour.frames .t-card { display: none !important; }
    .t-cap { position: absolute; bottom: 26px; left: 50%; transform: translate(-50%, 12px); opacity: 0;
      max-width: 820px; min-width: 360px; padding: 14px 22px 15px; border-radius: 16px;
      background: rgba(18, 18, 21, .92); color: #fafafa; box-shadow: 0 18px 50px -12px rgba(0,0,0,.45);
      backdrop-filter: blur(8px); transition: opacity .35s, transform .35s; text-align: right; }
    .t-cap.on { opacity: 1; transform: translate(-50%, 0); }
    .t-cap.top { bottom: auto; top: 26px; }
    .t-cap small { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; font-size: 12.5px; color: #a1a1aa; letter-spacing: .01em; }
    .t-cap small b { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 6px; background: #fafafa; color: #18181b; font-weight: 600; font-size: 11.5px; }
    .t-cap div { font-size: 18px; font-weight: 450; }
    .t-cap kbd { font: 500 14px ui-monospace, 'SF Mono', Consolas, monospace; padding: 1px 7px; border-radius: 6px; background: rgba(255,255,255,.14); }
    .t-cur { position: absolute; top: 0; left: 0; width: 26px; height: 26px; transform: translate(-100px, -100px);
      filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
    .t-rip { position: absolute; width: 40px; height: 40px; margin: -20px 0 0 -20px; border-radius: 50%;
      border: 2px solid rgba(24, 24, 27, .55); background: rgba(24, 24, 27, .12); animation: t-rip .55s ease-out forwards; }
    @keyframes t-rip { from { transform: scale(.3); opacity: 1; } to { transform: scale(1.4); opacity: 0; } }
    .t-spot { position: absolute; border-radius: 12px; border: 2px solid #18181b; opacity: 0;
      box-shadow: 0 0 0 4px rgba(24,24,27,.10), 0 0 0 9999px rgba(10,10,12,.10); transition: opacity .3s, all .45s cubic-bezier(.2,.7,.2,1); }
    .t-spot.on { opacity: 1; }
    .t-card { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 14px; background: #fafafa; color: #18181b; opacity: 0; transition: opacity .45s; text-align: center; }
    .t-card.dark { background: #0c0c0e; color: #fafafa; }
    .t-card.on { opacity: 1; }
    .t-card .num { font: 500 13px ui-monospace, 'SF Mono', Consolas, monospace; letter-spacing: .08em; color: #a1a1aa; }
    .t-card h1 { margin: 0; font-size: 46px; font-weight: 650; letter-spacing: -.02em; }
    .t-card p { margin: 0; font-size: 20px; color: #71717a; max-width: 720px; }
    .t-card .logo { width: 64px; height: 64px; margin-bottom: 6px; }
    .t-card .chips { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; justify-content: center; max-width: 760px; }
    .t-card .chips span { padding: 6px 14px; border-radius: 999px; border: 1px solid #e4e4e7; font-size: 15px; color: #52525b; }
    .t-card.dark .chips span { border-color: #2f2f35; color: #a1a1aa; }
    .t-menu { position: absolute; width: 300px; padding: 6px 0; border-radius: 10px; background: #fff; color: #1f1f1f;
      box-shadow: 0 0 0 1px rgba(0,0,0,.08), 0 10px 30px rgba(0,0,0,.18); font: 14px/1 system-ui, 'Segoe UI', sans-serif; direction: ltr; }
    .t-menu div { display: flex; align-items: center; gap: 10px; height: 32px; padding: 0 14px; direction: rtl; }
    .t-menu div.dim { color: #9a9a9a; }
    .t-menu div.hl { background: #e8eaed; }
    .t-menu hr { border: none; border-top: 1px solid #e3e3e3; margin: 6px 0; }
    .t-menu div span { margin-inline-start: auto; color: #9a9a9a; font-size: 12px; direction: ltr; }
    .t-menu img, .t-bar img { width: 16px; height: 16px; border-radius: 4px; }
    .t-bar { position: absolute; top: 0; left: 0; right: 0; height: 46px; display: flex; align-items: center; gap: 12px; padding: 0 14px;
      background: #f1f3f4; border-bottom: 1px solid #dadce0; transform: translateY(-100%); transition: transform .35s; direction: ltr; font: 14px system-ui, sans-serif; }
    .t-bar.on { transform: none; }
    .t-bar .url { flex: 1; height: 32px; border-radius: 16px; background: #fff; display: flex; align-items: center; padding: 0 16px; color: #3c4043; }
    .t-bar .url b { font-weight: 400; color: #80868b; }
    .t-bar .ext { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; transition: background .2s; }
    .t-bar .ext.hl { background: #dadce0; }
    .t-bar .ext img { width: 20px; height: 20px; }
    .t-bar .dots { display: flex; gap: 8px; } .t-bar .dots i { width: 12px; height: 12px; border-radius: 50%; background: #dadce0; }
    .t-tip { position: absolute; padding: 6px 10px; border-radius: 6px; background: #3c4043; color: #fff; font: 12.5px system-ui, sans-serif; white-space: nowrap; direction: rtl; }
  `;
  const CURSOR = `<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2.5 L4 19.5 L8.6 15.4 L11.6 22 L14.6 20.7 L11.7 14.2 L18 14.2 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  const ICON = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="22" height="22" x="1" y="1" rx="6.5" fill="#18181b"/><g fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round"><path d="M6.5 9.5h6.5M6.5 14.5h4"/><path d="M17 6.5v11"/></g></svg>`);

  let root = null;
  const els = {};
  const pos = { x: -100, y: -100 };
  let mode = 'video';

  function ensure() {
    if (root?.isConnected) return root;
    if (!document.documentElement) return null;
    root = document.createElement('div');
    root.id = '__tour';
    root.className = mode;
    const style = document.createElement('style');
    style.textContent = CSS;
    root.appendChild(style);
    const make = (cls, html = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; root.appendChild(d); return d; };
    els.spot = make('t-spot');
    els.bar = make('t-bar', `<div class="dots"><i></i><i></i><i></i></div><div class="url">lomda.example<b>/register</b></div><div class="ext"><img src="${ICON}"></div>`);
    els.menu = make('t-menu');
    els.menu.style.display = 'none';
    els.tip = make('t-tip');
    els.tip.style.display = 'none';
    els.card = make('t-card');
    els.cap = make('t-cap');
    els.cur = make('t-cur', CURSOR);
    document.documentElement.appendChild(root);
    setCursor(pos.x, pos.y);
    return root;
  }

  function setCursor(x, y) {
    pos.x = x; pos.y = y;
    if (els.cur) els.cur.style.transform = `translate(${x - 4}px, ${y - 2}px)`;
  }

  window.addEventListener('mousemove', e => { ensure(); setCursor(e.clientX, e.clientY); }, true);
  window.addEventListener('mousedown', e => { if (e.isTrusted) ripple(e.clientX, e.clientY); }, true);

  function ripple(x, y) {
    if (!ensure()) return;
    const r = document.createElement('div');
    r.className = 't-rip';
    r.style.left = `${x}px`; r.style.top = `${y}px`;
    root.appendChild(r);
    setTimeout(() => r.remove(), 700);
  }

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rich = s => esc(s).replace(/\[\[(.+?)\]\]/g, '<kbd>$1</kbd>');

  window.__tour = {
    setMode(m) { mode = m; ensure(); root.className = m; },
    cursor(x, y) { ensure(); setCursor(x, y); },
    ripple,
    caption(label, num, text) {
      ensure();
      els.cap.innerHTML = `<small><b>${esc(num)}</b>${esc(label)}</small><div>${rich(text)}</div>`;
      els.cap.classList.add('on');
    },
    hideCaption() { ensure(); els.cap.classList.remove('on'); },
    // 'top' keeps the caption clear of UI that lives at the bottom center (the manager's toast).
    captionAt(where) { ensure(); els.cap.classList.toggle('top', where === 'top'); },
    card({ num = '', title, sub = '', chips = [], logo = false, dark = false }) {
      ensure();
      els.card.className = `t-card${dark ? ' dark' : ''}`;
      els.card.innerHTML = `${logo ? `<img class="logo" src="${ICON}">` : ''}${num ? `<div class="num">${esc(num)}</div>` : ''}<h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}${chips.length ? `<div class="chips">${chips.map(c => `<span>${esc(c)}</span>`).join('')}</div>` : ''}`;
      requestAnimationFrame(() => els.card.classList.add('on'));
    },
    hideCard() { ensure(); els.card.classList.remove('on'); },
    spot(r, pad = 6) {
      ensure();
      if (!r) { els.spot.classList.remove('on'); return; }
      Object.assign(els.spot.style, { left: `${r.x - pad}px`, top: `${r.y - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
      els.spot.classList.add('on');
    },
    contextMenu(x, y, highlight = false) {
      ensure();
      if (x == null) { els.menu.style.display = 'none'; return; }
      els.menu.innerHTML = `<div class="dim">ביטול<span>Ctrl+Z</span></div><hr><div class="dim">גזירה<span>Ctrl+X</span></div><div class="dim">העתקה<span>Ctrl+C</span></div><div>הדבקה<span>Ctrl+V</span></div><div>בחירת הכל<span>Ctrl+A</span></div><hr><div class="${highlight ? 'hl' : ''}"><img src="${ICON}">AutoFill: הגדר אפשרויות לשדה זה</div><hr><div>בדיקה</div>`;
      Object.assign(els.menu.style, { display: 'block', left: `${x - 300}px`, top: `${y}px` });
    },
    menuItemPoint() {
      const items = els.menu.querySelectorAll('div');
      const r = items[5].getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    },
    toolbar(on, highlight = false) {
      ensure();
      els.bar.classList.toggle('on', !!on);
      els.bar.querySelector('.ext').classList.toggle('hl', !!highlight);
      if (on && highlight) {
        const r = els.bar.querySelector('.ext').getBoundingClientRect();
        Object.assign(els.tip.style, { display: 'block', left: `${r.right - 40}px`, top: `${r.bottom + 8}px` });
        els.tip.textContent = 'AutoFill · ניהול';
      } else els.tip.style.display = 'none';
    },
    extPoint() {
      const r = els.bar.querySelector('.ext').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    },
  };
  if (document.documentElement) ensure();
  else document.addEventListener('readystatechange', ensure, { once: true });
})();
