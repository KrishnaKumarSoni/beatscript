chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'toggleDrawer' });
  } catch (error) {
    console.log('Error sending message to content script:', error);
  }
}); 