// Create and inject the drawer
const drawer = document.createElement('div');
drawer.className = 'right-drawer';

const handle = document.createElement('div');
handle.className = 'drawer-handle';

// Create button container
const buttonContainer = document.createElement('div');
buttonContainer.className = 'button-container';

// Create settings button
const settingsBtn = document.createElement('button');
settingsBtn.className = 'btn';
settingsBtn.innerHTML = '⚙️';
settingsBtn.title = 'Display Settings';

// Create font size controls
const fontSizeControl = document.createElement('div');
fontSizeControl.className = 'font-size-control';

const decreaseFontBtn = document.createElement('button');
decreaseFontBtn.className = 'btn';
decreaseFontBtn.innerHTML = 'A-';
decreaseFontBtn.title = 'Decrease font size';

const increaseFontBtn = document.createElement('button');
increaseFontBtn.className = 'btn';
increaseFontBtn.innerHTML = 'A+';
increaseFontBtn.title = 'Increase font size';

fontSizeControl.appendChild(decreaseFontBtn);
fontSizeControl.appendChild(increaseFontBtn);

// Create close button
const closeButton = document.createElement('button');
closeButton.className = 'btn';
closeButton.innerHTML = '×';
closeButton.title = 'Close';

// Add all buttons to container
buttonContainer.appendChild(settingsBtn);
buttonContainer.appendChild(fontSizeControl);
buttonContainer.appendChild(closeButton);

// Create color picker
const colorPickerContainer = document.createElement('div');
colorPickerContainer.className = 'color-picker-container';

const startColorGroup = document.createElement('div');
startColorGroup.className = 'color-input-group';
const startColorLabel = document.createElement('label');
startColorLabel.textContent = 'Start:';
const startColorInput = document.createElement('input');
startColorInput.type = 'color';
startColorInput.className = 'color-input';
startColorInput.value = '#872900';
startColorGroup.appendChild(startColorLabel);
startColorGroup.appendChild(startColorInput);

const endColorGroup = document.createElement('div');
endColorGroup.className = 'color-input-group';
const endColorLabel = document.createElement('label');
endColorLabel.textContent = 'End:';
const endColorInput = document.createElement('input');
endColorInput.type = 'color';
endColorInput.className = 'color-input';
endColorInput.value = '#f26107';
endColorGroup.appendChild(endColorLabel);
endColorGroup.appendChild(endColorInput);

colorPickerContainer.appendChild(startColorGroup);
colorPickerContainer.appendChild(endColorGroup);

// Add components to drawer
drawer.appendChild(handle);
drawer.appendChild(buttonContainer);
drawer.appendChild(colorPickerContainer);

const content = document.createElement('div');
content.className = 'drawer-content';
drawer.appendChild(content);

document.body.appendChild(drawer);

// Font size control functionality
let currentFontSize = 14; // Default font size
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 24;

decreaseFontBtn.addEventListener('click', () => {
  if (currentFontSize > MIN_FONT_SIZE) {
    currentFontSize -= 2;
    updateFontSize();
  }
});

increaseFontBtn.addEventListener('click', () => {
  if (currentFontSize < MAX_FONT_SIZE) {
    currentFontSize += 2;
    updateFontSize();
  }
});

function updateFontSize() {
  const lyricsContent = document.querySelector('.lyrics-content');
  if (lyricsContent) {
    lyricsContent.style.fontSize = `${currentFontSize}px`;
  }
}

// Store the current URL for change detection
let currentUrl = window.location.href;

// Toggle drawer
let isOpen = false;
function toggleDrawer() {
  isOpen = !isOpen;
  drawer.classList.toggle('open');
  
  // If opening the drawer, fetch lyrics
  if (isOpen) {
    fetchLyrics();
  }
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggleDrawer") {
    toggleDrawer();
  }
});

// Close button functionality
closeButton.addEventListener('click', () => {
  isOpen = false;
  drawer.classList.remove('open');
});

// Resize functionality
let isResizing = false;
let startX;
let startWidth;

handle.addEventListener('mousedown', (e) => {
  isResizing = true;
  startX = e.clientX;
  startWidth = parseInt(getComputedStyle(drawer).width, 10);
  
  // Add dragging class to prevent text selection
  document.body.classList.add('dragging');
});

document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;
  
  const width = startWidth - (e.clientX - startX);
  
  // Set min and max width constraints
  if (width > 200 && width < 800) {
    drawer.style.width = `${width}px`;
  }
});

document.addEventListener('mouseup', () => {
  isResizing = false;
  document.body.classList.remove('dragging');
});

// Function to check if we're on a YouTube video page
function isYouTubeVideoPage() {
  return window.location.hostname.includes('youtube.com') && 
         window.location.pathname.includes('/watch');
}

// Function to extract YouTube title and channel name
function extractYouTubeInfo() {
  let title = '';
  let channel = '';
  
  // Try to extract video ID from URL to ensure we're getting info for the current video
  const urlParams = new URLSearchParams(window.location.search);
  const videoId = urlParams.get('v');
  
  console.log('Extracting info for video ID:', videoId);
  
  // Extract title - using the selector from the provided HTML snippet
  const titleElement = document.querySelector('h1.style-scope.ytd-watch-metadata yt-formatted-string');
  if (titleElement) {
    title = titleElement.textContent.trim();
    console.log('Extracted title:', title);
  } else {
    console.log('Title element not found');
  }
  
  // Extract channel name - using the selector from the provided HTML snippet
  const channelElement = document.querySelector('ytd-channel-name yt-formatted-string#text a');
  if (channelElement) {
    channel = channelElement.textContent.trim();
    console.log('Extracted channel:', channel);
  } else {
    console.log('Channel element not found');
    
    // Try alternative selectors for channel name
    const altChannelElement = document.querySelector('#owner-name a');
    if (altChannelElement) {
      channel = altChannelElement.textContent.trim();
      console.log('Extracted channel from alternative selector:', channel);
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
  
  return { title, channel };
}

// Function to fetch lyrics from the backend
async function fetchLyrics() {
  try {
    // Check if we're on a YouTube video page
    if (!isYouTubeVideoPage()) {
      content.innerHTML = `
        <div class="error">
          This extension only works on YouTube video pages.
        </div>`;
      return;
    }
    
    // Show loading state
    content.innerHTML = `
      <div class="loading">
        <div class="loading-text">Finding lyrics...</div>
      </div>`;
    
    // Get the current video ID to ensure we're fetching for the right video
    const urlParams = new URLSearchParams(window.location.search);
    const currentVideoId = urlParams.get('v');
    
    // Store the current video ID to verify later
    window.currentFetchVideoId = currentVideoId;
    
    console.log('Starting lyrics fetch for video ID:', currentVideoId);
    
    const { title, channel } = extractYouTubeInfo();
    
    // Verify we're still on the same video (in case of rapid navigation)
    const newUrlParams = new URLSearchParams(window.location.search);
    const newVideoId = newUrlParams.get('v');
    
    if (newVideoId !== currentVideoId) {
      console.log('Video changed during extraction, aborting this fetch');
      return; // Abort this fetch as we've navigated to a different video
    }
    
    if (!title) {
      content.innerHTML = `
        <div class="error">
          Could not extract video title
        </div>`;
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
    
    // Make API request to the backend
    const response = await fetch('http://localhost:3000/api/lyrics/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, artist: channel }),
    });
    
    // Verify again we're still on the same video (in case of navigation during fetch)
    const finalUrlParams = new URLSearchParams(window.location.search);
    const finalVideoId = finalUrlParams.get('v');
    
    if (finalVideoId !== currentVideoId) {
      console.log('Video changed during API call, aborting this display');
      return; // Abort this display as we've navigated to a different video
    }
    
    const data = await response.json();
    console.log('Backend response for video ID:', currentVideoId, data);
    
    if (data.success && data.result) {
      // Pass the result object to displayLyrics
      displayLyrics(data.result);
    } else {
      content.innerHTML = `
        <div class="error">
          No lyrics found for "${title}"
        </div>`;
    }
  } catch (error) {
    content.innerHTML = `
      <div class="error">
        Error fetching lyrics: ${error.message}
      </div>`;
    console.error('Error fetching lyrics:', error);
  }
}

// Function to display lyrics in the drawer
function displayLyrics(result) {
  console.log('Displaying lyrics with result:', result);
  
  try {
    // Handle different possible response structures
    let title, artist, lyrics, source;
    
    if (!result) {
      throw new Error('Empty result received from backend');
    }
    
    // Extract source information (for logging only)
    source = result.source || 'Unknown Source';
    
    // Extract lyrics
    lyrics = result.lyrics || '';
    
    // Direct check for the specific structure we're seeing in the logs
    if (result.metadata && typeof result.metadata === 'object') {
      // Log all available properties to help with debugging
      console.log('Available metadata properties:', Object.keys(result.metadata));
      
      // Check if artist is directly available
      if (result.metadata.artist) {
        artist = result.metadata.artist;
        console.log('Artist found directly in metadata:', artist);
      }
      
      // Check if title is directly available
      if (result.metadata.title) {
        title = result.metadata.title;
        console.log('Title found directly in metadata:', title);
      }
      
      // If we have both title and artist, we can return early
      if (artist && title) {
        console.log('Found both title and artist directly in metadata');
      } else {
        // Otherwise, continue with the fallback logic
        
        // For artist, check multiple possible fields
        artist = artist || result.metadata.artistNames || '';
        
        // For title, use what we have or fallback
        title = title || result.metadata.title || 'Unknown Title';
        
        console.log('After checking alternative fields:', { title, artist });
        
        // Some titles from Genius have the format "Artist - Title Lyrics - Genius"
        // Let's clean that up if needed
        if (title.includes(' Lyrics - Genius')) {
          const cleanedTitle = title.replace(' Lyrics - Genius', '');
          console.log('Cleaned title from Genius format:', cleanedTitle);
          
          // If the title contains the artist name, extract just the title part
          if (cleanedTitle.includes(' - ') && !artist) {
            const parts = cleanedTitle.split(' - ');
            if (parts.length >= 2) {
              artist = parts[0].trim();
              title = parts[1].trim();
              console.log('Extracted from title-artist format:', { title, artist });
            }
          } else {
            title = cleanedTitle;
          }
        }
        
        // If we have fullTitle but no artist, try to extract artist from fullTitle
        if (result.metadata.fullTitle && !artist) {
          console.log('Trying to extract from fullTitle:', result.metadata.fullTitle);
          const fullTitleMatch = result.metadata.fullTitle.match(/^(.+) by (.+)$/);
          if (fullTitleMatch && fullTitleMatch.length === 3) {
            title = fullTitleMatch[1].trim();
            artist = fullTitleMatch[2].trim();
            console.log('Extracted from fullTitle:', { title, artist });
          }
        }
      }
      
      // If artist is still empty, try to extract from the original YouTube title
      if (!artist && window.lastYouTubeInfo) {
        console.log('Trying to extract artist from YouTube info:', window.lastYouTubeInfo);
        
        // If the YouTube title contains " - ", it might be in "Artist - Title" format
        if (window.lastYouTubeInfo.title.includes(' - ')) {
          const parts = window.lastYouTubeInfo.title.split(' - ');
          if (parts.length >= 2) {
            artist = parts[0].trim();
            console.log('Extracted artist from YouTube title:', artist);
          }
        }
        
        // If we have a channel name, use it as a fallback
        if (!artist && window.lastYouTubeInfo.channel) {
          artist = window.lastYouTubeInfo.channel;
          console.log('Using YouTube channel as artist:', artist);
        }
      }
      
      // Final fallback
      if (!artist) {
        artist = 'Unknown Artist';
      }
    } else {
      // Fallback to direct properties if metadata is not available
      console.log('No metadata found, using direct properties');
      title = result.title || 'Unknown Title';
      artist = result.artist || 'Unknown Artist';
    }
    
    console.log('Final extracted song info:', { title, artist, source, lyricsLength: lyrics?.length || 0 });
    
    // Get release date if available
    const releaseDate = result.metadata && result.metadata.releaseDate ? result.metadata.releaseDate : '';
    
    // Create HTML for the lyrics display with simplified UI
    const lyricsHTML = `
      <div class="lyrics-container">
        <div class="song-info">
          <h2 class="song-title">${title}</h2>
          <h3 class="song-artist">${artist}</h3>
          ${releaseDate ? `<div class="release-date">Released: ${releaseDate}</div>` : ''}
        </div>
        <div class="lyrics-content">
          ${formatLyrics(lyrics)}
        </div>
        <div class="footer">
          <div class="powered-by">BeatScript</div>
        </div>
      </div>
    `;
    
    content.innerHTML = lyricsHTML;
    
  } catch (error) {
    console.error('Error displaying lyrics:', error);
    content.innerHTML = `<div class="error">Error displaying lyrics: ${error.message}</div>`;
  }
}

// Function to format lyrics with proper line breaks
function formatLyrics(lyrics) {
  if (!lyrics) return '<p>No lyrics available</p>';
  
  // Replace newlines with paragraph breaks
  return lyrics
    .split('\n')
    .map(line => line.trim() ? `<p>${line}</p>` : '<br>')
    .join('');
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
    background: linear-gradient(135deg, #111111, #222222, #333333);
    transition: right 0.3s ease;
    z-index: 10000;
    box-shadow: -2px 0 10px rgba(0, 0, 0, 0.2);
    box-sizing: border-box;
    font-family: 'Plus Jakarta Sans', Arial, sans-serif;
    border-radius: 12px 0 0 12px;
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
    width: 6px;
    cursor: ew-resize;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px 0 0 3px;
  }

  .drawer-handle:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .drawer-content {
    padding: 50px 20px 20px 20px;
    color: white;
    font-family: 'Plus Jakarta Sans', Arial, sans-serif;
    height: 100%;
    overflow-y: auto;
    opacity: 0;
    transition: opacity 0.3s ease;
    box-sizing: border-box;
  }

  .right-drawer.open .drawer-content {
    opacity: 1;
  }

  .lyrics-container {
    display: flex;
    flex-direction: column;
    height: auto;
    min-height: calc(100% - 50px);
  }
  
  .song-info {
    margin-bottom: 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    padding-bottom: 15px;
  }
  
  .song-title {
    font-size: 22px;
    margin: 0 0 10px 0;
    font-weight: 700;
  }
  
  .song-artist {
    font-size: 16px;
    margin: 0 0 5px 0;
    font-weight: 400;
    opacity: 0.8;
  }
  
  .release-date {
    font-size: 14px;
    margin-top: 5px;
    opacity: 0.7;
  }
  
  .lyrics-content {
    flex: 1;
    line-height: 1.5;
    padding-right: 5px;
    overflow-y: visible;
    font-size: ${currentFontSize}px;
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

  .font-size-control {
    position: absolute;
    top: 15px;
    right: 77px;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  
  .font-size-btn {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: bold;
  }
  
  .font-size-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

document.head.appendChild(lyricsStyles);

// Add Plus Jakarta Sans font
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';
document.head.appendChild(fontLink); 