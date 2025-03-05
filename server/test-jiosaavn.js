const { getURLJioSaavnAPI } = require('./apis/jioSaavnAPI');

// Test search string
const searchString = 'Anaadi x Sez on the Beat Nayaab Seedhe Maut';

// Test the JioSaavn API
async function testJioSaavnAPI() {
  console.log('Testing JioSaavn API with search string:', searchString);
  
  try {
    const result = await getURLJioSaavnAPI(searchString);
    
    if (!result || !result.url) {
      console.log('No results found from JioSaavn API');
    } else {
      console.log('Found result from JioSaavn API:');
      console.log(`Title: ${result.title}`);
      console.log(`Artist: ${result.artist}`);
      console.log(`URL: ${result.url}`);
      console.log(`Has Lyrics: ${result.hasLyrics}`);
    }
  } catch (error) {
    console.error('Error testing JioSaavn API:', error.message);
  }
}

// Run the test
testJioSaavnAPI(); 