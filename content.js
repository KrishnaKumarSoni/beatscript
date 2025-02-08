// Create drawer element with settings
// Zoom state management
let currentZoom = 100;
const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const ZOOM_STEP = 10;

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
      <div class="zoom-controls">
        <button class="zoom-btn zoom-out">−</button>
        <span class="zoom-level">100%</span>
        <button class="zoom-btn zoom-in">+</button>
      </div>
      <button class="auto-scroll-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12l7 7 7-7"/>
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
  videoState.isDrawerOpen = false;
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

// Toggle switch handlers with debug logging
const toggles = drawer.querySelectorAll('.toggle-switch input');
toggles.forEach(toggle => {
  toggle.addEventListener('change', (e) => {
    settings[e.target.id] = e.target.checked;
    localStorage.setItem('ytDrawerSettings', JSON.stringify(settings));
    debug.log(`Setting ${e.target.id} changed to ${e.target.checked}`);
    
    // If autoClose was enabled and drawer is open, set up the listener
    if (e.target.id === 'autoClose' && e.target.checked && videoState.isDrawerOpen) {
      setupVideoEndListener();
    }
  });
});

// Initialize settings
initSettings();

// State management
const videoState = {
    currentVideoId: null,
    isProcessing: false,
    currentTitle: '',
    channelName: null,
    isDrawerOpen: false,
    isAutoScrolling: false,
    autoScrollInterval: null,
    isAutoScrollPaused: false,
    cleanup() {
        this.isProcessing = false;
        this.currentVideoId = null;
        this.currentTitle = '';
        this.channelName = null;
        this.stopAutoScroll();
        // Reset zoom when cleaning up state
        currentZoom = 100;
        updateZoom();
        this.isAutoScrollPaused = false;
    },
    stopAutoScroll() {
        this.isAutoScrolling = false;
        this.isAutoScrollPaused = false;
        if (this.autoScrollInterval) {
            clearInterval(this.autoScrollInterval);
            this.autoScrollInterval = null;
        }
    }
};

// Debug logger with instance tracking
const INSTANCE_ID = Math.random().toString(36).substring(7);
const debug = {
    log: (...args) => console.log(`[YT-Drawer-${INSTANCE_ID}]`, ...args)
};

// Track last URL for change detection
let lastUrl = window.location.href;

// Listen for YouTube's client-side navigation
window.addEventListener('popstate', () => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        processVideoPage(true);
    }
});

// Add URL change detection via mutation observer
const urlChangeObserver = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        processVideoPage(true);
    }
});

// Start observing URL changes
urlChangeObserver.observe(document.querySelector('title'), {
    subtree: true,
    characterData: true,
    childList: true
});

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

// Get channel name from DOM
function getChannelName() {
    try {
        // Try multiple possible selectors for better compatibility
        const selectors = [
            '#text.style-scope.ytd-channel-name yt-formatted-string a',
            'ytd-video-owner-renderer .ytd-channel-name a',
            '#owner #channel-name a'
        ];
        
        let channelElement = null;
        for (const selector of selectors) {
            channelElement = document.querySelector(selector);
            if (channelElement) break;
        }
        
        const channelName = channelElement?.textContent?.trim() || null;
        debug.log('Channel name result:', channelName);
        return channelName;
    } catch (error) {
        debug.log('Error getting channel name:', error);
        return null;
    }
}

// Title check with retry mechanism
function startTitleCheck(videoId, shouldFetch = false) {
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
                
                // If title is a single word, include channel name
                const words = newTitle.split(/\s+/);
                const channelName = words.length === 1 ? getChannelName() : null;
                videoState.channelName = channelName;
                debug.log('Channel name for title:', channelName);
                
                // Only fetch lyrics if drawer is open or we're explicitly told to fetch
                if (shouldFetch || videoState.isDrawerOpen) {
                    updateVideoInfo(newTitle, videoId, channelName);
                }
                return;
            }
            
            checkCount++;
            if (checkCount < maxChecks && !newTitle) {
                setTimeout(checkTitle, checkInterval);
            } else if (!newTitle) {
                debug.log('Failed to find title after max attempts');
                if (videoState.isDrawerOpen) {
                    updateDrawerMessage('Could not find video title.');
                }
            }
        } catch (error) {
            debug.log('Error in title check:', error);
        }
    };

    // Start checking after a short delay to let YouTube update DOM
    setTimeout(checkTitle, 1000);
}

// API Configuration
const API_BASE_URL = 'http://localhost:8000/api';

// Function to extract song info from backend
async function extractSongInfo(title, channelName) {
    try {
        debug.log('Extracting song info for:', title);
        
        // Check if title is a single word and get channel name if needed
        const words = title.split(/\s+/);
        let queryParams = `title=${encodeURIComponent(title)}`;
        
        if (words.length === 1 && channelName) {
            debug.log('Adding channel name to query for single word title:', channelName);
            queryParams += `&channel=${encodeURIComponent(channelName)}`;
        }

        const response = await fetch(`${API_BASE_URL}/search?${queryParams}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        debug.log('API Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            debug.log('API Error:', response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
        }

        const data = await response.json();
        debug.log('API Response data:', data);

        return {
            title: data.song,
            artist: data.artist,
            type: data.type,
            lyrics: data.lyrics,
            source: data.source,
            source_favicon: data.source_favicon,
            error: data.error
        };
    } catch (error) {
        debug.log('Error extracting song info:', error.message);
        debug.log('Error stack:', error.stack);
        return {
            title: title,
            artist: 'Unknown',
            type: 'error',
            error: `Failed to fetch lyrics: ${error.message}`
        };
    }
}

// Function to update drawer content with song info
function updateDrawerContent(songInfo) {
    const drawerContent = drawer.querySelector('.drawer-content');
    
    // Clear existing content
    drawerContent.innerHTML = '';
    
    // Create header section
    const header = document.createElement('div');
    header.className = 'song-header';
    header.innerHTML = `
        <h2>${songInfo.title}</h2>
        <h3>${songInfo.artist}</h3>
    `;
    drawerContent.appendChild(header);
    
    // Handle different content types
    if (songInfo.type === 'error') {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = songInfo.error || 'Could not find song information';
        drawerContent.appendChild(errorDiv);
    } else if (songInfo.type === 'instrumental') {
        const infoDiv = document.createElement('div');
        infoDiv.className = 'info-message';
        infoDiv.textContent = 'This appears to be an instrumental track';
        drawerContent.appendChild(infoDiv);
    } else if (songInfo.type === 'lyrical' && songInfo.lyrics) {
        const lyricsDiv = document.createElement('div');
        lyricsDiv.className = 'lyrics-content';
        lyricsDiv.innerHTML = songInfo.lyrics.replace(/\n/g, '<br>');
        drawerContent.appendChild(lyricsDiv);
        
        // Always create source credit section for lyrical content
        const sourceDiv = document.createElement('div');
        sourceDiv.className = 'source-credit';
        
        // Get source info and favicon
        const source = songInfo.source || 'Unknown Source';
        let faviconUrl;
        
        // Handle different source cases
        if (songInfo.source_favicon) {
            faviconUrl = songInfo.source_favicon;
        } else if (source.toLowerCase() === 'jiosaavn') {
            faviconUrl = 'https://www.jiosaavn.com/favicon.ico';
        } else {
            faviconUrl = `https://www.google.com/s2/favicons?domain=${source.toLowerCase().replace(/\s+/g, '')}.com`;
        }
        
        sourceDiv.innerHTML = `
            <span>Source: ${source}</span>
            <img src="${faviconUrl}" alt="${source} favicon" class="source-favicon" onerror="this.style.display='none'">
        `;
        drawerContent.appendChild(sourceDiv);
        
        // Apply current zoom level
        updateZoom();
    }
}

// Add video end detection
let videoElement = null;
let videoEndListener = null;

function setupVideoEndListener() {
  // Remove existing listener if any
  if (videoElement && videoEndListener) {
    videoElement.removeEventListener('ended', videoEndListener);
  }

  // Find the video element
  videoElement = document.querySelector('video.html5-main-video');
  if (videoElement) {
    videoEndListener = () => {
      if (settings.autoClose && videoState.isDrawerOpen) {
        debug.log('Video ended, auto-closing drawer');
        drawer.classList.remove('open');
        drawer.style.transform = 'translateX(100%)';
        settingsMenu.classList.remove('active');
        videoState.isDrawerOpen = false;
      }
    };
    videoElement.addEventListener('ended', videoEndListener);
    debug.log('Video end listener set up');
  }
}

// Initialize drawer
function initializeDrawer() {
    debug.log('Initializing drawer');
    
    // Open drawer immediately
    drawer.classList.add('open');
    drawer.style.transform = 'translateX(0)';
    videoState.isDrawerOpen = true;
    
    // Show loading state immediately
    updateDrawerMessage('', true);
    
    // Then process current video if we have info
    if (videoState.currentVideoId && videoState.currentTitle) {
        updateVideoInfo(videoState.currentTitle, videoState.currentVideoId, videoState.channelName);
    } else {
        processVideoPage(true); // true flag indicates we should fetch lyrics
    }
}

// Add this helper function at the top after the constants
function safeGetURL(imagePath) {
    try {
        return chrome.runtime.getURL(imagePath);
    } catch (e) {
        console.error('Extension context error:', e);
        return ''; // Return empty string if context is invalid
    }
}

// Update the updateDrawerMessage function
function updateDrawerMessage(message, isLoading = false) {
    const content = drawer.querySelector('.drawer-content');
    if (!content) return;

    try {
        if (isLoading) {
            content.innerHTML = `
                <div class="skeleton-loader">
                    <div class="skeleton-header">
                        <div class="skeleton-title"></div>
                        <div class="skeleton-artist"></div>
                    </div>
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line"></div>
                </div>
            `;
        } else if (message === 'Please open a YouTube video to extract song information.') {
            // Safely get image URLs
            const img1 = safeGetURL('img1.png');
            const img2 = safeGetURL('img2.png');
            const img3 = safeGetURL('img3.png');

            // Only show carousel if we have valid image URLs
            if (img1 && img2 && img3) {
                content.innerHTML = `
                    <div class="welcome-container">
                        <div class="carousel">
                            <div class="carousel-inner">
                                <div class="carousel-slide">
                                    <img src="${img1}" alt="Calming image 1">
                                </div>
                                <div class="carousel-slide">
                                    <img src="${img2}" alt="Calming image 2">
                                </div>
                                <div class="carousel-slide">
                                    <img src="${img3}" alt="Calming image 3">
                                </div>
                            </div>
                        </div>
                        <div class="welcome-text">
                            Discover the poetry in music with BeatScript. Navigate to any YouTube music video, and let us unveil the artistry behind the melodies. From heartfelt ballads to energetic anthems, we'll bring you every word, every emotion, right here in your personal lyrics companion.
                        </div>
                    </div>
                `;
            } else {
                // Fallback content if images can't be loaded
                content.innerHTML = `
                    <div class="welcome-container">
                        <div class="welcome-text">
                            Discover the poetry in music with BeatScript. Navigate to any YouTube music video, and let us unveil the artistry behind the melodies. From heartfelt ballads to energetic anthems, we'll bring you every word, every emotion, right here in your personal lyrics companion.
                        </div>
                    </div>
                `;
            }
        } else {
            content.innerHTML = `<div class="yt-drawer-message">${message}</div>`;
        }
    } catch (error) {
        console.error('Error updating drawer message:', error);
        // Fallback content in case of error
        content.innerHTML = `<div class="yt-drawer-message">An error occurred. Please refresh the page.</div>`;
    }
}

// Update the processVideoPage function
function processVideoPage(shouldFetch = false) {
    try {
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

        // Check if extension context is valid before proceeding
        if (!chrome.runtime?.id) {
            debug.log('Extension context invalid');
            videoState.cleanup();
            updateDrawerMessage('Extension needs to be reloaded. Please refresh the page.');
            return;
        }

        // If auto-open is enabled and we're on a watch page, open drawer immediately
        if (settings.autoOpen && !videoState.isDrawerOpen) {
            debug.log('Auto-open enabled, opening drawer immediately');
            drawer.classList.add('open');
            drawer.style.transform = 'translateX(0)';
            videoState.isDrawerOpen = true;
            setupVideoEndListener();
        }

        // Show loading state whenever video changes or fetch is requested
        if (videoId !== videoState.currentVideoId || shouldFetch) {
            debug.log('Showing skeleton loader for new video or fetch request');
            updateDrawerMessage('', true);
        }

        if (videoId !== videoState.currentVideoId) {
            debug.log('New video detected:', videoId);
            videoState.cleanup();
            videoState.currentVideoId = videoId;
            startTitleCheck(videoId, true);
            setupVideoEndListener();
        } else if (shouldFetch && videoState.currentTitle) {
            debug.log('Drawer opened, fetching lyrics for existing video');
            updateVideoInfo(videoState.currentTitle, videoState.currentVideoId, videoState.channelName);
        } else {
            debug.log('Same video, no reprocessing needed');
        }
    } catch (error) {
        console.error('Error in processVideoPage:', error);
        updateDrawerMessage('An error occurred. Please refresh the page.');
    }
}

// Update video info without auto-open logic (since it's handled in processVideoPage)
async function updateVideoInfo(title, videoId, channelName) {
    if (!title || videoState.isProcessing) {
        return;
    }

    try {
        videoState.isProcessing = true;
        debug.log('Processing video:', { title, videoId, channelName });
        
        // Extract song information
        const songInfo = await extractSongInfo(title, channelName);
        
        // Update drawer with song info
        updateDrawerContent(songInfo);
        
        // If it's not a lyrical song and auto-open was the reason for opening, close the drawer
        if (settings.autoOpen && songInfo.type !== 'lyrical' && videoState.isDrawerOpen) {
            debug.log('Non-lyrical content detected, closing auto-opened drawer');
            drawer.classList.remove('open');
            drawer.style.transform = 'translateX(100%)';
            videoState.isDrawerOpen = false;
        }

    } catch (error) {
        debug.log('Error processing video:', error);
        updateDrawerMessage('Error: Could not process video');
    } finally {
        videoState.isProcessing = false;
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

    // Zoom event listeners
    const zoomIn = drawer.querySelector('.zoom-in');
    const zoomOut = drawer.querySelector('.zoom-out');

    if (zoomIn) {
        zoomIn.addEventListener('click', () => handleZoom(1));
    }
    if (zoomOut) {
        zoomOut.addEventListener('click', () => handleZoom(-1));
    }

    // Add auto-scroll button listener
    const autoScrollBtn = drawer.querySelector('.auto-scroll-btn');
    if (autoScrollBtn) {
        autoScrollBtn.addEventListener('click', () => {
            toggleAutoScroll();
        });
    }

    // Stop auto-scroll when user manually scrolls
    const drawerContent = drawer.querySelector('.drawer-content');
    if (drawerContent) {
        drawerContent.addEventListener('wheel', () => {
            if (videoState.isAutoScrolling) {
                videoState.stopAutoScroll();
                const autoScrollButton = drawer.querySelector('.auto-scroll-btn');
                if (autoScrollButton) {
                    autoScrollButton.classList.remove('active');
                }
            }
        });
    }

    // Add video state change listener
    const video = document.querySelector('video.html5-main-video');
    if (video) {
        video.addEventListener('play', () => {
            if (videoState.isAutoScrolling && videoState.isAutoScrollPaused) {
                const lyricsContent = document.querySelector('.lyrics-content');
                const drawerContent = document.querySelector('.drawer-content');
                const autoScrollButton = document.querySelector('.auto-scroll-btn');
                const scrollSpeed = calculateScrollSpeed();
                if (scrollSpeed) {
                    startAutoScroll(video, lyricsContent, drawerContent, scrollSpeed, autoScrollButton);
                }
            }
        });

        video.addEventListener('pause', () => {
            if (videoState.isAutoScrolling && !videoState.isAutoScrollPaused) {
                videoState.isAutoScrollPaused = true;
                const autoScrollButton = document.querySelector('.auto-scroll-btn');
                updateAutoScrollButton(autoScrollButton, 'paused');
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeOnLoad);
    } else {
        initializeOnLoad();
    }
}

// Start the event listeners
setupEventListeners();

// Add zoom functionality
function updateZoom() {
    const content = drawer.querySelector('.lyrics-content');
    const zoomLevel = drawer.querySelector('.zoom-level');
    if (content && zoomLevel) {
        content.style.transform = `scale(${currentZoom / 100})`;
        content.style.transformOrigin = 'top left';
        zoomLevel.textContent = `${currentZoom}%`;
    }
}

function handleZoom(direction) {
    const newZoom = currentZoom + (direction * ZOOM_STEP);
    if (newZoom >= MIN_ZOOM && newZoom <= MAX_ZOOM) {
        currentZoom = newZoom;
        updateZoom();
    }
}

// Add this function to calculate scroll speed
function calculateScrollSpeed() {
    try {
        const video = document.querySelector('video.html5-main-video');
        if (!video) return null;

        const duration = video.duration; // Video length in seconds
        const lyricsContent = document.querySelector('.lyrics-content');
        const drawerContent = document.querySelector('.drawer-content');
        if (!lyricsContent || !drawerContent) return null;

        // Get viewport and content measurements
        const viewportHeight = drawerContent.clientHeight;
        const totalContentHeight = lyricsContent.scrollHeight;
        const currentFontSize = parseFloat(window.getComputedStyle(lyricsContent).fontSize);
        const zoomFactor = currentZoom / 100;
        const effectiveFontSize = currentFontSize * zoomFactor;

        // Calculate number of lines
        const lineHeight = effectiveFontSize * 1.6; // Using line-height 1.6 from CSS
        const visibleLines = Math.floor(viewportHeight / lineHeight);
        const totalLines = Math.floor(totalContentHeight / lineHeight);

        // Calculate scroll speed
        // We want to finish scrolling slightly before the song ends (95% of duration)
        const effectiveDuration = duration * 0.95;
        const pixelsToScroll = totalContentHeight - viewportHeight;
        
        // If there's nothing to scroll, return null
        if (pixelsToScroll <= 0) return null;
        
        const scrollSpeed = pixelsToScroll / effectiveDuration;

        debug.log('Scroll calculations:', {
            duration,
            viewportHeight,
            totalContentHeight,
            effectiveFontSize,
            visibleLines,
            totalLines,
            scrollSpeed,
            pixelsToScroll
        });

        return scrollSpeed > 0 ? scrollSpeed : null;
    } catch (error) {
        debug.log('Error calculating scroll speed:', error);
        return null;
    }
}

// Add this function to handle auto-scroll
function toggleAutoScroll() {
    const lyricsContent = document.querySelector('.lyrics-content');
    const drawerContent = document.querySelector('.drawer-content');
    const autoScrollButton = document.querySelector('.auto-scroll-btn');
    const video = document.querySelector('video.html5-main-video');
    
    if (!lyricsContent || !drawerContent || !video) return;

    // If already scrolling, stop it
    if (videoState.isAutoScrolling) {
        videoState.stopAutoScroll();
        updateAutoScrollButton(autoScrollButton, 'default');
        return;
    }

    const scrollSpeed = calculateScrollSpeed();
    if (!scrollSpeed) {
        debug.log('Cannot start auto-scroll: invalid scroll speed or no content to scroll');
        return;
    }

    // Check if video is paused
    if (video.paused) {
        showTooltip('Play the video to start auto-scroll', autoScrollButton);
        videoState.isAutoScrolling = true;
        videoState.isAutoScrollPaused = true;
        updateAutoScrollButton(autoScrollButton, 'paused');
        return;
    }

    startAutoScroll(video, lyricsContent, drawerContent, scrollSpeed, autoScrollButton);
}

// Add function to update button appearance
function updateAutoScrollButton(button, state) {
    if (!button) return;

    button.classList.remove('active', 'paused');
    let icon = '';

    switch (state) {
        case 'active':
            button.classList.add('active');
            icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 6l12 12M6 18L18 6"/>
            </svg>`;
            break;
        case 'paused':
            button.classList.add('active', 'paused');
            icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 4h4v16H6zM14 4h4v16h-4z"/>
            </svg>`;
            break;
        default:
            icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>`;
    }
    
    button.innerHTML = icon;
}

// Add function to start auto-scroll
function startAutoScroll(video, lyricsContent, drawerContent, scrollSpeed, autoScrollButton) {
    videoState.isAutoScrolling = true;
    videoState.isAutoScrollPaused = false;
    updateAutoScrollButton(autoScrollButton, 'active');

    const maxScroll = lyricsContent.scrollHeight - drawerContent.clientHeight;

    // Set initial scroll position based on current video time
    if (video.currentTime > 0) {
        const currentPosition = calculateCurrentScrollPosition(video, scrollSpeed, maxScroll);
        drawerContent.scrollTop = currentPosition;
    } else {
        drawerContent.scrollTop = 0;
    }

    videoState.autoScrollInterval = setInterval(() => {
        if (!videoState.isAutoScrolling) {
            clearInterval(videoState.autoScrollInterval);
            return;
        }

        if (video.paused) {
            if (!videoState.isAutoScrollPaused) {
                videoState.isAutoScrollPaused = true;
                updateAutoScrollButton(autoScrollButton, 'paused');
            }
            return;
        } else if (videoState.isAutoScrollPaused) {
            videoState.isAutoScrollPaused = false;
            updateAutoScrollButton(autoScrollButton, 'active');
        }

        const newPosition = calculateCurrentScrollPosition(video, scrollSpeed, maxScroll);
        
        if (newPosition >= maxScroll) {
            videoState.stopAutoScroll();
            updateAutoScrollButton(autoScrollButton, 'default');
            return;
        }

        drawerContent.scrollTop = newPosition;
    }, 16); // 60fps update rate
}

// Add this function to calculate current scroll position based on video time
function calculateCurrentScrollPosition(video, scrollSpeed, totalScroll) {
    const currentTime = video.currentTime;
    return Math.min(currentTime * scrollSpeed, totalScroll);
}

// Add this function to create and show tooltip
function showTooltip(message, targetElement, duration = 3000) {
    const tooltip = document.createElement('div');
    tooltip.className = 'auto-scroll-tooltip';
    tooltip.textContent = message;
    
    // Position the tooltip below the target element
    const rect = targetElement.getBoundingClientRect();
    tooltip.style.top = `${rect.bottom + 8}px`;
    tooltip.style.left = `${rect.left + (rect.width / 2)}px`;
    
    document.body.appendChild(tooltip);
    
    // Remove tooltip after duration
    setTimeout(() => {
        tooltip.remove();
    }, duration);
}

// Update the chrome.runtime.onMessage listener
try {
    if (chrome.runtime?.id) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'toggleDrawer') {
                initializeDrawer();
            }
        });
    }
} catch (error) {
    console.error('Error setting up message listener:', error);
} 