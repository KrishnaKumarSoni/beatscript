// Listen for extension install or update
chrome.runtime.onInstalled.addListener(() => {
  // Notify all YouTube tabs that extension was reloaded
  chrome.tabs.query({ url: '*://*.youtube.com/*' }, (tabs) => {
    tabs.forEach(tab => {
      // Try to send message, ignore errors if content script isn't ready
      chrome.tabs.sendMessage(tab.id, { type: 'EXTENSION_RELOADED' }).catch(() => {
        // Content script not ready, that's okay
        console.log('Tab not ready for message:', tab.id);
      });
    });
  });
});

// Listen for extension button clicks
chrome.action.onClicked.addListener((tab) => {
  // Only handle clicks when on YouTube
  if (tab.url?.includes('youtube.com')) {
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_DRAWER' }).catch(() => {
      // Content script not ready, that's okay
      console.log('Tab not ready for drawer toggle:', tab.id);
    });
  }
});

// Listen for tab updates to handle page refreshes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only send message when the page is fully loaded
  if (changeInfo.status === 'complete' && tab.url?.includes('youtube.com')) {
    chrome.tabs.sendMessage(tabId, { 
      type: 'TAB_UPDATED',
      url: tab.url
    }).catch(() => {
      // Content script not ready, that's okay
      console.log('Tab not ready for message:', tabId);
    });
  }
});
