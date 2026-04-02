chrome.action.onClicked.addListener((tab) => {
  if (!tab.id || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) return;

  chrome.tabs.sendMessage(tab.id, { type: 'BS_TOGGLE' }, () => {
    // Suppress "receiving end does not exist" when content script hasn't loaded yet
    void chrome.runtime.lastError;
  });
});
