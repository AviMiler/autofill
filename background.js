// Service worker — registers context menu and routes messages to content script.

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
