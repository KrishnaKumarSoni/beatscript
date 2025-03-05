class BeatScriptPopup {
  constructor() {
    this.popup = null;
    this.timeout = null;
    this.loadFont();
  }

  loadFont() {
    // Add Jakarta Sans font if not already added
    if (!document.querySelector('link[href*="Plus+Jakarta+Sans"]')) {
      const link = document.createElement('link');
      link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  }

  create(message) {
    if (this.popup) {
      this.destroy();
    }

    this.popup = document.createElement('div');
    this.popup.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 16px 24px;
      background: linear-gradient(180deg, #2196F3 0%, #1976D2 100%);
      color: white;
      border-radius: 16px;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 9999;
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.3s ease-out;
    `;
    
    this.popup.textContent = message;
    document.body.appendChild(this.popup);

    // Trigger animation
    setTimeout(() => {
      this.popup.style.opacity = '1';
      this.popup.style.transform = 'translateY(0)';
    }, 100);

    // Auto-hide after 5 seconds
    this.timeout = setTimeout(() => this.destroy(), 5000);
  }

  destroy() {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    if (this.popup && this.popup.parentNode) {
      this.popup.style.opacity = '0';
      this.popup.style.transform = 'translateY(20px)';
      setTimeout(() => {
        if (this.popup && this.popup.parentNode) {
          this.popup.parentNode.removeChild(this.popup);
        }
      }, 300);
    }
  }
}

class BeatScriptManager {
  constructor() {
    this.drawer = new BeatScriptDrawer();
    this.popup = new BeatScriptPopup();
    this.isYouTubeWatch = false;
    this.lastUrl = '';
    this.isInitialized = false;
  }

  init() {
    try {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.initializeManager());
      } else {
        this.initializeManager();
      }
    } catch (error) {
      console.error('Error initializing BeatScript:', error);
    }
  }

  initializeManager() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Check initial URL and setup drawer if needed
    this.checkUrl(window.location.href, true);

    // Listen for URL changes
    this.setupUrlChangeListener();

    // Listen for extension messages
    this.setupMessageListener();

    // Notify that content script is ready
    chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' }).catch(() => {
      // Background script not ready, that's okay
      console.log('Background script not ready for message');
    });
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      try {
        switch (request.type) {
          case 'EXTENSION_RELOADED':
            this.handleExtensionReload();
            break;
          case 'TAB_UPDATED':
            if (request.url) {
              this.checkUrl(request.url);
            }
            break;
          case 'TOGGLE_DRAWER':
            this.handleDrawerToggle();
            break;
        }
        // Always send a response to prevent connection error
        sendResponse({ received: true });
      } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ error: error.message });
      }
      // Return true to indicate we'll send a response asynchronously
      return true;
    });
  }

  handleDrawerToggle() {
    if (this.isYouTubeWatch) {
      // If we're on a watch page, toggle the drawer
      if (!this.drawer) {
        this.drawer = new BeatScriptDrawer();
      }
      this.drawer.create(); // This will now toggle if already exists
    } else {
      // If not on a watch page, show message
      this.showNonWatchPageMessage();
    }
  }

  setupUrlChangeListener() {
    try {
      // Create URL change observer
      const observer = new MutationObserver(() => {
        const currentUrl = window.location.href;
        if (currentUrl !== this.lastUrl) {
          this.lastUrl = currentUrl;
          this.checkUrl(currentUrl);
        }
      });

      // Start observing title changes (for YouTube SPA navigation)
      const title = document.querySelector('title');
      if (title) {
        observer.observe(title, {
          subtree: true,
          characterData: true,
          childList: true
        });
      }

      // Listen for YouTube's navigation events
      document.addEventListener('yt-navigate-start', () => {
        // Clear current state when navigation starts
        if (this.drawer) {
          this.drawer.currentTitle = '';
          this.drawer.currentChannel = '';
        }
      });

      document.addEventListener('yt-navigate-finish', () => {
        // Small delay to ensure DOM is updated
        setTimeout(() => {
          const currentUrl = window.location.href;
          this.checkUrl(currentUrl);
          // Force update video info if on watch page
          if (currentUrl.includes('youtube.com/watch') && this.drawer) {
            this.drawer.updateVideoInfo();
          }
        }, 500);
      });

      // Handle browser history changes
      window.addEventListener('popstate', () => {
        const currentUrl = window.location.href;
        this.checkUrl(currentUrl);
        // Force update video info if on watch page
        if (currentUrl.includes('youtube.com/watch') && this.drawer) {
          this.drawer.updateVideoInfo();
        }
      });

      // Additional listener for YouTube's internal navigation
      document.addEventListener('click', (e) => {
        // Small delay to let YouTube's navigation complete
        setTimeout(() => {
          const currentUrl = window.location.href;
          if (currentUrl !== this.lastUrl) {
            this.lastUrl = currentUrl;
            this.checkUrl(currentUrl);
            // Force update video info if on watch page
            if (currentUrl.includes('youtube.com/watch') && this.drawer) {
              this.drawer.updateVideoInfo();
            }
          }
        }, 500);
      }, true);
    } catch (error) {
      console.error('Error setting up URL listener:', error);
    }
  }

  checkUrl(url, isInitial = false) {
    try {
      const isYouTubeWatch = url.includes('youtube.com/watch');
      
      if (isYouTubeWatch && !this.isYouTubeWatch) {
        // Transitioning to a watch page
        this.isYouTubeWatch = true;
        // Only auto-create drawer on URL change, not initial load
        if (!isInitial) {
          this.drawer.create();
        }
      } else if (!isYouTubeWatch && this.isYouTubeWatch) {
        // Leaving a watch page
        this.drawer.destroy();
        this.isYouTubeWatch = false;
        this.showNonWatchPageMessage();
      } else if (!isYouTubeWatch) {
        // On a non-watch page
        this.showNonWatchPageMessage();
      }
    } catch (error) {
      console.error('Error checking URL:', error);
      this.popup.create('⚠️ Something went wrong. Please refresh the page.');
    }
  }

  showNonWatchPageMessage() {
    this.popup.create('🎵 Open a YouTube video to start finding lyrics!');
  }

  handleExtensionReload() {
    // Show popup for non-watch pages
    if (!this.isYouTubeWatch) {
      this.popup.create('🔄 Extension reloaded! Please refresh the page to continue.');
      return;
    }

    // Show message in drawer if we're on a watch page
    if (this.drawer) {
      this.drawer.showReloadMessage();
    }
  }
}

// Initialize the manager
try {
  const manager = new BeatScriptManager();
  manager.init();
} catch (error) {
  console.error('Error creating BeatScript manager:', error);
}
