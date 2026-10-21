// UI smoke test for the v1.5 redesign: loads the unpacked extension in Chromium (light + dark),
// seeds storage, drives the dropdown / snippet / add-entry popover / manager, checks results and
// writes screenshots. See docs/REDESIGN-v1.5.md §7.
//
// Usage (needs Playwright + Chromium; serves tests/fixture.html on :8765):
//   python3 -m http.server 8765 --directory tests &
//   PW=$(npm root -g)/playwright node tests/ui-smoke.js /tmp/af-shots
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PW || 'playwright');
const OUT = process.argv[2] || path.join(require('os').tmpdir(), 'af-shots');
const EXT = path.resolve(__dirname, '..');
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const errors = [];
  for (const scheme of ['light', 'dark']) {
    const ctx = await chromium.launchPersistentContext(path.join(require('os').tmpdir(), `af-profile-${scheme}-${Date.now()}`), {
      headless: true, channel: 'chromium', colorScheme: scheme, viewport: { width: 1280, height: 820 }, locale: 'he-IL',
      args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
    });
    let [sw] = ctx.serviceWorkers();
    if (!sw) sw = await ctx.waitForEvent('serviceworker');
    const id = sw.url().split('/')[2];
    const now = Date.now();
    await sw.evaluate(({ now }) => chrome.storage.local.set({
      af_entries: [
        { id: 'e1', selector: '#email', fieldLabel: 'אימייל', name: 'אישי', value: 'avi@gmail.com', matchType: 'global', matchValue: '', enabled: true, created: now },
        { id: 'e2', selector: '#email', fieldLabel: 'אימייל', name: 'עבודה', value: 'avi@company.co.il', matchType: 'domain', matchValue: 'localhost', enabled: true, created: now },
        { id: 'e3', selector: '#email', fieldLabel: 'אימייל', name: '', value: 'old@mail.com', matchType: 'domain', matchValue: 'gov.il', enabled: false, created: now },
        { id: 'e4', selector: '#tz', fieldLabel: 'תעודת זהות', name: 'שלי', value: '123456782', matchType: 'global', matchValue: '', enabled: true, created: now },
        { id: 'e5', selector: "input[name='phone']", fieldLabel: 'טלפון', name: 'נייד', value: '050-1234567', matchType: 'url-contains', matchValue: '/checkout', enabled: true, created: now },
      ],
      af_snippets: [
        { id: 's1', trigger: '@TZ', value: '123456782', created: now },
        { id: 's2', trigger: '@TEL', value: '050-1234567', created: now },
        { id: 's3', trigger: '@ADDR', value: 'רחוב הרצל 10, תל אביב', created: now },
      ],
    }), { now });

    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`${scheme} page: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(`${scheme} console: ${m.text()}`); });
    await page.goto('http://localhost:8765/fixture.html');
    await page.waitForTimeout(600);
    await page.click('#email');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${scheme}-dropdown.png`, clip: { x: 640, y: 0, width: 640, height: 360 } });
    // Enter must fill the pre-selected first item
    await page.keyboard.press('Enter');
    const filled = await page.inputValue('#email');
    if (filled !== 'avi@gmail.com') errors.push(`${scheme}: Enter filled "${filled}"`);

    await page.click('#notes');
    await page.keyboard.type('שלום @T');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${scheme}-snippet.png`, clip: { x: 640, y: 0, width: 640, height: 460 } });
    await page.keyboard.press('Enter');
    const notes = await page.inputValue('#notes');
    if (notes !== 'שלום 123456782') errors.push(`${scheme}: snippet produced "${notes}"`);

    // Config popover: open via the content script directly (context menu can't be clicked headless)
    await page.click('#tz');
    await page.waitForTimeout(200);
    // click the "new entry" footer button inside the shadow dropdown
    const added = await page.evaluate(() => {
      const hosts = [...document.body.children].filter(c => c.shadowRoot);
      const btn = hosts.map(h => h.shadowRoot.querySelector('.af-add')).find(Boolean);
      if (!btn) return false;
      btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      return true;
    });
    if (!added) errors.push(`${scheme}: no add button`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${scheme}-popover.png` });
    await page.keyboard.type('999999998');
    // open advanced + list view
    await page.evaluate(() => {
      const host = [...document.body.children].find(c => c.shadowRoot?.querySelector('.af-pop'));
      host.shadowRoot.querySelector('details').open = true;
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${scheme}-popover-adv.png` });
    await page.evaluate(() => {
      const host = [...document.body.children].find(c => c.shadowRoot?.querySelector('.af-pop'));
      host.shadowRoot.querySelector('.af-foot .ghost').click();
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${scheme}-popover-list.png` });
    // back and save
    await page.evaluate(() => {
      const host = [...document.body.children].find(c => c.shadowRoot?.querySelector('.af-pop'));
      host.shadowRoot.querySelector('.af-head .af-icon').click();
    });
    await page.waitForTimeout(200);
    const draftKept = await page.evaluate(() => {
      const host = [...document.body.children].find(c => c.shadowRoot?.querySelector('.af-pop'));
      return host.shadowRoot.querySelector('input').value;
    });
    if (draftKept !== '999999998') errors.push(`${scheme}: draft lost "${draftKept}"`);
    await page.evaluate(() => {
      const host = [...document.body.children].find(c => c.shadowRoot?.querySelector('.af-pop'));
      host.shadowRoot.querySelector('.af-btn.primary').click();
    });
    await page.waitForTimeout(400);
    const saved = await sw.evaluate(async () => (await chrome.storage.local.get('af_entries')).af_entries.find(e => e.value === '999999998'));
    if (!saved || saved.matchType !== 'domain' || saved.matchValue !== 'localhost' || saved.fieldLabel !== 'תעודת זהות')
      errors.push(`${scheme}: saved entry wrong ${JSON.stringify(saved)}`);

    // Manager
    const m = await ctx.newPage();
    m.on('pageerror', e => errors.push(`${scheme} mgr: ${e.message}`));
    m.on('console', msg => { if (msg.type() === 'error') errors.push(`${scheme} mgr console: ${msg.text()}`); });
    await m.goto(`chrome-extension://${id}/manager/manager.html#url=${encodeURIComponent('http://localhost:8765/fixture.html')}`);
    await m.waitForTimeout(700);
    await m.screenshot({ path: `${OUT}/${scheme}-manager.png`, fullPage: true });
    await m.click('.site-item >> nth=0');
    await m.hover('.entry >> nth=0');
    await m.waitForTimeout(200);
    await m.screenshot({ path: `${OUT}/${scheme}-manager-all.png`, fullPage: true });
    await m.click('.entry >> nth=1 >> [aria-label="עריכה"]');
    await m.waitForTimeout(200);
    await m.screenshot({ path: `${OUT}/${scheme}-manager-edit.png`, fullPage: true });
    await m.keyboard.press('Escape');
    await m.click('#af-add-btn');
    await m.waitForTimeout(200);
    await m.screenshot({ path: `${OUT}/${scheme}-manager-new.png`, fullPage: true });
    await m.keyboard.press('Escape');
    await m.click('.nav-item[data-view=snippets]');
    await m.waitForTimeout(200);
    await m.screenshot({ path: `${OUT}/${scheme}-snippets.png`, fullPage: true });
    await m.click('.nav-item[data-view=backup]');
    await m.waitForTimeout(200);
    await m.screenshot({ path: `${OUT}/${scheme}-backup.png`, fullPage: true });
    await m.click('.nav-item[data-view=entries]');
    await m.click('.entry >> nth=0 >> [aria-label="מחיקה"]');
    await m.waitForTimeout(300);
    await m.screenshot({ path: `${OUT}/${scheme}-toast.png` });
    await m.setViewportSize({ width: 390, height: 844 });
    await m.waitForTimeout(200);
    await m.screenshot({ path: `${OUT}/${scheme}-mobile.png`, fullPage: true });
    const fontOk = await m.evaluate(() => document.fonts.check('14px Rubik', 'שלום'));
    if (!fontOk) errors.push(`${scheme}: Rubik not loaded`);
    await ctx.close();
  }
  console.log(errors.length ? errors.join('\n') : 'ALL CHECKS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
