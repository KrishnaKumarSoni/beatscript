// Create and inject the drawer
function createDrawer() {
  // Create the drawer elements
  const drawer = document.createElement('div');
  drawer.className = 'right-drawer';
  drawer.setAttribute('aria-label', 'Lyrics drawer');

  const handle = document.createElement('div');
  handle.className = 'drawer-handle';
  handle.setAttribute('aria-label', 'Resize drawer');
  handle.setAttribute('role', 'slider');

  const closeButton = document.createElement('button');
  closeButton.className = 'close-button';
  closeButton.innerHTML = '×';
  closeButton.setAttribute('aria-label', 'Close lyrics drawer');

  const content = document.createElement('div');
  content.className = 'drawer-content';

  // Create tooltip element
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  
  // Append elements to the drawer
  drawer.appendChild(handle);
  drawer.appendChild(closeButton);
  drawer.appendChild(content);
  document.body.appendChild(drawer);
  document.body.appendChild(tooltip);

  // Show welcome message
  showWelcomeMessage();

  return { drawer, handle, closeButton, content, tooltip };
}

// Show welcome message
function showWelcomeMessage() {
  try {
    const contentElement = document.getElementById('drawer-content');
    if (!contentElement) {
      console.error('Drawer content element not found');
      return;
    }
    
    contentElement.innerHTML = `
      <div class="welcome-message">
        <h2>Welcome to BeatScript!</h2>
        <p>This extension displays lyrics for YouTube music videos.</p>
        <p>Navigate to a music video to see lyrics automatically.</p>
        <div class="welcome-icon">🎵</div>
      </div>
    `;
  } catch (error) {
    console.error('Error showing welcome message:', error);
  }
}

// Initialize the drawer
const { drawer, handle, closeButton, content, tooltip } = createDrawer();

// Store the current URL for change detection
let currentUrl = window.location.href;

// Toggle drawer with animation
let isOpen = false;
function toggleDrawer() {
  isOpen = !isOpen;
  
  // Add transition class for smooth animation
  drawer.classList.add('animating');
  
  // Toggle open class
  drawer.classList.toggle('open');
  
  // If opening the drawer, fetch lyrics
  if (isOpen) {
    fetchLyrics();
    
    // Add a class to the body to indicate drawer is open
    document.body.classList.add('drawer-open');
    
    // Announce to screen readers
    announceToScreenReader('Lyrics drawer opened');
  } else {
    // Remove the class from the body
    document.body.classList.remove('drawer-open');
    
    // Announce to screen readers
    announceToScreenReader('Lyrics drawer closed');
  }
  
  // Remove the transition class after animation completes
  setTimeout(() => {
    drawer.classList.remove('animating');
  }, 500);
}

// Function to announce messages to screen readers
function announceToScreenReader(message) {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', 'assertive');
  announcement.setAttribute('role', 'status');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  // Remove after announcement is read
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggleDrawer") {
    toggleDrawer();
  }
});

// Close button functionality with animation
closeButton.addEventListener('click', () => {
  if (isOpen) {
    toggleDrawer();
  }
});

// Show tooltip function
function showTooltip(element, message, event) {
  const tooltipElement = document.querySelector('.tooltip');
  if (!tooltipElement) return;
  
  tooltipElement.textContent = message;
  tooltipElement.style.left = `${event.clientX + 10}px`;
  tooltipElement.style.top = `${event.clientY + 10}px`;
  tooltipElement.classList.add('visible');
}

// Hide tooltip function
function hideTooltip() {
  const tooltipElement = document.querySelector('.tooltip');
  if (!tooltipElement) return;
  
  tooltipElement.classList.remove('visible');
}

// Add tooltips to interactive elements
handle.addEventListener('mouseenter', (e) => showTooltip(handle, 'Drag to resize', e));
handle.addEventListener('mouseleave', hideTooltip);
closeButton.addEventListener('mouseenter', (e) => showTooltip(closeButton, 'Close drawer', e));
closeButton.addEventListener('mouseleave', hideTooltip);

// Update tooltip position on mouse move
document.addEventListener('mousemove', (e) => {
  const tooltipElement = document.querySelector('.tooltip.visible');
  if (tooltipElement) {
    tooltipElement.style.left = `${e.clientX + 10}px`;
    tooltipElement.style.top = `${e.clientY + 10}px`;
  }
});

// Resize functionality with improved feedback
let isResizing = false;
let startX;
let startWidth;

handle.addEventListener('mousedown', (e) => {
  isResizing = true;
  startX = e.clientX;
  startWidth = parseInt(getComputedStyle(drawer).width, 10);
  
  // Add dragging class to prevent text selection
  document.body.classList.add('dragging');
  
  // Change cursor for the entire document during resize
  document.body.style.cursor = 'ew-resize';
  
  // Add active class to handle
  handle.classList.add('active');
});

document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;
  
  const width = startWidth - (e.clientX - startX);
  
  // Set min and max width constraints
  if (width > 250 && width < 800) {
    drawer.style.width = `${width}px`;
    
    // Show width in tooltip
    showTooltip(handle, `Width: ${Math.round(width)}px`, e);
  }
});

document.addEventListener('mouseup', () => {
  if (isResizing) {
    isResizing = false;
    document.body.classList.remove('dragging');
    document.body.style.cursor = '';
    handle.classList.remove('active');
    hideTooltip();
    
    // Save the width preference
    const currentWidth = parseInt(getComputedStyle(drawer).width, 10);
    localStorage.setItem('drawerWidth', currentWidth);
  }
});

// Load saved width preference
function loadSavedWidth() {
  const savedWidth = localStorage.getItem('drawerWidth');
  if (savedWidth) {
    drawer.style.width = `${savedWidth}px`;
  }
}

// Initialize with saved preferences
loadSavedWidth();

// Function to check if we're on a YouTube video page with better detection
function isYouTubeVideoPage() {
  // Check URL pattern
  const isYouTubeURL = window.location.hostname.includes('youtube.com');
  const isWatchPage = window.location.pathname.includes('/watch');
  
  // Check for video player element as additional verification
  const hasVideoPlayer = !!document.querySelector('#movie_player') || 
                         !!document.querySelector('.html5-video-container');
  
  return isYouTubeURL && isWatchPage && hasVideoPlayer;
}

// Function to extract YouTube title and channel name with enhanced error handling
function extractYouTubeInfo() {
  let title = '';
  let channel = '';
  
  try {
    // Try to extract video ID from URL to ensure we're getting info for the current video
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('v');
    
    if (!videoId) {
      console.warn('Could not extract video ID from URL');
      return { title, channel, error: 'No video ID found' };
    }
    
    console.log('Extracting info for video ID:', videoId);
    
    // Try multiple selectors for title to handle YouTube DOM changes
    const titleSelectors = [
      'h1.style-scope.ytd-watch-metadata yt-formatted-string',
      '#container h1.title',
      'h1.title yt-formatted-string',
      '.title.style-scope.ytd-video-primary-info-renderer'
    ];
    
    // Try each selector until we find a match
    for (const selector of titleSelectors) {
      const titleElement = document.querySelector(selector);
      if (titleElement) {
        title = titleElement.textContent.trim();
        console.log('Extracted title:', title);
        break;
      }
    }
    
    // If we still don't have a title, try to get it from the document title
    if (!title && document.title) {
      // YouTube titles are usually in the format "Video Title - YouTube"
      const docTitle = document.title.replace(' - YouTube', '');
      if (docTitle) {
        title = docTitle;
        console.log('Extracted title from document title:', title);
      }
    }
    
    // Try multiple selectors for channel name to handle YouTube DOM changes
    const channelSelectors = [
      'ytd-channel-name yt-formatted-string#text a',
      '#owner-name a',
      '.ytd-channel-name a',
      '#channel-name #text a',
      '#owner #owner-container #owner-name a'
    ];
    
    // Try each selector until we find a match
    for (const selector of channelSelectors) {
      const channelElement = document.querySelector(selector);
      if (channelElement) {
        channel = channelElement.textContent.trim();
        console.log('Extracted channel:', channel);
        break;
      }
    }
    
    // If we still don't have a channel, try to extract it from the meta tags
    if (!channel) {
      const metaChannel = document.querySelector('meta[itemprop="channelId"]');
      if (metaChannel) {
        const channelId = metaChannel.getAttribute('content');
        console.log('Found channel ID in meta tags:', channelId);
        // We can't get the channel name directly, but we can indicate we found something
        channel = 'YouTube Channel';
      }
    }
    
    // If we couldn't extract the title or channel, try again with a retry mechanism
    if (!title || !channel) {
      console.log('Missing title or channel, will retry extraction');
      
      // If we already have a retry count for this video, increment it
      if (window.extractionRetries && window.extractionRetries.videoId === videoId) {
        window.extractionRetries.count++;
      } else {
        // Otherwise, start a new retry count
        window.extractionRetries = {
          videoId: videoId,
          count: 1
        };
      }
      
      // If we haven't exceeded the maximum number of retries
      if (window.extractionRetries.count < 5) {
        console.log(`Retry attempt ${window.extractionRetries.count} for video ${videoId}`);
        
        // Schedule another extraction attempt
        setTimeout(() => {
          const newInfo = extractYouTubeInfo();
          
          // If we successfully extracted info, update the lyrics
          if (newInfo.title && newInfo.channel && isOpen) {
            console.log('Successfully extracted info after retry, updating lyrics');
            fetchLyrics();
          }
        }, 500 * window.extractionRetries.count); // Increasing delay with each retry
      }
    } else {
      // Reset retry count if successful
      window.extractionRetries = null;
    }
    
    return { title, channel, videoId };
  } catch (error) {
    console.error('Error extracting YouTube info:', error);
    return { title, channel, error: error.message };
  }
}

// Function to show loading state
function showLoading() {
  try {
    const contentElement = document.getElementById('drawer-content');
    if (!contentElement) {
      console.error('Drawer content element not found');
      return;
    }
    
    contentElement.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p>Fetching lyrics...</p>
      </div>
    `;
  } catch (error) {
    console.error('Error showing loading state:', error);
  }
}

// Function to show error state with icon and suggestion
function showError(message, icon = '❌', suggestion = '') {
  try {
    const contentElement = document.getElementById('drawer-content');
    if (!contentElement) {
      console.error('Drawer content element not found');
      return;
    }
    
    contentElement.innerHTML = `
      <div class="error-container">
        <div class="error-icon">${icon}</div>
        <h3 class="error-message">${message}</h3>
        ${suggestion ? `<p class="error-suggestion">${suggestion}</p>` : ''}
        <button id="retry-button" class="retry-button">Try Again</button>
      </div>
    `;
    
    // Add event listener to retry button
    const retryButton = document.getElementById('retry-button');
    if (retryButton) {
      retryButton.addEventListener('click', () => {
        fetchLyrics();
      });
    }
  } catch (error) {
    console.error('Error showing error state:', error);
    // Last resort fallback
    try {
      const contentElement = document.getElementById('drawer-content');
      if (contentElement) {
        contentElement.innerHTML = '<div class="error-container"><p>An error occurred. Please refresh the page.</p></div>';
      }
    } catch (e) {
      // Nothing more we can do
    }
  }
}

// Function to show empty state with customizable message and icon
function showEmptyState(title, message, icon = '🎵') {
  try {
    const contentElement = document.getElementById('drawer-content');
    if (!contentElement) {
      console.error('Drawer content element not found');
      return;
    }
    
    contentElement.innerHTML = `
      <div class="empty-state-container">
        <div class="empty-state-icon">${icon}</div>
        <h3 class="empty-state-title">${title}</h3>
        <p class="empty-state-message">${message}</p>
      </div>
    `;
  } catch (error) {
    console.error('Error showing empty state:', error);
  }
}

// Function to fetch lyrics from the backend with enhanced error handling
async function fetchLyrics() {
  let abortController;
  
  try {
    // Check if we're on a YouTube video page
    if (!isYouTubeVideoPage()) {
      showEmptyState(
        "Not a YouTube Video",
        "This extension works on YouTube video pages. Navigate to a music video to see lyrics.",
        "🎬"
      );
      return;
    }
    
    // Show loading state
    showLoading();
    
    // Create an AbortController to cancel the fetch if needed
    abortController = new AbortController();
    const signal = abortController.signal;
    
    // Set a timeout to abort the fetch if it takes too long
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 15000); // 15 seconds timeout
    
    // Get the current video ID to ensure we're fetching for the right video
    const urlParams = new URLSearchParams(window.location.search);
    const currentVideoId = urlParams.get('v');
    
    if (!currentVideoId) {
      showError(
        "Could not identify the video",
        "🔍",
        "Make sure you're watching a video on YouTube."
      );
      return;
    }
    
    // Store the current video ID to verify later
    window.currentFetchVideoId = currentVideoId;
    
    console.log('Starting lyrics fetch for video ID:', currentVideoId);
    
    const extractedInfo = extractYouTubeInfo();
    
    // Check if there was an error during extraction
    if (extractedInfo.error) {
      showError(
        `Could not extract video information: ${extractedInfo.error}`,
        "📋",
        "Try refreshing the page or selecting a different video."
      );
      return;
    }
    
    const { title, channel } = extractedInfo;
    
    // Verify we're still on the same video (in case of rapid navigation)
    const newUrlParams = new URLSearchParams(window.location.search);
    const newVideoId = newUrlParams.get('v');
    
    if (newVideoId !== currentVideoId) {
      console.log('Video changed during extraction, aborting this fetch');
      clearTimeout(timeoutId);
      return; // Abort this fetch as we've navigated to a different video
    }
    
    if (!title) {
      showError(
        "Could not extract video title",
        "📋",
        "Try refreshing the page or selecting a different video."
      );
      clearTimeout(timeoutId);
      return;
    }
    
    // Store the YouTube info for later use
    window.lastYouTubeInfo = { 
      title, 
      channel,
      videoId: currentVideoId,
      timestamp: Date.now()
    };
    
    console.log('Fetching lyrics for:', { title, artist: channel, videoId: currentVideoId });
    
    // Check if we have cached lyrics for this video
    const cachedLyrics = getCachedLyrics(currentVideoId);
    if (cachedLyrics) {
      console.log('Using cached lyrics for video ID:', currentVideoId);
      displayLyrics(cachedLyrics);
      clearTimeout(timeoutId);
      return;
    }
    
    // Make API request to the backend with timeout and abort capability
    try {
      const response = await fetch('http://localhost:3000/api/lyrics/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, artist: channel }),
        signal: signal
      });
      
      // Clear the timeout since the request completed
      clearTimeout(timeoutId);
      
      // Verify again we're still on the same video (in case of navigation during fetch)
      const finalUrlParams = new URLSearchParams(window.location.search);
      const finalVideoId = finalUrlParams.get('v');
      
      if (finalVideoId !== currentVideoId) {
        console.log('Video changed during API call, aborting this display');
        return; // Abort this display as we've navigated to a different video
      }
      
      // Check if the response is ok
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Backend response for video ID:', currentVideoId, data);
      
      if (data.success && data.result) {
        // Cache the lyrics for future use
        cacheLyrics(currentVideoId, data.result);
        
        // Pass the result object to displayLyrics
        displayLyrics(data.result);
      } else {
        showError(
          `No lyrics found for "${title}"`,
          "🔍",
          "Try a different video or check if this is a music video."
        );
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        showError(
          "Request timed out",
          "⏱️",
          "The server took too long to respond. Please try again later."
        );
      } else {
        showError(
          `Error fetching lyrics: ${fetchError.message}`,
          "❌",
          "Please check your internet connection and try again."
        );
      }
      console.error('Fetch error:', fetchError);
    }
  } catch (error) {
    showError(
      `Error fetching lyrics: ${error.message}`,
      "❌",
      "Please check your internet connection and try again."
    );
    console.error('Error fetching lyrics:', error);
  }
}

// Function to cache lyrics
function cacheLyrics(videoId, lyricsData) {
  try {
    const cache = JSON.parse(localStorage.getItem('lyricsCache')) || {};
    
    // Add the new lyrics to the cache
    cache[videoId] = {
      data: lyricsData,
      timestamp: Date.now()
    };
    
    // Limit cache size to 20 entries
    const videoIds = Object.keys(cache);
    if (videoIds.length > 20) {
      // Sort by timestamp (oldest first)
      videoIds.sort((a, b) => cache[a].timestamp - cache[b].timestamp);
      
      // Remove the oldest entries
      for (let i = 0; i < videoIds.length - 20; i++) {
        delete cache[videoIds[i]];
      }
    }
    
    localStorage.setItem('lyricsCache', JSON.stringify(cache));
  } catch (error) {
    console.error('Error caching lyrics:', error);
  }
}

// Function to get cached lyrics
function getCachedLyrics(videoId) {
  try {
    const cache = JSON.parse(localStorage.getItem('lyricsCache')) || {};
    
    // Check if we have cached lyrics for this video
    if (cache[videoId]) {
      const cachedEntry = cache[videoId];
      
      // Check if the cache is still valid (less than 24 hours old)
      const cacheAge = Date.now() - cachedEntry.timestamp;
      const cacheValidityPeriod = 24 * 60 * 60 * 1000; // 24 hours
      
      if (cacheAge < cacheValidityPeriod) {
        return cachedEntry.data;
      } else {
        // Cache is too old, remove it
        delete cache[videoId];
        localStorage.setItem('lyricsCache', JSON.stringify(cache));
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting cached lyrics:', error);
    return null;
  }
}

// Function to display lyrics in the drawer
function displayLyrics(result) {
  try {
    // Clear loading state
    const contentElement = document.getElementById('drawer-content');
    if (!contentElement) {
      console.error('Drawer content element not found');
      return;
    }
    
    contentElement.innerHTML = '';
    
    // Create header with song and artist info
    const headerElement = document.createElement('div');
    headerElement.className = 'lyrics-header';
    
    // Add song title
    const titleElement = document.createElement('h2');
    titleElement.className = 'lyrics-title';
    titleElement.textContent = result.title || 'Unknown Title';
    headerElement.appendChild(titleElement);
    
    // Add artist name if available
    if (result.artist) {
      const artistElement = document.createElement('h3');
      artistElement.className = 'lyrics-artist';
      artistElement.textContent = result.artist;
      headerElement.appendChild(artistElement);
    }
    
    // Add source attribution if available
    if (result.source) {
      const sourceElement = document.createElement('div');
      sourceElement.className = 'lyrics-source';
      sourceElement.textContent = `Source: ${result.source}`;
      headerElement.appendChild(sourceElement);
    }
    
    contentElement.appendChild(headerElement);
    
    // Create lyrics container
    const lyricsContainer = document.createElement('div');
    lyricsContainer.className = 'lyrics-container';
    
    // Format and display lyrics
    if (result.lyrics && result.lyrics.trim()) {
      // Split lyrics by line breaks and create paragraph elements
      const lyricsLines = result.lyrics.split('\n');
      
      lyricsLines.forEach(line => {
        const paragraph = document.createElement('p');
        
        // Handle empty lines (create space between verses)
        if (line.trim() === '') {
          paragraph.className = 'lyrics-break';
          paragraph.innerHTML = '&nbsp;';
        } else {
          paragraph.className = 'lyrics-line';
          paragraph.textContent = line;
        }
        
        lyricsContainer.appendChild(paragraph);
      });
    } else {
      // Handle case where lyrics are empty or just whitespace
      const noLyricsMessage = document.createElement('p');
      noLyricsMessage.className = 'lyrics-line no-lyrics';
      noLyricsMessage.textContent = 'Lyrics content is empty.';
      lyricsContainer.appendChild(noLyricsMessage);
    }
    
    contentElement.appendChild(lyricsContainer);
    
    // Add timestamp of when lyrics were fetched
    const timestampElement = document.createElement('div');
    timestampElement.className = 'lyrics-timestamp';
    const now = new Date();
    timestampElement.textContent = `Fetched: ${now.toLocaleString()}`;
    contentElement.appendChild(timestampElement);
    
    // Add a feedback button
    const feedbackContainer = document.createElement('div');
    feedbackContainer.className = 'feedback-container';
    
    const feedbackButton = document.createElement('button');
    feedbackButton.className = 'feedback-button';
    feedbackButton.textContent = 'Report incorrect lyrics';
    feedbackButton.addEventListener('click', () => {
      // Simple feedback mechanism - could be expanded in the future
      feedbackButton.textContent = 'Thank you for your feedback!';
      feedbackButton.disabled = true;
      
      // Store feedback in local storage for potential future use
      try {
        const feedback = JSON.parse(localStorage.getItem('lyricsFeedback')) || [];
        feedback.push({
          videoId: new URLSearchParams(window.location.search).get('v'),
          title: result.title,
          artist: result.artist,
          timestamp: Date.now()
        });
        localStorage.setItem('lyricsFeedback', JSON.stringify(feedback));
      } catch (error) {
        console.error('Error storing feedback:', error);
      }
    });
    
    feedbackContainer.appendChild(feedbackButton);
    contentElement.appendChild(feedbackContainer);
    
  } catch (error) {
    console.error('Error displaying lyrics:', error);
    showError(
      'Error displaying lyrics',
      '📝',
      'There was a problem displaying the lyrics. Please try again.'
    );
  }
}

// Function to check for URL changes
function checkForUrlChanges() {
  const newUrl = window.location.href;
  
  // If the URL has changed
  if (newUrl !== currentUrl) {
    console.log('URL changed from', currentUrl, 'to', newUrl);
    
    // Update the current URL
    currentUrl = newUrl;
    
    // Check if we're on a YouTube video page
    if (isYouTubeVideoPage()) {
      console.log('Detected navigation to a new YouTube video');
      
      // If the drawer is open, refresh the content after a short delay
      // to allow YouTube to update the DOM with the new video information
      if (isOpen) {
        console.log('Drawer is open, will refresh content after delay');
        
        // Clear any existing timeout to prevent multiple fetches
        if (window.refreshLyricsTimeout) {
          clearTimeout(window.refreshLyricsTimeout);
        }
        
        // Set a timeout to fetch lyrics after a delay
        window.refreshLyricsTimeout = setTimeout(() => {
          console.log('Refreshing lyrics after URL change delay');
          fetchLyrics();
        }, 1000); // 1 second delay
      }
    }
  }
}

// Function to check if the video has changed by comparing video IDs
function checkVideoIdChange() {
  // Get the current video ID
  const urlParams = new URLSearchParams(window.location.search);
  const currentVideoId = urlParams.get('v');
  
  // If we have a stored video ID and it's different from the current one
  if (window.lastVideoId && window.lastVideoId !== currentVideoId) {
    console.log('Video ID changed from', window.lastVideoId, 'to', currentVideoId);
    
    // If the drawer is open, refresh the content
    if (isOpen) {
      console.log('Drawer is open, will refresh content due to video ID change');
      
      // Clear any existing timeout to prevent multiple fetches
      if (window.refreshLyricsTimeout) {
        clearTimeout(window.refreshLyricsTimeout);
      }
      
      // Set a timeout to fetch lyrics after a delay
      window.refreshLyricsTimeout = setTimeout(() => {
        console.log('Refreshing lyrics after video ID change');
        fetchLyrics();
      }, 1000); // 1 second delay
    }
  }
  
  // Update the stored video ID
  window.lastVideoId = currentVideoId;
}

// Set up URL change monitoring
// Method 1: Check periodically
setInterval(checkForUrlChanges, 1000);
setInterval(checkVideoIdChange, 1000);

// Method 2: Use the History API to detect SPA navigation
const originalPushState = history.pushState;
history.pushState = function() {
  originalPushState.apply(this, arguments);
  checkForUrlChanges();
  checkVideoIdChange();
};

const originalReplaceState = history.replaceState;
history.replaceState = function() {
  originalReplaceState.apply(this, arguments);
  checkForUrlChanges();
  checkVideoIdChange();
};

// Method 3: Listen for popstate events (back/forward navigation)
window.addEventListener('popstate', () => {
  checkForUrlChanges();
  checkVideoIdChange();
});

// Method 4: Set up a mutation observer to detect changes to the video player
function setupVideoPlayerObserver() {
  // Find the video player container
  const videoPlayerContainer = document.querySelector('#movie_player') || 
                              document.querySelector('.html5-video-container');
  
  if (videoPlayerContainer) {
    console.log('Setting up mutation observer for video player');
    
    // Create a mutation observer to watch for changes to the video player
    const observer = new MutationObserver((mutations) => {
      // Check if the video has changed
      checkVideoIdChange();
    });
    
    // Start observing the video player
    observer.observe(videoPlayerContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src']
    });
  } else {
    console.log('Video player container not found, will retry setup');
    
    // Retry setup after a delay
    setTimeout(setupVideoPlayerObserver, 1000);
  }
}

// Initialize the video player observer
setupVideoPlayerObserver();

// Add styles for the lyrics display
const lyricsStyles = document.createElement('style');
lyricsStyles.textContent = `
  .right-drawer {
    position: fixed;
    top: 0;
    right: -100%;
    width: 400px;
    height: 100vh;
    background: linear-gradient(to bottom, #4a90e2, #357abd);
    transition: right 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 10000;
    border-radius: 12px 0 0 12px;
    box-shadow: -2px 0 10px rgba(0, 0, 0, 0.2);
    box-sizing: border-box;
  }

  .right-drawer.open {
    right: 0;
  }

  .drawer-handle {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    height: 100px;
    width: 8px;
    cursor: ew-resize;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 12px 0 0 12px;
    transition: background 0.3s ease;
  }

  .drawer-handle:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .close-button {
    position: absolute;
    top: 35px;
    right: 15px;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    transition: background 0.3s ease, transform 0.3s ease;
  }

  .close-button:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: scale(1.1);
  }

  .drawer-content {
    padding: 80px 25px 20px 25px;
    color: white;
    font-family: Arial, sans-serif;
    height: 100%;
    overflow-y: auto;
    opacity: 0;
    transition: opacity 0.4s ease;
    box-sizing: border-box;
  }

  .right-drawer.open .drawer-content {
    opacity: 1;
  }

  .lyrics-container {
    display: flex;
    flex-direction: column;
    height: auto;
    min-height: calc(100% - 80px);
  }
  
  .song-info {
    margin-bottom: 25px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    padding-bottom: 20px;
  }
  
  .song-title {
    font-size: 24px;
    margin: 0 0 10px 0;
    font-weight: 700;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }
  
  .song-artist {
    font-size: 18px;
    margin: 0 0 10px 0;
    font-weight: 400;
    opacity: 0.9;
  }
  
  .lyrics-content {
    flex: 1;
    line-height: 1.6;
    padding-right: 5px;
    overflow-y: visible;
  }
  
  .lyrics-content p {
    margin: 0 0 8px 0;
  }
  
  .loading {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    font-size: 18px;
    padding-top: 40px;
  }
  
  .error {
    color: #ff6b6b;
    padding: 20px;
    text-align: center;
    font-size: 16px;
    margin-top: 40px;
  }
`;

document.head.appendChild(lyricsStyles); 