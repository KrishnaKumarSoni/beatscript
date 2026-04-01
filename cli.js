require('dotenv').config();
const readline = require('readline');
const genius = require('./providers/genius');
const lrclib = require('./providers/lrclib');
const jiosaavn = require('./providers/jiosaavn');
const { validateMatch, formatLyrics } = require('./llm');

const providers = [genius, lrclib, jiosaavn];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

async function fetchLyrics(title, artist) {
  for (const provider of providers) {
    let result;
    try {
      process.stdout.write(`  trying ${provider.name || 'provider'}... `);
      result = await provider.getLyrics(title, artist);
    } catch (err) {
      console.log(`error: ${err.message}`);
      continue;
    }

    if (!result) { console.log('not found'); continue; }

    process.stdout.write(`found → validating... `);
    let validation;
    try {
      validation = await validateMatch(
        { title, artist },
        { title: result.song.title, artist: result.song.artist }
      );
    } catch (err) {
      console.log(`validation error: ${err.message}`);
      continue;
    }

    if (!validation.match) {
      console.log(`wrong song (${validation.reason})`);
      continue;
    }

    process.stdout.write(`confirmed → formatting... `);
    try {
      const formatted = await formatLyrics({ title, artist }, result);
      console.log('done\n');
      return { ...formatted, source: result.source };
    } catch (err) {
      console.log(`formatting error: ${err.message}`);
      return result;
    }
  }

  return null;
}

async function main() {
  console.log('\nBeatscript Lyrics CLI\n');

  while (true) {
    const title = (await ask('Song title (or q to quit): ')).trim();
    if (title.toLowerCase() === 'q') break;

    const artist = (await ask('Artist name: ')).trim();
    if (!title || !artist) {
      console.log('Both fields are required.\n');
      continue;
    }

    console.log('\nSearching...');
    const result = await fetchLyrics(title, artist);

    if (!result) {
      console.log('\nNo lyrics found across all sources.\n');
    } else {
      const featuring = result.featuring?.length ? ` ft. ${result.featuring.join(', ')}` : '';
      const meta = [result.album, result.duration, result.language].filter(Boolean).join(' · ');

      console.log(`\n${'─'.repeat(60)}`);
      console.log(`${result.title} — ${result.artist}${featuring}`);
      if (meta) console.log(meta);
      console.log(`via ${result.source}`);
      console.log('─'.repeat(60));
      console.log(result.lyrics);
      console.log('─'.repeat(60) + '\n');
    }
  }

  rl.close();
}

main();
