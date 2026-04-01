const axios = require('axios');

const SAAVN_API = 'https://www.jiosaavn.com/api.php';

async function searchSong(title, artist) {
  const response = await axios.get(SAAVN_API, {
    params: {
      __call: 'search.getResults',
      _format: 'json',
      _marker: '0',
      cc: 'in',
      includeMetaTags: '0',
      q: `${title} ${artist}`,
      p: 1,
      n: 10,
    },
  });

  const results = response.data?.results;
  if (!results?.length) return null;

  const artistLower = artist.toLowerCase();

  // Among songs that have lyrics, prefer an artist name match
  const withLyrics = results.filter((r) => r.has_lyrics === 'true');
  if (!withLyrics.length) return null;

  const match =
    withLyrics.find((r) =>
      r.primary_artists?.toLowerCase().includes(artistLower)
    ) || withLyrics[0];

  return {
    id: match.id,
    title: match.song,
    artist: match.primary_artists,
    album: match.album,
  };
}

async function fetchLyricsById(songId) {
  const response = await axios.get(SAAVN_API, {
    params: {
      __call: 'lyrics.getLyrics',
      ctx: 'web6dot0',
      api_version: '4',
      _format: 'json',
      _marker: '0',
      lyrics_id: songId,
    },
  });

  const raw = response.data?.lyrics;
  if (!raw) return null;

  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim() || null;
}

// Returns { song, lyrics, source } or null
async function getLyrics(title, artist) {
  const song = await searchSong(title, artist);
  if (!song) return null;

  const lyrics = await fetchLyricsById(song.id);
  if (!lyrics) return null;

  return { song, lyrics, source: 'jiosaavn' };
}

module.exports = { getLyrics };
