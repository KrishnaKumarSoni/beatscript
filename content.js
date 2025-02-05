// Create drawer element with settings
const drawer = document.createElement('div');
drawer.className = 'yt-drawer';
drawer.innerHTML = `
  <div class="drawer-header">
    <div class="drawer-controls">
      <button class="yt-drawer-close">×</button>
      <button class="settings-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>
    </div>
  </div>
  <div class="resize-handle"></div>
  <div class="drawer-content"></div>
  <div class="settings-menu">
    <div class="settings-item">
      <span>Open automatically</span>
      <label class="toggle-switch">
        <input type="checkbox" id="autoOpen">
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="settings-item">
      <span>Close after song ends</span>
      <label class="toggle-switch">
        <input type="checkbox" id="autoClose">
        <span class="toggle-slider"></span>
      </label>
    </div>
  </div>
`;

// Create and append elements
document.body.appendChild(drawer);

// Create overlay for resize
const overlay = document.createElement('div');
overlay.className = 'resize-overlay';
document.body.appendChild(overlay);

// Cache DOM elements
const resizeHandle = drawer.querySelector('.resize-handle');
const closeButton = drawer.querySelector('.yt-drawer-close');
const settingsBtn = drawer.querySelector('.settings-btn');
const settingsMenu = drawer.querySelector('.settings-menu');

// Helper function to convert to sentence case
function toSentenceCase(str) {
  return str.replace(/\w\S*/g, function(txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

// Settings state management
const settings = {
  autoOpen: false,
  autoClose: false,
  ...JSON.parse(localStorage.getItem('ytDrawerSettings') || '{}')
};

// Initialize settings
function initSettings() {
  document.getElementById('autoOpen').checked = settings.autoOpen;
  document.getElementById('autoClose').checked = settings.autoClose;
}

// Resize functionality
let isResizing = false;
let startX = 0;
let startWidth = 0;
const minWidth = 200;
const maxWidth = 1200;

function initResize(e) {
  e.preventDefault();
  e.stopPropagation();
  
  isResizing = true;
  startX = e.pageX || e.touches?.[0].pageX;
  startWidth = parseInt(getComputedStyle(drawer).width);
  
  drawer.classList.add('resizing');
  overlay.classList.add('active');
  document.body.style.cursor = 'ew-resize';
  
  // Bind move and up events
  document.addEventListener('mousemove', handleResize, { passive: false });
  document.addEventListener('touchmove', handleResize, { passive: false });
  document.addEventListener('mouseup', stopResize);
  document.addEventListener('touchend', stopResize);
}

function handleResize(e) {
  if (!isResizing) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  // Use requestAnimationFrame for smooth updates
  requestAnimationFrame(() => {
    const currentX = e.pageX || e.touches?.[0].pageX;
    const diff = startX - currentX;
    const newWidth = Math.min(Math.max(startWidth + diff, minWidth), maxWidth);
    
    document.documentElement.style.setProperty('--drawer-width', `${newWidth}px`);
  });
}

function stopResize() {
  if (!isResizing) return;
  
  isResizing = false;
  drawer.classList.remove('resizing');
  overlay.classList.remove('active');
  document.body.style.cursor = '';
  
  // Remove event listeners
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('touchmove', handleResize);
  document.removeEventListener('mouseup', stopResize);
  document.removeEventListener('touchend', stopResize);
}

// Add resize event listeners
resizeHandle.addEventListener('mousedown', initResize);
resizeHandle.addEventListener('touchstart', initResize);

// Event Listeners
closeButton.addEventListener('click', () => {
  drawer.classList.remove('open');
  drawer.style.transform = 'translateX(100%)';
  settingsMenu.classList.remove('active');
});

settingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  settingsMenu.classList.toggle('active');
});

// Click outside to close settings menu
document.addEventListener('click', (e) => {
  if (!settingsBtn.contains(e.target) && !settingsMenu.contains(e.target)) {
    settingsMenu.classList.remove('active');
  }
});

// Prevent drawer clicks from closing settings
drawer.addEventListener('click', (e) => {
  if (!settingsBtn.contains(e.target) && !settingsMenu.contains(e.target)) {
    settingsMenu.classList.remove('active');
  }
});

// Toggle switch handlers
const toggles = drawer.querySelectorAll('.toggle-switch input');
toggles.forEach(toggle => {
  toggle.addEventListener('change', (e) => {
    settings[e.target.id] = e.target.checked;
    localStorage.setItem('ytDrawerSettings', JSON.stringify(settings));
  });
});

// Initialize settings
initSettings();

// State management
const videoState = {
    currentVideoId: null,
    isProcessing: false,
    currentTitle: '',
    cleanup() {
        this.isProcessing = false;
        this.currentVideoId = null;
        this.currentTitle = '';
    }
};

// Debug logger with instance tracking
const INSTANCE_ID = Math.random().toString(36).substring(7);
const debug = {
    log: (...args) => console.log(`[YT-Drawer-${INSTANCE_ID}]`, ...args)
};

// Track last URL for change detection
let lastUrl = window.location.href;

// Get video ID from URL
function getVideoId(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.searchParams.get('v');
    } catch (e) {
        return null;
    }
}

// Get title from DOM with better error handling
function getVideoTitle() {
    try {
        const titleElement = document.querySelector('h1.style-scope.ytd-watch-metadata yt-formatted-string');
        const title = titleElement?.textContent?.trim() || null;
        debug.log('Title check result:', title);
        return title;
    } catch (error) {
        debug.log('Error getting title:', error);
        return null;
    }
}

// Title check with retry mechanism
function startTitleCheck(videoId) {
    debug.log('Starting title check for video:', videoId);
    let checkCount = 0;
    const maxChecks = 10;
    const checkInterval = 500; // 500ms

    const checkTitle = () => {
        try {
            // Verify we're still on the same video
            const currentVideoId = getVideoId(window.location.href);
            if (currentVideoId !== videoId) {
                debug.log('Video changed during title check, aborting');
                return;
            }

            const newTitle = getVideoTitle();
            debug.log(`Title check ${checkCount + 1}/${maxChecks}:`, newTitle);
            
            if (newTitle && newTitle !== videoState.currentTitle) {
                debug.log('Title found:', newTitle);
                videoState.currentTitle = newTitle;
                updateVideoInfo(newTitle, videoId);
                return;
            }
            
            checkCount++;
            if (checkCount < maxChecks && !newTitle) {
                setTimeout(checkTitle, checkInterval);
            } else if (!newTitle) {
                debug.log('Failed to find title after max attempts');
                updateDrawerMessage('Could not find video title.');
            }
        } catch (error) {
            debug.log('Error in title check:', error);
        }
    };

    // Start checking after a short delay to let YouTube update DOM
    setTimeout(checkTitle, 1000);
}

// Main function to handle video updates
async function updateVideoInfo(title, videoId) {
    // Verify again we're still on the same video before making API call
    if (videoId !== videoState.currentVideoId) {
        debug.log('Video changed before API call, aborting');
        return;
    }
    
    if (!title || !videoId || videoState.isProcessing) return;
    
    const content = drawer.querySelector('.drawer-content');
    if (!content) return;

    videoState.isProcessing = true;
    content.innerHTML = '<div class="loading">Extracting song info...</div>';

    try {
        // Final check before API call
        const currentVideoId = getVideoId(window.location.href);
        if (currentVideoId !== videoId) {
            debug.log('Video changed before API call, aborting');
            return;
        }

        const songInfo = await extractSongInfo(title);
        // Verify one last time after API call
        if (videoId === videoState.currentVideoId) {
            updateDrawerContent(songInfo);
        } else {
            debug.log('Video changed during API call, not updating drawer');
        }
    } catch (error) {
        console.error('Error updating video info:', error);
        if (videoId === videoState.currentVideoId) {
            content.innerHTML = '<div class="error">Could not extract song information</div>';
        }
    } finally {
        videoState.isProcessing = false;
    }
}

// Process video page with improved state management
function processVideoPage() {
    const currentUrl = window.location.href;
    if (!currentUrl.includes('youtube.com/watch')) {
        debug.log('Not a watch page');
        videoState.cleanup();
        updateDrawerMessage('Please open a YouTube video to extract song information.');
        return;
    }

    const videoId = getVideoId(currentUrl);
    if (!videoId) {
        debug.log('No video ID found');
        videoState.cleanup();
        updateDrawerMessage('Invalid video URL.');
        return;
    }

    if (videoId !== videoState.currentVideoId) {
        debug.log('New video detected:', videoId);
        videoState.cleanup();
        videoState.currentVideoId = videoId;
        startTitleCheck(videoId);
    } else {
        debug.log('Same video, no reprocessing needed');
    }
}

// Update drawer message
function updateDrawerMessage(message) {
    const content = drawer.querySelector('.drawer-content');
    if (content) {
        content.innerHTML = `<div class="yt-drawer-message">${message}</div>`;
    }
}

// Initialize content script
function initializeOnLoad() {
    debug.log('Content script initialized');
    processVideoPage();
}

// Set up all event listeners
function setupEventListeners() {
    // YouTube navigation events
    document.addEventListener('yt-navigate-start', () => {
        debug.log('Navigation started, cleaning up');
        videoState.cleanup();
    });

    document.addEventListener('yt-navigate-finish', () => {
        debug.log('YouTube navigation finished');
        processVideoPage();
    });

    // Keep existing event listeners
    window.addEventListener('popstate', () => {
        debug.log('Browser navigation detected');
        videoState.cleanup();
        processVideoPage();
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            debug.log('Page visibility changed to visible');
            processVideoPage();
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeOnLoad);
    } else {
        initializeOnLoad();
    }
}

// Start the event listeners
setupEventListeners();

// Initialize drawer
function initializeDrawer() {
    debug.log('Initializing drawer');
    
    // Show drawer first
    drawer.style.transform = '';
    drawer.classList.add('open');
    
    // Then process current video
    processVideoPage();
}

// Extension message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleDrawer') {
        initializeDrawer();
    }
});

async function extractSongInfo(title) {
    try {
        const response = await fetch('http://localhost:8000/api/extract-song-info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title })
        });

        if (!response.ok) {
            throw new Error('Failed to extract song info');
        }

        return await response.json();
    } catch (error) {
        console.error('Error extracting song info:', error);
        return { song: 'Unknown Song', artist: 'Unknown Artist' };
    }
}

function updateDrawerContent(songInfo) {
    const content = drawer.querySelector('.drawer-content');
    if (content) {
        content.innerHTML = `
            <div class="song-info">
                <div class="song-name">${songInfo.song}</div>
                <div class="artist-name">${songInfo.artist}</div>
            </div>
        `;
    }
} 