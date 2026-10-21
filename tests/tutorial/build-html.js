// Builds the self-contained HTML tutorial player from the keyframes produced by
//   node tests/tutorial/record.js frames <framesDir>
// Usage: node tests/tutorial/build-html.js <framesDir> <out.html>
// Everything (keyframes, Rubik font, logo) is inlined, so the HTML works offline as a single file.
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(process.argv[2]);
const OUT = path.resolve(process.argv[3] || 'autofill-tutorial.html');
const REPO = path.resolve(__dirname, '..', '..');

const steps = JSON.parse(fs.readFileSync(path.join(SRC, 'steps.json'), 'utf8')).map(s => (s.type === 'shot'
  ? { ...s, img: `data:image/jpeg;base64,${fs.readFileSync(path.join(SRC, 'frames', s.img)).toString('base64')}` }
  : s));
const font = f => fs.readFileSync(path.join(REPO, 'manager', 'fonts', f)).toString('base64');
const logo = fs.readFileSync(path.join(REPO, 'icons', 'logo.svg'), 'utf8')
  .replace(/width="512" height="512"/, 'width="100%" height="100%"');

const html = `<!doctype html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>AutoFill · מדריך שימוש</title>
<style>
@font-face { font-family: 'Rubik'; font-weight: 300 900; src: url(data:font/woff2;base64,${font('rubik-hebrew.woff2')}) format('woff2-variations'); unicode-range: U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F; }
@font-face { font-family: 'Rubik'; font-weight: 300 900; src: url(data:font/woff2;base64,${font('rubik-latin.woff2')}) format('woff2-variations'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+2000-206F, U+20AC, U+2190-2193; }
:root {
  --bg: #fafafa; --surface: #fff; --surface-2: #f4f4f5; --line: #e9e9ec; --line-strong: #dcdce0;
  --text: #18181b; --muted: #71717a; --subtle: #a1a1aa; --accent: #18181b; --accent-fg: #fff;
  --ring: rgba(24,24,27,.12); --chrome: #ececee; --shadow: 0 1px 2px rgba(0,0,0,.04), 0 24px 60px -24px rgba(0,0,0,.25);
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #0c0c0e; --surface: #141417; --surface-2: #1c1c20; --line: #232328; --line-strong: #2f2f35;
    --text: #fafafa; --muted: #a1a1aa; --subtle: #6b6b74; --accent: #fafafa; --accent-fg: #0c0c0e;
    --ring: rgba(250,250,250,.14); --chrome: #1c1c20; --shadow: 0 1px 2px rgba(0,0,0,.4), 0 24px 60px -24px rgba(0,0,0,.8); }
}
* { box-sizing: border-box; }
html, body { margin: 0; }
body { background: var(--bg); color: var(--text); font: 400 15px/1.5 'Rubik', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
button { font: inherit; color: inherit; }
:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }
.wrap { max-width: 1320px; margin: 0 auto; padding: 28px 28px 48px; }
header { display: flex; align-items: center; gap: 12px; margin-bottom: 22px; }
header .logo { width: 30px; height: 30px; }
header h1 { margin: 0; font-size: 19px; font-weight: 600; letter-spacing: -.01em; }
header p { margin: 0 0 0 0; margin-inline-start: auto; color: var(--muted); font-size: 13.5px; }
.layout { display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 28px; align-items: start; }
.layout > * { min-width: 0; }

/* chapters */
.chapters { position: sticky; top: 24px; display: flex; flex-direction: column; gap: 2px; }
.chapters .title { padding: 0 10px 8px; font-size: 12px; font-weight: 500; color: var(--subtle); }
.chapter { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border: none; border-radius: 9px;
  background: transparent; color: var(--muted); text-align: start; cursor: pointer; transition: background .12s, color .12s; }
.chapter:hover { background: var(--surface-2); color: var(--text); }
.chapter.active { background: var(--surface-2); color: var(--text); font-weight: 500; }
.chapter .n { flex-shrink: 0; display: grid; place-items: center; width: 22px; height: 22px; border-radius: 7px;
  border: 1px solid var(--line-strong); font: 500 11.5px ui-monospace, 'SF Mono', Consolas, monospace; color: var(--muted); }
.chapter.active .n { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
.chapter.done .n { color: var(--text); }

/* stage */
.window { border: 1px solid var(--line); border-radius: 14px; overflow: hidden; background: var(--surface); box-shadow: var(--shadow); }
.bar { display: flex; align-items: center; gap: 12px; height: 42px; padding: 0 14px; background: var(--chrome); border-bottom: 1px solid var(--line); direction: ltr; }
.dots { display: flex; gap: 7px; } .dots i { width: 11px; height: 11px; border-radius: 50%; background: var(--line-strong); }
.url { flex: 1; max-width: 560px; height: 28px; display: flex; align-items: center; gap: 8px; padding: 0 14px; border-radius: 14px;
  background: var(--surface); color: var(--muted); font-size: 13px; }
.url svg { width: 14px; height: 14px; }
.url b { color: var(--text); font-weight: 500; }
.screen { position: relative; aspect-ratio: 1280 / 800; overflow: hidden; background: var(--surface-2); }
.screen img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity .35s ease; }
.screen img.on { opacity: 1; }
.cursor { position: absolute; top: 0; left: 0; width: 2.1%; min-width: 16px; z-index: 3; pointer-events: none;
  transition: left .7s cubic-bezier(.65,0,.35,1), top .7s cubic-bezier(.65,0,.35,1), opacity .25s; filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
.cursor svg { display: block; width: 100%; height: auto; margin: -8% 0 0 -16%; }
.ripple { position: absolute; z-index: 2; width: 3.4%; aspect-ratio: 1; border-radius: 50%; translate: -50% -50%;
  border: 2px solid rgba(24,24,27,.55); background: rgba(24,24,27,.12); animation: rip .6s ease-out forwards; pointer-events: none; }
@keyframes rip { from { scale: .3; opacity: 1; } to { scale: 1.5; opacity: 0; } }
.card { position: absolute; inset: 0; z-index: 4; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.6%;
  padding: 0 8%; text-align: center; background: var(--surface); opacity: 0; transition: opacity .4s; pointer-events: none; }
.card.on { opacity: 1; }
.card .lg { width: 7%; aspect-ratio: 1; margin-bottom: .5%; }
.card .num { font: 500 clamp(10px, 1.1vw, 13px) ui-monospace, 'SF Mono', Consolas, monospace; letter-spacing: .08em; color: var(--subtle); }
.card h2 { margin: 0; font-size: clamp(22px, 3.6vw, 44px); font-weight: 650; letter-spacing: -.02em; }
.card p { margin: 0; font-size: clamp(13px, 1.6vw, 19px); color: var(--muted); max-width: 640px; }
.card .chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 1%; max-width: 760px; }
.card .chips span { padding: 5px 13px; border: 1px solid var(--line-strong); border-radius: 999px; font-size: clamp(11px, 1.2vw, 14px); color: var(--muted); }

/* caption + controls */
.caption { min-height: 92px; margin-top: 18px; padding: 16px 20px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
.caption small { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-size: 12.5px; color: var(--subtle); }
.caption small b { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 6px; background: var(--accent); color: var(--accent-fg); font-size: 11.5px; font-weight: 600; }
.caption .text { font-size: 17.5px; line-height: 1.55; animation: fade .35s ease; }
@keyframes fade { from { opacity: 0; transform: translateY(3px); } }
kbd { font: 500 13.5px ui-monospace, 'SF Mono', Consolas, monospace; padding: 1px 7px; border-radius: 6px; background: var(--surface-2); border: 1px solid var(--line-strong); }
.controls { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
.btn { display: inline-grid; place-items: center; width: 38px; height: 38px; border-radius: 10px; border: 1px solid var(--line-strong);
  background: var(--surface); cursor: pointer; transition: background .12s; }
.btn:hover { background: var(--surface-2); }
.btn.play { width: 46px; height: 46px; border: none; background: var(--accent); color: var(--accent-fg); border-radius: 12px; }
.btn.play:hover { opacity: .88; background: var(--accent); }
.btn svg { width: 18px; height: 18px; }
.track { flex: 1; min-width: 0; display: flex; gap: 3px; height: 30px; align-items: center; cursor: pointer; direction: rtl; }
.seg { flex: 1; min-width: 0; height: 4px; border-radius: 2px; background: var(--line-strong); overflow: hidden; position: relative; transition: height .12s; }
.track:hover .seg { height: 6px; }
.seg.gap { margin-inline-start: 6px; }
.seg i { position: absolute; inset: 0; right: 0; width: 0; background: var(--accent); }
.seg.done i { width: 100%; }
.counter { min-width: 64px; text-align: left; font: 12.5px ui-monospace, 'SF Mono', Consolas, monospace; color: var(--muted); direction: ltr; }
.hint { margin-top: 10px; font-size: 12.5px; color: var(--subtle); }
@media (max-width: 980px) {
  .layout { grid-template-columns: 1fr; }
  .chapters { position: static; flex-direction: row; overflow-x: auto; order: 2; }
  .chapters .title { display: none; }
  .chapter { width: auto; flex-shrink: 0; }
  .wrap { padding: 16px 16px 40px; }
  .hint, header p { display: none; }
  .track { gap: 1px; }
  .seg.gap { margin-inline-start: 3px; }
  .counter { min-width: 0; }
  .caption .text { font-size: 15.5px; }
  .controls { gap: 6px; }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
</style>
</head>
<body>
<div class="wrap">
  <header><span class="logo">${logo}</span><h1>AutoFill · מדריך שימוש</h1><p>מדריך אינטראקטיבי · 7 פרקים</p></header>
  <div class="layout">
    <nav class="chapters" id="chapters" aria-label="פרקים"><div class="title">פרקים</div></nav>
    <main>
      <div class="window">
        <div class="bar"><div class="dots"><i></i><i></i><i></i></div><div class="url" id="url"></div></div>
        <div class="screen" id="screen">
          <img id="imgA" alt=""><img id="imgB" alt="">
          <div class="cursor" id="cursor"><svg viewBox="0 0 24 24"><path d="M4 2.5 L4 19.5 L8.6 15.4 L11.6 22 L14.6 20.7 L11.7 14.2 L18 14.2 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg></div>
          <div class="card" id="card"></div>
        </div>
      </div>
      <div class="caption" aria-live="polite"><small id="capLabel"></small><div class="text" id="capText"></div></div>
      <div class="controls">
        <button class="btn" id="prev" title="הקודם" aria-label="הקודם"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
        <button class="btn play" id="play" title="ניגון / השהיה" aria-label="ניגון / השהיה"></button>
        <button class="btn" id="next" title="הבא" aria-label="הבא"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
        <div class="track" id="track"></div>
        <div class="counter" id="counter"></div>
      </div>
      <div class="hint">מקשים: <kbd>רווח</kbd> ניגון/השהיה · <kbd>←</kbd> הבא · <kbd>→</kbd> הקודם · לחיצה על הפס קופצת לשלב</div>
    </main>
  </div>
</div>
<script>
const STEPS = ${JSON.stringify(steps)};
const LOGO = ${JSON.stringify(logo)};
const W = 1280, H = 800;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rich = s => esc(s).replace(/\\[\\[(.+?)\\]\\]/g, '<kbd>$1</kbd>');
const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 5.5v13a1 1 0 0 1-1.5.86l-10.4-6.5a1 1 0 0 1 0-1.72l10.4-6.5A1 1 0 0 1 17 5.5z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
const ICON_LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const ICON_PUZZLE = '<span style="display:inline-block;width:14px;height:14px">' + LOGO + '</span>';

// Chapters: a card with a "פרק N" num starts one.
const chapters = [];
STEPS.forEach((s, i) => {
  if (s.type === 'card' && /פרק/.test(s.num || '')) chapters.push({ start: i, title: s.title, n: chapters.length + 1 });
  s.chapterIdx = chapters.length - 1;
});
const dur = s => s.type === 'card' ? (s.logo ? 4200 : 3000) : Math.min(7200, 2300 + (s.caption || '').length * 50);

let idx = -1, playing = false, timer = 0, startedAt = 0, remaining = 0, front = $('imgA'), back = $('imgB'), lastShot = null;

const nav = $('chapters');
chapters.forEach((c, k) => {
  const b = document.createElement('button');
  b.className = 'chapter';
  b.innerHTML = '<span class="n">' + c.n + '</span><span>' + esc(c.title) + '</span>';
  b.addEventListener('click', () => go(c.start, true));
  nav.appendChild(b);
});
const track = $('track');
STEPS.forEach((s, i) => {
  const seg = document.createElement('div');
  seg.className = 'seg' + (i > 0 && s.type === 'card' ? ' gap' : '');
  seg.appendChild(document.createElement('i'));
  seg.addEventListener('click', e => { e.stopPropagation(); go(i, true); });
  track.appendChild(seg);
});

function setUrl(s) {
  $('url').innerHTML = s.url === 'manager'
    ? ICON_PUZZLE + '<b>AutoFill</b>&nbsp;· ניהול'
    : ICON_LOCK + '<b>lomda.example</b>/register';
}

function place(el, x, y) { el.style.left = (x / W * 100) + '%'; el.style.top = (y / H * 100) + '%'; }
function ripple(p) {
  const r = document.createElement('div');
  r.className = 'ripple';
  place(r, p.x, p.y);
  $('screen').appendChild(r);
  setTimeout(() => r.remove(), 700);
}
function showImg(src) {
  back.src = src;
  back.classList.add('on');
  front.classList.remove('on');
  [front, back] = [back, front];
}

function render(i, jumped) {
  const s = STEPS[i];
  const card = $('card');
  const cursor = $('cursor');
  if (s.type === 'card') {
    card.innerHTML = (s.logo ? '<div class="lg">' + LOGO + '</div>' : '') + (s.num ? '<div class="num">' + esc(s.num) + '</div>' : '') +
      '<h2>' + esc(s.title) + '</h2>' + (s.sub ? '<p>' + esc(s.sub) + '</p>' : '') +
      (s.chips && s.chips.length ? '<div class="chips">' + s.chips.map(c => '<span>' + esc(c) + '</span>').join('') + '</div>' : '');
    card.classList.add('on');
    cursor.style.opacity = 0;
    $('capLabel').innerHTML = s.num ? '<b>' + esc(s.num.match(/\\d+/)?.[0] || '') + '</b>' + esc(s.title) : '';
    $('capText').innerHTML = esc(s.sub || '');
  } else {
    card.classList.remove('on');
    cursor.style.opacity = 1;
    setUrl(s);
    $('capLabel').innerHTML = '<b>' + esc(s.chapter) + '</b>' + esc(s.chapterTitle);
    $('capText').innerHTML = rich(s.caption);
    const moved = lastShot && (Math.abs(lastShot.x - s.x) + Math.abs(lastShot.y - s.y) > 4);
    if (jumped || !lastShot) {
      cursor.style.transition = 'none';
      place(cursor, s.x, s.y);
      cursor.offsetWidth;
      cursor.style.transition = '';
      showImg(s.img);
    } else {
      place(cursor, s.x, s.y);
      const delay = moved ? 720 : 0;
      setTimeout(() => {
        if (STEPS[idx] !== s) return;
        if (s.click) ripple(s.click);
        setTimeout(() => { if (STEPS[idx] === s) showImg(s.img); }, s.click ? 160 : 0);
      }, delay);
    }
    lastShot = s;
  }
  $('capText').style.animation = 'none'; $('capText').offsetWidth; $('capText').style.animation = '';
  [...nav.querySelectorAll('.chapter')].forEach((b, k) => {
    b.classList.toggle('active', k === s.chapterIdx);
    b.classList.toggle('done', k < s.chapterIdx);
  });
  [...track.children].forEach((seg, k) => {
    seg.classList.toggle('done', k < i);
    const bar = seg.firstChild;
    bar.style.transition = 'none';
    bar.style.width = k < i ? '100%' : '0';
  });
  $('counter').textContent = (i + 1) + ' / ' + STEPS.length;
}

function go(i, jumped = false) {
  if (i < 0 || i >= STEPS.length) return;
  clearTimeout(timer);
  idx = i;
  render(i, jumped);
  if (playing) schedule(dur(STEPS[i]));
}
function schedule(ms) {
  clearTimeout(timer);
  remaining = ms; startedAt = performance.now();
  const bar = track.children[idx].firstChild;
  bar.style.transition = 'none'; bar.offsetWidth;
  bar.style.transition = 'width ' + ms + 'ms linear';
  bar.style.width = '100%';
  timer = setTimeout(() => { if (idx < STEPS.length - 1) go(idx + 1); else setPlaying(false); }, ms);
}
function setPlaying(p) {
  playing = p;
  $('play').innerHTML = p ? ICON_PAUSE : ICON_PLAY;
  if (p) {
    if (idx >= STEPS.length - 1) go(0, true);
    else schedule(remaining || dur(STEPS[idx]));
  } else {
    clearTimeout(timer);
    remaining = Math.max(400, remaining - (performance.now() - startedAt));
    const bar = track.children[idx]?.firstChild;
    if (bar) { const w = getComputedStyle(bar).width; bar.style.transition = 'none'; bar.style.width = w; }
  }
}
$('play').addEventListener('click', () => setPlaying(!playing));
$('next').addEventListener('click', () => { remaining = 0; go(idx + 1, true); });
$('prev').addEventListener('click', () => { remaining = 0; go(idx - 1, true); });
document.addEventListener('keydown', e => {
  if (e.key === ' ') { e.preventDefault(); setPlaying(!playing); }
  else if (e.key === 'ArrowLeft') { remaining = 0; go(idx + 1, true); }
  else if (e.key === 'ArrowRight') { remaining = 0; go(idx - 1, true); }
});
go(0, true);
setPlaying(true);
</script>
</body>
</html>
`;
fs.writeFileSync(OUT, html);
console.log(`${OUT}  (${(html.length / 1024 / 1024).toFixed(2)} MB, ${steps.length} steps)`);
