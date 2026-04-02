const API_BASE = 'https://beatscript.vercel.app';

// ── DOM helpers ──────────────────────────────────────────────
function $(id) { return document.getElementById(id); }
function show(id) { $(id)?.classList.remove('bs-hidden'); }
function hide(id) { $(id)?.classList.add('bs-hidden'); }

// Track current video so we know when it actually changes
let currentVideoId = null;

// ── Extract YouTube video ID from current URL ─────────────────
function getVideoId() {
  const match = window.location.href.match(/[?&]v=([^&#]+)/);
  return match ? match[1] : null;
}

// ── Scrape YouTube page metadata ──────────────────────────────
function getYouTubeMeta() {
  const titleEl = document.querySelector('ytd-watch-metadata #title yt-formatted-string');
  const channelEl = document.querySelector('ytd-channel-name #text');
  return {
    videoTitle: titleEl?.getAttribute('title') || titleEl?.textContent?.trim() || null,
    channelName: channelEl?.textContent?.trim() || null,
  };
}

// ── Extract most vibrant color from thumbnail via canvas ──────
async function extractVibrantColor(imageUrl) {
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const size = 50;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(blobUrl);

        const { data } = ctx.getImageData(0, 0, size, size);
        let bestColor = [180, 180, 255];
        let bestScore = -1;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;
          const brightness = max / 255;
          const score = saturation * (1 - Math.abs(brightness - 0.55));
          if (score > bestScore) { bestScore = score; bestColor = [r, g, b]; }
        }

        resolve(bestColor);
      };
      img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(null); };
      img.src = blobUrl;
    });
  } catch {
    return null;
  }
}

// ── Apply theme CSS vars to drawer ────────────────────────────
function applyTheme(rgb) {
  const drawer = $('bs-drawer');
  if (!drawer || !rgb) return;
  const [r, g, b] = rgb;
  const tr = Math.round(r + (255 - r) * 0.45);
  const tg = Math.round(g + (255 - g) * 0.45);
  const tb = Math.round(b + (255 - b) * 0.45);
  drawer.style.setProperty('--bs-accent',      `rgb(${r},${g},${b})`);
  drawer.style.setProperty('--bs-accent-dim',  `rgba(${r},${g},${b},0.10)`);
  drawer.style.setProperty('--bs-accent-mid',  `rgba(${r},${g},${b},0.28)`);
  drawer.style.setProperty('--bs-accent-text', `rgb(${tr},${tg},${tb})`);
}

// ── Build drawer HTML (once) ──────────────────────────────────
function injectDrawer() {
  if ($('bs-drawer')) return;

  const drawer = document.createElement('div');
  drawer.id = 'bs-drawer';
  drawer.innerHTML = `
    <button id="bs-close-btn" aria-label="Close">
      <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="1" y1="1" x2="11" y2="11"/>
        <line x1="11" y1="1" x2="1" y2="11"/>
      </svg>
    </button>

    <div id="bs-loading">
      <div class="bs-spinner"></div>
      <span>finding lyrics…</span>
    </div>

    <div id="bs-error" class="bs-hidden">
      <span id="bs-error-text"></span>
      <button id="bs-retry-btn">Try again</button>
    </div>

    <div id="bs-lyrics-view" class="bs-hidden">
      <div id="bs-meta">
        <span id="bs-song-title"></span>
        <span id="bs-song-artist"></span>
        <span id="bs-song-extra"></span>
      </div>
      <pre id="bs-lyrics"></pre>
    </div>
  `;

  document.body.appendChild(drawer);
  $('bs-close-btn').addEventListener('click', () => drawer.classList.remove('bs-open'));
  $('bs-retry-btn').addEventListener('click', () => loadLyrics());
}

// ── Theme + lyrics refresh for current video ──────────────────
async function applyThumbnailTheme() {
  const videoId = getVideoId();
  if (!videoId) return;
  const color = await extractVibrantColor(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
  applyTheme(color);
}

// ── Reset drawer to loading state and re-fetch for new video ──
function onVideoChanged() {
  const videoId = getVideoId();
  if (!videoId || videoId === currentVideoId) return;
  currentVideoId = videoId;

  const drawer = $('bs-drawer');
  if (!drawer) return;

  // Always refresh theme
  applyThumbnailTheme();

  // Refresh lyrics whether drawer is open or not — reset state
  // so next open (or current open) shows fresh content
  loadLyrics();
}

// ── Fetch lyrics from API ─────────────────────────────────────
async function loadLyrics() {
  show('bs-loading');
  hide('bs-error');
  hide('bs-lyrics-view');

  const { videoTitle, channelName } = getYouTubeMeta();

  if (!videoTitle || !channelName) {
    showError('Could not read video info. Make sure you are on a YouTube video page.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/lyrics/youtube`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoTitle, channelName }),
    });

    const data = await res.json();

    if (data.notMusic) {
      showNotMusic(data.reason);
      return;
    }

    if (!res.ok || data.error) {
      showError(data.error || 'Lyrics not found for this video.');
      return;
    }

    renderLyrics(data);
  } catch (err) {
    showError('Network error — is the API up?');
  }
}

function showNotMusic(reason) {
  hide('bs-loading');
  hide('bs-lyrics-view');
  $('bs-error-text').textContent = reason || 'This video doesn\'t seem to be a song.';
  $('bs-error-text').style.color = 'rgba(255,255,255,0.3)';
  hide('bs-retry-btn');
  show('bs-error');
}

function showError(msg) {
  hide('bs-loading');
  hide('bs-lyrics-view');
  $('bs-error-text').textContent = msg;
  $('bs-error-text').style.color = '';
  show('bs-retry-btn');
  show('bs-error');
}

function renderLyrics(data) {
  hide('bs-loading');
  hide('bs-error');

  const title  = data.title  || data.song?.title  || '';
  const artist = data.artist || data.song?.artist || '';
  const featuring = data.featuring?.length ? ` ft. ${data.featuring.join(', ')}` : '';
  const extra = [data.album, data.duration, data.language].filter(Boolean).join(' · ');

  $('bs-song-title').textContent = `${title}${featuring}`;
  $('bs-song-artist').textContent = artist;
  $('bs-song-extra').textContent = extra;
  $('bs-lyrics').textContent = data.lyrics;

  show('bs-lyrics-view');
}

// ── Toggle drawer open/closed ─────────────────────────────────
function toggleDrawer() {
  injectDrawer();

  const drawer = $('bs-drawer');
  const isOpen = drawer.classList.contains('bs-open');

  if (!isOpen) {
    drawer.classList.add('bs-open');
    applyThumbnailTheme();
    // Only fetch if we don't already have lyrics for this video
    if ($('bs-lyrics-view').classList.contains('bs-hidden')) {
      loadLyrics();
    }
  } else {
    drawer.classList.remove('bs-open');
  }
}

// ── Watch for YouTube SPA navigation ─────────────────────────
// yt-navigate-finish fires when the URL changes but DOM may not
// be updated yet. yt-page-data-updated fires once the title,
// channel, and metadata are fully populated — use that for fetching.
document.addEventListener('yt-navigate-finish', () => {
  injectDrawer();
  // Reset currentVideoId so the upcoming yt-page-data-updated
  // always triggers a fresh fetch for the new video
  currentVideoId = null;
  // Show loading immediately so drawer doesn't show stale lyrics
  if ($('bs-drawer')) {
    hide('bs-lyrics-view');
    hide('bs-error');
    show('bs-loading');
    applyThumbnailTheme();
  }
});

document.addEventListener('yt-page-data-updated', () => {
  injectDrawer();
  onVideoChanged();
});

// Listen for toggle message from background.js
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'BS_TOGGLE') toggleDrawer();
});
