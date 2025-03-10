const axios = require('axios');

// Debug mode for detailed logging
const DEBUG_MODE = true;

// Debug logger function
function debug(...args) {
  if (DEBUG_MODE) {
    console.log('[DEBUG]', ...args);
  }
}

/**
 * Scrapes lyrics from JioSaavn using their lyrics API
 * @param {Object} songData - The song data object containing URL and songId
 * @returns {Promise<string|null>} - The lyrics as a string or null if not found
 */
async function scrapeLyricsFromJioSaavn(songData) {
  if (!songData || !songData.songId) {
    console.error('No song ID provided to JioSaavn scraper');
      throw new Error("No song ID provided to JioSaavn scraper");
  }

  // If we already know the song doesn't have lyrics, don't even try
  if (songData.hasLyrics === false) {
    console.log(`Song ${songData.songId} is known not to have lyrics in JioSaavn`);
    throw new Error("Song is known not to have lyrics in JioSaavn");
  }

  try {
    // Use the direct lyrics API endpoint
    const lyricsUrl = `https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics&ctx=web6dot0&api_version=4&_format=json&_marker=0&lyrics_id=${songData.songId}`;
    
    console.log('Fetching lyrics from JioSaavn API:', lyricsUrl);
    
    const response = await axios.get(lyricsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000 // 10 second timeout
    });

    // Check if the response indicates a failure
    if (response.data && response.data.status === 'failure') {
      console.log(`JioSaavn API returned failure: ${response.data.error?.msg || 'Unknown error'}`);
      throw new Error("JioSaavn API returned failure");
    }

    // Check if lyrics exist in the response
    if (!response.data || !response.data.lyrics) {
      console.log('No lyrics found in JioSaavn API response');
      throw new Error("No lyrics found in JioSaavn API response");
    }

    // Clean up the lyrics - replace <br> tags with newlines
    let lyrics = response.data.lyrics
      .replace(/<br>/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\t/g, '  ')
      .replace(/\\r/g, '')
      .trim();

    return lyrics;
  } catch (error) {
    console.error('Error scraping JioSaavn lyrics:', error.message);
    throw new Error("Error scraping JioSaavn lyrics");
  }
}

/**
 * Searches for songs on JioSaavn
 * @param {string} query - The search query
 * @returns {Promise<Array>} - Array of song results with metadata
 */
async function searchJioSaavn(query) {
  if (!query) {
    debug('Empty query provided to JioSaavn search');
    throw new Error("Empty query provided to JioSaavn search");
  }

  debug('Searching JioSaavn for:', query);
  
  try {
    // Encode the query for URL
    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://www.jiosaavn.com/api.php?__call=autocomplete.get&_format=json&_marker=0&cc=in&includeMetaTags=1&query=${encodedQuery}`;
    
    // Make the request
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://www.jiosaavn.com',
        'Referer': 'https://www.jiosaavn.com/'
      }
    });
    
    // Check if we have a valid response
    if (!response.data || typeof response.data !== 'string') {
      // console.log('JioSaavn search failed: Invalid response format');
      debug('JioSaavn search failed: Invalid response format');
      throw new Error("JioSaavn search failed: Invalid response format");
    }
    
    // Parse the response (JioSaavn returns a string that needs to be parsed)
    const jsonData = JSON.parse(response.data);
    
    // Check if we have song results
    if (!jsonData.songs || !jsonData.songs.data || !Array.isArray(jsonData.songs.data)) {
      // console.log('JioSaavn search: No songs found in response');
      debug('JioSaavn search: No songs found in response');
      throw new Error("JioSaavn search: No songs found in response");
    }
    
    // Extract song data
    const songs = jsonData.songs.data;
    // console.log(`JioSaavn search: Found ${songs.length} songs`);
    debug(`Found ${songs.length} songs on JioSaavn`);
    
    // Process each song to extract metadata and lyrics URL
    const processedResults = await Promise.all(
      songs.slice(0, 5).map(async (song) => {
        try {
          // Get song ID and token
          const id = song.id;
          const token = song.perma_url.split('/').pop();
          
          // console.log(`JioSaavn: Processing song ${song.title} by ${song.more_info.primary_artists}`);
          
          // Get song details
          const songDetails = await getSongDetails(id, token);
          if (!songDetails) {
            throw new Error("JioSaavn: No song details found");
          }
          
          return songDetails;
        } catch (error) {
          // console.log(`JioSaavn: Error processing song ${song.title}:`, error.message);
          debug(`Error processing song ${song.title}:`, error.message);
          throw new Error("JioSaavn: Error processing song");
        }
      })
    );
    
    // Filter out null results and return
    const validResults = processedResults.filter(result => result !== null);
    debug(`Returning ${validResults.length} valid results from JioSaavn`);
    return validResults;
    
  } catch (error) {
    console.log('JioSaavn search error:', error.message);
    throw new Error("JioSaavn search error");
  }
}

/**
 * Gets detailed information about a song from JioSaavn
 * @param {string} id - The song ID
 * @param {string} token - The song token/permalink
 * @returns {Promise<Object|null>} - Song details with lyrics if available
 */
async function getSongDetails(id, token) {
  if (!id || !token) {
    // console.log('JioSaavn: Missing song ID or token');
    throw new Error("JioSaavn: Missing song ID or token");
  }
  
  try {
    // Get song details
    const songUrl = `https://www.jiosaavn.com/api.php?__call=song.getDetails&cc=in&_marker=0%3F_marker%3D0&_format=json&pids=${id}`;
    const songResponse = await axios.get(songUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://www.jiosaavn.com',
        'Referer': 'https://www.jiosaavn.com/'
      }
    });
    
    // Parse song details
    if (!songResponse.data || typeof songResponse.data !== 'string') {
      // console.log('JioSaavn: Invalid song details response');
      throw new Error("JioSaavn: Invalid song details response");
    }
    
    const songData = JSON.parse(songResponse.data);
    if (!songData[id]) {
      // console.log('JioSaavn: Song details not found');
      throw new Error("JioSaavn: Song details not found");
    }
    
    const song = songData[id];
    // console.log('JioSaavn: Got song details for', song.title);
    
    // Get lyrics if available
    let lyrics = null;
    if (song.has_lyrics === '1') {
      try {
        const lyricsUrl = `https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics&ctx=web6dot0&api_version=4&_format=json&_marker=0%3F_marker%3D0&lyrics_id=${song.id}`;
        const lyricsResponse = await axios.get(lyricsUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://www.jiosaavn.com',
            'Referer': 'https://www.jiosaavn.com/'
          }
        });
        
        if (lyricsResponse.data && lyricsResponse.data.lyrics) {
          lyrics = lyricsResponse.data.lyrics;
          // console.log('JioSaavn: Successfully retrieved lyrics');
          debug('Successfully retrieved lyrics for:', song.title);
        }
      } catch (lyricsError) {
        // console.log('JioSaavn: Error fetching lyrics:', lyricsError.message);
        debug('Error fetching lyrics:', lyricsError.message);
      }
    } else {
      // console.log('JioSaavn: No lyrics available for this song');
      debug('No lyrics available for song:', song.title);
    }
    
    // Format the result
    return {
      title: song.title,
      artist: song.primary_artists || song.singers,
      album: song.album,
      year: song.year,
      releaseDate: song.release_date,
      duration: song.duration,
      language: song.language,
      url: song.perma_url,
      image: song.image.replace('150x150', '500x500'),
      lyrics: lyrics,
      source: 'JioSaavn'
    };
    
  } catch (error) {
    // console.log('JioSaavn: Error getting song details:', error.message);
    debug('Error getting song details:', error.message);
    throw new Error("JioSaavn: Error getting song details");
  }
}

module.exports = {
  scrapeLyricsFromJioSaavn,
  searchJioSaavn,
  getSongDetails
}; 