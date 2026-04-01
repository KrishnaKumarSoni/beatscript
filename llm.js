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

module.exports = { validateMatch, formatLyrics };
