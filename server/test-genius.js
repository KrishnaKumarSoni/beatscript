const { getURLGeniusAPI } = require('./apis/geniusAPI');
const config = require('./config');

// Test search string
const searchString = 'Anaadi x Sez on the Beat Nayaab Seedhe Maut';

// Test the Genius API
async function testGeniusAPI() {
  console.log('Testing Genius API with search string:', searchString);
  console.log('Using access token:', config.genius.accessToken);
  
  try {
    const results = await getURLGeniusAPI(searchString, config.genius.accessToken);
    
    if (!results || !Array.isArray(results) || results.length === 0) {
      console.log('No results found from Genius API');
    } else {
      console.log(`Found ${results.length} results from Genius API`);
      results.forEach((result, index) => {
        console.log(`\nResult #${index + 1}:`);
        console.log(`Title: ${result.title}`);
        console.log(`Artist: ${result.artist}`);
        console.log(`URL: ${result.url}`);
      });
    }
  } catch (error) {
    console.error('Error testing Genius API:', error.message);
  }
}

// Run the test
testGeniusAPI(); 