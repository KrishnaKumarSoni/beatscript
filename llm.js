const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Step 1: Check if the provider result actually matches what was requested.
// Only passes title + artist strings — tiny token usage.
async function validateMatch(requested, returned) {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a music expert. Given a requested song and a returned song, decide if they are the same song. ' +
          'Account for transliteration variants, alternate spellings, subtitle differences like "Pt. 1", featured artists in the name, etc. ' +
          'Reply with JSON: { "match": true } or { "match": false, "reason": "..." }',
      },
      {
        role: 'user',
        content: `Requested: title="${requested.title}", artist="${requested.artist}"\nReturned: title="${returned.title}", artist="${returned.artist}"`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
  });

  const result = JSON.parse(response.choices[0].message.content);
  return result;
}

// Step 2: Clean and structure the confirmed lyrics into a standard schema.
async function formatLyrics(requested, raw) {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a music metadata expert. Given a song title, artist, and raw lyrics, return a clean structured JSON object. ' +
          'Fix encoding artifacts, normalize whitespace, and preserve section headers like [Verse], [Chorus] if present. ' +
          'Return JSON with this exact shape: ' +
          '{ "title": string, "artist": string, "featuring": string[] or [], "album": string or null, "duration": string or null, "language": string, "lyrics": string }',
      },
      {
        role: 'user',
        content: `Title: ${requested.title}\nArtist: ${requested.artist}\nSource metadata: ${JSON.stringify(raw.song)}\n\nLyrics:\n${raw.lyrics}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
  });

  return JSON.parse(response.choices[0].message.content);
}

// Parse a YouTube video title + channel name into { songTitle, artistName }
async function parseYouTubeMetadata(videoTitle, channelName) {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a music metadata expert. Given a YouTube video title and the YouTube channel name that uploaded it, ' +
          'extract the song title and artist name. ' +
          'The video title often contains both (e.g. "Artist - Song", "Song (ft. X) | Artist", "Song by Artist") — parse accordingly. ' +
          'The channel name is usually the artist or their official channel, which is a strong signal for the artist name. ' +
          'Strip anything that is not part of the actual song title: "(Official Video)", "(Lyrics)", "(Audio)", "(4K)", "ft.", featured artist annotations in brackets, etc. from the title field only — keep them in the artist field if relevant. ' +
          'Reply with JSON: { "songTitle": string, "artistName": string }',
      },
      {
        role: 'user',
        content: `YouTube video title: "${videoTitle}"\nYouTube channel name (uploader): "${channelName}"`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
  });

  return JSON.parse(response.choices[0].message.content);
}

module.exports = { validateMatch, formatLyrics, parseYouTubeMetadata };
