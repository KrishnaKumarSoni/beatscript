const axios = require('axios');
// const { config } = require('dotenv');
const config = require('../config');
/**
 * Gets the Genius song URLs and metadata for a given search string using the official Genius API
 * Returns top 3 most relevant results for better matching
 * 
 * @param {string} searchString - Cleaned search string
 * @param {string} accessToken - Genius API access token
 * @returns {Promise<Array<Object>>} Array of objects containing song URLs and metadata (empty array if not found)
 */
async function getURLGeniusAPI(searchString) {
  accessToken = config.genius.accessToken;
  console.log("searchString from geniusAPI",searchString);
  
  if (!searchString || !accessToken) {
    console.error('Missing required parameters: searchString or accessToken');
    throw new Error('Missing required parameters: searchString or accessToken');
  }
  
  try {
    // Use the official Genius API search endpoint
    const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(searchString)}`;
    
    console.log("search url",searchUrl)
    const response = await axios.get(searchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    // Check if we have search results
    if (response.data && 
        response.data.response && 
        response.data.response.hits && 
        Array.isArray(response.data.response.hits) && 
        response.data.response.hits.length > 0) {
      
      // Get top 3 hits (or all if less than 3)
      const topHits = response.data.response.hits.slice(0, 3);
      
      // Map each hit to our metadata structure
      return topHits.map(hit => {
        const result = hit.result;
        return {
          url: result.url,
          title: result.title,
          artist: result.primary_artist ? result.primary_artist.name : null,
          artistNames: result.artist_names || null,
          releaseDate: result.release_date_for_display || null,
          imageUrl: result.song_art_image_url || null,
          language: result.language || null,
          source: 'Genius',
          // Additional metadata for better matching
          fullTitle: result.full_title || null,
          titleWithFeatured: result.title_with_featured || null,
          stats: {
            pageviews: result.stats ? result.stats.pageviews : null,
            hot: result.stats ? result.stats.hot : false
          }
        };
      });
    }
    
    // Return empty array instead of null when no results are found
    throw new Error('No results found in Genius API search');
  } catch (error) {
    console.error('Error in Genius API search:', error.message);
    // Return empty array instead of null on error
    throw new Error('Error in Genius API search:', error.message);
  }
}
// console.log(getURLGeniusAPI("tum hi ho"));
module.exports = {
  getURLGeniusAPI
}; 