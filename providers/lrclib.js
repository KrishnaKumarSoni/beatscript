const axios = require('axios');

const LRCLIB_API_BASE = 'https://lrclib.net/api';

// Returns { song, lyrics } or null
async function getLyrics(title, artist) {
  const response = await axios.get(`${LRCLIB_API_BASE}/search`, {
    params: { track_name: title, artist_name: artist },
  });

  const results = response.data;
  if (!results.length) return null;

  // Prefer results where artist name matches, fall back to first result
  const artistLower = artist.toLowerCase();
  const match =
    results.find((r) => r.artistName.toLowerCase().includes(artistLower)) ||
    results[0];

  // Skip instrumentals — no lyrics to return
  if (match.instrumental) return null;

  const lyrics = match.plainLyrics || null;
  if (!lyrics) return null;

  return {
    song: {
      title: match.trackName,
      artist: match.artistName,
      album: match.albumName,
      duration: match.duration,
    },
    lyrics,
    source: 'lrclib',
  };
}

module.exports = { getLyrics };
