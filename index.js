require('dotenv').config();
const express = require('express');
const genius = require('./providers/genius');
const lrclib = require('./providers/lrclib');
const jiosaavn = require('./providers/jiosaavn');
const { validateMatch, formatLyrics, parseYouTubeMetadata } = require('./llm');

const app = express();
app.use(express.json());

// Fallback chain — add new providers here in order
const providers = [genius, lrclib, jiosaavn];

async function fetchLyrics(title, artist) {
  for (const provider of providers) {
    let result;
    try {
      result = await provider.getLyrics(title, artist);
    } catch (err) {
      console.warn(`[${provider.name || 'provider'}] fetch failed:`, err.message);
      continue;
    }

    if (!result) continue;

    // Validate the result is actually the requested song
    let validation;
    try {
      validation = await validateMatch(
        { title, artist },
        { title: result.song.title, artist: result.song.artist }
      );
    } catch (err) {
      console.warn(`[llm] validation failed:`, err.message);
      continue;
    }

    if (!validation.match) {
      console.warn(`[${result.source}] rejected — ${validation.reason}`);
      continue;
    }

    // Confirmed match — format and return
    try {
      const formatted = await formatLyrics({ title, artist }, result);
      return { ...formatted, source: result.source };
    } catch (err) {
      console.warn(`[llm] formatting failed:`, err.message);
      // Return raw result rather than nothing
      return result;
    }
  }

  return null;
}

// GET /lyrics?title=...&artist=...
app.get('/lyrics', async (req, res) => {
  const { title, artist } = req.query;
  if (!title || !artist) {
    return res.status(400).json({ error: 'title and artist query params are required' });
  }
  await handleRequest(title, artist, res);
});

// POST /lyrics  { title, artist }
app.post('/lyrics', async (req, res) => {
  const { title, artist } = req.body;
  if (!title || !artist) {
    return res.status(400).json({ error: 'title and artist are required in the request body' });
  }
  await handleRequest(title, artist, res);
});

async function handleRequest(title, artist, res) {
  try {
    const result = await fetchLyrics(title, artist);
    if (!result) {
      return res.status(404).json({ error: 'Lyrics not found across all sources' });
    }
    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Unexpected error', details: err.message });
  }
}

// POST /lyrics/youtube  { videoTitle, channelName }
app.post('/lyrics/youtube', async (req, res) => {
  const { videoTitle, channelName } = req.body;
  if (!videoTitle || !channelName) {
    return res.status(400).json({ error: 'videoTitle and channelName are required' });
  }
  try {
    const parsed = await parseYouTubeMetadata(videoTitle, channelName);
    const result = await fetchLyrics(parsed.songTitle, parsed.artistName);
    if (!result) {
      return res.status(404).json({ error: 'Lyrics not found', parsed });
    }
    res.json({ ...result, parsed });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Unexpected error', details: err.message });
  }
});

// Export for Vercel serverless; also listen locally when run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Beatscript API running on port ${PORT}`));
}

module.exports = app;
