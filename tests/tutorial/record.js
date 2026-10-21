// AutoFill tutorial recorder. Drives the REAL unpacked extension in Chromium on a fictional site
// (tests/tutorial/site.html served as http://lomda.example/register) through a scripted walkthrough.
//
//   node tests/tutorial/record.js video  <outDir>   → screencast frames + autofill-tutorial.mp4 (ffmpeg, libx264)
//   node tests/tutorial/record.js frames <outDir>   → keyframe JPEGs + steps.json (input for build-html.js)
//
// Env: PW = path to the playwright package (default: require('playwright')).
// The overlay (cursor, captions, chapter cards, fake context menu / toolbar) is tour-overlay.js.
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { execFileSync } = require('child_process');
const { chromium } = require(process.env.PW || 'playwright');

const MODE = process.argv[2] === 'frames' ? 'frames' : 'video';
const OUT = path.resolve(process.argv[3] || path.join(os.tmpdir(), `af-tutorial-${MODE}`));
const REPO = path.resolve(__dirname, '..', '..');
const PORT = 8766;
const SITE = 'http://lomda.example/register';
const VIEW = { width: 1280, height: 800 };
const VIDEO = MODE === 'video';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── tiny static server: /register → site.html, everything else from the repo (fonts) ──
function serve() {
  const types = { '.html': 'text/html; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    const file = url === '/register' ? path.join(__dirname, 'site.html') : path.join(REPO, path.normalize(url));
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(PORT, '127.0.0.1', () => r(server)));
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
  const server = await serve();

  const ctx = await chromium.launchPersistentContext(path.join(os.tmpdir(), `af-tut-profile-${Date.now()}`), {
    channel: 'chromium', headless: true, viewport: VIEW, deviceScaleFactor: VIDEO ? 1 : 1.25, locale: 'he-IL', colorScheme: 'light',
    args: [`--disable-extensions-except=${REPO}`, `--load-extension=${REPO}`, '--no-proxy-server',
      `--host-resolver-rules=MAP lomda.example 127.0.0.1:${PORT}`, '--hide-scrollbars'],
  });
  await ctx.addInitScript({ path: path.join(__dirname, 'tour-overlay.js') });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  const MANAGER = `chrome-extension://${extId}/manager/manager.html`;
  const page = ctx.pages()[0] || await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  // ── recording ──
  const frameLog = [];
  let cdp = null;
  async function startScreencast() {
    if (!VIDEO) return;
    if (!cdp) {
      cdp = await ctx.newCDPSession(page);
      cdp.on('Page.screencastFrame', f => {
        const name = `f${String(frameLog.length).padStart(6, '0')}.jpg`;
        fs.writeFileSync(path.join(OUT, 'frames', name), Buffer.from(f.data, 'base64'));
        frameLog.push({ name, t: f.metadata.timestamp });
        cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
      });
    }
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 94, everyNthFrame: 1 }).catch(() => {});
  }

  // The headless screencast captures the window's content area, whose size races with the viewport
  // emulation (sometimes 1280×661 instead of 1280×800). Measure real frames and resize the window
  // via CDP until they match the viewport, then drop the calibration frames.
  const jpegHeight = buf => buf.readUInt16BE(buf.indexOf(Buffer.from([0xff, 0xc0])) + 5);
  async function calibrateFrameSize() {
    if (!VIDEO) return;
    let h = 0;
    for (let attempt = 0; attempt < 5; attempt++) {
      const n = frameLog.length;
      for (let k = 0; k < 30 && frameLog.length === n; k++) { await page.mouse.move(600 + (k % 2) * 4, 400); await sleep(80); }
      const last = frameLog[frameLog.length - 1];
      h = jpegHeight(fs.readFileSync(path.join(OUT, 'frames', last.name)));
      if (h === VIEW.height) break;
      const { windowId, bounds } = await cdp.send('Browser.getWindowForTarget');
      await cdp.send('Browser.setWindowBounds', { windowId, bounds: { width: VIEW.width, height: bounds.height + VIEW.height - h } });
      await sleep(600);
    }
    console.log(`screencast frame height: ${h}`);
    frameLog.length = 0;
  }

  // ── tour state + helpers ──
  const cur = { x: 640, y: 420 };
  let chapter = { num: '', title: '' };
  let caption = '';
  let clicked = null;
  const steps = [];
  let shotN = 0;

  const tour = (fn, ...a) => page.evaluate(([fn, a]) => window.__tour?.[fn](...a), [fn, a]).catch(() => {});
  async function afterNav() {
    await page.waitForLoadState('domcontentloaded');
    await sleep(VIDEO ? 500 : 350);
    await tour('setMode', VIDEO ? 'video' : 'frames');
    await tour('cursor', cur.x, cur.y);
    if (VIDEO && caption) await tour('caption', chapter.title, chapter.num, caption);
    await startScreencast();
  }
  async function goto(url) { await page.goto(url); await afterNav(); }

  async function moveTo(x, y, ms = 650) {
    if (!VIDEO) { await page.mouse.move(x, y); cur.x = x; cur.y = y; return; }
    const n = Math.max(10, Math.round(ms / 16));
    const sx = cur.x, sy = cur.y;
    for (let i = 1; i <= n; i++) {
      const t = i / n, e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      await page.mouse.move(sx + (x - sx) * e, sy + (y - sy) * e);
      await sleep(14);
    }
    cur.x = x; cur.y = y;
  }
  async function center(loc) {
    await loc.waitFor({ state: 'visible', timeout: 8000 });
    let b = await loc.boundingBox();
    // Scroll the document (never scrollIntoView: on elements in fixed layers it pans the visual
    // viewport sideways, shifting the whole frame) when the target is hidden or under the caption.
    if (b.y < 56 || b.y + b.height > VIEW.height - 130) {
      await page.evaluate(([dy, smooth]) => window.scrollBy({ top: dy, behavior: smooth ? 'smooth' : 'instant' }),
        [b.y - VIEW.height * 0.4, VIDEO]);
      await sleep(VIDEO ? 700 : 150);
      b = await loc.boundingBox();
    }
    return { x: b.x + b.width / 2, y: b.y + b.height / 2, box: b };
  }
  async function hover(loc) { const c = await center(loc); await moveTo(c.x, c.y); await sleep(VIDEO ? 250 : 80); }
  async function click(loc, opts = {}) {
    const c = await center(loc);
    await moveTo(c.x, c.y);
    if (VIDEO) await sleep(150);
    await page.mouse.click(c.x, c.y, opts);
    clicked = { x: c.x, y: c.y };
    await sleep(VIDEO ? 450 : 250);
  }
  async function type(text, delay = 65) { await page.keyboard.type(text, { delay: VIDEO ? delay : 0 }); await sleep(VIDEO ? 200 : 60); }
  async function key(k) { await page.keyboard.press(k); clicked = null; await sleep(VIDEO ? 450 : 250); }
  async function spot(loc, pad) {
    if (!loc) { await tour('spot', null); return; }
    const { box } = await center(loc);
    await tour('spot', box, pad);
    await sleep(VIDEO ? 350 : 120);
  }

  async function say(text) {
    caption = text;
    if (VIDEO) { await tour('caption', chapter.title, chapter.num, text); await sleep(300); }
  }
  // Hold for reading (video) or capture a keyframe (frames).
  async function shot(hold) {
    const vv = await page.evaluate(() => [visualViewport.offsetLeft, visualViewport.offsetTop, visualViewport.scale]);
    if (vv[0] || vv[1] || vv[2] !== 1) console.warn(`WARNING: visual viewport shifted ${vv} at "${caption.slice(0, 40)}"`);
    if (VIDEO) {
      await sleep(hold ?? Math.min(6500, 1700 + caption.length * 52));
      return;
    }
    await sleep(200);
    const name = `k${String(++shotN).padStart(3, '0')}.jpg`;
    await page.screenshot({ path: path.join(OUT, 'frames', name), type: 'jpeg', quality: 82, scale: 'css' });
    steps.push({ type: 'shot', img: name, caption, chapter: chapter.num, chapterTitle: chapter.title,
      x: cur.x, y: cur.y, click: clicked, url: page.url().startsWith('chrome-extension') ? 'manager' : 'site' });
    clicked = null;
  }
  async function card(opts, hold = 2900) {
    if (VIDEO) {
      await tour('hideCaption');
      await tour('card', opts);
      await sleep(hold);
      await tour('hideCard');
      await sleep(550);
    } else {
      steps.push({ type: 'card', ...opts });
    }
  }
  async function chapterCard(num, title, sub) {
    chapter = { num, title };
    caption = '';
    await card({ num: `פרק ${num} מתוך 7`, title, sub });
  }

  async function openConfigViaContextMenu(loc) {
    const c = await center(loc);
    await moveTo(c.x, c.y);
    await page.mouse.click(c.x, c.y, { button: 'right' });
    clicked = { x: c.x, y: c.y };
    await sleep(200);
    await tour('contextMenu', c.x + 10, c.y + 6);
    await shot(1200);
    const p = await page.evaluate(() => window.__tour.menuItemPoint());
    await moveTo(p.x, p.y, 550);
    await tour('contextMenu', c.x + 10, c.y + 6, true);
    await shot(700);
    await tour('ripple', p.x, p.y);
    clicked = { x: p.x, y: p.y };
    await sleep(VIDEO ? 250 : 0);
    await tour('contextMenu', null);
    await sw.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      await chrome.tabs.sendMessage(tab.id, { action: 'open-config' }, { frameId: 0 });
    });
    await page.locator('.af-pop').waitFor();
    await sleep(VIDEO ? 500 : 300);
  }

  const pop = sel => page.locator(`.af-pop ${sel}`);
  const popInput = i => page.locator('.af-pop .af-body > input').nth(i);
  const dropItem = i => page.locator('.af-drop .af-item').nth(i);

  // ── seed: a few entries saved earlier (incl. other sites, for a realistic manager) ──
  const now = Date.now();
  await sw.evaluate(now => chrome.storage.local.set({
    af_entries: [
      { id: 'e_seed1', selector: '#full-name', fieldLabel: 'שם מלא', name: '', value: 'דנה לוי', matchType: 'global', matchValue: '', enabled: true, created: now },
      { id: 'e_seed2', selector: '#phone', fieldLabel: 'טלפון נייד', name: 'נייד', value: '050-1234567', matchType: 'global', matchValue: '', enabled: true, created: now },
      { id: 'e_seed3', selector: '#phone', fieldLabel: 'טלפון נייד', name: 'עבודה', value: '03-7654321', matchType: 'global', matchValue: '', enabled: true, created: now },
      { id: 'e_seed4', selector: '#tz', fieldLabel: 'תעודת זהות', name: '', value: '123456782', matchType: 'global', matchValue: '', enabled: true, created: now },
      { id: 'e_seed5', selector: '#city', fieldLabel: 'עיר מגורים', name: '', value: 'תל אביב', matchType: 'global', matchValue: '', enabled: true, created: now },
      { id: 'e_seed6', selector: "input[name='address']", fieldLabel: 'כתובת למשלוח', name: 'בית', value: 'רחוב הרצל 10, תל אביב', matchType: 'domain', matchValue: 'shop.example', enabled: true, created: now },
      { id: 'e_seed7', selector: '#coupon', fieldLabel: 'קוד קופון', name: 'מועדון', value: 'NOVA20', matchType: 'domain', matchValue: 'shop.example', enabled: true, created: now },
      { id: 'e_seed8', selector: "input[name='company']", fieldLabel: 'חברה', name: '', value: 'סטודיו נובה', matchType: 'url-contains', matchValue: '/careers', enabled: true, created: now },
    ],
    af_snippets: [],
  }), now);

  await goto(SITE);
  await calibrateFrameSize();
  await page.mouse.move(cur.x, cur.y);

  // ── intro ──
  await card({ logo: true, title: 'AutoFill · מדריך שימוש', sub: 'ממלאים טפסים בכל אתר בלחיצה אחת. כל מה שצריך לדעת, בכמה דקות.',
    chips: ['הוספת מילוי', 'עוד ערך לשדה', 'מילוי בלחיצה', 'עריכה מתוך הדף', 'מסך הניהול', 'קיצורי טקסט', 'גיבוי ומצב כהה'] }, 4200);

  // ── 1. add a value to a field ──
  await chapterCard('1', 'הוספת מילוי לשדה', 'שומרים ערך פעם אחת, והוא מוצע בכל פעם שנכנסים לשדה.');
  await say('זה טופס הרשמה רגיל באתר כלשהו. נשמור את כתובת האימייל שלנו לשדה הזה.');
  await spot(page.locator('#email'));
  await shot();
  await spot(null);
  await say('לוחצים קליק ימני על השדה ובוחרים «AutoFill: הגדר אפשרויות לשדה זה».');
  await openConfigViaContextMenu(page.locator('#email'));
  await say('נפתח חלון קטן ליד השדה. שם השדה («אימייל») זוהה אוטומטית מהדף.');
  await shot();
  await say('מקלידים את הערך, ואם רוצים גם שם קצר שיעזור לזהות אותו ברשימה.');
  await type('dana.levi@gmail.com');
  await click(popInput(1));
  await type('אישי');
  await shot(1500);
  await say('«יופיע ב» קובע איפה ההצעה תופיע: ברירת המחדל היא רק באתר הזה. לאימייל אישי נבחר «כל האתרים».');
  await spot(pop('select'), 4);
  await hover(pop('select'));
  // The native <select> popup is not rendered in headless captures, so the value is set directly.
  await page.locator('.af-pop select').selectOption('global');
  clicked = { ...cur };
  await shot();
  await spot(null);
  await say('לוחצים «שמירה». זהו, הערך שמור.');
  await click(pop('.af-btn.primary'));
  await shot(1600);

  // ── 2. a second value for the same field ──
  await chapterCard('2', 'עוד ערך לאותו שדה', 'לשדה אחד אפשר לשמור כמה ערכים, למשל אימייל אישי ואימייל עבודה.');
  await say('נכנסים לשדה, וההצעה כבר כאן. כדי להוסיף ערך נוסף לוחצים «מילוי חדש» בתחתית הרשימה.');
  await click(page.locator('#email'));
  await shot();
  await click(page.locator('.af-drop .af-add'));
  await say('אותו חלון נפתח. הפעם נשאיר את ברירת המחדל: רק באתר lomda.example.');
  await type('dana@studio-nova.co.il');
  await click(popInput(1));
  await type('עבודה');
  await spot(pop('select'), 4);
  await shot();
  await spot(null);
  await click(pop('.af-btn.primary'));
  await sleep(VIDEO ? 300 : 100);

  // ── 3. filling ──
  await chapterCard('3', 'מילוי בלחיצה', 'נכנסים לשדה, ובוחרים מהרשימה בעכבר או במקלדת.');
  await goto(SITE);
  await say('נכנסים לשדה «שם מלא». ההצעה הראשונה כבר מסומנת, אז מספיק ללחוץ [[Enter]].');
  await click(page.locator('#full-name'));
  await shot();
  await key('Enter');
  await say('באימייל יש שתי הצעות. החיצים [[↓]] [[↑]] עוברים ביניהן, ו-[[Enter]] ממלא.');
  await click(page.locator('#email'));
  await shot(1800);
  await key('ArrowDown');
  await shot(1600);
  await key('Enter');
  await say('אפשר גם פשוט ללחוץ על ההצעה בעכבר.');
  await click(page.locator('#phone'));
  await hover(dropItem(0));
  await shot(1700);
  await click(dropItem(0));
  await click(page.locator('#tz'));
  await key('Enter');
  await click(page.locator('#city'));
  await key('Enter');
  await moveTo(900, 560);
  await say('כל הטופס התמלא בכמה שניות.');
  await shot();

  // ── 4. edit from the page ──
  await chapterCard('4', 'עריכה מתוך הדף', 'רואים ומשנים את הערכים השמורים לשדה בלי לצאת מהאתר.');
  await say('בחלון של השדה לוחצים «שמורים לשדה», ומקבלים את כל הערכים שנשמרו לו.');
  await openConfigViaContextMenu(page.locator('#email'));
  await spot(pop('.af-foot .af-btn.ghost'), 4);
  await shot(1800);
  await spot(null);
  await click(pop('.af-foot .af-btn.ghost'));
  await shot();
  await say('המתג מכבה ומדליק ערך. עיפרון עורך אותו במקום.');
  await click(page.locator('.af-pop .af-row').nth(0).locator('[aria-label="עריכה"]'));
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Control+A');
  await type('פרטי');
  await shot();
  await key('Enter');
  await say('מחיקה נעשית בשתי לחיצות, כדי שלא יימחק משהו בטעות.');
  await click(page.locator('.af-pop .af-row').nth(1).locator('[aria-label="מחיקה"]'));
  await shot();
  await sleep(VIDEO ? 2800 : 3200);
  await say('[[Esc]] חוזר אחורה וסוגר את החלון.');
  await key('Escape');
  await key('Escape');
  await shot(1600);

  // ── 5. the manager ──
  await chapterCard('5', 'מסך הניהול', 'כל המילויים והקיצורים במקום אחד.');
  await say('לחיצה על אייקון AutoFill בסרגל הדפדפן פותחת את מסך הניהול.');
  await tour('toolbar', true);
  await sleep(VIDEO ? 500 : 200);
  const ext = await page.evaluate(() => window.__tour.extPoint());
  await moveTo(ext.x, ext.y, 800);
  await tour('toolbar', true, true);
  await shot(1800);
  await tour('ripple', ext.x, ext.y);
  await sleep(VIDEO ? 300 : 0);
  await goto(`${MANAGER}#url=${encodeURIComponent(SITE)}`);
  await say('המסך נפתח מסונן לאתר שבו היית: רק מה שחל על lomda.example.');
  await spot(page.locator('.site-item.active'), 2);
  await shot();
  await spot(null);
  await say('ברשימה «סינון לפי אתר» בוחרים «הכל» או אתר מסוים. ליד כל אחד מוצג מספר הערכים שלו.');
  await click(page.locator('.site-item').first());
  await shot();
  await say('בריחוף על שורה מופיעות הפעולות: העתקת הערך, עריכה ומחיקה.');
  const row = page.locator('.entry', { hasText: '050-1234567' });
  await hover(row.locator('.entry-info'));
  await click(row.locator('[aria-label="העתקת הערך"]'));
  await shot();
  await say('עריכה נעשית בתוך השורה: ערך, שם, ואיפה הוא יופיע.');
  await click(row.locator('[aria-label="עריכה"]'));
  await shot();
  await key('Escape');
  await say('חיפוש מוצא לפי שם, ערך, שדה או אתר.');
  await click(page.locator('#af-search'));
  await type('shop', 110);
  await shot();
  await page.locator('#af-search').fill('');
  await tour('captionAt', 'top');
  await say('מחקתם בטעות? למטה מופיעה הודעה עם «ביטול» שמחזירה את הערך.');
  const coupon = page.locator('.entry', { hasText: 'NOVA20' });
  await hover(coupon.locator('.entry-info'));
  await click(coupon.locator('[aria-label="מחיקה"]'));
  await shot(1800);
  await click(page.locator('.toast button'));
  await shot(1400);
  await tour('captionAt', 'bottom');

  // ── 6. snippets ──
  await chapterCard('6', 'קיצורי טקסט', 'מילה קצרה שמתרחבת לטקסט מלא, בכל שדה ובכל אתר.');
  await say('בסרגל הצד עוברים ל«קיצורי טקסט» ומוסיפים קיצור: למשל @TZ למספר הזהות.');
  await click(page.locator('.nav-item[data-view=snippets]'));
  await click(page.locator('#af-snip-trigger'));
  await type('@TZ');
  await click(page.locator('#af-snip-value'));
  await type('123456782');
  await shot(1500);
  await key('Enter');
  await type('@ADDR');
  await click(page.locator('#af-snip-value'));
  await type('רחוב הרצל 10, תל אביב', 45);
  await key('Enter');
  await type('@SIG');
  await click(page.locator('#af-snip-value'));
  await type('בברכה, דנה לוי', 45);
  await key('Enter');
  await moveTo(700, 520);
  await shot();
  await goto(SITE);
  await say('עכשיו, בכל שדה, מקלידים את תחילת הקיצור, וההצעה מופיעה מיד. החלק שהוקלד מודגש.');
  await click(page.locator('#notes'));
  await type('מספר זהות: @T', 110);
  await shot();
  await say('[[Enter]] מחליף רק את הקיצור בטקסט המלא, ושאר מה שכתבתם נשאר.');
  await key('Enter');
  await type(' · @SI', 110);
  await shot(1600);
  await key('Enter');
  await moveTo(900, 600);
  await shot(2200);

  // ── 7. backup + dark mode ──
  await chapterCard('7', 'גיבוי ומצב כהה', 'שומרים עותק של הכל, והממשק מתאים את עצמו לתאורה.');
  await goto(MANAGER);
  await say('בלשונית «גיבוי» מייצאים את כל המילויים והקיצורים לקובץ, ומייבאים אותו במחשב אחר. הייבוא לא מוחק כלום.');
  await click(page.locator('.nav-item[data-view=backup]'));
  await spot(page.locator('.backup-grid'), 8);
  await shot();
  await spot(null);
  await say('כשהמחשב במצב כהה, כל המסכים עוברים למצב כהה אוטומטית.');
  await page.emulateMedia({ colorScheme: 'dark' });
  await click(page.locator('.nav-item[data-view=entries]'));
  await shot();
  await goto(SITE);
  await page.emulateMedia({ colorScheme: 'dark' });
  await say('גם רשימת ההצעות בתוך האתרים.');
  await click(page.locator('#email'));
  await shot();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.keyboard.press('Escape');

  // ── outro ──
  chapter = { num: '', title: '' };
  await card({ logo: true, title: 'זהו, אפשר להתחיל', sub: 'ארבעה דברים שכדאי לזכור:',
    chips: ['קליק ימני על שדה ← הוספת מילוי', 'Enter ממלא את ההצעה הראשונה', 'קיצור + Enter בכל שדה', 'אייקון התוסף ← מסך הניהול'] }, 4500);

  // ── output ──
  if (VIDEO) {
    await cdp.send('Page.stopScreencast').catch(() => {});
    await sleep(300);
    const list = frameLog.map((f, i) => {
      const next = frameLog[i + 1];
      const d = next ? Math.max(0.001, next.t - f.t) : 1.5;
      return `file 'frames/${f.name}'\nduration ${d.toFixed(4)}`;
    }).join('\n') + `\nfile 'frames/${frameLog[frameLog.length - 1].name}'\n`;
    fs.writeFileSync(path.join(OUT, 'list.txt'), list);
    const mp4 = path.join(OUT, 'autofill-tutorial.mp4');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'list.txt',
      '-vf', `scale=${VIEW.width}:${VIEW.height},fps=30,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-tune', 'stillimage',
      '-movflags', '+faststart', mp4], { cwd: OUT });
    const h = jpegHeight(fs.readFileSync(path.join(OUT, 'frames', frameLog[Math.floor(frameLog.length / 2)].name)));
    if (h !== VIEW.height) console.warn(`WARNING: screencast frames are ${h}px tall, expected ${VIEW.height}`);
    console.log(`frames: ${frameLog.length}  →  ${mp4}`);
  } else {
    fs.writeFileSync(path.join(OUT, 'steps.json'), JSON.stringify(steps, null, 1));
    console.log(`keyframes: ${steps.filter(s => s.type === 'shot').length}, cards: ${steps.filter(s => s.type === 'card').length}  →  ${OUT}`);
  }
  if (errors.length) console.log('page errors:\n' + errors.join('\n'));
  await ctx.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
