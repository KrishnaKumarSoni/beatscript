// Create and inject the drawer
const drawer = document.createElement('div');
drawer.className = 'right-drawer';

const handle = document.createElement('div');
handle.className = 'drawer-handle';

const closeButton = document.createElement('button');
closeButton.className = 'close-button';
closeButton.innerHTML = '×';

// Add theme selector
const themeSelector = document.createElement('div');
themeSelector.className = 'theme-selector';

const themes = [
  { name: 'purple', class: 'theme-purple' },
  { name: 'dark', class: 'theme-dark' },
  { name: 'ocean', class: 'theme-ocean' },
  { name: 'sunset', class: 'theme-sunset' }
];

themes.forEach(theme => {
  const themeOption = document.createElement('div');
  themeOption.className = `theme-option ${theme.class}`;
  themeOption.dataset.theme = theme.name;
  themeOption.title = `${theme.name.charAt(0).toUpperCase() + theme.name.slice(1)} theme`;
  
  if (theme.name === 'purple') {
    themeOption.classList.add('active');
  }
  
  themeOption.addEventListener('click', () => {
    // Remove active class from all options
    document.querySelectorAll('.theme-option').forEach(option => {
      option.classList.remove('active');
    });
    
    // Add active class to clicked option
    themeOption.classList.add('active');
    
    // Apply theme
    applyTheme(theme.name);
  });
  
  themeSelector.appendChild(themeOption);
});

// Add font size controls
const fontSizeControl = document.createElement('div');
fontSizeControl.className = 'font-size-control';

const decreaseBtn = document.createElement('button');
decreaseBtn.className = 'font-size-btn';
decreaseBtn.innerHTML = 'A-';
decreaseBtn.title = 'Decrease font size';
decreaseBtn.addEventListener('click', () => adjustFontSize(-1));

const increaseBtn = document.createElement('button');
increaseBtn.className = 'font-size-btn';
increaseBtn.innerHTML = 'A+';
increaseBtn.title = 'Increase font size';
increaseBtn.addEventListener('click', () => adjustFontSize(1));

fontSizeControl.appendChild(decreaseBtn);
fontSizeControl.appendChild(increaseBtn);

const content = document.createElement('div');
content.className = 'drawer-content';

drawer.appendChild(handle);
drawer.appendChild(closeButton);
drawer.appendChild(themeSelector);
drawer.appendChild(fontSizeControl);
drawer.appendChild(content);
document.body.appendChild(drawer);

// Store the current URL for change detection
let currentUrl = window.location.href;

// Store current font size
let currentFontSize = 16; // Default font size

// Function to adjust font size
function adjustFontSize(change) {
  currentFontSize = Math.max(12, Math.min(24, currentFontSize + change));
  
  // Apply new font size to lyrics content
  const lyricsContent = document.querySelector('.lyrics-content');
  if (lyricsContent) {
    lyricsContent.style.fontSize = `${currentFontSize}px`;
  }
  
  // Store preference in localStorage
  try {
    localStorage.setItem('beatscript_font_size', currentFontSize);
  } catch (e) {
    console.error('Could not save font size preference:', e);
  }
}

// Function to apply theme
function applyTheme(themeName) {
  // Remove all theme classes
  drawer.classList.remove('theme-purple-active', 'theme-dark-active', 'theme-ocean-active', 'theme-sunset-active');
  
  // Add the selected theme class
  drawer.classList.add(`theme-${themeName}-active`);
  
  // Apply theme colors
  let primaryColor, secondaryColor, bgGradient;
  
  switch(themeName) {
    case 'purple':
      primaryColor = '#8a2be2';
      secondaryColor = '#a29bfe';
      bgGradient = 'linear-gradient(135deg, #0f0c29, #302b63)';
      break;
    case 'dark':
      primaryColor = '#777777';
      secondaryColor = '#aaaaaa';
      bgGradient = 'linear-gradient(135deg, #111111, #333333)';
      break;
    case 'ocean':
      primaryColor = '#26d0ce';
      secondaryColor = '#1a2980';
      bgGradient = 'linear-gradient(135deg, #1a2980, #26d0ce)';
      break;
    case 'sunset':
      primaryColor = '#ff416c';
      secondaryColor = '#ff4b2b';
      bgGradient = 'linear-gradient(135deg, #ff416c, #ff4b2b)';
      break;
    default:
      primaryColor = '#8a2be2';
      secondaryColor = '#a29bfe';
      bgGradient = 'linear-gradient(135deg, #0f0c29, #302b63)';
  }
  
  // Apply the theme colors
  drawer.style.background = bgGradient;
  
  // Update hover effects for lyrics paragraphs
  const style = document.createElement('style');
  style.id = 'theme-specific-styles';
  
  // Remove any existing theme-specific styles
  const existingStyle = document.getElementById('theme-specific-styles');
  if (existingStyle) {
    existingStyle.remove();
  }
  
  style.textContent = `
    .lyrics-content p:hover {
      color: ${primaryColor};
      border-left: 2px solid ${primaryColor};
    }
    .drawer-handle:hover {
      background: rgba(${hexToRgb(primaryColor)}, 0.6);
      box-shadow: 0 0 15px rgba(${hexToRgb(primaryColor)}, 0.4);
    }
    .close-button:hover {
      background: rgba(${hexToRgb(primaryColor)}, 0.8);
      box-shadow: 0 0 15px rgba(${hexToRgb(primaryColor)}, 0.4);
    }
    .font-size-btn:hover {
      background: rgba(${hexToRgb(primaryColor)}, 0.3);
    }
    .song-artist {
      color: ${secondaryColor};
    }
  `;
  
  document.head.appendChild(style);
  
  // Store preference in localStorage
  try {
    localStorage.setItem('beatscript_theme', themeName);
  } catch (e) {
    console.error('Could not save theme preference:', e);
  }
}

// Helper function to convert hex to rgb
function hexToRgb(hex) {
  // Remove the # if present
  hex = hex.replace('#', '');
  
  // Parse the hex values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return `${r}, ${g}, ${b}`;
}

// Load saved preferences
function loadPreferences() {
  try {
    // Load font size
    const savedFontSize = localStorage.getItem('beatscript_font_size');
    if (savedFontSize) {
      currentFontSize = parseInt(savedFontSize);
    }
    
    // Load theme
    const savedTheme = localStorage.getItem('beatscript_theme');
    if (savedTheme) {
      // Find and click the theme option
      const themeOption = document.querySelector(`.theme-option[data-theme="${savedTheme}"]`);
      if (themeOption) {
        themeOption.click();
      }
    }
  } catch (e) {
    console.error('Could not load preferences:', e);
  }
}

// Call loadPreferences after a short delay to ensure the drawer is fully created
setTimeout(loadPreferences, 100);

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
          <div class="error-icon">⚠️</div>
          <div class="error-message">This extension only works on YouTube video pages.</div>
          <div class="error-details">Navigate to a YouTube video to see lyrics.</div>
        </div>`;
      return;
    }
    
    // Show loading state
    content.innerHTML = `
      <div class="loading">
        <div class="loading-text">Finding lyrics</div>
        <div class="loading-dots"><span>.</span><span>.</span><span>.</span></div>
        <div class="loading-music-note">♪</div>
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
          <div class="error-icon">⚠️</div>
          <div class="error-message">Could not extract video title</div>
          <div class="error-details">Try refreshing the page or selecting a different video.</div>
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
          <div class="error-icon">🎵</div>
          <div class="error-message">No lyrics found for "${title}"</div>
          <div class="error-details">Try with a different song or check if this is a music video.</div>
        </div>`;
    }
  } catch (error) {
    content.innerHTML = `
      <div class="error">
        <div class="error-icon">❌</div>
        <div class="error-message">Error fetching lyrics</div>
        <div class="error-details">${error.message}</div>
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
    
    // Create HTML for the lyrics display with enhanced UI
    const lyricsHTML = `
      <div class="lyrics-container">
        <div class="song-info">
          <h2 class="song-title">${title}</h2>
          <h3 class="song-artist">${artist}</h3>
          ${releaseDate ? `<div class="release-date">Released: ${releaseDate}</div>` : ''}
        </div>
        <div class="lyrics-content" style="font-size: ${currentFontSize}px">
          ${formatLyrics(lyrics)}
        </div>
        <div class="footer">
          <div class="powered-by">BeatScript</div>
        </div>
      </div>
    `;
    
    content.innerHTML = lyricsHTML;
    
    // Add a subtle animation to the lyrics
    setTimeout(() => {
      const lyricsParagraphs = document.querySelectorAll('.lyrics-content p');
      lyricsParagraphs.forEach((p, index) => {
        p.style.opacity = '0';
        p.style.transform = 'translateY(20px)';
        p.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        
        setTimeout(() => {
          p.style.opacity = '1';
          p.style.transform = 'translateY(0)';
        }, 100 + (index * 30)); // Faster animation
      });
    }, 300);
    
  } catch (error) {
    console.error('Error displaying lyrics:', error);
    content.innerHTML = `
      <div class="error">
        <div class="error-icon">❌</div>
        <div class="error-message">Error displaying lyrics</div>
        <div class="error-details">${error.message}</div>
      </div>`;
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
    background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
    transition: right 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    z-index: 10000;
    box-shadow: -5px 0 25px rgba(0, 0, 0, 0.5);
    box-sizing: border-box;
    font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    border-left: 1px solid rgba(255, 255, 255, 0.1);
  }

  .right-drawer.open {
    right: 0;
  }

  .drawer-handle {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    height: 120px;
    width: 8px;
    cursor: ew-resize;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px 0 0 4px;
    transition: all 0.3s ease;
  }

  .drawer-handle:hover {
    background: rgba(138, 43, 226, 0.6);
    box-shadow: 0 0 15px rgba(138, 43, 226, 0.4);
    width: 10px;
  }

  .close-button {
    position: absolute;
    top: 20px;
    right: 20px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(138, 43, 226, 0.2);
    border: none;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    transition: all 0.3s ease;
    z-index: 10001;
  }

  .close-button:hover {
    background: rgba(138, 43, 226, 0.8);
    transform: rotate(90deg);
    box-shadow: 0 0 15px rgba(138, 43, 226, 0.4);
  }

  .drawer-content {
    padding: 100px 30px 30px 30px;
    color: white;
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
    min-height: calc(100% - 50px);
    position: relative;
  }

  .song-info {
    margin-bottom: 30px;
    border-bottom: 2px solid rgba(138, 43, 226, 0.3);
    padding-bottom: 20px;
    position: relative;
  }

  .song-title {
    font-size: 26px;
    margin: 0 0 12px 0;
    font-weight: 700;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    color: #fff;
    line-height: 1.3;
  }

  .song-artist {
    font-size: 18px;
    margin: 0 0 8px 0;
    font-weight: 400;
    opacity: 0.9;
    color: #a29bfe;
  }

  .release-date {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
    margin-top: 10px;
  }

  .lyrics-content {
    flex: 1;
    line-height: 1.8;
    padding-right: 10px;
    overflow-y: visible;
    font-size: 16px;
    position: relative;
  }

  .lyrics-content p {
    margin: 0 0 16px 0;
    transition: all 0.3s ease;
    position: relative;
    padding-left: 12px;
    border-left: 2px solid transparent;
  }

  .lyrics-content p:hover {
    transform: translateX(5px);
    color: #8a2be2;
    border-left: 2px solid #8a2be2;
  }

  .loading {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100%;
    padding-top: 40px;
    position: relative;
    text-align: center;
  }

  .error {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: #ff6b6b;
    padding: 30px;
    text-align: center;
    margin-top: 40px;
    background: rgba(255, 107, 107, 0.1);
    border-radius: 12px;
    border-left: 4px solid #ff6b6b;
  }

  .theme-selector {
    position: absolute;
    top: 70px;
    left: 30px;
    display: flex;
    gap: 3px;
    z-index: 100;
    opacity: 0.7;
    transition: opacity 0.3s ease;
  }

  .theme-selector:hover {
    opacity: 1;
  }

  .theme-option {
    width: 15px;
    height: 15px;
    cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.3);
    transition: all 0.2s ease;
    position: relative;
  }

  .theme-option:hover, .theme-option.active {
    transform: translateY(-2px);
  }

  .theme-option.active::after {
    content: '';
    position: absolute;
    bottom: -3px;
    left: 50%;
    transform: translateX(-50%);
    width: 5px;
    height: 2px;
    background: white;
  }

  .font-size-control {
    position: absolute;
    top: 70px;
    right: 30px;
    display: flex;
    gap: 3px;
    align-items: center;
    opacity: 0.7;
    transition: opacity 0.3s ease;
    z-index: 100;
  }

  .font-size-control:hover {
    opacity: 1;
  }

  .font-size-btn {
    width: 20px;
    height: 20px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s ease;
  }

  .font-size-btn:hover {
    background: rgba(138, 43, 226, 0.3);
    transform: translateY(-2px);
  }
`;

document.head.appendChild(lyricsStyles); 