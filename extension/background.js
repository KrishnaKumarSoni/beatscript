// Listen for extension installation or update
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    // First-time installation
    console.log('BeatScript Lyrics extension installed');
    
    // Initialize storage with default settings
    chrome.storage.local.set({
      drawerWidth: 400,
      autoOpen: true,
      darkMode: false,
      lastUpdated: Date.now()
    }, () => {
      console.log('Default settings initialized');
    });
    
    // Open onboarding page
    chrome.tabs.create({
      url: 'https://beatscript.io/welcome'
    });
  } else if (details.reason === 'update') {
    // Extension was updated
    console.log('BeatScript Lyrics extension updated');
    
    // Update the lastUpdated timestamp
    chrome.storage.local.set({
      lastUpdated: Date.now()
    });
  }
});

// Listen for extension icon clicks
chrome.action.onClicked.addListener(tab => {
  // Check if we're on a YouTube page
  if (tab.url && tab.url.includes('youtube.com')) {
    console.log('Extension icon clicked on YouTube page');
    
    // Send message to content script to toggle drawer
    chrome.tabs.sendMessage(tab.id, { action: 'toggleDrawer' })
      .catch(error => {
        console.error('Error sending message to content script:', error);
        
        // If content script is not ready or has an error, try injecting it
        if (error.message.includes('Could not establish connection') || 
            error.message.includes('The message port closed')) {
          
          console.log('Attempting to inject content script');
          
          // Inject the content script
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          }).then(() => {
            console.log('Content script injected successfully');
            
            // Try sending the message again after a short delay
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, { action: 'toggleDrawer' })
                .catch(secondError => {
                  console.error('Failed to send message after injection:', secondError);
                });
            }, 500);
          }).catch(injectionError => {
            console.error('Failed to inject content script:', injectionError);
          });
        }
      });
  } else {
    console.log('Extension clicked on non-YouTube page');
    
    // Show notification that extension only works on YouTube
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'BeatScript Lyrics',
      message: 'This extension only works on YouTube pages. Please navigate to YouTube to use it.'
    });
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  if (message.action === 'updateIcon') {
    // Update the extension icon based on whether lyrics are available
    if (message.hasLyrics) {
      chrome.action.setIcon({
        path: {
          16: 'icons/icon16.png',
          48: 'icons/icon48.png',
          128: 'icons/icon128.png'
        },
        tabId: sender.tab.id
      });
      
      chrome.action.setTitle({
        title: 'BeatScript Lyrics: Lyrics Available',
        tabId: sender.tab.id
      });
    } else {
      // Use a grayscale icon to indicate no lyrics
      chrome.action.setIcon({
        path: {
          16: 'icons/icon16_gray.png',
          48: 'icons/icon48_gray.png',
          128: 'icons/icon128_gray.png'
        },
        tabId: sender.tab.id
      });
      
      chrome.action.setTitle({
        title: 'BeatScript Lyrics: No Lyrics Available',
        tabId: sender.tab.id
      });
    }
    
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'logError') {
    // Log errors from content script
    console.error('Content script error:', message.error);
    
    // Store error in local storage for debugging
    chrome.storage.local.get('errors', data => {
      const errors = data.errors || [];
      errors.push({
        timestamp: Date.now(),
        message: message.error,
        url: sender.tab.url
      });
      
      // Keep only the last 10 errors
      if (errors.length > 10) {
        errors.shift();
      }
      
      chrome.storage.local.set({ errors });
    });
    
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'saveSettings') {
    // Save user settings
    chrome.storage.local.set({
      drawerWidth: message.settings.drawerWidth || 400,
      autoOpen: message.settings.autoOpen !== undefined ? message.settings.autoOpen : true,
      darkMode: message.settings.darkMode || false
    }, () => {
      console.log('Settings saved:', message.settings);
      sendResponse({ success: true });
    });
    
    return true;
  }
  
  if (message.action === 'getSettings') {
    // Retrieve user settings
    chrome.storage.local.get(['drawerWidth', 'autoOpen', 'darkMode'], data => {
      console.log('Retrieved settings:', data);
      sendResponse({
        success: true,
        settings: {
          drawerWidth: data.drawerWidth || 400,
          autoOpen: data.autoOpen !== undefined ? data.autoOpen : true,
          darkMode: data.darkMode || false
        }
      });
    });
    
    return true;
  }
}); 