// Service worker — registers context menu and routes messages to content script.

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'af-configure',
    title: '⚡ AutoFill: הגדר אפשרויות לשדה זה',
    contexts: ['editable'],
    // Only show on real web pages — chrome:// and other internal pages
    // don't allow content scripts so the menu item would do nothing there.
    documentUrlPatterns: ['https://*/*', 'http://*/*', 'file:///*'],
  });
});

// Kill switch: set to false to disable HTTP Basic Auth autofill.
const AF_BASIC_AUTH_ENABLED = true;

if (AF_BASIC_AUTH_ENABLED) chrome.webRequest.onAuthRequired.addListener(
  (details, callback) => {
    chrome.storage.local.get('af_credential', (res) => {
      const cred = res.af_credential;
      if (cred && cred.username && cred.password) {
        callback({ authCredentials: { username: cred.username, password: cred.password } });
      } else {
        callback({});
      }
    });
  },
  { urls: ['<all_urls>'] },
  ['asyncBlocking']
);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'af-configure' || !tab?.id) return;
  // Send to the specific frame where the right-click happened (may be an iframe).
  // info.frameId is 0 for the main frame, >0 for iframes.
  const frameId = info.frameId ?? 0;
  chrome.tabs.sendMessage(tab.id, { action: 'open-config' }, { frameId }, () => {
    if (chrome.runtime.lastError) {
      // Content script not available on this page (e.g. chrome:// URLs).
    }
  });
});
