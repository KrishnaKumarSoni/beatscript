const axios = require('axios');
const cheerio = require('cheerio');

const GENIUS_API_BASE = 'https://api.genius.com';
const ACCESS_TOKEN = process.env.GENIUS_ACCESS_TOKEN;

async function searchSong(title, artist) {
  const query = `${title} ${artist}`;
  const response = await axios.get(`${GENIUS_API_BASE}/search`, {
    params: { q: query },
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });

  const hits = response.data.response.hits;
  if (!hits.length) return null;

  const artistLower = artist.toLowerCase();
  const match = hits.find((h) =>
    h.result.primary_artist.name.toLowerCase().includes(artistLower)
  );

  // Don't fall back to hits[0] — returning a wrong-artist song poisons the fallback chain
  if (!match) return null;

  return {
    id: match.result.id,
    title: match.result.title,
    artist: match.result.primary_artist.name,
    url: match.result.url,
    thumbnail: match.result.song_art_image_thumbnail_url,
  };
}

async function scrapeLyrics(songUrl) {
  const response = await axios.get(songUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  const $ = cheerio.load(response.data);
  const lyricsContainers = $('[data-lyrics-container="true"]');

  if (!lyricsContainers.length) return null;

  let lyrics = '';
  lyricsContainers.each((_, el) => {
    $(el).find('br').replaceWith('\n');
    $(el).find('a[href*="contributors"], .LyricsHeader, .LyricsLabel').remove();
    lyrics += $(el).text() + '\n';
  });

  lyrics = lyrics.replace(/<[^>]+>/g, '');

  const firstBracket = lyrics.indexOf('[');
  if (firstBracket > 0) {
    lyrics = lyrics.slice(firstBracket);
  }

  return lyrics.trim() || null;
}

// Returns { song, lyrics } or null
async function getLyrics(title, artist) {
  const song = await searchSong(title, artist);
  if (!song) return null;

  const lyrics = await scrapeLyrics(song.url);
  if (!lyrics) return null;

  return { song, lyrics, source: 'genius' };
}

module.exports = { getLyrics };
