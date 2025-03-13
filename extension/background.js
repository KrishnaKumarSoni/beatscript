// Listen for clicks on the extension icon
chrome.action.onClicked.addListener((tab) => {
  // Send message to content script to toggle drawer
  chrome.tabs.sendMessage(tab.id, { action: "toggleDrawer" });
}); 