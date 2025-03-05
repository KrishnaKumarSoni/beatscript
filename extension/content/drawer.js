class BeatScriptDrawer {
  constructor() {
    this.drawer = null;
    this.handle = null;
    this.closeButton = null;
    this.refreshButton = null;
    this.contentCard = null;
    this.lyricsSection = null;
    this.isResizing = false;
    this.startX = 0;
    this.startWidth = 0;
    this.minWidth = 300;
    this.maxWidth = 800;
    this.defaultWidth = 500;
    this.MARGIN = 24; // Consistent margin value
    this.currentTitle = '';
    this.currentChannel = '';
    this.loadFont();
  }

  loadFont() {
    // Add Jakarta Sans font
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }

  create() {
    // If drawer already exists, just toggle it
    if (this.drawer) {
      this.toggle();
      return;
    }

    // Create drawer container
    this.drawer = document.createElement('div');
    this.drawer.id = 'beatscript-drawer';
    this.drawer.className = 'beatscript-drawer';

    // Create fixed nav
    const nav = document.createElement('div');
    nav.className = 'drawer-nav';

    // Create scrollable content area
    const content = document.createElement('div');
    content.className = 'drawer-content';

    this.createCloseButton();
    this.createRefreshButton();
    this.createResizeHandle();
    this.createContentCard();
    this.createLyricsSection();
    
    // Add components to drawer
    nav.appendChild(this.refreshButton);
    nav.appendChild(this.closeButton);
    this.drawer.appendChild(nav);
    content.appendChild(this.contentCard);
    content.appendChild(this.lyricsSection);
    this.drawer.appendChild(content);
    this.drawer.appendChild(this.handle);
    document.body.appendChild(this.drawer);

    // Load styles
    this.loadStyles();

    // Update content immediately and set up observer
    this.updateVideoInfo();
    this.setupVideoInfoObserver();

    // Open the drawer after a short delay to ensure smooth animation
    setTimeout(() => this.open(), 100);
  }

  loadStyles() {
    // Load the drawer styles if not already loaded
    if (!document.querySelector('link[href*="drawer.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = chrome.runtime.getURL('styles/drawer.css');
      document.head.appendChild(link);
    }
  }

  createContentCard() {
    this.contentCard = document.createElement('div');
    this.contentCard.className = 'drawer-content-card';

    const titleElement = document.createElement('h2');
    titleElement.className = 'drawer-title';
    this.contentCard.appendChild(titleElement);

    const channelElement = document.createElement('div');
    channelElement.className = 'drawer-channel';
    this.contentCard.appendChild(channelElement);
  }

  createLyricsSection() {
    this.lyricsSection = document.createElement('div');
    this.lyricsSection.className = 'drawer-lyrics';
  }

  showSkeletonLoader() {
    if (!this.lyricsSection) return;

    this.lyricsSection.innerHTML = '';
    
    // Create skeleton lines
    const lines = 12; // Number of skeleton lines
    for (let i = 0; i < lines; i++) {
      const line = document.createElement('div');
      const width = i % 3 === 0 ? '70%' : '100%'; // Vary the width for visual interest
      line.style.cssText = `
        height: 16px;
        width: ${width};
        background: linear-gradient(to right, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.2) 50%, rgba(255, 255, 255, 0.1) 100%);
        margin-bottom: 12px;
        border-radius: 4px;
        animation: shimmer 2s infinite linear;
        background-size: 1000px 100%;
      `;
      this.lyricsSection.appendChild(line);
    }

    // Animate in
    requestAnimationFrame(() => {
      this.lyricsSection.style.opacity = '1';
      this.lyricsSection.style.transform = 'translateY(0)';
    });
  }

  async updateVideoInfo() {
    try {
      // Get video title
      const titleElement = document.querySelector('h1.style-scope.ytd-watch-metadata yt-formatted-string');
      const title = titleElement?.textContent?.trim() || 'Unknown Title';

      // Get channel name
      const channelElement = document.querySelector('ytd-channel-name yt-formatted-string#text a');
      const channel = channelElement?.textContent?.trim() || 'Unknown Channel';

      // Update the content card
      if (this.contentCard) {
        this.contentCard.children[0].textContent = title;
        this.contentCard.children[1].textContent = channel;
      }

      // Only fetch lyrics if title and channel are different from current
      if (title !== this.currentTitle || channel !== this.currentChannel) {
        this.currentTitle = title;
        this.currentChannel = channel;
        await this.fetchLyrics(title, channel);
      }
    } catch (error) {
      console.error('Error updating video info:', error);
    }
  }

  async fetchLyrics(title, artist) {
    try {
      // Show skeleton loader before making the API call
      this.showSkeletonLoader();

      const response = await fetch('http://localhost:3000/api/lyrics/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, artist })
      });

      const data = await response.json();

      if (data.success && data.lyrics) {
        this.updateLyrics(data);
      } else {
        this.showLyricsError(data.error || 'No lyrics found');
      }
    } catch (error) {
      console.error('Error fetching lyrics:', error);
      this.showLyricsError('Failed to fetch lyrics');
    }
  }

  updateLyrics(data) {
    if (!this.lyricsSection) return;

    // Clear loading state
    this.lyricsSection.innerHTML = '';

    // Create lyrics content
    const lyricsContent = document.createElement('div');
    lyricsContent.className = 'drawer-lyrics-content';
    lyricsContent.textContent = data.lyrics;

    // Create source badge
    const sourceBadge = document.createElement('div');
    sourceBadge.className = 'drawer-source-badge';
    sourceBadge.textContent = `Lyrics from ${data.source}`;

    this.lyricsSection.appendChild(lyricsContent);
    this.lyricsSection.appendChild(sourceBadge);

    // Animate in
    requestAnimationFrame(() => {
      this.lyricsSection.style.opacity = '1';
      this.lyricsSection.style.transform = 'translateY(0)';
    });
  }

  showLyricsError(message) {
    if (!this.lyricsSection) return;

    this.lyricsSection.innerHTML = '';
    const errorElement = document.createElement('div');
    errorElement.className = 'drawer-error';

    const emoji = document.createElement('div');
    emoji.className = 'drawer-error-emoji';
    emoji.textContent = '🎵';

    const messageText = document.createElement('div');
    messageText.className = 'drawer-error-message';
    messageText.textContent = message === 'No song URLs found from any source' ? 
      "Hmm... This doesn't seem to be a song, or we haven't found it in our sources yet!" :
      message;

    errorElement.appendChild(emoji);
    errorElement.appendChild(messageText);
    this.lyricsSection.appendChild(errorElement);

    // Animate in
    requestAnimationFrame(() => {
      this.lyricsSection.style.opacity = '1';
      this.lyricsSection.style.transform = 'translateY(0)';
    });
  }

  setupVideoInfoObserver() {
    // Create observer to watch for title/channel changes
    const observer = new MutationObserver((mutations) => {
      // Check if the title or channel has actually changed
      const titleElement = document.querySelector('h1.style-scope.ytd-watch-metadata yt-formatted-string');
      const channelElement = document.querySelector('ytd-channel-name yt-formatted-string#text a');
      
      const newTitle = titleElement?.textContent?.trim() || 'Unknown Title';
      const newChannel = channelElement?.textContent?.trim() || 'Unknown Channel';
      
      // Only update if the content has changed
      if (newTitle !== this.currentTitle || newChannel !== this.currentChannel) {
        this.currentTitle = newTitle;
        this.currentChannel = newChannel;
        this.updateVideoInfo();
      }
    });

    // Observe the video metadata container
    const metadataContainer = document.querySelector('ytd-watch-metadata');
    if (metadataContainer) {
      observer.observe(metadataContainer, {
        subtree: true,
        characterData: true,
        childList: true
      });
    }

    // Listen for YouTube's navigation events
    document.addEventListener('yt-navigate-start', () => {
      // Clear current content when navigation starts
      if (this.contentCard) {
        this.contentCard.children[0].textContent = 'Loading...';
        this.contentCard.children[1].textContent = '';
      }
      if (this.lyricsSection) {
        this.showSkeletonLoader();
      }
    });

    document.addEventListener('yt-navigate-finish', () => {
      // Small delay to ensure YouTube has updated the DOM
      setTimeout(() => {
        const currentUrl = window.location.href;
        if (currentUrl.includes('youtube.com/watch')) {
          this.updateVideoInfo();
        }
      }, 500);
    });

    // Also handle regular navigation
    window.addEventListener('popstate', () => {
      const currentUrl = window.location.href;
      if (currentUrl.includes('youtube.com/watch')) {
        setTimeout(() => this.updateVideoInfo(), 500);
      }
    });
  }

  createCloseButton() {
    this.closeButton = document.createElement('div');
    this.closeButton.className = 'drawer-close-button';
    
    const closeIcon = document.createElement('div');
    closeIcon.className = 'drawer-close-icon';
    
    const line1 = document.createElement('div');
    line1.className = 'drawer-close-line';
    
    const line2 = document.createElement('div');
    line2.className = 'drawer-close-line';
    
    closeIcon.appendChild(line1);
    closeIcon.appendChild(line2);
    this.closeButton.appendChild(closeIcon);

    // Add click handler
    this.closeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });
  }

  createRefreshButton() {
    this.refreshButton = document.createElement('div');
    this.refreshButton.className = 'drawer-refresh-button';
    
    const refreshIcon = document.createElement('div');
    refreshIcon.className = 'drawer-refresh-icon';
    
    // Add refresh SVG icon
    refreshIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
      </svg>
    `;
    
    this.refreshButton.appendChild(refreshIcon);

    // Add click handler
    this.refreshButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      // Add refreshing class for animation
      this.refreshButton.classList.add('refreshing');
      
      // Get current video info and refresh lyrics
      const titleElement = document.querySelector('h1.style-scope.ytd-watch-metadata yt-formatted-string');
      const channelElement = document.querySelector('ytd-channel-name yt-formatted-string#text a');
      
      const title = titleElement?.textContent?.trim() || 'Unknown Title';
      const channel = channelElement?.textContent?.trim() || 'Unknown Channel';
      
      // Fetch new lyrics
      await this.fetchLyrics(title, channel);
      
      // Remove refreshing class after fetch
      this.refreshButton.classList.remove('refreshing');
    });
  }

  createResizeHandle() {
    this.handle = document.createElement('div');
    this.handle.className = 'drawer-resize-handle';

    // Add resize functionality
    this.handle.addEventListener('mousedown', this.startResize.bind(this));
    document.addEventListener('mousemove', this.resize.bind(this));
    document.addEventListener('mouseup', this.stopResize.bind(this));
  }

  startResize(e) {
    this.isResizing = true;
    this.startX = e.clientX;
    this.startWidth = parseInt(this.drawer.style.width, 10);
    this.handle.style.background = 'rgba(255, 255, 255, 0.5)';
    
    // Prevent text selection while resizing
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.mozUserSelect = 'none';
  }

  resize(e) {
    if (!this.isResizing) return;

    const width = this.startWidth + (this.startX - e.clientX);
    if (width >= this.minWidth && width <= this.maxWidth) {
      this.drawer.style.width = `${width}px`;
      this.drawer.style.right = this.drawer.classList.contains('open') ? '0' : `-${width}px`;
    }
  }

  stopResize() {
    this.isResizing = false;
    this.handle.style.background = 'rgba(255, 255, 255, 0.3)';
    
    // Re-enable text selection
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    document.body.style.mozUserSelect = '';
  }

  open() {
    if (!this.drawer) return;
    this.drawer.style.right = '0';
    this.drawer.classList.add('open');
  }

  close() {
    if (!this.drawer) return;
    const width = this.drawer.style.width || `${this.defaultWidth}px`;
    this.drawer.style.right = `-${width}`;
    this.drawer.classList.remove('open');
  }

  toggle() {
    if (!this.drawer) return;
    if (this.drawer.classList.contains('open')) {
      this.close();
    } else {
      this.open();
    }
  }

  destroy() {
    if (this.drawer && this.drawer.parentNode) {
      this.drawer.parentNode.removeChild(this.drawer);
      this.drawer = null;
      this.handle = null;
      this.closeButton = null;
      this.refreshButton = null;
      this.contentCard = null;
      this.lyricsSection = null;
    }
  }

  showReloadMessage() {
    const reloadMessage = document.createElement('div');
    reloadMessage.style.cssText = `
      position: absolute;
      top: ${this.MARGIN}px;
      left: ${this.MARGIN * 3}px;
      right: ${this.MARGIN}px;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      display: flex;
      align-items: center;
      animation: slideIn 0.3s ease-out;
    `;

    const icon = document.createElement('span');
    icon.textContent = '🔄';
    icon.style.marginRight = '8px';
    
    const text = document.createElement('span');
    text.textContent = 'Extension updated! Please refresh the page to continue.';
    
    reloadMessage.appendChild(icon);
    reloadMessage.appendChild(text);
    
    if (this.drawer) {
      this.drawer.appendChild(reloadMessage);
      
      // Auto remove after 5 seconds
      setTimeout(() => {
        if (reloadMessage.parentNode === this.drawer) {
          reloadMessage.style.animation = 'slideOut 0.3s ease-in';
          setTimeout(() => {
            if (reloadMessage.parentNode === this.drawer) {
              this.drawer.removeChild(reloadMessage);
            }
          }, 300);
        }
      }, 5000);
    }
  }
}

// Add the animations to the document
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateY(0);
      opacity: 1;
    }
    to {
      transform: translateY(-100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style); 