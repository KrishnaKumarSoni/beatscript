const axios = require('axios');

/**
 * Gets the JioSaavn song URL and metadata for a given search string
 * 
 * @param {string} searchString - Cleaned search string
 * @returns {Promise<Object|null>} Object containing song URL and metadata or null if not found
 */
async function getURLJioSaavnAPI(searchString) {
  try {
    if (!searchString) {
      console.error('Missing required parameter: searchString');
      throw new Error('Missing required parameter: searchString');
    }
    
    // Step 1: Search for the song using JioSaavn's search API
    const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&cc=in&q=${encodeURIComponent(searchString)}`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    // Check if we have search results
    if (response.data && 
        response.data.results && 
        Array.isArray(response.data.results) && 
        response.data.results.length > 0) {
      
      // Try to find a song with lyrics first
      let songWithLyrics = null;
      let firstSong = null;
      
      // Check up to the first 5 results to find a song with lyrics
      const songsToCheck = Math.min(5, response.data.results.length);
      
      for (let i = 0; i < songsToCheck; i++) {
        const song = response.data.results[i];
        if (!song.id) continue;
        
        // Save the first song as a fallback
        if (i === 0) {
          firstSong = song;
        }
        
        const detailsUrl = `https://www.jiosaavn.com/api.php?__call=song.getDetails&cc=in&_marker=0&_format=json&pids=${song.id}`;
        
        const detailsResponse = await axios.get(detailsUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        if (detailsResponse.data && detailsResponse.data[song.id]) {
          const songDetails = detailsResponse.data[song.id];
          
          // If this song has lyrics, use it
          if (songDetails.has_lyrics === "true") {
            songWithLyrics = songDetails;
            break;
          }
        }
      }
      
      // Use the song with lyrics if found, otherwise use the first song
      const songDetails = songWithLyrics || (firstSong ? response.data.results[0] : null);
      
      if (songDetails) {
        const songId = songDetails.id;
        
        // If we already have the full details from our search for lyrics, use those
        if (songWithLyrics) {
          return {
            url: songWithLyrics.perma_url || null,
            title: songWithLyrics.song || null,
            artist: songWithLyrics.primary_artists || songWithLyrics.singers || null,
            album: songWithLyrics.album || null,
            year: songWithLyrics.year || null,
            imageUrl: songWithLyrics.image || null,
            releaseDate: songWithLyrics.release_date || null,
            songId: songId,
            hasLyrics: songWithLyrics.has_lyrics === "true",
            source: 'JioSaavn'
          };
        }
        
        // Otherwise, get the details for the first song
        const detailsUrl = `https://www.jiosaavn.com/api.php?__call=song.getDetails&cc=in&_marker=0&_format=json&pids=${songId}`;
        
        const detailsResponse = await axios.get(detailsUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        if (detailsResponse.data && detailsResponse.data[songId]) {
          const songDetails = detailsResponse.data[songId];
          return {
            url: songDetails.perma_url || null,
            title: songDetails.song || null,
            artist: songDetails.primary_artists || songDetails.singers || null,
            album: songDetails.album || null,
            year: songDetails.year || null,
            imageUrl: songDetails.image || null,
            releaseDate: songDetails.release_date || null,
            songId: songId,
            hasLyrics: songDetails.has_lyrics === "true",
            source: 'JioSaavn'
          };
        }
      }
    }
    
    // No results found
    throw new Error('No results found in JioSaavn API search');
  } catch (error) {
    console.error('Error in JioSaavn API search:', error.message);
    throw new Error('Error in JioSaavn API search:', error.message);
  }
}

module.exports = {
  getURLJioSaavnAPI
}; 