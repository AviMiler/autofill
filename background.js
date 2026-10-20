// Service worker — context menu, and the single entry to the manager page
// (toolbar icon click + "full management" link from the in-page panel).

const MANAGER_PATH = 'manager/manager.html';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'af-configure',
    title: '⚡ AutoFill: הגדר אפשרויות לשדה זה',
    contexts: ['editable'],
    documentUrlPatterns: ['https://*/*', 'http://*/*', 'file:///*'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'af-configure' || !tab?.id) return;
  const frameId = info.frameId ?? 0;
  chrome.tabs.sendMessage(tab.id, { action: 'open-config' }, { frameId }, () => {
    if (chrome.runtime.lastError) {}
  });
});

// Opens the manager (or re-uses the already-open tab) with an optional pre-filter.
// The filter travels in the URL hash (#url=...&sel=...) so an open manager can react via hashchange.
async function openManager({ url, selector } = {}) {
  const params = new URLSearchParams();
  if (/^(https?|file):/i.test(url || '')) params.set('url', url);
  if (selector) params.set('sel', selector);
  const hash = params.toString() ? `#${params}` : '';
  const target = chrome.runtime.getURL(MANAGER_PATH) + hash;

  const [existing] = await chrome.tabs.query({ url: chrome.runtime.getURL(MANAGER_PATH) + '*' });
  if (existing) {
    await chrome.tabs.update(existing.id, { url: target, active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: target });
  }
}

// tab.url is readable here thanks to the `activeTab` permission granted by the icon click.
chrome.action.onClicked.addListener(tab => {
  openManager({ url: tab?.url }).catch(err => console.error('[background] openManager failed:', err));
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.action !== 'open-manager') return;
  // sender.url is the sender frame's URL; it equals the page URL only for the top frame
  // (sender.tab.url is hidden without the `tabs` permission), so iframes pass no URL.
  const url = sender.frameId === 0 ? sender.url : undefined;
  openManager({ url, selector: msg.selector })
    .catch(err => console.error('[background] openManager failed:', err));
});
