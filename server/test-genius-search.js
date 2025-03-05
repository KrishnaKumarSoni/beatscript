/**
 * Test script to debug Genius API search results
 */

const axios = require('axios');
const config = require('./config');

// Test different search queries
const searchQueries = [
  'KARMA GOOGLE PAY',
  'KARMA GOOGLE PAY Kalamkaar',
  'KARMA - GOOGLE PAY',
  'KARMA GOOGLE PAY OFFICIAL',
  'KARMA GOOGLE PAY lyrics',
  'KARMA by Kalamkaar',
  'KARMA GOOGLE PAY KALAMKAAR lyrics'
];

async function testGeniusSearch() {
  const accessToken = config.genius.accessToken;
  
  console.log('Testing Genius API search with different queries...\n');
  
  for (const query of searchQueries) {
    console.log(`\n--- Testing search query: "${query}" ---`);
    
    try {
      // Make direct API call to Genius
      const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(query)}`;
      
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
        
        // Get top 5 hits
        const topHits = response.data.response.hits.slice(0, 5);
        
        console.log(`Found ${topHits.length} results:`);
        
        // Log each hit with relevant details
        topHits.forEach((hit, index) => {
          const result = hit.result;
          console.log(`\nResult #${index + 1}:`);
          console.log(`Title: ${result.title}`);
          console.log(`Artist: ${result.primary_artist ? result.primary_artist.name : 'Unknown'}`);
          console.log(`URL: ${result.url}`);
          console.log(`Full Title: ${result.full_title || 'N/A'}`);
          console.log(`Type: ${result.type || 'N/A'}`);
        });
      } else {
        console.log('No results found');
      }
    } catch (error) {
      console.error('Error in Genius API search:', error.message);
    }
  }
}

// Run the test
testGeniusSearch(); 